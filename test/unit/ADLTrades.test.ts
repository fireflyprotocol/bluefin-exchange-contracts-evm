import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { ContractTransaction, Signer } from "ethers";
import {
    toBigNumberStr,
    Order,
    toBigNumber,
    hexToBigNumber,
    hexToBaseNumber
} from "../../submodules/library";

import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";

import { FEE_POOL_ADDRESS, INSURANCE_POOL_ADDRESS } from "../helpers/default";

import {
    mintAndDeposit,
    moveToStartOfTrading,
    moveToStartOfFirstWindow,
    increaseBlockTime
} from "../helpers/utils";

import { AllContracts } from "../helpers/interfaces";
import { OrderSigner } from "../../submodules/library";
import { createOrder, tradeByOrder, adlTradeByOrder } from "../helpers/order";
import {
    evaluateExpect,
    evaluateSystemExpect,
    parseEvent
} from "../helpers/expect";
import { GuardianStatus } from "../../types";
import { FundingOracle } from "../../artifacts/typechain";

chai.use(chaiAsPromised);
const expect = chai.expect;

const tests = {
    "# 1 - Long Position + Full ADL": [
        {
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: 10,
            leverage: 4,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.264706,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 1,
            expectCat: {
                mro: 1,
                oiOpen: 1000,
                qPos: -10,
                margin: 1000,
                marginRatio: 1,
                bankBalance: 3980,
                pPos: 100
            }
        },
        {
            tradeType: "ADL",
            pOracle: 70,
            size: 10,
            settlementAmtDueByMaker: 0,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1730,
                pPos: 0,
                pnl: -250
            },
            expectCat: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 5230,
                pPos: 0,
                pnl: 250
            },
            expectSystem: {
                fee: 140,
                IFBalance: 0,
                perpetual: 1250
            }
        }
    ],

    "#2 - Short Position + Full ADL": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.25,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: 20,
            leverage: 2,
            expectCat: {
                mro: 0.5,
                oiOpen: 2000,
                qPos: 20,
                margin: 1000,
                marginRatio: 0.5,
                bankBalance: 3960,
                pPos: 100
            }
        },
        {
            tradeType: "ADL",
            pOracle: 130,
            size: -10,
            settlementAmtDueByMaker: 0,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1730,
                pPos: 0,
                pnl: -250
            },
            expectCat: {
                mro: 0.5,
                oiOpen: 1000,
                qPos: 10,
                margin: 500,
                marginRatio: 0.6153846154,
                bankBalance: 4710,
                pPos: 100,
                pnl: 250
            },
            expectSystem: {
                fee: 210,
                IFBalance: 0,
                perpetual: 1750
            }
        }
    ],

    "#3 - Short Position + Partial ADL": [
        {
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: -10,
            leverage: 5,
            expectAlice: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.212121,
                bankBalance: 1780,
                pPos: 100
            }
        },
        {
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: 20,
            leverage: 2,
            expectCat: {
                mro: 0.5,
                oiOpen: 2000,
                qPos: 20,
                margin: 1000,
                marginRatio: 0.5,
                bankBalance: 3960,
                pPos: 100
            }
        },
        {
            tradeType: "ADL",
            pOracle: 125,
            size: -5,
            settlementAmtDueByMaker: 0,
            expectAlice: {
                mro: 0.2,
                oiOpen: 500,
                qPos: -5,
                margin: 100,
                marginRatio: 1,
                bankBalance: 1780,
                pPos: 100,
                pnl: -100
            },
            expectCat: {
                mro: 0.5,
                oiOpen: 1500,
                qPos: 15,
                margin: 750,
                marginRatio: 0.6,
                bankBalance: 4310,
                pPos: 100,
                pnl: 100
            },
            expectSystem: {
                fee: 210,
                IFBalance: 0,
                perpetual: 2050
            }
        }
    ],
    "#4 - Long Position + Full ADL + Funding > Margin": [
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: 10,
            leverage: 4,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.264706,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -20,
            leverage: 2,
            tradeAfter: 0,
            expectCat: {
                mro: 0.5,
                oiOpen: 2000,
                qPos: -20,
                margin: 1000,
                marginRatio: 0.5,
                bankBalance: 3960,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "ADL",
            pOracle: 70,
            price: 0,
            size: 5,
            tradeAfter: 3594,
            settlementAmtDueByMaker: 500.666667,
            expectAlice: {
                mro: 0.25,
                oiOpen: 750.333333333,
                qPos: 5,
                margin: 125,
                marginRatio: -0.7858730159,
                bankBalance: 1730,
                pPos: 150.067,
                pnl: -125.0
            },
            expectCat: {
                mro: 0.5,
                oiOpen: 1500,
                qPos: -15,
                margin: 1501.0,
                marginRatio: 1,
                bankBalance: 4335.0,
                pPos: 100,
                pnl: -125.333334
            },
            expectSystem: {
                fee: 210,
                IFBalance: 0,
                perpetual: 2125
            }
        }
    ],
    "#5 - Long Position + Full ADL + Funding > Margin": [
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: 10,
            leverage: 4,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.264706,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -20,
            leverage: 2,
            tradeAfter: 0,
            expectCat: {
                mro: 0.5,
                oiOpen: 2000,
                qPos: -20,
                margin: 1000,
                marginRatio: 0.5,
                bankBalance: 3960,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "ADL",
            pOracle: 70,
            size: 10,
            tradeAfter: 3594,
            settlementAmtDueByMaker: 500.666667,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1730,
                pPos: 0,
                pnl: -250.0
            },
            expectCat: {
                mro: 0.5,
                oiOpen: 1000,
                qPos: -10,
                margin: 1000.667,
                marginRatio: 1.6271728549,
                bankBalance: 4710.0,
                pPos: 100,
                pnl: -250.66666666
            },
            expectSystem: {
                fee: 210,
                IFBalance: 0,
                perpetual: 1750
            }
        }
    ],

    "#6 - Long Position + Full ADL + margin > funding": [
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: 10,
            leverage: 2,
            expectAlice: {
                mro: 0.5,
                oiOpen: 1000,
                qPos: 10,
                margin: 500,
                marginRatio: 0.5098039216,
                bankBalance: 1480,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: -20,
            leverage: 2,
            tradeAfter: 0,
            expectCat: {
                mro: 0.5,
                oiOpen: 2000,
                qPos: -20,
                margin: 1000,
                marginRatio: 0.5,
                bankBalance: 3960,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: 0.715238096,
            tradeType: "ADL",
            pOracle: 50,
            size: 10,
            tradeAfter: 3594,
            settlementAmtDueByMaker: 0,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 0,
                bankBalance: 1480,
                pPos: 0,
                pnl: -142.380952
            },
            expectCat: {
                mro: 0.5,
                oiOpen: 1000,
                qPos: -10,
                margin: 857.619,
                marginRatio: 2.3572222222,
                bankBalance: 4960,
                pPos: 100,
                pnl: 142.380952
            },
            expectSystem: {
                fee: 210,
                IFBalance: 0,
                perpetual: 2000
            }
        }
    ],

    "#7 - Short Position + Full ADL + Funding > Margin": [
        {
            useRealFunder: true,
            fundingRate: -0.715238096,
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: -10,
            leverage: 4,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.2254901961,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: -0.715238096,
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: 20,
            leverage: 2,
            tradeAfter: 0,
            expectCat: {
                mro: 0.5,
                oiOpen: 2000,
                qPos: 20,
                margin: 1000,
                marginRatio: 0.5,
                bankBalance: 3960,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: -0.715238096,
            tradeType: "ADL",
            pOracle: 100,
            price: 0,
            size: 10,
            tradeAfter: 3594,
            settlementAmtDueByMaker: 715.238096,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 0,
                bankBalance: 1730,
                pPos: 0,
                pnl: -250.0
            },
            expectCat: {
                mro: 0.5,
                oiOpen: 1000,
                qPos: 10,
                margin: 1215.238,
                marginRatio: 1.2144444444,
                bankBalance: 4710,
                pPos: 100,
                pnl: -465.238096
            },
            expectSystem: {
                fee: 210,
                IFBalance: 0,
                perpetual: 1750
            }
        }
    ],

    "#8 - Short Position + Full ADL + Funding > (Margin + oiOpen)": [
        {
            useRealFunder: true,
            fundingRate: -1.548333333,
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: -10,
            leverage: 4,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.2254901961,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: -1.548333333,
            tradeType: "filler",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 1,
            tradeAfter: 0,
            expectCat: {
                mro: 1,
                oiOpen: 1000,
                qPos: 10,
                margin: 1000,
                marginRatio: 1,
                bankBalance: 3980,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            fundingRate: -1.548333333,
            tradeType: "ADL",
            pOracle: 100,
            size: 10,
            tradeAfter: 3594,
            settlementAmtDueByMaker: 1548.333333,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 0,
                bankBalance: 1730,
                pPos: 0,
                pnl: -250.0
            },
            expectCat: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 0,
                bankBalance: 5778.333333,
                pPos: 0,
                pnl: -750.0
            },
            expectSystem: {
                fee: 140,
                IFBalance: 0,
                perpetual: 701.666667
            }
        }
    ]
};

