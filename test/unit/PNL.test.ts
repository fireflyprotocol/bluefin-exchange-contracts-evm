import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { ContractTransaction, Signer } from "ethers";
import { toBigNumberStr, BigNumber, Order } from "../../submodules/library";
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
import { parseEvent } from "../helpers/expect";

chai.use(chaiAsPromised);

const tests = {
    "Test # 1 - Long + Long  (Increasing) []": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "normal",
            pOracle: 110,
            price: 110,
            size: 10,
            leverage: 4,
            expectAlice: {
                pnl: 0
            }
        }
    ],
    "Test # 2 - Long + Short (Reducing) [Profit]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "normal",
            pOracle: 120,
            price: 120,
            size: -6,
            leverage: 4,
            expectAlice: {
                pnl: 120
            }
        }
    ],

    "Test # 3 - Long + Short (Reducing) [Loss]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "normal",
            pOracle: 85,
            price: 85,
            size: -6,
            leverage: 4,
            expectAlice: {
                pnl: -90
            }
        }
    ],

    "Test # 4 - Long + Short (Flipping) [Profit]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "normal",
            pOracle: 125,
            price: 125,
            size: -14,
            leverage: 4,
            expectAlice: {
                pnl: 250
            }
        }
    ],

    "Test # 5 - Long + Short (Flipping) [Loss]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "normal",
            pOracle: 85,
            price: 85,
            size: -14,
            leverage: 4,
            expectAlice: {
                pnl: -150
            }
        }
    ],

    "Test # 6 - Short + Short (Increasing) []": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "normal",
            pOracle: 110,
            price: 110,
            size: -10,
            leverage: 4,
            expectAlice: {
                pnl: 0
            }
        }
    ],

    "Test # 7 - Short + Long (Reducing) [Profit]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "normal",
            pOracle: 80,
            price: 80,
            size: 6,
            leverage: 4,
            expectAlice: {
                pnl: 120
            }
        }
    ],

    "Test # 8 - Short + Long (Reducing) [Loss]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "normal",
            pOracle: 115,
            price: 115,
            size: 6,
            leverage: 4,
            expectAlice: {
                pnl: -90
            }
        }
    ],
    "Test # 9 - Short + Long (Flipping) [Profit]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "normal",
            pOracle: 80,
            price: 80,
            size: 14,
            leverage: 4,
            expectAlice: {
                pnl: 200
            }
        }
    ],
    "Test # 10 - Short + Long (Flipping) [Loss]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "normal",
            pOracle: 115,
            price: 115,
            size: 14,
            leverage: 4,
            expectAlice: {
                pnl: -150
            }
        }
    ],

    "Test # 11 - Long Liquidation Maker (Reducing) [Good Liquidation]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectAlice: {
                pnl: -250
            }
        }
    ],

    "Test # 12 - Long Liquidation Maker (Reducing) [Underwater Liquidation]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectAlice: {
                pnl: -250
            }
        }
    ],

    "Test # 13 - Short Liquidation Maker (Reducing) [Good Liquidation]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectAlice: {
                pnl: -250
            }
        }
    ],
    "Test # 14 - Short Liquidation Maker (Reducing) [Underwater Liquidation]": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectAlice: {
                pnl: -250
            }
        }
    ],
    "Test # 15 - Long Partial Liquidation Maker (Reducing) [Good Liquidation]":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: 10,
                leverage: 4,
                priceBankruptcy: 75
            },
            {
                tradeType: "liquidation",
                pOracle: 75,
                size: 5,
                expectAlice: {
                    pnl: -125
                }
            }
        ],
    "Test # 16 - Long Partial Liquidation Maker (Reducing) [Underwater Liquidation]":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: 10,
                leverage: 4,
                priceBankruptcy: 75
            },
            {
                tradeType: "liquidation",
                pOracle: 75,
                size: 3,
                expectAlice: {
                    pnl: -75
                }
            }
        ],
    "Test # 17 - Short Partial Liquidation Maker (Reducing) [Good Liquidation]":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: -10,
                leverage: 4,
                priceBankruptcy: 125
            },
            {
                tradeType: "liquidation",
                pOracle: 125,
                size: -6,
                expectAlice: {
                    pnl: -150
                }
            }
        ],
    "Test # 18 - Short Partial Liquidation Maker (Reducing) [Underwater Liquidation]":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: -10,
                leverage: 4,
                priceBankruptcy: 125
            },
            {
                tradeType: "liquidation",
                pOracle: 125,
                size: -7,
                expectAlice: {
                    pnl: -175
                }
            }
        ],
    "Test # 19 - Long Liquidation Taker (Increasing) []": [
        {
            tradeType: "filler",
            pOracle: 90,
            price: 90,
            size: 5,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 0,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectTaker: {
                pnl: 0
            }
        }
    ],
    "Test # 20 - Long Liquidation Taker (Reducing) [Profit]": [
        {
            tradeType: "filler",
            pOracle: 90,
            price: 90,
            size: -20,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 0,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectTaker: {
                pnl: 150
            }
        }
    ],
    "Test # 21 - Long Liquidation Taker (Reducing) [Loss]": [
        {
            tradeType: "filler",
            pOracle: 65,
            price: 65,
            size: -20,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 0,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectTaker: {
                pnl: -100
            }
        }
    ],
    "Test # 22 - Long Liquidation Taker (Flipping) [Profit]": [
        {
            tradeType: "filler",
            pOracle: 90,
            price: 90,
            size: -4,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 0,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectTaker: {
                pnl: 60
            }
        }
    ],
    "Test # 23 - Long Liquidation Taker (Flipping) [Loss]": [
        {
            tradeType: "filler",
            pOracle: 65,
            price: 65,
            size: -4,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 0,
            price: 100,
            size: 10,
            leverage: 4,
            priceBankruptcy: 75
        },
        {
            tradeType: "liquidation",
            pOracle: 75,
            size: 10,
            expectTaker: {
                pnl: -40
            }
        }
    ],
    "Test # 24 - Short Liquidation Taker (Increasing) []": [
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectTaker: {
                pnl: 0
            }
        }
    ],
    "Test # 25 - Short Liquidation Taker (Reducing) [Profit]": [
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: 20,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectTaker: {
                pnl: 250
            }
        }
    ],
    "Test # 26 - Short Liquidation Taker (Reducing) [Loss]": [
        {
            tradeType: "filler",
            pOracle: 135,
            price: 135,
            size: 20,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectTaker: {
                pnl: -100
            }
        }
    ],
    "Test # 27 - Short Liquidation Taker (Flipping) [Profit]": [
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: 4,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectTaker: {
                pnl: 100
            }
        }
    ],
    "Test # 28 - Short Liquidation Taker (Flipping) [Loss]": [
        {
            tradeType: "filler",
            pOracle: 135,
            price: 135,
            size: 4,
            leverage: 1
        },
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            priceBankruptcy: 125
        },
        {
            tradeType: "liquidation",
            pOracle: 125,
            size: -10,
            expectTaker: {
                pnl: -40
            }
        }
    ]
};

