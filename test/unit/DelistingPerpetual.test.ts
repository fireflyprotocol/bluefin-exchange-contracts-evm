import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumberStr,
    BigNumber,
    Balance,
    OrderSigner
} from "../../submodules/library";
import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import {
    getBlockTimestamp,
    mintAndDeposit,
    moveToStartOfTrading
} from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { createOrder, tradeByOrder } from "../helpers/order";
import { FEE_POOL_ADDRESS } from "../helpers/default";

chai.use(chaiAsPromised);

const tests = {
    "Test # 1": [
        {
            action: "trade",
            maker: "A",
            taker: "B",
            pOracle: 1000,
            price: 1000,
            size: 10,
            leverage: 4
        },

        {
            action: "trade",
            maker: "C",
            taker: "D",
            pOracle: 1000,
            price: 1000,
            size: 20,
            leverage: 8
        },

        {
            action: "trade",
            maker: "E",
            taker: "F",
            pOracle: 900,
            price: 900,
            size: 25,
            leverage: 5
        },
        {
            action: "trade",
            maker: "G",
            taker: "H",
            pOracle: 900,
            price: 900,
            size: 20,
            leverage: 4
        },
        {
            action: "price oracle update",
            pOracle: 1200
        },
        {
            action: "remove margin",
            signer: "C",
            pOracle: 1200,
            margin: 2500
        },
        {
            action: "add margin",
            signer: "D",
            pOracle: 1200,
            margin: 3100
        },
        {
            action: "delist market",
            pOracle: 1225
        },
        {
            action: "withdraws",
            signer: "E",
            expect: {
                balance: 13900
            }
        },
        {
            action: "withdraws",
            signer: "G",
            expect: {
                balance: 12320
            }
        },
        {
            action: "withdraws",
            signer: "A",
            expect: {
                balance: 8150
            }
        },
        {
            action: "withdraws",
            signer: "C",
            expect: {
                balance: 6025
            }
        },
        {
            action: "withdraws",
            signer: "B",
            expect: {
                balance: 3300
            }
        },
        {
            action: "withdraws",
            signer: "H",
            expect: {
                balance: 1140
            }
        },
        {
            action: "withdraws",
            signer: "F",
            expect: {
                balance: 1050
            }
        }
    ],
    "Test # 2": [
        {
            action: "trade",
            maker: "A",
            taker: "B",
            pOracle: 1000,
            price: 1000,
            size: -10,
            leverage: 4
        },

        {
            action: "trade",
            maker: "C",
            taker: "D",
            pOracle: 1000,
            price: 1000,
            size: -10,
            leverage: 8
        },

        {
            action: "trade",
            maker: "E",
            taker: "F",
            pOracle: 1100,
            price: 1100,
            size: -25,
            leverage: 6
        },

        {
            action: "trade",
            maker: "G",
            taker: "H",
            pOracle: 1100,
            price: 1100,
            size: -20,
            leverage: 4
        },

        {
            action: "price oracle update",
            pOracle: 850
        },

        {
            action: "remove margin",
            signer: "C",
            pOracle: 850,
            margin: 1250
        },
        {
            action: "add margin",
            signer: "D",
            pOracle: 850,
            margin: 4550
        },
        {
            action: "delist market",
            pOracle: 865
        },

        {
            action: "withdraws",
            signer: "E",
            expect: {
                balance: 11600
            }
        },

        {
            action: "withdraws",
            signer: "G",
            expect: {
                balance: 10480
            }
        },

        {
            action: "withdraws",
            signer: "D",
            expect: {
                balance: 4450
            }
        },

        {
            action: "withdraws",
            signer: "A",
            expect: {
                balance: 7250
            }
        },

        {
            action: "withdraws",
            signer: "C",
            expect: {
                balance: 7250
            }
        },

        {
            action: "withdraws",
            signer: "B",
            expect: {
                balance: 3958.333333
            }
        },

        {
            action: "withdraws",
            signer: "H",
            expect: {
                balance: 60
            }
        },

        {
            action: "withdraws",
            signer: "F",
            expect: {
                balance: 866.666667
            }
        }
    ],
    "Test # 3": [
        {
            action: "trade",
            maker: "A",
            taker: "B",
            pOracle: 1000,
            price: 1000,
            size: -10,
            leverage: 4
        },

        {
            action: "trade",
            maker: "C",
            taker: "D",
            pOracle: 1000,
            price: 1000,
            size: -10,
            leverage: 8
        },

        {
            action: "trade",
            maker: "E",
            taker: "F",
            pOracle: 1100,
            price: 1100,
            size: -25,
            leverage: 6
        },

        {
            action: "trade",
            maker: "G",
            taker: "H",
            pOracle: 1100,
            price: 1100,
            size: -20,
            leverage: 4
        },

        {
            action: "price oracle update",
            pOracle: 850
        },

        {
            action: "remove margin",
            signer: "C",
            pOracle: 850,
            margin: 1250
        },
        {
            action: "add margin",
            signer: "D",
            pOracle: 850,
            margin: 4550
        },
        {
            action: "delist market",
            pOracle: 865
        },

        {
            action: "withdraws",
            signer: "A",
            expect: {
                balance: 7250
            }
        },

        {
            action: "withdraws",
            signer: "B",
            expect: {
                balance: 4450
            }
        },

        {
            action: "withdraws",
            signer: "C",
            expect: {
                balance: 7250
            }
        },

        {
            action: "withdraws",
            signer: "D",
            expect: {
                balance: 4450
            }
        },

        {
            action: "withdraws",
            signer: "E",
            expect: {
                balance: 11600
            }
        },
        {
            action: "withdraws",
            signer: "F",
            expect: {
                balance: 866.6666667
            }
        },
        {
            action: "withdraws",
            signer: "G",
            expect: {
                balance: 9988.333333
            }
        },
        {
            action: "withdraws",
            signer: "H",
            expect: {
                balance: 60
            }
        }
    ]
};

