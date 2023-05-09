import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { ContractTransaction, Signer } from "ethers";
import {
    toBigNumberStr,
    Order,
    toBigNumber,
    hexToBaseNumber,
    bigNumber,
    hexToBigNumber
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
import { createOrder, liqTradeByOrder, tradeByOrder } from "../helpers/order";
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
    "Test #1 Long Position + Full Liquidation": [
        {
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: 10,
            leverage: 4,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.242424,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 78.947368,
            price: 0,
            size: 10,
            leverage: 1,
            settlementAmount: 0,
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
            expectLiquidator: {
                mro: 1,
                oiOpen: 789.47368,
                qPos: 10,
                margin: 789.47368,
                marginRatio: 1,
                bankBalance: 4246.052632,
                pPos: 78.947368,
                pnl: 35.526312
            },
            expectSystem: {
                fee: 70,
                IFBalance: 3.947368,
                perpetual: 1250
            }
        }
    ],
    "Test # 2 - Short Position + Full Liquidation": [
        {
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: -10,
            leverage: 4,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.262626,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 119.047622,
            price: 0,
            size: -10,
            leverage: 1,
            settlementAmount: 0,
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
            expectLiquidator: {
                mro: 1,
                oiOpen: 1190.47622,
                qPos: -10,
                margin: 1190.47622,
                marginRatio: 1,
                bankBalance: 3863.095182,
                pPos: 119.047622,
                pnl: 53.571402
            },
            expectSystem: {
                fee: 70,
                IFBalance: 5.952378,
                perpetual: 1630.95244
            }
        }
    ],

    "Test # 3 - Long Position + Partial Liquidation": [
        {
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: 10,
            leverage: 4,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.242424,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 78.947366,
            price: 0,
            size: 6,
            leverage: 1,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 400,
                qPos: 4,
                margin: 100,
                marginRatio: 0.05,
                bankBalance: 1730,
                pPos: 100,
                pnl: -150
            },
            expectLiquidator: {
                mro: 1,
                oiOpen: 473.684196,
                qPos: 6,
                margin: 473.684196,
                marginRatio: 1,
                bankBalance: 4547.6315804,
                pPos: 78.947366,
                pnl: 21.3157764
            },
            expectSystem: {
                fee: 70,
                IFBalance: 2.36842,
                perpetual: 950
            }
        }
    ],

    "Test # 4 - Short Position + Partial Liquidation": [
        {
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: -10,
            leverage: 4,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.262626,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 119.047622,
            price: 0,
            size: -6,
            leverage: 1,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 400,
                qPos: -4,
                margin: 100,
                marginRatio: 0.05,
                bankBalance: 1730,
                pPos: 100,
                pnl: -150
            },
            expectLiquidator: {
                mro: 1,
                oiOpen: 714.285732,
                qPos: -6,
                margin: 714.285732,
                marginRatio: 1,
                bankBalance: 4317.857109,
                pPos: 119.047622,
                pnl: 32.142841
            },
            expectSystem: {
                fee: 70,
                IFBalance: 3.571427,
                perpetual: 1178.571464
            }
        }
    ],
    "Test # 5 - Long Position + Full Underwater Liquidation": [
        {
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: 10,
            leverage: 4,
            settlementAmount: 0,
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
            tradeType: "liquidation",
            pOracle: 69.999998,
            price: 0,
            size: 10,
            leverage: 1,
            settlementAmount: 0,
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
            expectLiquidator: {
                mro: 1,
                oiOpen: 699.99998,
                qPos: 10,
                margin: 699.99998,
                marginRatio: 1,
                bankBalance: 4250,
                pPos: 69.999998,
                pnl: -50.00002
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 1250
            }
        }
    ],
    "Test # 6 - Short Position + Full Underwater Liquidation": [
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
            tradeType: "liquidation",
            pOracle: 137.500002,
            price: 0,
            size: -10,
            leverage: 1,
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
            expectLiquidator: {
                mro: 1,
                oiOpen: 1375.00002,
                qPos: -10,
                margin: 1375.00002,
                marginRatio: 1,
                bankBalance: 3499.99996,
                pPos: 137.500002,
                pnl: -125.00002
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 2000.00004
            }
        }
    ],
    "Test # 7 - Long Position + Full Underwater Liquidation": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: 10,
            leverage: 5,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1780,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 69.999998,
            price: 0,
            size: 10,
            leverage: 1,
            settlementAmount: 0,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1780,
                pPos: 0,
                pnl: -200
            },
            expectLiquidator: {
                mro: 1,
                oiOpen: 699.99998,
                qPos: 10,
                margin: 699.99998,
                marginRatio: 1,
                bankBalance: 4200,
                pPos: 69.999998,
                pnl: -100.00002
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 1200
            }
        }
    ],
    "Test # 8 - Short Position + Partial Underwater Liquidation": [
        {
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: -10,
            leverage: 5,
            settlementAmount: 0,
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
            tradeType: "liquidation",
            pOracle: 130.000002,
            price: 0,
            size: -10,
            leverage: 1,
            settlementAmount: 0,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1780,
                pPos: 0,
                pnl: -200
            },
            expectLiquidator: {
                mro: 1,
                oiOpen: 1300.00002,
                qPos: -10,
                margin: 1300.00002,
                marginRatio: 1,
                bankBalance: 3599.99996,
                pPos: 130.000002,
                pnl: -100.00002
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 1800.00004
            }
        }
    ],

    "Test # 9 - Long Position + Full Liquidation (Liquidator Increases Position)":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: 10,
                leverage: 4,
                settlementAmount: 0,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
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
                size: 5,
                leverage: 1,
                settlementAmount: 0,
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 500,
                    qPos: 5,
                    margin: 500,
                    marginRatio: 1,
                    bankBalance: 4490,
                    pPos: 100
                }
            },
            {
                tradeType: "liquidation",
                pOracle: 78.947366,
                price: 0,
                size: 10,
                leverage: 1,
                settlementAmount: 0,
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
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 1289.47366,
                    qPos: 15,
                    margin: 1289.47366,
                    marginRatio: 1,
                    bankBalance: 3736.052634,
                    pPos: 85.964911,
                    pnl: 35.526294
                },
                expectSystem: {
                    fee: 105,
                    IFBalance: 3.947366,
                    perpetual: 3000
                }
            }
        ],

    "Test # 10 - Short Position + Full Liquidation (Liquidator Increases Position)":
        [
            {
                tradeType: "normal",
                pOracle: 102,
                price: 100,
                size: -10,
                leverage: 4,
                settlementAmount: 0,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.22549,
                    bankBalance: 1730,
                    pPos: 100
                }
            },
            {
                tradeType: "filler",
                pOracle: 102,
                price: 100,
                size: -10,
                leverage: 2,
                settlementAmount: 0,
                expectLiquidator: {
                    mro: 0.5,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 500,
                    marginRatio: 0.471,
                    bankBalance: 4480,
                    pPos: 100
                }
            },
            {
                tradeType: "liquidation",
                pOracle: 119.047622,
                price: 0,
                size: -10,
                leverage: 2,
                settlementAmount: 0,
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
                expectLiquidator: {
                    mro: 0.5,
                    oiOpen: 2190.47622,
                    qPos: -20,
                    margin: 1095.23811,
                    marginRatio: 0.3799999,
                    bankBalance: 3938.333292,
                    pPos: 109.523811,
                    pnl: 53.571402
                },
                expectSystem: {
                    fee: 140,
                    IFBalance: 5.952378,
                    perpetual: 2275.71433
                }
            }
        ],
    "Test # 11 - Long Position + Full Liquidation (Liquidator Nets Position)": [
        {
            tradeType: "normal",
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            tradeType: "filler",
            pOracle: 101,
            price: 100,
            size: -20,
            leverage: 1,
            settlementAmount: 0,
            expectLiquidator: {
                mro: 1,
                oiOpen: 2000,
                qPos: -20,
                margin: 2000,
                marginRatio: 0.980198,
                bankBalance: 2960,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 78.947366,
            price: 0,
            size: 10,
            leverage: 1,
            settlementAmount: 0,
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
            expectLiquidator: {
                mro: 1,
                oiOpen: 1000,
                qPos: -10,
                margin: 1000,
                marginRatio: 1.533333,
                bankBalance: 4206.052634,
                pPos: 100,
                pnl: 246.052634
            },
            expectSystem: {
                fee: 210,
                IFBalance: 3.947366,
                perpetual: 2000
            }
        }
    ],

    "Test # 12 - Short Position + Full Liquidation (Liquidator Nets Position)":
        [
            {
                tradeType: "normal",
                pOracle: 100,
                price: 100,
                size: -10,
                leverage: 4,
                settlementAmount: 0,
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
                leverage: 1,
                settlementAmount: 0,
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 2000,
                    qPos: 20,
                    margin: 2000,
                    marginRatio: 1,
                    bankBalance: 2960,
                    pPos: 100
                }
            },
            {
                tradeType: "liquidation",
                pOracle: 119.047622,
                price: 0,
                size: -10,
                leverage: 1,
                settlementAmount: 0,
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
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 1000,
                    marginRatio: 1,
                    bankBalance: 4204.047622,
                    pPos: 100,
                    pnl: 244.047622
                },
                expectSystem: {
                    fee: 210,
                    IFBalance: 5.952378,
                    perpetual: 2000
                }
            }
        ],
    "Test # 13 - Long Position + Full Liquidation (Liquidator Flips Position)":
        [
            {
                tradeType: "normal",
                pOracle: 101,
                price: 100,
                size: 10,
                leverage: 4,
                settlementAmount: 0,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.257426,
                    bankBalance: 1730,
                    pPos: 100
                }
            },
            {
                tradeType: "filler",
                pOracle: 101,
                price: 100,
                size: -4,
                leverage: 1,
                settlementAmount: 0,
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 400,
                    qPos: -4,
                    margin: 400,
                    marginRatio: 0.980198,
                    bankBalance: 4592,
                    pPos: 100
                }
            },
            {
                tradeType: "liquidation",
                pOracle: 78,
                price: 0,
                size: 10,
                leverage: 1,
                settlementAmount: 0,
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
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 468,
                    qPos: 6,
                    margin: 468,
                    marginRatio: 1,
                    bankBalance: 4639,
                    pPos: 78,
                    pnl: 115
                },
                expectSystem: {
                    fee: 98,
                    IFBalance: 3,
                    perpetual: 1212
                }
            }
        ],

    "Test # 14 - Short Position + Full Liquidation": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            settlementAmount: 0,
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
            size: 4,
            leverage: 1,
            settlementAmount: 0,
            expectLiquidator: {
                mro: 1,
                oiOpen: 400,
                qPos: 4,
                margin: 400,
                marginRatio: 1,
                bankBalance: 4592,
                pPos: 100
            }
        },
        {
            tradeType: "liquidation",
            pOracle: 120,
            price: 0,
            size: -10,
            leverage: 1,
            settlementAmount: 0,
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
            expectLiquidator: {
                mro: 1,
                oiOpen: 720,
                qPos: -6,
                margin: 720,
                marginRatio: 1,
                bankBalance: 4397,
                pPos: 120,
                pnl: 125
            },
            expectSystem: {
                fee: 98,
                IFBalance: 5,
                perpetual: 1440
            }
        }
    ],

    "Test # 15 - Long Position + Partial Underwater Liquidation": [
        {
            tradeType: "normal",
            pOracle: 102,
            price: 100,
            size: 10,
            leverage: 4,
            settlementAmount: 0,
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
            tradeType: "liquidation",
            pOracle: 69.999998,
            price: 0,
            size: 6,
            leverage: 1,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 400,
                qPos: 4,
                margin: 100,
                marginRatio: -0.071429,
                bankBalance: 1730,
                pPos: 100,
                pnl: -150
            },
            expectLiquidator: {
                mro: 1,
                oiOpen: 419.999988,
                qPos: 6,
                margin: 419.999988,
                marginRatio: 1,
                bankBalance: 4550,
                pPos: 69.999998,
                pnl: -30.000012
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 950
            }
        }
    ],
    "Test # 16 - Short Position + Partial Underwater Liquidation": [
        {
            tradeType: "normal",
            pOracle: 100,
            price: 100,
            size: -10,
            leverage: 4,
            settlementAmount: 0,
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
            tradeType: "liquidation",
            pOracle: 137.500002,
            price: 0,
            size: -6,
            leverage: 1,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 400,
                qPos: -4,
                margin: 100,
                marginRatio: -0.090909,
                bankBalance: 1730,
                pPos: 100,
                pnl: -150
            },
            expectLiquidator: {
                mro: 1,
                oiOpen: 825.000012,
                qPos: -6,
                margin: 825.000012,
                marginRatio: 1,
                bankBalance: 4099.999976,
                pPos: 137.500002,
                pnl: -75.000012
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 1400.000024
            }
        }
    ],
    "Test #17 Long Position + Funding > Margin": [
        {
            useRealFunder: true,
            fundingRate: 0.3105617566,
            tradeType: "normal",
            pOracle: 99,
            price: 100,
            size: 10,
            leverage: 4,
            settlementAmount: 0,
            expectAlice: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.242424,
                bankBalance: 1730,
                pPos: 100
            }
        },
        {
            useRealFunder: true,
            tradeType: "liquidation",
            fundingRate: 0.3105617566,
            pOracle: 78.947368,
            price: 0,
            size: 10,
            leverage: 1,
            tradeAfter: 3595,
            expectAlice: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1730,
                pPos: 0,
                pnl: 0
            },
            expectLiquidator: {
                liquidatorPaysForSettlement: 57.28533,
                mro: 1,
                oiOpen: 789.47368,
                qPos: 10,
                margin: 789.47368,
                marginRatio: 1,
                bankBalance: 3942.71467,
                pPos: 78.947368,
                pnl: -210.52632
            },
            expectSystem: {
                fee: 70,
                IFBalance: 0,
                perpetual: 1557.28533
            }
        }
    ],
    "Test # 18 - Long Position + Partial Underwater Liquidation + Funding < Margin":
        [
            {
                useRealFunder: true,
                fundingRate: 0.04899236773,
                tradeType: "normal",
                pOracle: 102,
                price: 100,
                size: 10,
                leverage: 4,
                settlementAmount: 0,
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
                tradeType: "liquidation",
                fundingRate: 0.04899236773,
                pOracle: 69.999998,
                price: 0,
                size: 6,
                leverage: 1,
                tradeAfter: 3595,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 80.022,
                    marginRatio: -0.1433730465,
                    bankBalance: 1730,
                    pPos: 100,
                    pnl: -120.033328
                },
                expectLiquidator: {
                    liquidatorPaysForSettlement: 0,
                    mro: 1,
                    oiOpen: 419.999988,
                    qPos: 6,
                    margin: 419.999988,
                    marginRatio: 1,
                    bankBalance: 4520.033328,
                    pPos: 69.999998,
                    pnl: -59.966684
                },
                expectSystem: {
                    fee: 70,
                    IFBalance: 0,
                    perpetual: 979.966672
                }
            }
        ],

    "Test #19 - Long Position + Partial Underwater Liquidation + Funding > Margin":
        [
            {
                useRealFunder: true,
                fundingRate: 0.4903049969,
                tradeType: "normal",
                pOracle: 102,
                price: 100,
                size: 10,
                leverage: 4,
                settlementAmount: 0,
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
                tradeType: "liquidation",
                fundingRate: 0.4903049969,
                tradeAfter: 3595,
                pOracle: 69.999998,
                price: 0,
                size: 6,
                leverage: 1,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 0,
                    marginRatio: -0.4285714694,
                    bankBalance: 1730,
                    pPos: 100,
                    pnl: 0
                },
                expectLiquidator: {
                    liquidatorPaysForSettlement: 249.833257,
                    mro: 1,
                    oiOpen: 419.999988,
                    qPos: 6,
                    margin: 419.999988,
                    marginRatio: 1,
                    bankBalance: 4150.166743,
                    pPos: 69.999998,
                    pnl: -180.000012
                },
                expectSystem: {
                    fee: 70,
                    IFBalance: 0,
                    perpetual: 1349.833257
                }
            }
        ],

    "Test # 20 - Long Position + Full Liquidation (Liquidator Nets Position) + Funding < Margin":
        [
            {
                tradeType: "normal",
                fundingRate: 0.0573789879,
                pOracle: 101,
                price: 100,
                size: 10,
                leverage: 4,
                settlementAmount: 0,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.257426,
                    bankBalance: 1730,
                    pPos: 100
                }
            },
            {
                useRealFunder: true,
                tradeType: "filler",
                pOracle: 101,
                price: 100,
                size: -10,
                leverage: 1,
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 1000,
                    marginRatio: 0.980198,
                    bankBalance: 3980,
                    pPos: 100
                }
            },
            {
                useRealFunder: true,
                fundingRate: 0.0573789879,
                tradeType: "liquidation",
                pOracle: 80,
                price: 0,
                size: 10,
                leverage: 1,
                tradeAfter: 3592,
                expectAlice: {
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    bankBalance: 1730,
                    pPos: 0,
                    pnl: -192.079418
                },
                expectLiquidator: {
                    liquidatorPaysForSettlement: 0,
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    bankBalance: 5230.0,
                    pPos: 0,
                    pnl: 192.079418
                },
                expectSystem: {
                    fee: 140,
                    IFBalance: 0,
                    perpetual: 0
                }
            }
        ],

    "Test # 21 - Long Position + Full Liquidation (Liquidator Flips Position) + Funding > Margin":
        [
            {
                useRealFunder: true,
                fundingRate: 0.566289879,
                tradeType: "normal",
                pOracle: 101,
                price: 100,
                size: 10,
                leverage: 4,
                settlementAmount: 0,
                expectAlice: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.257426,
                    bankBalance: 1730,
                    pPos: 100
                }
            },
            {
                useRealFunder: true,
                fundingRate: 0.566289879,
                tradeType: "filler",
                pOracle: 101,
                price: 100,
                size: -5,
                leverage: 1,
                tradeAfter: 0,
                expectLiquidator: {
                    mro: 1,
                    oiOpen: 500,
                    qPos: -5,
                    margin: 500,
                    marginRatio: 0.980198,
                    bankBalance: 4490,
                    pPos: 100
                }
            },
            {
                useRealFunder: true,
                tradeType: "liquidation",
                fundingRate: 0.566289879,
                tradeAfter: 3592,
                pOracle: 80,
                price: 0,
                size: 10,
                leverage: 1,
                expectAlice: {
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    bankBalance: 1730,
                    pPos: 0,
                    pnl: 0
                },
                expectLiquidator: {
                    liquidatorPaysForSettlement: 321.635026,
                    mro: 1,
                    oiOpen: 400,
                    qPos: 5,
                    margin: 400,
                    marginRatio: 1,
                    bankBalance: 4454.182487,
                    pPos: 80,
                    pnl: -100
                },
                expectSystem: {
                    fee: 105,
                    IFBalance: 0,
                    perpetual: 1295.817513
                }
            }
        ]
};

