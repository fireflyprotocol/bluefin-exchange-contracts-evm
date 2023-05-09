import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumberStr,
    BigNumber,
    Balance,
    Order,
    BIGNUMBER_BASE,
    toBigNumber,
    bnToString
} from "../../submodules/library";
import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import { FEE_POOL_ADDRESS, INSURANCE_POOL_ADDRESS } from "../helpers/default";

import {
    getBlockTimestamp,
    mintAndDeposit,
    moveToStartOfTrading
} from "../helpers/utils";

import { AllContracts } from "../helpers/interfaces";
import { OrderSigner } from "../../submodules/library";
import { createOrder, liqTradeByOrder, tradeByOrder } from "../helpers/order";

chai.use(chaiAsPromised);
const expect = chai.expect;

const tests = {
    "Test #1-Long Liquidation (Full) , Liquidator reduces with Loss > Margin": [
        {
            tradeType: "normal",
            pOracle: 500,
            price: 500,
            size: 10,
            leverage: 4
        },
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -14,
            leverage: 6
        },
        {
            tradeType: "liquidation",
            pOracle: 392,
            size: 10,
            leverage: 6,
            expect: {
                error: "Cannot trade when loss exceeds margin. Please add margin: 0x15d34aaf...0a2c6a65"
            }
        }
    ],
    "Test #2-Long Liquidation (Full) , Liquidator closes with Loss > Margin": [
        {
            tradeType: "normal",
            pOracle: 500,
            price: 500,
            size: 10,
            leverage: 4
        },
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 6
        },
        {
            tradeType: "liquidation",
            pOracle: 392,
            size: 10,
            leverage: 6,
            expect: {
                error: "Cannot trade when loss exceeds margin. Please add margin: 0x15d34aaf...0a2c6a65"
            }
        }
    ],

    "Test #3-Long Liquidation (Full) , Liquidator flips with Loss > Margin": [
        {
            tradeType: "normal",
            pOracle: 500,
            price: 500,
            size: 10,
            leverage: 4
        },
        {
            tradeType: "filler",

            pOracle: 100,
            price: 100,
            size: -6,
            leverage: 6
        },
        {
            tradeType: "liquidation",

            pOracle: 392,
            size: 10,
            leverage: 6,
            expect: {
                error: "Cannot trade when loss exceeds margin. Please add margin: 0x15d34aaf...0a2c6a65"
            }
        }
    ],

    "Test #4-Short Liquidation (Full) , Liquidator reduces with Loss > Margin":
        [
            {
                tradeType: "normal",

                pOracle: 500,
                price: 500,
                size: -10,
                leverage: 4
            },
            {
                tradeType: "filler",

                pOracle: 700,
                price: 700,
                size: 14,
                leverage: 10
            },
            {
                tradeType: "liquidation",

                pOracle: 598,
                size: -10,
                leverage: 10,

                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin: 0x15d34aaf...0a2c6a65"
                }
            }
        ],
    "Test #5-Short Liquidation (Full) , Liquidator closes with Loss > Margin": [
        {
            tradeType: "normal",

            pOracle: 500,
            price: 500,
            size: -10,
            leverage: 4
        },
        {
            tradeType: "filler",

            pOracle: 700,
            price: 700,
            size: 10,
            leverage: 10
        },
        {
            tradeType: "liquidation",

            pOracle: 598,
            size: -10,
            leverage: 10,
            expect: {
                error: "Cannot trade when loss exceeds margin. Please add margin: 0x15d34aaf...0a2c6a65"
            }
        }
    ],
    "Test #6-Short Liquidation (Full) , Liquidator flips with Loss > Margin": [
        {
            tradeType: "normal",

            pOracle: 500,
            price: 500,
            size: -10,
            leverage: 4
        },
        {
            tradeType: "filler",

            pOracle: 700,
            price: 700,
            size: 6,
            leverage: 10
        },
        {
            tradeType: "liquidation",

            pOracle: 598,
            size: -10,

            leverage: 10,
            expect: {
                error: "Cannot trade when loss exceeds margin. Please add margin: 0x15d34aaf...0a2c6a65"
            }
        }
    ],

    "Test #7-Long Liquidation (Full) , Liquidator increases OI (8x) - Error as Not Whitelisted":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: 1500,
                leverage: 8
            },
            {
                tradeType: "filler",
                pOracle: 100,
                price: 100,
                size: 1400,
                leverage: 8
            },
            {
                whitelist: false,
                tradeType: "liquidation",
                pOracle: 90,
                size: 1500,
                leverage: 8,
                expect: {
                    error: "OI open for selected leverage > max allowed oi open: 0x15d34aaf...0a2c6a65"
                }
            }
        ],

    "Test #8-Long Liquidation (Full) , Liquidator increases OI (8x) - Passes as whitelisted":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: 1500,
                leverage: 8
            },
            {
                tradeType: "filler",
                pOracle: 100,
                price: 100,
                size: 1400,
                leverage: 8
            },
            {
                whitelist: true,
                tradeType: "liquidation",
                pOracle: 90,
                size: 1500,
                leverage: 8,
                expect: {
                    error: false
                }
            }
        ]
};