describe("Position Closure Traders After Delisting Perpetual", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let a: Signer;
    let b: Signer;
    let c: Signer;
    let d: Signer;
    let e: Signer;
    let f: Signer;
    let g: Signer;
    let h: Signer;

    let orderSigner: OrderSigner;

    const getSigner = (name: string) => {
        switch (name) {
            case "A":
                return a;
            case "B":
                return b;
            case "C":
                return c;
            case "D":
                return d;
            case "E":
                return e;
            case "F":
                return f;
            case "G":
                return g;
            case "H":
                return h;
        }
    };

    before(async () => {
        [owner, a, b, c, d, e, f, g, h] = await hardhat.ethers.getSigners();
    });

    const executeTests = async (testCases: Object) => {
        Object.keys(testCases).forEach((testName) => {
            describe(testName, () => {
                (testCases as any)[testName].forEach((testCase: any) => {
                    before(async () => {
                        await initState();
                    });

                    let testCaseDescription;

                    switch (testCase.action) {
                        case "trade":
                            testCaseDescription = `${
                                testCase.maker
                            } opens size:${Math.abs(testCase.size)} price:${
                                testCase.price
                            } leverage:${testCase.leverage}x ${
                                testCase.size > 0 ? "Long" : "Short"
                            } against ${testCase.taker}`;
                            break;
                        case "remove margin":
                            testCaseDescription = `${testCase.signer} removes margin:${testCase.margin} at oracle price:${testCase.pOracle}`;
                            break;
                        case "add margin":
                            testCaseDescription = `${testCase.signer} adds margin:${testCase.margin} at oracle price:${testCase.pOracle}`;
                            break;
                        case "delist market":
                            testCaseDescription = `Perpetual Delisted at oracle price:${testCase.pOracle}`;
                            break;
                        case "withdraws":
                            testCaseDescription = `${testCase.signer} withdraws position amount using closePosition`;
                            break;
                        default:
                            testCaseDescription = `Oracle price changes to ${testCase.pOracle}`;
                            break;
                    }

                    it(testCaseDescription, async () => {
                        let curMaker: Signer;
                        let curTaker: Signer;

                        if (testCase.pOracle) {
                            // set price oracle price
                            await contracts.priceOracle.setPrice(
                                toBigNumberStr(testCase.pOracle)
                            );
                        }

                        // if a trade is to be made
                        if (testCase.action == "trade") {
                            curMaker = getSigner(testCase.maker) as Signer;
                            curTaker = getSigner(testCase.taker) as Signer;

                            const order = createOrder({
                                price: testCase.price,
                                quantity: Math.abs(testCase.size),
                                leverage: testCase.leverage,
                                isBuy: testCase.size > 0,
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
                        }
                        // if margin is to be removed
                        else if (testCase.action == "remove margin") {
                            const signer = getSigner(testCase.signer) as Signer;
                            await contracts.perpetual
                                .connect(signer)
                                .removeMargin(
                                    await signer.getAddress(),
                                    toBigNumberStr(testCase.margin)
                                );
                        }
                        // if margin is to be added
                        else if (testCase.action == "add margin") {
                            const signer = getSigner(testCase.signer) as Signer;
                            await contracts.perpetual
                                .connect(signer)
                                .addMargin(
                                    await signer.getAddress(),
                                    toBigNumberStr(testCase.margin)
                                );
                        } else if (testCase.action == "delist market") {
                            await contracts.perpetual.delistPerpetual(
                                toBigNumberStr(testCase.pOracle),
                                toBigNumberStr(testCase.pOracle)
                            );
                        }
                        // else if withdraws amount (this will have an expect field)
                        else if (testCase.action == "withdraws") {
                            const signer = getSigner(testCase.signer) as Signer;
                            const address = await signer.getAddress();
                            await contracts.perpetual
                                .connect(signer)
                                .closePosition(address);
                            const marginBankBalance =
                                await Balance.getMarginBankBalance(
                                    address,
                                    contracts.marginbank as any
                                );

                            expect(
                                marginBankBalance.shiftedBy(-18).toFixed(6)
                            ).to.be.equal(
                                new BigNumber(testCase.expect.balance).toFixed(
                                    6
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
            maxOrderPrice: toBigNumberStr(2000),
            feePool: FEE_POOL_ADDRESS,
            makerFee: toBigNumberStr(0.01),
            takerFee: toBigNumberStr(0.02)
        });

        await postDeployment(contracts, owner, {});

        // // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // deposit 6K in all accounts
        await [a, b, c, d, e, f, g, h].forEach(async (signer) => {
            await mintAndDeposit(
                signer,
                contracts.token,
                contracts.marginbank,
                6_000
            );
        });

        await moveToStartOfTrading(contracts.perpetual);
    }

    executeTests(tests);
});