describe("Liquidation Trades", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let liquidator: Signer;
    let orderSigner: OrderSigner;
    let order: Order;
    let tx: ContractTransaction;
    let event;

    before(async () => {
        [owner, alice, bob, liquidator] = await hardhat.ethers.getSigners();
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
                            ? `Liquidator opens size:${Math.abs(
                                  testCase.size
                              )} price:${testCase.price} leverage:${
                                  testCase.leverage
                              }x ${
                                  testCase.size > 0 ? "Long" : "Short"
                              } against Bob`
                            : `Liquidator liquidates Alice at oracle price: ${
                                  testCase.pOracle
                              } leverage:${testCase.leverage}x size:${Math.abs(
                                  testCase.size
                              )}`;

                    it(testDescription, async () => {
                        // implies we are in a liquidation trade
                        // set FR, if using real funder
                        if (
                            testCase.tradeType == "liquidation" &&
                            testCase.useRealFunder
                        ) {
                            await increaseBlockTime(testCase.tradeAfter, 1);
                            await contracts.perpetual.setOffChainFundingRate(
                                toBigNumberStr(testCase.fundingRate)
                            );
                        }

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

                            event = await parseEvent(tx, "TradeExecuted");
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

                            tx = await tradeByOrder(
                                bob,
                                liquidator,
                                fillerOrder,
                                orderSigner,
                                contracts.perpetual
                            );
                        } else {
                            tx = await liqTradeByOrder(
                                liquidator,
                                alice,
                                order,
                                contracts.liquidation,
                                contracts.perpetual,
                                {
                                    quantity: toBigNumberStr(
                                        Math.abs(testCase.size)
                                    ),
                                    leverage: toBigNumberStr(testCase.leverage)
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

                        if (testCase.expectLiquidator) {
                            if (
                                testCase.expectLiquidator
                                    .liquidatorPaysForSettlement
                            ) {
                                const liquidatorPaymentEvent = await parseEvent(
                                    tx,
                                    "LiquidatorPaidForAccountSettlement"
                                );
                                const liquidatorPaidForSettlement =
                                    liquidatorPaymentEvent
                                        ? hexToBaseNumber(
                                              liquidatorPaymentEvent.amount,
                                              6
                                          )
                                        : 0;
                                const expectedLiquidatorSettlementAmount =
                                    Number(
                                        bigNumber(
                                            testCase.expectLiquidator
                                                .liquidatorPaysForSettlement
                                        ).toFixed(6)
                                    );
                                expect(liquidatorPaidForSettlement).to.be.equal(
                                    expectedLiquidatorSettlementAmount
                                );
                            }

                            await evaluateExpect(
                                liquidator,
                                testCase.expectLiquidator,
                                toBigNumber(testCase.oraclePrice),
                                hexToBigNumber(event.takerPnl),
                                contracts
                            );
                        }

                        if (testCase.expectSystem) {
                            await evaluateSystemExpect(
                                testCase.expectSystem,
                                contracts
                            );
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

        // move funding rate off-chain
        await contracts.guardian.setFundingRateStatus(
            contracts.funder.address,
            GuardianStatus.Disallowed
        );

        // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // mints and deposits 2K token to margin bank for marker and taker
        await mintAndDeposit(
            alice,
            contracts.token,
            contracts.marginbank,
            2_000
        );
        await mintAndDeposit(bob, contracts.token, contracts.marginbank, 2_000);
        await mintAndDeposit(
            liquidator,
            contracts.token,
            contracts.marginbank,
            5_000
        );

        await moveToStartOfTrading(contracts.perpetual);

        if (useRealFunder) {
            await moveToStartOfFirstWindow(contracts.funder as FundingOracle);

            await increaseBlockTime(3600, 1);
            expect(
                +(await contracts.funder.expectedFundingWindow())
            ).to.be.equal(2);

            // set FR
            await contracts.perpetual.setOffChainFundingRate(
                toBigNumberStr(fundingRate || 1)
            );
        }
    }

    executeTests(tests);
});
