import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumberStr,
    BigNumber,
    Balance,
    SigningMethod,
    BIGNUMBER_BASE,
    toBigNumber,
    bnToString,
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
import { FEE_POOL_ADDRESS } from "../helpers/default";

chai.use(chaiAsPromised);
const expect = chai.expect;

const tests = {
    "Test # 69 - Reducing Long Position, abs.Loss > Margin  + []+Error- Cannot trade when loss exceeds margin":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 70,
                size: -6,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 70 - Closing Long Position, abs.Loss > Margin  + []+Error- Cannot trade when loss exceeds margin":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 70,
                size: -10,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 71 - Flipping Long Position, abs.Loss > Margin  + []+Error- Cannot trade when loss exceeds margin":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 70,
                size: -16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 72 - Reducing Short Position, abs.Loss > Margin  + []+Error- Cannot trade when loss exceeds margin":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 130,
                size: 6,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 73 - Closing Short Position, abs.Loss > Margin  + []+Error- Cannot trade when loss exceeds margin":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 130,
                size: 10,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 74 - Flipping Short Position, abs.Loss > Margin  + []+Error- Cannot trade when loss exceeds margin":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 130,
                size: 16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 75 - Reducing Long Position, abs.Loss < Margin, (Loss+Fee) > Margin + []+Proceed-0":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 75.25,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 100,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 94.075
                }
            }
        ],
    "Test # 76 - Closing Long Position, abs.Loss < Margin, (Loss+Fee) > Margin + []+Proceed-0":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 75.25,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 110.125
                }
            }
        ],
    "Test # 77 - Flipping Long Position, abs.Loss < Margin, (Loss+Fee) > Margin + []+Proceed-0":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 80,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.0625,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 80,
                price: 75.25,
                size: -16,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 451.5,
                    qPos: -6,
                    margin: 112.875,
                    marginRatio: 0.175781,
                    pPos: 75.25,
                    fee: 141.73
                }
            }
        ],
    "Test # 78 - Reducing Short Position, abs.Loss < Margin, (Loss+Fee) > Margin + []+Proceed-0":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 124.75,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: -4,
                    margin: 100,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 108.925
                }
            }
        ],
    "Test # 79 - Closing Short Position, abs.Loss < Margin, (Loss+Fee) > Margin + []+Proceed-0":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 124.75,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 134.875
                }
            }
        ],
    "Test # 80 - Flipping Short Position, abs.Loss < Margin, (Loss+Fee) > Margin + []+Proceed-0":
        [
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
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 100,
                price: 124.75,
                size: 16,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 748.5,
                    qPos: 6,
                    margin: 187.125,
                    marginRatio: 0.064375,
                    pPos: 124.75,
                    fee: 187.27
                }
            }
        ]
};

// All tests are from taker's (Alice) perspective
describe("More Loss Than Margin (0.1/0.01% IMR/MMR  and 2%/5% Maker/Taker fee)", () => {
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

                    const testDescription =
                        Math.abs(testCase.size) > 0
                            ? `Alice opens size:${Math.abs(
                                  testCase.size
                              )} price:${testCase.price} leverage:${
                                  testCase.leverage
                              }x ${
                                  testCase.size > 0 ? "Long" : "Short"
                              } against Bob`
                            : `Updating oracle price to: ${testCase.pOracle}`;

                    it(testDescription, async () => {
                        // set price oracle price
                        const oraclePrice = toBigNumber(testCase.pOracle);
                        await contracts.priceOracle
                            .connect(owner)
                            .setPrice(bnToString(oraclePrice));

                        if (Math.abs(testCase.size) == 0) {
                            return;
                        }

                        const order = createOrder({
                            price: testCase.price,
                            quantity: Math.abs(testCase.size),
                            leverage: testCase.leverage,
                            isBuy: testCase.size > 0,
                            makerAddress: await maker.getAddress(),
                            salt: Date.now()
                        });

                        if (testCase.size != 0) {
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

                                const positionBalance =
                                    await Balance.getPositionBalance(
                                        await maker.getAddress(),
                                        contracts.perpetual as any
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
                                const expectedPosition =
                                    getExpectedTestPosition(testCase.expect);

                                const fee = new BigNumber(
                                    await (
                                        await contracts.marginbank.getAccountBankBalance(
                                            FEE_POOL_ADDRESS
                                        )
                                    ).toHexString()
                                );

                                // perform expects
                                expectPosition(
                                    expectedPosition,
                                    toTestPositionExpect(
                                        positionBalance,
                                        pPos,
                                        marginRatio,
                                        undefined,
                                        fee
                                    )
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
                            }
                        }
                    });
                });
            });
        });
    };

    async function initState() {
        // deploy all contracts and set imr and mme to 6.25 percent and 5 percent
        contracts = await deployAll({
            imr: toBigNumberStr(0.01),
            mmr: toBigNumberStr(0.001),
            tickSize: toBigNumberStr(0.0000001),
            mtbLong: toBigNumberStr(1),
            mtbShort: toBigNumberStr(1),
            makerFee: toBigNumberStr(0.02),
            takerFee: toBigNumberStr(0.05)
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
