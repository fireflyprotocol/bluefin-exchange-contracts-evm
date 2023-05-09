import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import {
    deployAll,
    deployPerpetual,
    deployMarginMath
} from "../helpers/initializePerpetual";
import { Signer } from "ethers";
import { expectEvent, parseEvent } from "../helpers/expect";
import {
    toBigNumberStr,
    bnToString,
    ADDRESSES
} from "../../submodules/library";
import { getBlockTimestamp, mintAndDeposit } from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { FEE_POOL_ADDRESS } from "../helpers/default";
import { GuardianStatus } from "../../types";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Perpetual Contract", () => {
    let contracts: AllContracts;
    let marginMathAddress: string;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
        marginMathAddress = await deployMarginMath();
    });

    beforeEach(async () => {
        contracts = await deployAll({});
        await mintAndDeposit(
            alice,
            contracts.token,
            contracts.marginbank,
            2_000
        );
        await mintAndDeposit(bob, contracts.token, contracts.marginbank, 2_000);
    });

    describe("Initialization", () => {
        it("should revert as address of fee pool can not be zero", async () => {
            await expect(
                deployPerpetual({
                    feePool: ADDRESSES.ZERO,
                    marginMath: marginMathAddress,
                    guardian: contracts.guardian.address,
                    imr: toBigNumberStr(0.1),
                    mmr: toBigNumberStr(0.1)
                })
            ).to.be.eventually.rejectedWith("P22");
        });

        it("should revert as address of margin math contract can not be zero", async () => {
            await expect(
                deployPerpetual({
                    marginMath: ADDRESSES.ZERO,
                    feePool: FEE_POOL_ADDRESS,
                    imr: toBigNumberStr(0.1),
                    mmr: toBigNumberStr(0.1),
                    guardian: contracts.guardian.address
                })
            ).to.be.eventually.rejectedWith("P6");
        });

        it("should revert when trying to deploy perpetual contract with maintenance margin as zero", async () => {
            await expect(
                deployPerpetual({
                    marginMath: marginMathAddress,
                    feePool: FEE_POOL_ADDRESS,
                    mmr: toBigNumberStr(0),
                    guardian: contracts.guardian.address
                })
            ).to.be.eventually.rejectedWith("P27");
        });

        it("should revert when trying to deploy perpetual contract with maintenance margin > initial margin", async () => {
            await expect(
                deployPerpetual({
                    marginMath: marginMathAddress,
                    feePool: FEE_POOL_ADDRESS,
                    imr: toBigNumberStr(0.0625),
                    mmr: toBigNumberStr(0.1),
                    guardian: contracts.guardian.address
                })
            ).to.be.eventually.rejectedWith("P30");
        });

        it("should revert when trying to deploy perpetual contract with default maker fee > 25%", async () => {
            await expect(
                deployPerpetual({
                    marginMath: marginMathAddress,
                    feePool: FEE_POOL_ADDRESS,
                    guardian: contracts.guardian.address,
                    makerFee: toBigNumberStr(0.3)
                })
            ).to.be.eventually.rejectedWith("P26");
        });

        it("should revert when trying to deploy perpetual contract with default taker fee > 25%", async () => {
            await expect(
                deployPerpetual({
                    marginMath: marginMathAddress,
                    feePool: FEE_POOL_ADDRESS,
                    guardian: contracts.guardian.address,
                    takerFee: toBigNumberStr(0.3)
                })
            ).to.be.eventually.rejectedWith("P25");
        });
    });

    describe("Set Oracle", () => {
        it("should set a new oracle contract", async () => {
            // set oracle
            const txResult = await contracts.perpetual
                .connect(owner)
                .setOracle(contracts.priceOracle.address);
            await expectEvent(txResult, "PriceOracleUpdate");

            expect((await contracts.perpetual.addresses()).oracle).to.be.equal(
                contracts.priceOracle.address
            );
        });

        it("should revert when non-admin tries to update oracle", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .setOracle(contracts.priceOracle.address)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should revert when oracle price is set to zero", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(0));
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setOracle(contracts.priceOracle.address)
            ).to.eventually.be.rejectedWith("P21");
        });
    });

    describe("Guardian control", () => {
        it("should revert as only guardian contract can set trading status", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setTradingStatus(GuardianStatus.Disallowed)
            ).to.be.eventually.rejectedWith("P3");
        });
    });

    describe("Set Funder", () => {
        it("should set a new funder contract", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setFunder(contracts.funder.address);
            await expectEvent(txResult, "FundingOracleUpdate");
            expect((await contracts.perpetual.addresses()).funder).to.be.equal(
                contracts.funder.address
            );
        });

        it("should revert when non-admin tries to update funder", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .setFunder(contracts.funder.address)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Delist Perpetual", () => {
        const oraclePrice = 70;
        beforeEach(async () => {
            // set 70 as oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(oraclePrice));
        });

        it("delists market  at the oracle price", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .delistPerpetual(
                    toBigNumberStr(oraclePrice - 20),
                    toBigNumberStr(oraclePrice + 50)
                );
            await expectEvent(txResult, "PerpetualDelisted");

            expect(await contracts.perpetual.delisted()).to.be.equal(true);
        });

        it("revert when perpetual is not delisted", async () => {
            await expect(
                contracts.perpetual
                    .connect(alice)
                    .closePosition(await alice.getAddress())
            ).to.be.rejectedWith("P2");
        });

        it("should revert when caller does not have permission to withdraw after delisting", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .delistPerpetual(
                    toBigNumberStr(oraclePrice - 20),
                    toBigNumberStr(oraclePrice + 50)
                );
            await expectEvent(txResult, "PerpetualDelisted");

            await expect(
                contracts.perpetual
                    .connect(owner)
                    .closePosition(await alice.getAddress())
            ).to.be.rejectedWith("P5");
        });

        it("should revert position closure when user has no open position", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .delistPerpetual(
                    toBigNumberStr(oraclePrice - 20),
                    toBigNumberStr(oraclePrice + 50)
                );

            await expectEvent(txResult, "PerpetualDelisted");

            await expect(
                contracts.perpetual
                    .connect(bob)
                    .closePosition(await bob.getAddress())
            ).to.be.rejectedWith("P18");
        });

        it("should enable perpetual delisting when bounds are equal to oracle price", async () => {
            await contracts.perpetual
                .connect(owner)
                .delistPerpetual(
                    toBigNumberStr(oraclePrice),
                    toBigNumberStr(oraclePrice)
                );

            expect(await contracts.perpetual.delisted()).to.be.true;
        });

        it("should revert if perpetual is already delisted", async () => {
            await contracts.perpetual
                .connect(owner)
                .delistPerpetual(
                    toBigNumberStr(oraclePrice),
                    toBigNumberStr(oraclePrice)
                );

            await expect(
                contracts.perpetual
                    .connect(owner)
                    .delistPerpetual(
                        toBigNumberStr(oraclePrice),
                        toBigNumberStr(oraclePrice)
                    )
            ).to.eventually.be.rejectedWith("P1");
        });

        it("should revert if oracle price is below provided lower bound", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .delistPerpetual(
                        toBigNumberStr(oraclePrice + 10),
                        toBigNumberStr(oraclePrice + 10)
                    )
            ).to.eventually.be.rejectedWith("P19");
        });

        it("should revert if oracle price is above provided lower bound", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .delistPerpetual(
                        toBigNumberStr(oraclePrice - 10),
                        toBigNumberStr(oraclePrice - 10)
                    )
            ).to.eventually.be.rejectedWith("P20");
        });

        it("should revert it called by non-admin", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .delistPerpetual(
                        toBigNumberStr(oraclePrice),
                        toBigNumberStr(oraclePrice)
                    )
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Set FeePool", () => {
        it("should not set fee pool address with zero", async () => {
            await expect(
                contracts.perpetual.connect(owner).setFeePool(ADDRESSES.ZERO)
            ).to.eventually.be.rejectedWith("P22");
        });

        it("should update fee pool address", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setFeePool(FEE_POOL_ADDRESS);
            await expectEvent(txResult, "FeePoolUpdate");
            expect((await contracts.perpetual.addresses()).feePool).to.be.equal(
                FEE_POOL_ADDRESS
            );
        });

        it("should revert when non-admin tries to update fee pool bank address", async () => {
            await expect(
                contracts.perpetual.connect(bob).setFeePool(FEE_POOL_ADDRESS)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Fee", () => {
        it("should set default taker fee to 0.5%", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setDefaultTakerFee(toBigNumberStr(0.005));
            await expectEvent(txResult, "DefaultTakerFeeUpdate");
            expect(
                bnToString(+(await contracts.perpetual.defaultTakerFee()))
            ).to.be.equal(toBigNumberStr(0.005));
        });

        it("should set default maker fee to 0.5%", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setDefaultMakerFee(toBigNumberStr(0.005));
            await expectEvent(txResult, "DefaultMakerFeeUpdate");
            expect(
                bnToString(+(await contracts.perpetual.defaultMakerFee()))
            ).to.be.equal(toBigNumberStr(0.005));
        });

        it("should revert when trying to set default taker fee > 25%", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setDefaultTakerFee(toBigNumberStr(0.3))
            ).to.eventually.be.rejectedWith("P25");
        });

        it("should revert when trying to set default maker fee > 25%", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setDefaultMakerFee(toBigNumberStr(0.28))
            ).to.eventually.be.rejectedWith("P26");
        });

        it("should revert when non-admin tries to update market trade fee", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .setDefaultTakerFee(toBigNumberStr(0.5))
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should revert when non-admin tries to update limit trade fee", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .setDefaultMakerFee(toBigNumberStr(0.5))
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Trading Time", () => {
        it("should have trading time set to 0 by default", async () => {
            expect(+(await contracts.perpetual.tradingStartTime())).to.be.equal(
                0
            );
        });

        it("should start trading at provided timestamp", async () => {
            const startingTime = (await getBlockTimestamp()) + 10;
            const txResult = await contracts.perpetual
                .connect(owner)
                .startTrading(startingTime);
            await expectEvent(txResult, "TradingStarted");
            expect(+(await contracts.perpetual.tradingStartTime())).to.be.equal(
                startingTime
            );
        });

        it("should revert as P23", async () => {
            const startingTime = (await getBlockTimestamp()) + 10;
            await contracts.perpetual.connect(owner).startTrading(startingTime);

            await expect(
                contracts.perpetual.connect(owner).startTrading(startingTime)
            ).to.eventually.be.rejectedWith("P23");
        });

        it("should revert trading start time must be > current time", async () => {
            const startingTime = (await getBlockTimestamp()) - 10;
            await expect(
                contracts.perpetual.connect(owner).startTrading(startingTime)
            ).to.eventually.be.rejectedWith("P24");
        });

        it("should stop trading", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .stopTrading();
            await expectEvent(txResult, "TradingStopped");
            expect(+(await contracts.perpetual.tradingStartTime())).to.be.equal(
                0
            );
        });

        it("should revert when non-admin tries to start trading", async () => {
            await expect(
                contracts.perpetual.connect(bob).startTrading(1)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should revert when non-admin tries to stop trading", async () => {
            await expect(
                contracts.perpetual.connect(bob).stopTrading()
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Operators", () => {
        it("should make bob sub account for alice", async () => {
            const txResult = await contracts.perpetual
                .connect(alice)
                .setSubAccount(await bob.getAddress(), true);

            await expectEvent(txResult, "SubAccountUpdate");

            expect(
                await contracts.perpetual.getIsSubAccount(
                    await alice.getAddress(),
                    await bob.getAddress()
                )
            ).to.be.equal(true);
        });

        it("should revoke sub account rights from bob for alice account", async () => {
            await contracts.perpetual
                .connect(alice)
                .setSubAccount(await bob.getAddress(), true);

            const txResult = await contracts.perpetual
                .connect(alice)
                .setSubAccount(await bob.getAddress(), false);

            await expectEvent(txResult, "SubAccountUpdate");

            expect(
                await contracts.perpetual.getIsSubAccount(
                    await alice.getAddress(),
                    await bob.getAddress()
                )
            ).to.be.equal(false);
        });

        it("should allow bob(sub account) to adjust leverage for alice account", async () => {
            await contracts.perpetual
                .connect(alice)
                .setSubAccount(await bob.getAddress(), true);

            const txResult = await contracts.perpetual
                .connect(bob)
                .adjustLeverage(await alice.getAddress(), toBigNumberStr(2));
            await expectEvent(txResult, "AccountPositionUpdate");
        });

        it("should revert when alice tries to set her leverage to 0.9", async () => {
            await expect(
                contracts.perpetual
                    .connect(alice)
                    .adjustLeverage(
                        await alice.getAddress(),
                        toBigNumberStr(0.9)
                    )
            ).to.be.eventually.rejectedWith("P17");
        });

        it("should not allow bob(invalid operator) to adjust leverage for alice account", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .adjustLeverage(await alice.getAddress(), toBigNumberStr(2))
            ).to.be.eventually.rejectedWith("P5");
        });

        it("should allow alice(herself) to adjust leverage for alice account", async () => {
            const txResult = await contracts.perpetual
                .connect(alice)
                .adjustLeverage(await alice.getAddress(), toBigNumberStr(2));
            await expectEvent(txResult, "AccountPositionUpdate");
        });

        it("should make alice a settlement operator", async () => {
            const txResult = await contracts.perpetual.setSettlementOperator(
                await alice.getAddress(),
                true
            );

            await expectEvent(txResult, "SettlementOperatorUpdate");

            expect(
                await contracts.perpetual.settlementOperators(
                    await alice.getAddress()
                )
            ).to.be.equal(true);
        });

        it("should revert if non-admin tries to set settlement operator", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .setSettlementOperator(await alice.getAddress(), true)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should make alice a trade operator", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setTradeContract(await alice.getAddress(), true);

            await expectEvent(txResult, "TradeContractUpdate");

            expect(
                await contracts.perpetual.tradeContracts(
                    await alice.getAddress()
                )
            ).to.be.equal(true);
        });

        it("should revert if non-admin tries to set trade operator", async () => {
            await expect(
                contracts.perpetual
                    .connect(bob)
                    .setTradeContract(await alice.getAddress(), true)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Initial/Maintenance Margin", () => {
        it("should set initial Margin to 0.1", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setInitialMargin(toBigNumberStr(0.1));
            await expectEvent(txResult, "IMRUpdate");
            expect(
                bnToString(+(await contracts.perpetual.initialMarginRequired()))
            ).to.be.equal(toBigNumberStr(0.1));
        });

        it("should set maintenance Margin to 0.08", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setMaintenanceMargin(toBigNumberStr(0.08));
            await expectEvent(txResult, "MMRUpdate");
            expect(
                bnToString(
                    +(await contracts.perpetual.maintenanceMarginRequired())
                )
            ).to.be.equal(toBigNumberStr(0.08));
        });

        it("should invoke get initial margin successfully", async () => {
            const txResult = await contracts.perpetual
                .connect(owner)
                .setInitialMargin(toBigNumberStr(0.1));
            await expectEvent(txResult, "IMRUpdate");
            expect(
                bnToString(+(await contracts.perpetual.initialMarginRequired()))
            ).to.be.equal(toBigNumberStr(0.1));
        });

        it("should revert when trying to set maintenance margin > initial Margin", async () => {
            await contracts.perpetual
                .connect(owner)
                .setInitialMargin(toBigNumberStr(0.15));

            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setMaintenanceMargin(toBigNumberStr(0.16))
            ).to.eventually.be.rejectedWith("P28");
        });

        it("should revert when trying to set initial margin < maintenance Margin", async () => {
            await contracts.perpetual
                .connect(owner)
                .setMaintenanceMargin(toBigNumberStr(0.08));

            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setInitialMargin(toBigNumberStr(0.06))
            ).to.eventually.be.rejectedWith("P30");
        });

        it("should revert when trying to set initial margin as zero", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setInitialMargin(toBigNumberStr(0))
            ).to.eventually.be.rejectedWith("P29");
        });

        it("should revert when trying to set maintenance margin as zero", async () => {
            await expect(
                contracts.perpetual
                    .connect(owner)
                    .setMaintenanceMargin(toBigNumberStr(0))
            ).to.eventually.be.rejectedWith("P27");
        });

        it("should revert when non-admin tries to set maintenance margin", async () => {
            await expect(
                contracts.perpetual
                    .connect(alice)
                    .setMaintenanceMargin(toBigNumberStr(0.08))
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should revert when non-admin tries to set initial margin", async () => {
            await expect(
                contracts.perpetual
                    .connect(alice)
                    .setInitialMargin(toBigNumberStr(0.2))
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
    });

    describe("Setting off-chain funding rate", () => {
        it("only off-chain funding rate operator can set off-chain funding rate", async () => {
            await expect(
                contracts.perpetual.connect(alice).setOffChainFundingRate(1000)
            ).to.be.eventually.rejectedWith("P4");

            await contracts.perpetual
                .connect(owner)
                .setOffChainFundingRate(1000);
        });

        it("only owner can set a new off-chain funding rate operator", async () => {
            await expect(
                contracts.perpetual
                    .connect(alice)
                    .setOffChainFROperator(await bob.getAddress())
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );

            await contracts.perpetual
                .connect(owner)
                .setOffChainFROperator(await bob.getAddress());

            await contracts.perpetual.connect(bob).setOffChainFundingRate(2000);

            await expect(
                contracts.perpetual.connect(owner).setOffChainFundingRate(1000)
            ).to.be.eventually.rejectedWith("P4");
        });
    });

    describe("Deleveraging Operator", () => {
        it("should make bob deleveraging operator", async () => {
            const bobAddress = await bob.getAddress();
            const tx = await contracts.perpetual.setDeleveragingOperator(
                bobAddress
            );
            const eventData = await parseEvent(
                tx,
                "DeleveragingOperatorUpdate"
            );
            expect(eventData.operator).to.be.equal(bobAddress);
        });
    });
});
