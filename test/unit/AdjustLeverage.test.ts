import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumber,
    bnToString,
    toBigNumberStr,
    BigNumber,
    Balance,
    SigningMethod,
    BIGNUMBER_BASE,
    Trader
} from "../../submodules/library";
import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import {
    getBlockTimestamp,
    mintAndDeposit,
    moveToStartOfTrading,
    getExpectedTestPosition,
    toTestPositionExpect
} from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { OrderSigner } from "../../submodules/library";
import { createOrder } from "../helpers/order";
import { expectPosition } from "../helpers/expect";

chai.use(chaiAsPromised);
const expect = chai.expect;

// all tests assume 5% maker/taker fee, imr/mmr 6.25/5% and 2_000 dollars in maker/taker accounts
// all tests are for taker
const tests = {
    "Test # 1 - Long Position In Profit + Increase Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 120,
            leverage: 5,
            expect: {
                error: "",
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 40,
                marginRatio: 0.2,
                bankBalance: 1910,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 2 - Long Position In Loss + Increase Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 85,
            leverage: 6,
            expect: {
                error: "",
                mro: 0.166667,
                oiOpen: 1000,
                qPos: 10,
                margin: 291.666667,
                marginRatio: 0.166667,
                bankBalance: 1658.333333,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 3 - Short Position In Profit + Increase Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 85,
            leverage: 7,
            expect: {
                error: "",
                mro: 0.143,
                oiOpen: 1000,
                qPos: -10,
                margin: 0,
                marginRatio: 0.176471,
                bankBalance: 1950,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 4 - Short Position In Loss + Increase Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 120,
            leverage: 7,
            expect: {
                error: "",
                mro: 0.142857,
                oiOpen: 1000,
                qPos: -10,
                margin: 371.428571,
                marginRatio: 0.142857,
                bankBalance: 1578.571429,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 5 - Long Position In Profit + Reduce Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 120,
            leverage: 1,
            expect: {
                error: "",
                mro: 1,
                oiOpen: 1000,
                qPos: 10,
                margin: 1000,
                marginRatio: 1,
                bankBalance: 950,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 6 - Long Position In Loss + Reduce Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 85,
            leverage: 3,
            expect: {
                error: "",
                mro: 0.333333,
                oiOpen: 1000,
                qPos: 10,
                margin: 433.333333,
                marginRatio: 0.333333,
                bankBalance: 1516.666667,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 7 - Short Position In Profit + Reduce Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 85,
            leverage: 2,
            expect: {
                error: "",
                mro: 0.5,
                oiOpen: 1000,
                qPos: -10,
                margin: 275,
                marginRatio: 0.5,
                bankBalance: 1675,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 8 - Short Position In Loss + Reduce Leverage + Proceed": [
        {
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 120,
            leverage: 1,
            expect: {
                error: "",
                mro: 1,
                oiOpen: 1000,
                qPos: -10,
                margin: 1400,
                marginRatio: 1,
                bankBalance: 550,
                pPos: 100,
                fee: 100
            }
        }
    ],
    "Test # 9 - Long Position + Reduce Leverage more than Bank+ Error": [
        {
            pOracle: 100,
            price: 100,
            size: 35,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 3500,
                qPos: 35,
                margin: 875,
                marginRatio: 0.25,
                bankBalance: 950,
                pPos: 100,
                fee: 350
            }
        },
        {
            pOracle: 120,
            leverage: 1,
            expect: {
                error: "Insufficient account funds: 0x3c44cddd...fa4293bc"
            }
        }
    ],
    "Test # 10 - Short Position + Reduce Leverage more than Bank + Error": [
        {
            pOracle: 102,
            price: 100,
            size: -35,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 3500,
                qPos: -35,
                margin: 875,
                marginRatio: 0.22549,
                bankBalance: 950,
                pPos: 100,
                fee: 350
            }
        },
        {
            pOracle: 80,
            leverage: 1,
            expect: {
                error: "Insufficient account funds: 0x3c44cddd...fa4293bc"
            }
        }
    ],

    "Test # 11 - Zero Leverage + Error": [
        {
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1700,
                pPos: 100,
                fee: 100
            }
        },
        {
            pOracle: 110,
            leverage: 0,
            expect: {
                error: "P17"
            }
        }
    ]
};

describe("Adjust leverage Tests with 5% Maker/Taker Fee and 6.25%/5% IMR/MMR", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let maker: Signer;
    let taker: Signer;
    let orderSigner: OrderSigner;

    before(async () => {
        [owner, maker, taker] = await hardhat.ethers.getSigners();
    });

    const executeTests = async (testCases: Object) => {
        Object.keys(testCases).forEach((testName) => {
            describe(testName, () => {
                (testCases as any)[testName].forEach((testCase: any) => {
                    before(async () => {
                        await initState();
                    });

                    const testCaseName =
                        testCase.size && testCase.size != 0
                            ? `Alice opens size:${Math.abs(
                                  testCase.size
                              )} price:${testCase.price} leverage:${
                                  testCase.leverage
                              }x ${
                                  testCase.size < 0 ? "Long" : "Short"
                              } against Bob`
                            : `Alice adjusts leverage ${testCase.leverage}`;

                    it(testCaseName, async () => {
                        const oraclePrice = toBigNumber(testCase.pOracle);

                        // set price oracle price
                        await contracts.priceOracle
                            .connect(owner)
                            .setPrice(bnToString(oraclePrice));

                        const order = createOrder({
                            price: testCase.price,
                            quantity: Math.abs(testCase.size),
                            leverage: testCase.leverage,
                            isBuy: testCase.size < 0,
                            makerAddress: await maker.getAddress(),
                            salt: Date.now()
                        });

                        // check if trade is to be performed
                        if (testCase.size) {
                            const params = await Trader.setupNormalTrade(
                                orderSigner,
                                SigningMethod.HardhatTypedData,
                                taker,
                                maker,
                                order
                            );
                            // if no error is expected do the contract call
                            if (testCase.expect.error == "") {
                                await contracts.perpetual.trade(
                                    params.accounts,
                                    [params.data],
                                    0
                                );
                            } else {
                                // an error is expected
                                await expect(
                                    contracts.perpetual.trade(
                                        params.accounts,
                                        [params.data],
                                        0
                                    )
                                ).to.be.eventually.rejectedWith(
                                    `VM Exception while processing transaction: reverted with reason string '${testCase.expect.error}: 0x70997970...17dc79c8'`
                                );
                                return;
                            }
                        }
                        // check if margin is to be added
                        else if (testCase.leverage >= 0) {
                            if (testCase.expect.error == "") {
                                await contracts.perpetual
                                    .connect(taker)
                                    .adjustLeverage(
                                        await taker.getAddress(),
                                        toBigNumberStr(testCase.leverage)
                                    );
                            } else {
                                // an error is expected
                                await expect(
                                    contracts.perpetual
                                        .connect(taker)
                                        .adjustLeverage(
                                            await taker.getAddress(),
                                            toBigNumberStr(testCase.leverage)
                                        )
                                ).to.be.eventually.rejectedWith(
                                    `VM Exception while processing transaction: reverted with reason string '${testCase.expect.error}'`
                                );
                                return;
                            }
                        }

                        const positionBalance =
                            await Balance.getPositionBalance(
                                await taker.getAddress(),
                                contracts.perpetual as any
                            );

                        const marginBankBalance =
                            await Balance.getMarginBankBalance(
                                await taker.getAddress(),
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
                            testCase.expect
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
                    });
                });
            });
        });
    };

    async function initState() {
        contracts = await deployAll({
            makerFee: toBigNumberStr(0.05),
            takerFee: toBigNumberStr(0.05),
            imr: toBigNumberStr(0.0625),
            mmr: toBigNumberStr(0.05)
        });

        await postDeployment(contracts, owner, {});

        // // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // mints and deposits 2K token to margin bank for marker and taker
        await mintAndDeposit(
            maker,
            contracts.token,
            contracts.marginbank,
            2_000
        );
        await mintAndDeposit(
            taker,
            contracts.token,
            contracts.marginbank,
            2_000
        );

        await moveToStartOfTrading(contracts.perpetual);
    }

    executeTests(tests);
});
