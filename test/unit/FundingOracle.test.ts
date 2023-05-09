import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import {
    getBlockTimestamp,
    increaseBlockTime,
    moveToStartOfFirstWindow,
    mintAndDeposit,
    getExpectedTestPosition,
    toTestPositionExpect
} from "../helpers/utils";
import { FundingOracle, Guardian } from "../../artifacts/typechain";
import {
    deployFundingOracle,
    postDeployment,
    deployAll,
    deployGuardian,
    createOrderSigner
} from "../helpers/initializePerpetual";
import { Signer } from "ethers";
import { expectEvent, parseEvent } from "../helpers/expect";
import {
    toBigNumberStr,
    BigNumber,
    Balance,
    BIGNUMBER_BASE,
    toBigNumber,
    bnToString
} from "../../submodules/library";
import { createOrder, tradeByOrder } from "../helpers/order";
import { expectPosition } from "../helpers/expect";
import { GuardianStatus } from "../../types";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("FundingOracle Contract", () => {
    let oracle: FundingOracle;
    let guardianContract: Guardian;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let cat: Signer;
    let dog: Signer;

    beforeEach(async () => {
        [owner, alice, bob, cat, dog] = await hardhat.ethers.getSigners();
        guardianContract = await deployGuardian();
        oracle = await deployFundingOracle(
            await owner.getAddress(),
            guardianContract.address
        );
    });

    describe("Start/Stop", async () => {
        it("should start funding", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            const txResult = await oracle.startFunding(timestamp);
            await expectEvent(txResult, "FundingRateStart");
        });

        it("should revert as funding is already started", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);
            await expect(
                oracle.startFunding(timestamp)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: Funding is already started"
            );
        });

        it("should revert as funding timestamp must be > current block time", async () => {
            const timestamp = (await getBlockTimestamp()) - 1;
            await expect(
                oracle.startFunding(timestamp)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: Start time must be > current block time"
            );
        });

        it("should stop funding", async () => {
            const txResult = await oracle.stopFunding();
            await expectEvent(txResult, "FundingRateStop");
        });
    });

    describe("Funding Window", async () => {
        it("should return expected funding window as zero", async () => {
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(0);
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(0);
        });

        it("should return expected funding window as 1", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(1);

            await increaseBlockTime(10);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(1);
        });
    });

    describe("Record Trade", async () => {
        it("should not record trade data as funding rate is not yet started", async () => {
            await oracle.recordTrade(toBigNumberStr(10), toBigNumberStr(11));
            const fundingWindow = await oracle.currentFundingWindow();
            expect(+fundingWindow[2]).to.be.equal(0);
        });

        it("should not record trade data as timestamp < 1st funding rate window", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);
            await oracle.recordTrade(toBigNumberStr(10), toBigNumberStr(11));
            const fundingWindow = await oracle.currentFundingWindow();
            expect(+fundingWindow[2]).to.be.equal(0);
        });

        it("should record trade as 1st window of funding rate has started", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await increaseBlockTime(11);
            const expectedTLast = (await getBlockTimestamp()) + 1;

            await oracle.recordTrade(toBigNumberStr(10), toBigNumberStr(11));
            const fundingWindow = await oracle.currentFundingWindow();
            expect(+fundingWindow[1]).to.be.equal(expectedTLast);
        });

        it("should revert when non funding provider tries to record a trade", async () => {
            await expect(
                oracle
                    .connect(alice)
                    .recordTrade(toBigNumberStr(10), toBigNumberStr(11))
            ).to.eventually.be.rejectedWith(
                "FundingOracle: caller is not funding rate provider"
            );
        });
    });

    describe("Setting Funding Rate", async () => {
        it("should revert as funding rate can not be set for 0th window", async () => {
            await expect(oracle.setFundingRate()).to.be.eventually.rejectedWith(
                "FundingOracle: funding rate is not settable for 0th window"
            );
        });

        it("should not set funding rate for 1st window as the window is not yet completed", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(10);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(1);

            await expect(oracle.setFundingRate()).to.be.eventually.rejectedWith(
                "FundingOracle: funding rate is not settable for 0th window"
            );
        });

        it("should set funding rate for 1st window when its finished", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(10);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(1);

            await increaseBlockTime(3600, 1);

            expect(+(await oracle.expectedFundingWindow())).to.be.equal(2);

            const txResult = await oracle.setFundingRate();
            await expectEvent(txResult, "FundingRateUpdate");
            expect(+(await oracle.windowSet())).to.be.equal(1);
        });

        it("should revert when trying to set funding rate for 1st window twice", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(3700, 1);

            await oracle.setFundingRate();

            await expect(oracle.setFundingRate()).to.be.eventually.rejectedWith(
                "FundingOracle: funding rate for current window is already set"
            );
        });

        it("should directly set funding rate for 2nd window as 2 hours have passed", async () => {
            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(7300, 1);

            await oracle.setFundingRate();

            expect(+(await oracle.windowSet())).to.be.equal(2);
        });

        it("should revert when trying to set funding rate and on-chain funding status disabled", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            await expect(oracle.setFundingRate()).to.be.eventually.rejectedWith(
                "FundingOracle: on-chain funding rate cannot be applied at the moment"
            );
        });
    });

    describe("Guardian protection", () => {
        it("should revert as funding not allowed when guardian disabled it", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            await expect(
                oracle.connect(owner).setFundingRate()
            ).to.be.eventually.rejectedWith(
                "FundingOracle: on-chain funding rate cannot be applied at the moment"
            );
        });

        it("should return quietly when recording a trade when funding rate is turned off", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            const tx = await oracle.recordTrade(
                toBigNumberStr(10),
                toBigNumberStr(11)
            );
            const event = await parseEvent(tx, "FRTradeRecorded");
            expect(event).to.be.equal(undefined);
        });

        it("should revert as only guardian contract can set funding status", async () => {
            await expect(
                oracle
                    .connect(owner)
                    .setFundingRateStatus(GuardianStatus.Disallowed)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: caller is not the guardian contract"
            );
        });
    });

    describe("Setting off-chain Funding Rate", async () => {
        it("off-chain funding can only be set when on-chain funding is disabled", async () => {
            await expect(
                oracle.connect(owner).setOffChainFundingRate(1000)
            ).to.eventually.be.rejectedWith(
                "VM Exception while processing transaction: reverted with reason string 'FundingOracle: off-chain funding rate cannot be set while on-chain allowed'"
            );
        });

        it("off-chain funding rate can only be set by funding rate operator", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );
            await expect(
                oracle.connect(alice).setOffChainFundingRate(1000)
            ).to.eventually.be.rejectedWith(
                "FundingOracle: caller is not funding rate provider"
            );
        });

        it("should revert as off-chain funding rate can not be set for 0th window", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );
            await expect(
                oracle.setOffChainFundingRate(1000)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: funding rate is not settable for 0th window"
            );
        });

        it("should revert as off-chain funding rate should be within bound", async () => {
            let maxFunding: number = 1000000000000000;
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            await expect(
                oracle.setOffChainFundingRate(maxFunding + 1)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: off-chain funding rate exceeds max funding rate"
            );

            await expect(
                oracle.setOffChainFundingRate(-1 * (maxFunding + 1))
            ).to.be.eventually.rejectedWith(
                "FundingOracle: off-chain funding rate exceeds max funding rate"
            );
        });

        it("should not set off-chain funding rate for 1st window as the window is not yet completed", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(10);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(1);

            await expect(
                oracle.setOffChainFundingRate(1000)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: funding rate is not settable for 0th window"
            );
        });

        it("should set off-chain funding rate for 1st window when its finished", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(10);
            expect(+(await oracle.expectedFundingWindow())).to.be.equal(1);

            await increaseBlockTime(3600, 1);

            expect(+(await oracle.expectedFundingWindow())).to.be.equal(2);

            const txResult = await oracle.setOffChainFundingRate(1000);
            await expectEvent(txResult, "FundingRateUpdate");
            expect(+(await oracle.windowSet())).to.be.equal(1);
        });

        it("should revert when trying to set off-chain funding rate for 1st window twice", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(3700, 1);

            await oracle.setOffChainFundingRate(1000);

            await expect(
                oracle.setOffChainFundingRate(1000)
            ).to.be.eventually.rejectedWith(
                "FundingOracle: funding rate for current window is already set"
            );
        });

        it("should set off-chain funding rate per second correctly", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(3700, 1);

            await oracle.setOffChainFundingRate(toBigNumberStr(0.001));

            expect(+(await oracle.currentFundingRate())).to.be.equal(
                277777777777
            );
        });

        it("should directly set off-chain funding rate for 2nd window as 2 hours have passed", async () => {
            await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    oracle.address,
                    GuardianStatus.Disallowed
                );

            const timestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(timestamp);

            await moveToStartOfFirstWindow(oracle);

            await increaseBlockTime(7300, 1);

            await oracle.setOffChainFundingRate(1000);

            expect(+(await oracle.windowSet())).to.be.equal(2);
        });
    });

    describe("Funding Rate Calculation", async () => {
        it("should compute funding rates correctly after all trades", async () => {
            const trades = [
                {
                    pOracle: 100,
                    price: 100,
                    seconds: 1
                },
                {
                    pOracle: 100,
                    price: 110,
                    seconds: 900
                },
                {
                    pOracle: 100,
                    price: 120,
                    seconds: 1200
                },
                {
                    pOracle: 100,
                    price: 115,
                    seconds: 2100
                },
                {
                    pOracle: 100,
                    price: 107,
                    seconds: 2640
                },
                {
                    pOracle: 100,
                    price: 120,
                    seconds: 3000
                },
                {
                    pOracle: 100,
                    price: 121,
                    seconds: 3599
                },
                {
                    seconds: 3600,
                    setFundingRate: 0.000000278
                },
                {
                    pOracle: 102,
                    price: 115,
                    seconds: 3900
                },
                {
                    pOracle: 96,
                    price: 115,
                    seconds: 4800
                },
                {
                    pOracle: 96,
                    price: 108,
                    seconds: 5460
                },
                {
                    pOracle: 109,
                    price: 110,
                    seconds: 5880
                },
                {
                    pOracle: 100,
                    price: 100,
                    seconds: 6240
                },
                {
                    pOracle: 110,
                    price: 98,
                    seconds: 7020
                },
                {
                    seconds: 7200,
                    setFundingRate: 0.000000278
                },
                {
                    pOracle: 108,
                    price: 100,
                    seconds: 8100
                },
                {
                    pOracle: 104,
                    price: 107,
                    seconds: 8940
                },
                {
                    pOracle: 109,
                    price: 106,
                    seconds: 9420
                },
                {
                    pOracle: 98,
                    price: 114,
                    seconds: 10620
                },
                {
                    seconds: 10800,
                    setFundingRate: -0.000000278
                },
                {
                    pOracle: 105,
                    price: 105,
                    seconds: 10860
                },
                {
                    pOracle: 115,
                    price: 113,
                    seconds: 11280
                },
                {
                    pOracle: 105,
                    price: 112,
                    seconds: 11880
                },
                {
                    pOracle: 107,
                    price: 105,
                    seconds: 12300
                },
                {
                    pOracle: 111,
                    price: 105,
                    seconds: 12900
                },
                {
                    pOracle: 105,
                    price: 110,
                    seconds: 13980
                },
                {
                    seconds: 14400,
                    setFundingRate: -0.000000071
                }
            ];

            let startingTimestamp = (await getBlockTimestamp()) + 10;
            await oracle.startFunding(startingTimestamp);
            await moveToStartOfFirstWindow(oracle);

            for (const action of trades) {
                const performActionAt = startingTimestamp + action.seconds - 1;
                const currentChainTime = await getBlockTimestamp();
                await increaseBlockTime(performActionAt - currentChainTime);
                if (action.price) {
                    await oracle.recordTrade(
                        toBigNumberStr(action.price as number),
                        toBigNumberStr(action.pOracle as number)
                    );
                } else {
                    await oracle.setFundingRate();
                    const expectedFR = new BigNumber(
                        action.setFundingRate as number
                    ).toFixed(9);
                    const actualFR = new BigNumber(
                        (await oracle.currentFundingRate()).toHexString()
                    )
                        .dividedBy(1e18)
                        .toFixed(9);
                    expect(actualFR).to.be.equal(expectedFR);
                }
            }
        });

        it("should apply funding rate correctly # 1", async () => {
            const trades = [
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 1
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 110,
                    seconds: 900
                },
                {
                    actors: "A&B",
                    size: 1000,
                    leverage: 1,
                    pOracle: 100,
                    price: 120,
                    seconds: 1200,
                    expect: {
                        mro: 1.0,
                        oiOpen: 120000,
                        qPos: 1000,
                        margin: 120000,
                        marginRatio: 1,
                        bankBalance: 880000,
                        pPos: 120
                    }
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 115,
                    seconds: 1
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 107,
                    seconds: 2640
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 120,
                    seconds: 3000
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 121,
                    seconds: 3599
                },
                {
                    seconds: 3600,
                    setFundingRate: 0.001 // hourly
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 102,
                    price: 115,
                    seconds: 3900
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 115,
                    seconds: 4800
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 108,
                    seconds: 5460
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 110,
                    seconds: 5880
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 6240
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 110,
                    price: 98,
                    seconds: 7020
                },
                {
                    seconds: 7200,
                    setFundingRate: 0.001
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 100,
                    seconds: 8100
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 104,
                    price: 107,
                    seconds: 8940
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 106,
                    seconds: 9420
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 98,
                    price: 114,
                    seconds: 10620
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    seconds: 10800,
                    setFundingRate: -0.001
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 105,
                    seconds: 10860
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 115,
                    price: 113,
                    seconds: 11280
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 112,
                    seconds: 11880
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 105,
                    seconds: 12300
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 111,
                    price: 105,
                    seconds: 12900
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 110,
                    seconds: 13980
                },
                {
                    seconds: 14400,
                    setFundingRate: -0.000257317
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 104,
                    seconds: 14940
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 98,
                    seconds: 16080
                },

                {
                    actors: "A&B",
                    size: 45,
                    leverage: 1,
                    pOracle: 114,
                    price: 110,
                    seconds: 16320,
                    expect: {
                        mro: 1.0,
                        oiOpen: 124950.0,
                        qPos: 1045,
                        margin: 124847.0, // Alice funding payment: -110 -98 + 105 = -103 USDC
                        marginRatio: 0.999138714,
                        bankBalance: 875050.0,
                        pPos: 119.569
                    }
                }
            ];

            // will deploy perpetual contract with FundingOracle contract
            const contracts = await deployAll({ useRealFunder: true });

            await postDeployment(contracts, owner, { updateFRProvider: true });

            await mintAndDeposit(
                cat,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                dog,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );

            // create order signer
            const orderSigner = createOrderSigner(contracts.trader.address);

            const currentTimestamp = await getBlockTimestamp();
            const startingTimestamp =
                +(await contracts.perpetual.tradingStartTime());

            await increaseBlockTime(startingTimestamp - currentTimestamp - 1);

            for (const action of trades) {
                if (action.setFundingRate) {
                    const performActionAt =
                        startingTimestamp + action.seconds - 1;
                    const currentChainTime = await getBlockTimestamp();

                    await increaseBlockTime(performActionAt - currentChainTime);

                    await contracts.perpetual.setFundingRate();
                } else {
                    const performActionAt =
                        startingTimestamp + action.seconds - 2;
                    const currentChainTime = await getBlockTimestamp();
                    await increaseBlockTime(performActionAt - currentChainTime);

                    const oraclePrice = toBigNumber(
                        action.pOracle as any as number
                    );

                    await contracts.priceOracle
                        .connect(owner)
                        .setPrice(bnToString(oraclePrice));

                    const { curMaker, curTaker, expects } =
                        action.actors == "C&D"
                            ? { curMaker: cat, curTaker: dog, expects: false }
                            : { curMaker: alice, curTaker: bob, expects: true };

                    const order = createOrder({
                        price: action.price,
                        quantity: Math.abs(action.size as number),
                        leverage: action.leverage,
                        isBuy: (action.size as number) > 0,
                        makerAddress: await curMaker.getAddress(),
                        salt: Date.now()
                    });

                    await tradeByOrder(
                        curTaker,
                        curMaker,
                        order,
                        orderSigner,
                        contracts.perpetual
                    );

                    if (expects) {
                        const positionBalance =
                            await Balance.getPositionBalance(
                                await curMaker.getAddress(),
                                contracts.perpetual as any
                            );
                        const marginBankBalance =
                            await Balance.getMarginBankBalance(
                                await curMaker.getAddress(),
                                contracts.marginbank as any
                            );

                        const marginRatio = Balance.getMarginRatio(
                            positionBalance,
                            oraclePrice
                        );

                        const pPos = positionBalance.qPos.gt(0)
                            ? positionBalance.oiOpen
                                  .multipliedBy(BIGNUMBER_BASE)
                                  .dividedBy(positionBalance.qPos)
                            : new BigNumber("0");

                        // create expected position
                        const expectedPosition = getExpectedTestPosition(
                            action.expect
                        );

                        // perform expects
                        expectPosition(
                            expectedPosition,
                            toTestPositionExpect(
                                positionBalance,
                                pPos,
                                marginRatio,
                                marginBankBalance
                            )
                        );
                    }
                }
            }
        });

        it("should apply funding rate correctly # 2", async () => {
            const trades = [
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 1
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 110,
                    seconds: 900
                },
                {
                    actors: "A&B",
                    size: 1000,
                    leverage: 1,
                    pOracle: 100,
                    price: 120,
                    seconds: 1200,
                    expect: {
                        mro: 1,
                        oiOpen: 120000,
                        qPos: 1000,
                        margin: 120000,
                        marginRatio: 1,
                        bankBalance: 880000,
                        pPos: 120
                    }
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 115,
                    seconds: 2100
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 107,
                    seconds: 2640
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 120,
                    seconds: 3000
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 121,
                    seconds: 3599
                },
                {
                    seconds: 3600,
                    setFundingRate: 0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 102,
                    price: 115,
                    seconds: 3900
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 115,
                    seconds: 4800
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 108,
                    seconds: 5460
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 110,
                    seconds: 5880
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 6240
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 110,
                    price: 98,
                    seconds: 7020
                },
                {
                    seconds: 7200,
                    setFundingRate: 0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 100,
                    seconds: 8100
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 104,
                    price: 107,
                    seconds: 8940
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 106,
                    seconds: 9420
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 98,
                    price: 114,
                    seconds: 10620
                },
                {
                    seconds: 10800,
                    setFundingRate: -0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 105,
                    seconds: 10860
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 115,
                    price: 113,
                    seconds: 11280
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 112,
                    seconds: 11880
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 105,
                    seconds: 12300
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 111,
                    price: 105,
                    seconds: 12900
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 110,
                    seconds: 13980
                },
                {
                    seconds: 14400,
                    setFundingRate: -0.0000000715
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 104,
                    seconds: 14940
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 98,
                    seconds: 16080
                },
                {
                    actors: "A&B",
                    size: 45,
                    leverage: 1,
                    pOracle: 114,
                    price: 110,
                    seconds: 16320,
                    expect: {
                        mro: 1.0,
                        oiOpen: 124950.0,
                        qPos: 1045,
                        margin: 124847.0, // Alice funding payment: -110 -98 + 105 = -103 USDC
                        marginRatio: 0.999138714,
                        bankBalance: 875050.0,
                        pPos: 119.569
                    }
                }
            ];

            // will deploy perpetual contract with FundingOracle contract
            const contracts = await deployAll({ useRealFunder: true });

            await postDeployment(contracts, owner, { updateFRProvider: true });

            await mintAndDeposit(
                cat,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                dog,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );

            // create order signer
            const orderSigner = createOrderSigner(contracts.trader.address);

            const currentTimestamp = await getBlockTimestamp();
            const startingTimestamp =
                +(await contracts.perpetual.tradingStartTime());

            await increaseBlockTime(startingTimestamp - currentTimestamp - 1);

            for (const action of trades) {
                if (action.setFundingRate) {
                    const performActionAt =
                        startingTimestamp + action.seconds - 1;
                    const currentChainTime = await getBlockTimestamp();

                    await increaseBlockTime(performActionAt - currentChainTime);
                    await contracts.perpetual.setFundingRate();

                    const expectedFR = new BigNumber(
                        action.setFundingRate as number
                    ).toFixed(10);
                    const actualFR = new BigNumber(
                        (
                            await contracts.funder.currentFundingRate()
                        ).toHexString()
                    )
                        .dividedBy(1e18)
                        .toFixed(10);
                    expect(actualFR).to.be.equal(expectedFR);
                } else {
                    const performActionAt =
                        startingTimestamp + action.seconds - 2;
                    const currentChainTime = await getBlockTimestamp();
                    await increaseBlockTime(performActionAt - currentChainTime);
                    const oraclePrice = toBigNumber(
                        action.pOracle as any as number
                    );

                    await contracts.priceOracle
                        .connect(owner)
                        .setPrice(bnToString(oraclePrice));

                    const { curMaker, curTaker, expects } =
                        action.actors == "C&D"
                            ? { curMaker: cat, curTaker: dog, expects: false }
                            : { curMaker: alice, curTaker: bob, expects: true };

                    const order = createOrder({
                        price: action.price,
                        quantity: Math.abs(action.size as number),
                        leverage: action.leverage,
                        isBuy: (action.size as number) > 0,
                        makerAddress: await curMaker.getAddress(),
                        salt: Date.now()
                    });

                    await tradeByOrder(
                        curTaker,
                        curMaker,
                        order,
                        orderSigner,
                        contracts.perpetual
                    );

                    if (expects) {
                        const positionBalance =
                            await Balance.getPositionBalance(
                                await curMaker.getAddress(),
                                contracts.perpetual as any
                            );
                        const marginBankBalance =
                            await Balance.getMarginBankBalance(
                                await curMaker.getAddress(),
                                contracts.marginbank as any
                            );

                        const marginRatio = Balance.getMarginRatio(
                            positionBalance,
                            oraclePrice
                        );

                        const pPos = positionBalance.qPos.gt(0)
                            ? positionBalance.oiOpen
                                  .multipliedBy(BIGNUMBER_BASE)
                                  .dividedBy(positionBalance.qPos)
                            : new BigNumber("0");

                        // create expected position
                        const expectedPosition = getExpectedTestPosition(
                            action.expect
                        );

                        // perform expects
                        expectPosition(
                            expectedPosition,
                            toTestPositionExpect(
                                positionBalance,
                                pPos,
                                marginRatio,
                                marginBankBalance
                            )
                        );
                    }
                }
            }
        });

        it("should apply funding rate correctly # 3", async () => {
            const trades = [
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 99,
                    seconds: 1
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 107,
                    seconds: 751
                },
                {
                    actors: "A&B",
                    size: 1000,
                    leverage: 1,
                    pOracle: 100,
                    price: 98,
                    seconds: 1101,
                    expect: {
                        mro: 1,
                        oiOpen: 98000,
                        qPos: 1000,
                        margin: 98000,
                        marginRatio: 1,
                        bankBalance: 902000,
                        pPos: 98
                    }
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 108,
                    seconds: 2001
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 97,
                    seconds: 2641
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 3000
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 110,
                    seconds: 3599
                },
                {
                    seconds: 3600,
                    setFundingRate: 0.0000001271
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 102,
                    price: 103,
                    seconds: 4183
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 115,
                    seconds: 4742
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 103,
                    seconds: 5188
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 108,
                    seconds: 5631
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 114,
                    seconds: 6211
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 110,
                    price: 115,
                    seconds: 6808
                },
                {
                    seconds: 7384,
                    setFundingRate: 0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 106,
                    seconds: 8034
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 104,
                    price: 100,
                    seconds: 8984
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 106,
                    seconds: 9534
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 98,
                    price: 95,
                    seconds: 10334
                },
                {
                    seconds: 10853,
                    setFundingRate: -0.0000001572
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 108,
                    seconds: 11335
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 115,
                    price: 106,
                    seconds: 11933
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 104,
                    seconds: 12525
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 114,
                    seconds: 12980
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 111,
                    price: 101,
                    seconds: 13483
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 104,
                    seconds: 13904
                },
                {
                    seconds: 14405,
                    setFundingRate: -0.0000001894
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 110,
                    seconds: 14907
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 114,
                    seconds: 15350
                },
                {
                    actors: "A&B",
                    size: 45,
                    leverage: 1,
                    pOracle: 114,
                    price: 110,
                    seconds: 15781,
                    expect: {
                        mro: 1,
                        oiOpen: 102950,
                        qPos: 1045,
                        margin: 102861.2837644, // payment: -52.9041 - 94.4414 + 58.63 = -88.7162356
                        marginRatio: 0.9992553026,
                        bankBalance: 897050,
                        pPos: 98.516746
                    }
                }
            ];

            // will deploy perpetual contract with FundingOracle contract
            const contracts = await deployAll({ useRealFunder: true });

            await mintAndDeposit(
                cat,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                dog,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );

            await postDeployment(contracts, owner, { updateFRProvider: true });

            // create order signer
            const orderSigner = createOrderSigner(contracts.trader.address);

            const currentTimestamp = await getBlockTimestamp();
            const startingTimestamp =
                +(await contracts.perpetual.tradingStartTime());

            await increaseBlockTime(startingTimestamp - currentTimestamp - 1);

            for (const action of trades) {
                if (action.setFundingRate) {
                    const performActionAt =
                        startingTimestamp + action.seconds - 1;
                    const currentChainTime = await getBlockTimestamp();

                    await increaseBlockTime(performActionAt - currentChainTime);

                    await contracts.perpetual.setFundingRate();

                    const expectedFR = new BigNumber(
                        action.setFundingRate as number
                    ).toFixed(10);

                    const actualFR = new BigNumber(
                        (
                            await contracts.funder.currentFundingRate()
                        ).toHexString()
                    )
                        .dividedBy(1e18)
                        .toFixed(10);
                    expect(actualFR).to.be.equal(expectedFR);
                } else {
                    const performActionAt =
                        startingTimestamp + action.seconds - 2;
                    const currentChainTime = await getBlockTimestamp();
                    await increaseBlockTime(performActionAt - currentChainTime);

                    const oraclePrice = toBigNumber(
                        action.pOracle as any as number
                    );

                    await contracts.priceOracle
                        .connect(owner)
                        .setPrice(bnToString(oraclePrice));

                    const { curMaker, curTaker, expects } =
                        action.actors == "C&D"
                            ? { curMaker: cat, curTaker: dog, expects: false }
                            : { curMaker: alice, curTaker: bob, expects: true };

                    const order = createOrder({
                        price: action.price,
                        quantity: Math.abs(action.size as number),
                        leverage: action.leverage,
                        isBuy: (action.size as number) > 0,
                        makerAddress: await curMaker.getAddress(),
                        salt: Date.now()
                    });

                    await tradeByOrder(
                        curTaker,
                        curMaker,
                        order,
                        orderSigner,
                        contracts.perpetual
                    );

                    if (expects) {
                        const positionBalance =
                            await Balance.getPositionBalance(
                                await curMaker.getAddress(),
                                contracts.perpetual as any
                            );
                        const marginBankBalance =
                            await Balance.getMarginBankBalance(
                                await curMaker.getAddress(),
                                contracts.marginbank as any
                            );

                        const marginRatio = Balance.getMarginRatio(
                            positionBalance,
                            oraclePrice
                        );

                        const pPos = positionBalance.qPos.gt(0)
                            ? positionBalance.oiOpen
                                  .multipliedBy(BIGNUMBER_BASE)
                                  .dividedBy(positionBalance.qPos)
                            : new BigNumber("0");

                        // create expected position
                        const expectedPosition = getExpectedTestPosition(
                            action.expect
                        );

                        // perform expects
                        expectPosition(
                            expectedPosition,
                            toTestPositionExpect(
                                positionBalance,
                                pPos,
                                marginRatio,
                                marginBankBalance
                            )
                        );
                    }
                }
            }
        });

        it("should apply funding rate correctly # 4", async () => {
            const trades = [
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 1
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 110,
                    seconds: 900
                },
                {
                    actors: "A&B",
                    size: 1000,
                    leverage: 1,
                    pOracle: 100,
                    price: 120,
                    seconds: 1200,
                    expect: {
                        mro: 1,
                        oiOpen: 120000,
                        qPos: 1000,
                        margin: 120000,
                        marginRatio: 1,
                        bankBalance: 880000,
                        pPos: 120
                    }
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 115,
                    seconds: 2100
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 107,
                    seconds: 2640
                },
                {
                    actors: "A&B",
                    size: -1000,
                    leverage: 1,
                    pOracle: 100,
                    price: 120,
                    seconds: 3000
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 121,
                    seconds: 3599
                },
                {
                    seconds: 3600,
                    setFundingRate: 0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 102,
                    price: 115,
                    seconds: 3900
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 115,
                    seconds: 4800
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 96,
                    price: 108,
                    seconds: 5460
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 109,
                    price: 110,
                    seconds: 5880
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 100,
                    price: 100,
                    seconds: 6240
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 110,
                    price: 98,
                    seconds: 7020
                },
                {
                    seconds: 7200,
                    setFundingRate: 0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 100,
                    seconds: 8100
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 104,
                    price: 107,
                    seconds: 8940
                },
                {
                    actors: "A&B",
                    size: 1000,
                    leverage: 1,
                    pOracle: 109,
                    price: 106,
                    seconds: 9420
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 98,
                    price: 114,
                    seconds: 10620
                },
                {
                    seconds: 10800,
                    setFundingRate: -0.0000002778
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 105,
                    seconds: 10860
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 115,
                    price: 113,
                    seconds: 11280
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 112,
                    seconds: 11880
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 105,
                    seconds: 12300
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 111,
                    price: 105,
                    seconds: 12900
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 105,
                    price: 110,
                    seconds: 13980
                },
                {
                    seconds: 14400,
                    setFundingRate: -0.0000000715
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 108,
                    price: 104,
                    seconds: 14940
                },
                {
                    actors: "C&D",
                    size: 1,
                    leverage: 1,
                    pOracle: 107,
                    price: 98,
                    seconds: 16080
                },
                {
                    actors: "A&B",
                    size: 45,
                    leverage: 1,
                    pOracle: 114,
                    price: 110,
                    seconds: 16320,
                    expect: {
                        mro: 1,
                        oiOpen: 110950,
                        qPos: 1045,
                        margin: 110957, // // payment: -0 - 98 + 105 = +7
                        marginRatio: 1.0000609418,
                        bankBalance: 889050.0,
                        pPos: 106.172
                    }
                }
            ];

            // will deploy perpetual contract with FundingOracle contract
            const contracts = await deployAll({ useRealFunder: true });

            await postDeployment(contracts, owner, { updateFRProvider: true });

            await mintAndDeposit(
                cat,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                dog,
                contracts.token,
                contracts.marginbank,
                200_000
            );
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                1_000_000
            );

            // create order signer
            const orderSigner = createOrderSigner(contracts.trader.address);

            const currentTimestamp = await getBlockTimestamp();
            const startingTimestamp =
                +(await contracts.perpetual.tradingStartTime());

            await increaseBlockTime(startingTimestamp - currentTimestamp - 1);

            for (const action of trades) {
                if (action.setFundingRate) {
                    const performActionAt =
                        startingTimestamp + action.seconds - 1;
                    const currentChainTime = await getBlockTimestamp();

                    await increaseBlockTime(performActionAt - currentChainTime);

                    await contracts.perpetual.setFundingRate();

                    const expectedFR = new BigNumber(
                        action.setFundingRate as number
                    ).toFixed(10);

                    const actualFR = new BigNumber(
                        (await contracts.funder.getFundingRate()).toHexString()
                    )
                        .dividedBy(1e18)
                        .toFixed(10);
                    expect(actualFR).to.be.equal(expectedFR);
                } else {
                    const performActionAt =
                        startingTimestamp + action.seconds - 2;
                    const currentChainTime = await getBlockTimestamp();
                    await increaseBlockTime(performActionAt - currentChainTime);

                    const oraclePrice = toBigNumber(
                        action.pOracle as any as number
                    );
                    await contracts.priceOracle
                        .connect(owner)
                        .setPrice(bnToString(oraclePrice));

                    const { curMaker, curTaker } =
                        action.actors == "C&D"
                            ? { curMaker: cat, curTaker: dog }
                            : { curMaker: alice, curTaker: bob };

                    const expects = action.expect != undefined;

                    const order = createOrder({
                        price: action.price,
                        quantity: Math.abs(action.size as number),
                        leverage: action.leverage,
                        isBuy: (action.size as number) > 0,
                        makerAddress: await curMaker.getAddress(),
                        salt: Date.now()
                    });

                    await tradeByOrder(
                        curTaker,
                        curMaker,
                        order,
                        orderSigner,
                        contracts.perpetual
                    );

                    if (expects) {
                        const positionBalance =
                            await Balance.getPositionBalance(
                                await curMaker.getAddress(),
                                contracts.perpetual as any
                            );
                        const marginBankBalance =
                            await Balance.getMarginBankBalance(
                                await curMaker.getAddress(),
                                contracts.marginbank as any
                            );

                        const marginRatio = Balance.getMarginRatio(
                            positionBalance,
                            oraclePrice
                        );

                        const pPos = positionBalance.qPos.gt(0)
                            ? positionBalance.oiOpen
                                  .multipliedBy(BIGNUMBER_BASE)
                                  .dividedBy(positionBalance.qPos)
                            : new BigNumber("0");

                        // create expected position
                        const expectedPosition = getExpectedTestPosition(
                            action.expect
                        );

                        // perform expects
                        expectPosition(
                            expectedPosition,
                            toTestPositionExpect(
                                positionBalance,
                                pPos,
                                marginRatio,
                                marginBankBalance
                            )
                        );
                    }
                }
            }
        });
    });

    it("should updated max allowed funding rate", async () => {
        oracle.setMaxAllowedFundingRate(toBigNumberStr(0.005));
        expect(+(await oracle.maxFunding())).to.be.equal(
            Number(toBigNumberStr(0.005))
        );
    });
});