describe("PNL", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let liquidator: Signer;
    let orderSigner: OrderSigner;
    let order: Order;

    before(async () => {
        [owner, alice, bob, liquidator] = await hardhat.ethers.getSigners();
    });

    const executeTests = async (testCases: Object) => {
        Object.keys(testCases).forEach((testName) => {
            describe(testName, () => {
                (testCases as any)[testName].forEach((testCase: any) => {
                    before(async () => {
                        await initState();
                    });

                    let testDescription;
                    let transaction: ContractTransaction;

                    switch (testCase.tradeType) {
                        case "normal":
                            testDescription = `Alice opens size:${Math.abs(
                                testCase.size
                            )} price:${testCase.price} leverage:${
                                testCase.leverage
                            }x ${
                                testCase.size > 0 ? "Long" : "Short"
                            } against Bob`;
                            break;
                        case "filler":
                            testDescription = `Liquidator opens size:${Math.abs(
                                testCase.size
                            )} price:${testCase.price} leverage:${
                                testCase.leverage
                            }x ${
                                testCase.size > 0 ? "Long" : "Short"
                            } against Bob`;
                            break;
                        case "liquidation":
                            testDescription = `Liquidator liquidates Alice at oracle price: ${
                                testCase.pOracle
                            } leverage:1x size:${Math.abs(testCase.size)}`;
                            break;
                        default:
                            testDescription = "";
                            break;
                    }

                    it(testDescription, async () => {
                        // set price oracle price
                        await contracts.priceOracle.setPrice(
                            toBigNumberStr(testCase.pOracle)
                        );

                        if (testCase.tradeType == "normal") {
                            await contracts.perpetual
                                .connect(bob)
                                .adjustLeverage(
                                    await bob.getAddress(),
                                    toBigNumberStr(testCase.leverage)
                                );

                            order = createOrder({
                                price: testCase.price,
                                quantity: Math.abs(testCase.size),
                                leverage: testCase.leverage,
                                isBuy: testCase.size > 0,
                                makerAddress: await alice.getAddress(),
                                salt: Date.now()
                            });

                            transaction = await tradeByOrder(
                                bob,
                                alice,
                                order,
                                orderSigner,
                                contracts.perpetual
                            );
                        } else if (testCase.tradeType == "filler") {
                            await contracts.perpetual
                                .connect(bob)
                                .adjustLeverage(
                                    await bob.getAddress(),
                                    toBigNumberStr(testCase.leverage)
                                );

                            const fillerOrder = createOrder({
                                price: testCase.price,
                                quantity: Math.abs(testCase.size),
                                leverage: testCase.leverage,
                                isBuy: testCase.size > 0,
                                makerAddress: await liquidator.getAddress(),
                                salt: Date.now()
                            });

                            transaction = await tradeByOrder(
                                bob,
                                liquidator,
                                fillerOrder,
                                orderSigner,
                                contracts.perpetual
                            );
                        } else {
                            transaction = await liqTradeByOrder(
                                liquidator,
                                alice,
                                order,
                                contracts.liquidation,
                                contracts.perpetual,
                                {
                                    quantity: toBigNumberStr(
                                        Math.abs(testCase.size)
                                    )
                                }
                            );
                        }

                        const event = await parseEvent(
                            transaction,
                            "TradeExecuted"
                        );

                        if (testCase.expectAlice) {
                            const pnl = new BigNumber(
                                event.makerPnl.toHexString()
                            );
                            expect(pnl.shiftedBy(-18).toFixed(3)).to.be.equal(
                                new BigNumber(testCase.expectAlice.pnl).toFixed(
                                    3
                                )
                            );
                        }

                        if (testCase.expectTaker) {
                            const pnl = new BigNumber(
                                event.takerPnl.toHexString()
                            );
                            expect(pnl.shiftedBy(-18).toFixed(3)).to.be.equal(
                                new BigNumber(testCase.expectTaker.pnl).toFixed(
                                    3
                                )
                            );
                        }
                    });
                });
            });
        });
    };

    async function initState() {
        // deploy all contracts
        contracts = await deployAll({
            imr: toBigNumberStr(0.0625),
            mmr: toBigNumberStr(0.05),
            insurancePoolPercentage: toBigNumberStr(0.1),
            insurancePool: INSURANCE_POOL_ADDRESS,
            tickSize: toBigNumberStr(0.000001),
            feePool: FEE_POOL_ADDRESS,
            makerFee: toBigNumberStr(0.02),
            takerFee: toBigNumberStr(0.05)
        });

        await postDeployment(contracts, owner, {});

        // // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        await mintAndDeposit(
            alice,
            contracts.token,
            contracts.marginbank,
            2_0000
        );
        await mintAndDeposit(
            bob,
            contracts.token,
            contracts.marginbank,
            2_0000
        );

        await mintAndDeposit(
            liquidator,
            contracts.token,
            contracts.marginbank,
            5_0000
        );

        await moveToStartOfTrading(contracts.perpetual);
    }

    executeTests(tests);
});