describe("Liquidation Trades with More Loss", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let cat: Signer;
    let liquidator: Signer;
    let orderSigner: OrderSigner;
    let order: Order;

    before(async () => {
        [owner, alice, bob, cat, liquidator] =
            await hardhat.ethers.getSigners();
    });

    const executeTests = async (testCases: Object) => {
        Object.keys(testCases).forEach((testName) => {
            describe(testName, () => {
                (testCases as any)[testName].forEach((testCase: any) => {
                    before(async () => {
                        await initState();
                    });

                    const testDescription =
                        testCase.tradeType == "normal"
                            ? `Alice opens size:${Math.abs(
                                  testCase.size
                              )} price:${testCase.price} leverage:${
                                  testCase.leverage
                              }x ${
                                  testCase.size > 0 ? "Long" : "Short"
                              } against Bob`
                            : testCase.tradeType == "filler"
                            ? `Liquidator opens size:${Math.abs(
                                  testCase.size
                              )} price:${testCase.price} leverage:${
                                  testCase.leverage
                              }x ${
                                  testCase.size > 0 ? "Long" : "Short"
                              } against Cat`
                            : `Liquidator liquidates Alice at oracle price: ${
                                  testCase.pOracle
                              } leverage:${testCase.leverage}x size:${Math.abs(
                                  testCase.size
                              )}`;

                    it(testDescription, async () => {
                        // set price oracle price
                        const oraclePrice = toBigNumber(testCase.pOracle);
                        await contracts.priceOracle
                            .connect(owner)
                            .setPrice(bnToString(oraclePrice));

                        if (testCase.tradeType == "normal") {
                            order = createOrder({
                                price: testCase.price,
                                quantity: Math.abs(testCase.size),
                                leverage: testCase.leverage,
                                isBuy: testCase.size > 0,
                                makerAddress: await alice.getAddress(),
                                salt: Date.now()
                            });

                            await tradeByOrder(
                                bob,
                                alice,
                                order,
                                orderSigner,
                                contracts.perpetual
                            );
                        } else if (testCase.tradeType == "filler") {
                            const fillerOrder = createOrder({
                                price: testCase.price,
                                quantity: Math.abs(testCase.size),
                                leverage: testCase.leverage,
                                isBuy: testCase.size > 0,
                                makerAddress: await liquidator.getAddress(),
                                salt: Date.now()
                            });

                            await tradeByOrder(
                                cat,
                                liquidator,
                                fillerOrder,
                                orderSigner,
                                contracts.perpetual
                            );
                        } else {
                            if (testCase.whitelist == true) {
                                await contracts.liquidation.setWhitelistedLiquidator(
                                    await liquidator.getAddress(),
                                    true
                                );
                            }

                            if (testCase.expect.error) {
                                await expect(
                                    liqTradeByOrder(
                                        liquidator,
                                        alice,
                                        order,
                                        contracts.liquidation,
                                        contracts.perpetual,
                                        {
                                            quantity: toBigNumberStr(
                                                Math.abs(testCase.size)
                                            ),
                                            leverage: toBigNumberStr(
                                                testCase.leverage
                                            )
                                        }
                                    )
                                ).to.be.eventually.rejectedWith(
                                    testCase.expect.error
                                );
                            } else {
                                await (
                                    await liqTradeByOrder(
                                        liquidator,
                                        alice,
                                        order,
                                        contracts.liquidation,
                                        contracts.perpetual,
                                        {
                                            quantity: toBigNumberStr(
                                                Math.abs(testCase.size)
                                            ),
                                            leverage: toBigNumberStr(
                                                testCase.leverage
                                            )
                                        }
                                    )
                                ).wait();
                            }
                        }
                    });
                });
            });
        });
    };

    async function initState() {
        // deploy all contracts
        contracts = await deployAll({
            insurancePool: INSURANCE_POOL_ADDRESS,
            feePool: FEE_POOL_ADDRESS,
            imr: toBigNumberStr(0.0625),
            mmr: toBigNumberStr(0.05),
            insurancePoolPercentage: toBigNumberStr(0.1),
            tickSize: toBigNumberStr(0.000001),
            makerFee: toBigNumberStr(0.02),
            takerFee: toBigNumberStr(0.05),
            priceDiff: toBigNumberStr(100000),
            maxOrderPrice: toBigNumberStr(10000000)
        });

        await postDeployment(contracts, owner, {});

        // // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // mints and deposits 2K token to margin bank for marker and taker
        await mintAndDeposit(
            alice,
            contracts.token,
            contracts.marginbank,
            2_000_000
        );

        await mintAndDeposit(
            bob,
            contracts.token,
            contracts.marginbank,
            2_000_000
        );
        await mintAndDeposit(
            cat,
            contracts.token,
            contracts.marginbank,
            2_000_000
        );

        await mintAndDeposit(
            liquidator,
            contracts.token,
            contracts.marginbank,
            5_000_000
        );

        await moveToStartOfTrading(contracts.perpetual);
    }

    executeTests(tests);
});