describe("ADL Trades", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let cat: Signer;
    let dog: Signer;
    let operator: Signer;
    let orderSigner: OrderSigner;
    let order: Order;
    let tx: ContractTransaction;
    let event;

    before(async () => {
        [owner, alice, bob, cat, dog, operator] =
            await hardhat.ethers.getSigners();
    });

    const executeTests = async (testCases: Object) => {
        Object.keys(testCases).forEach((testName) => {
            describe(testName, () => {
                (testCases as any)[testName].forEach((testCase: any) => {
                    before(async () => {
                        await initState(
                            testCase.useRealFunder == true,
                            testCase.fundingRate
                        );
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
                            ? `Cat opens size:${Math.abs(
                                  testCase.size
                              )} price:${testCase.price} leverage:${
                                  testCase.leverage
                              }x ${
                                  testCase.size > 0 ? "Long" : "Short"
                              } against Dog`
                            : `Deleveraging Alice against Cat at oracle price: ${
                                  testCase.pOracle
                              } size:${Math.abs(testCase.size)}`;

                    it(testDescription, async () => {
                        await contracts.priceOracle.setPrice(
                            toBigNumberStr(testCase.pOracle)
                        );

                        if (testCase.tradeType == "normal") {
                            order = createOrder({
                                price: testCase.price,
                                quantity: Math.abs(testCase.size),
                                leverage: testCase.leverage,
                                isBuy: testCase.size > 0,
                                makerAddress: await alice.getAddress(),
                                salt: Date.now()
                            });

                            tx = await tradeByOrder(
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
                                makerAddress: await cat.getAddress(),
                                salt: Date.now()
                            });

                            tx = await tradeByOrder(
                                dog,
                                cat,
                                fillerOrder,
                                orderSigner,
                                contracts.perpetual
                            );
                        } else {
                            if (testCase.tradeAfter) {
                                await increaseBlockTime(testCase.tradeAfter, 1);
                                await contracts.perpetual.setOffChainFundingRate(
                                    toBigNumberStr(testCase.fundingRate)
                                );
                            }

                            tx = await adlTradeByOrder(
                                cat,
                                alice,
                                order,
                                contracts.adl,
                                contracts.perpetual,
                                {
                                    sender: operator,
                                    quantity: toBigNumberStr(
                                        Math.abs(testCase.size)
                                    )
                                }
                            );
                        }

                        event = await parseEvent(tx, "TradeExecuted");

                        if (testCase.expectAlice) {
                            await evaluateExpect(
                                alice,
                                testCase.expectAlice,
                                toBigNumber(testCase.oraclePrice),
                                hexToBigNumber(event.makerPnl),
                                contracts
                            );
                        }

                        if (testCase.expectCat) {
                            await evaluateExpect(
                                cat,
                                testCase.expectCat,
                                toBigNumber(testCase.oraclePrice),
                                hexToBigNumber(
                                    testCase.tradeType == "filler"
                                        ? event.makerPnl
                                        : event.takerPnl
                                ),
                                contracts
                            );
                        }

                        if (testCase.expectSystem) {
                            await evaluateSystemExpect(
                                testCase.expectSystem,
                                contracts
                            );
                        }

                        if (testCase.tradeType == "ADL") {
                            event = await parseEvent(
                                tx,
                                "SettlementAmtDueByMaker"
                            );
                            if (testCase.settlementAmtDueByMaker == 0) {
                                expect(event).to.be.equal(undefined);
                            } else {
                                const amountDue = hexToBaseNumber(
                                    event.settlementAmount,
                                    6
                                );
                                expect(amountDue).to.be.equal(
                                    testCase.settlementAmtDueByMaker
                                );
                            }
                        }
                    });
                });
            });
        });
    };

    async function initState(useRealFunder: boolean, fundingRate: number) {
        // deploy all contracts
        contracts = await deployAll({
            imr: toBigNumberStr(0.0625),
            mmr: toBigNumberStr(0.05),
            insurancePoolPercentage: toBigNumberStr(0.1),
            insurancePool: INSURANCE_POOL_ADDRESS,
            tickSize: toBigNumberStr(0.000001),
            feePool: FEE_POOL_ADDRESS,
            makerFee: toBigNumberStr(0.02),
            takerFee: toBigNumberStr(0.05),
            useRealFunder: useRealFunder,
            maxAllowedFR: toBigNumberStr(1000) // 1000x% max allowed FR
        });

        await postDeployment(contracts, owner, {
            updateFRProvider: useRealFunder
        });

        await contracts.perpetual.setDeleveragingOperator(
            await operator.getAddress()
        );

        // move funding rate off-chain
        await contracts.guardian.setFundingRateStatus(
            contracts.funder.address,
            GuardianStatus.Disallowed
        );

        // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        await mintAndDeposit(
            alice,
            contracts.token,
            contracts.marginbank,
            2_000
        );
        await mintAndDeposit(bob, contracts.token, contracts.marginbank, 2_000);
        await mintAndDeposit(cat, contracts.token, contracts.marginbank, 5_000);
        await mintAndDeposit(dog, contracts.token, contracts.marginbank, 5_000);

        await moveToStartOfTrading(contracts.perpetual);

        if (useRealFunder) {
            await moveToStartOfFirstWindow(contracts.funder as FundingOracle);

            await increaseBlockTime(3600, 1);
            expect(
                +(await contracts.funder.expectedFundingWindow())
            ).to.be.equal(2);

            // set FR as 100% by default else the provided one
            await contracts.perpetual.setOffChainFundingRate(
                toBigNumberStr(fundingRate || 1)
            );
        }
    }

    executeTests(tests);
});
