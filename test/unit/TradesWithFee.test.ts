import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    BigNumber,
    Balance,
    BIGNUMBER_BASE,
    toBigNumber,
    bnToString,
    toBigNumberStr
} from "../../submodules/library";
import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import { FEE_POOL_ADDRESS } from "../helpers/default";
import {
    mintAndDeposit,
    moveToStartOfTrading,
    getExpectedTestPosition,
    toTestPositionExpect
} from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { OrderSigner } from "../../submodules/library";
import { createOrder, tradeByOrder } from "../helpers/order";
import { expectPosition } from "../helpers/expect";

chai.use(chaiAsPromised);

// all tests are for Maker Fee 5% and taker Fee set to 15%
const tests = {
    "Test # 1 -   Long Position + Long Trade = Long Position-: -": [
        {
            pOracle: 99,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.242424,
                bankBalance: 1700,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 105,
            size: 4,
            leverage: 4,
            expect: {
                mro: 0.25,
                oiOpen: 1420,
                qPos: 14,
                margin: 355,
                marginRatio: 0.231602,
                bankBalance: 1532,
                pPos: 101.428571,
                fee: 284
            }
        }
    ],
    "Test # 2 -   Short Position + Short Trade = Short Position-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.262626,
                bankBalance: 1600,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: false,
            price: 105,
            size: -4,
            leverage: 4,
            expect: {
                mro: 0.25,
                oiOpen: 1420,
                qPos: -14,
                margin: 355,
                marginRatio: 0.242997,
                bankBalance: 1474,
                pPos: 101.428571,
                fee: 284
            }
        }
    ],
    "Test # 3 -   Long Position + Short Trade = Long Position-: -user books profit":
        [
            {
                pOracle: 99,
                isTaker: true,
                price: 100,
                size: 10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.242424,
                    bankBalance: 1600,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 99,
                isTaker: false,
                price: 105,
                size: -4,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 600,
                    qPos: 6,
                    margin: 150,
                    marginRatio: 0.242424,
                    bankBalance: 1699,
                    pPos: 100,
                    fee: 284
                }
            }
        ],
    "Test # 4 -   Long Position + Short Trade = Long Position-: -user books loss":
        [
            {
                pOracle: 99,
                isTaker: false,
                price: 100,
                size: 10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.242424,
                    bankBalance: 1700,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 101,
                isTaker: false,
                price: 95,
                size: -4,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 600,
                    qPos: 6,
                    margin: 150,
                    marginRatio: 0.257426,
                    bankBalance: 1761,
                    pPos: 100,
                    fee: 276
                }
            }
        ],
    "Test # 5 -   Short Position + Long Trade = Short Position-: -user books profit":
        [
            {
                pOracle: 100,
                isTaker: true,
                price: 100,
                size: -10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    bankBalance: 1600,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 99,
                isTaker: false,
                price: 95,
                size: 4,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 600,
                    qPos: -6,
                    margin: 150,
                    marginRatio: 0.262626,
                    bankBalance: 1701,
                    pPos: 100,
                    fee: 276
                }
            }
        ],
    "Test # 6 -   Short Position + Long Trade = Short Position-: -user books loss":
        [
            {
                pOracle: 102,
                isTaker: true,
                price: 100,
                size: -10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.22549,
                    bankBalance: 1600,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 101,
                isTaker: true,
                price: 105,
                size: 4,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 600,
                    qPos: -6,
                    margin: 150,
                    marginRatio: 0.237624,
                    bankBalance: 1617,
                    pPos: 100,
                    fee: 284
                }
            }
        ],
    "Test # 7 - Long Position + Short Trade = Short Position-: -Margin is added back to Bank (New Short Value is less than the notional value of Long Value)":
        [
            {
                pOracle: 101,
                isTaker: false,
                price: 100,
                size: 10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.257426,
                    bankBalance: 1700,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 99,
                isTaker: false,
                price: 105,
                size: -14,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 420,
                    qPos: -4,
                    margin: 105,
                    marginRatio: 0.325758,
                    bankBalance: 1821.5,
                    pPos: 105,
                    fee: 494
                }
            }
        ],
    "Test # 8 - Long Position + Short Trade = Short Position-: -More Margin is added from Bank to Position (New Short Value is more than the notional value of Long Value)":
        [
            {
                pOracle: 100,
                isTaker: false,
                price: 100,
                size: 10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.25,
                    bankBalance: 1700,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 102,
                isTaker: true,
                price: 105,
                size: -25,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1575,
                    qPos: -15,
                    margin: 393.75,
                    marginRatio: 0.286765,
                    bankBalance: 1212.5,
                    pPos: 105,
                    fee: 725
                }
            }
        ],
    "Test # 9 -   Short Position + Long Trade = Long Position-: -Margin is added back to Bank (New Long Value is less than the notional value of Short Value)":
        [
            {
                pOracle: 102,
                isTaker: true,
                price: 100,
                size: -10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.22549,
                    bankBalance: 1600,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 101,
                isTaker: false,
                price: 105,
                size: 14,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 420,
                    qPos: 4,
                    margin: 105,
                    marginRatio: 0.220297,
                    bankBalance: 1621.5,
                    pPos: 105,
                    fee: 494
                }
            }
        ],
    "Test # 10 - Short Position + Long Trade = Long Position-: -More Margin is added from Bank to Position (New Long Value is more than the notional value of Short Value)":
        [
            {
                pOracle: 100,
                isTaker: true,
                price: 100,
                size: -10,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.25,
                    bankBalance: 1600,
                    pPos: 100,
                    fee: 200
                }
            },
            {
                pOracle: 99,
                isTaker: false,
                price: 105,
                size: 25,
                leverage: 4,
                expect: {
                    mro: 0.25,
                    oiOpen: 1575,
                    qPos: 15,
                    margin: 393.75,
                    marginRatio: 0.204545,
                    bankBalance: 1275,
                    pPos: 105,
                    fee: 725
                }
            }
        ],
    "Test # 11 -   Long + Long (Profit) + Long (Loss)-: -": [
        {
            pOracle: 100,
            isTaker: true,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 105,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: 15,
                margin: 305,
                marginRatio: 0.194719,
                bankBalance: 1466.25,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 102,
            isTaker: false,
            price: 95,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 2000,
                qPos: 20,
                margin: 400,
                marginRatio: 0.215686,
                bankBalance: 1347.5,
                pPos: 100,
                fee: 400
            }
        }
    ],
    "Test # 12 -   Long + Long (Loss) + Long (Loss)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 95,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: 15,
                margin: 295,
                marginRatio: 0.228758,
                bankBalance: 1483.75,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 90,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1925,
                qPos: 20,
                margin: 385,
                marginRatio: 0.222222,
                bankBalance: 1371.25,
                pPos: 96.25,
                fee: 385
            }
        }
    ],
    "Test # 13 -   Long + Long (Loss) + Long (Profit)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 95,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: 15,
                margin: 295,
                marginRatio: 0.205387,
                bankBalance: 1531.25,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 102,
            isTaker: false,
            price: 110,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 2025,
                qPos: 20,
                margin: 405,
                marginRatio: 0.205882,
                bankBalance: 1393.75,
                pPos: 101.25,
                fee: 405
            }
        }
    ],
    "Test # 14 -   Long + Long (Profit) + Short (Profit)-: -": [
        {
            pOracle: 100,
            isTaker: true,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 105,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: 15,
                margin: 305,
                marginRatio: 0.194719,
                bankBalance: 1518.75,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 110,
            size: -8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 711.666667,
                qPos: 7,
                margin: 142.333333,
                marginRatio: 0.194719,
                bankBalance: 1704.083333,
                pPos: 101.666667,
                fee: 445
            }
        }
    ],
    "Test # 15 -   Long + Long (Profit) + Short (Loss)-: -": [
        {
            pOracle: 99,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 105,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: 15,
                margin: 305,
                marginRatio: 0.178451,
                bankBalance: 1618.75,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 95,
            size: -8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 711.666667,
                qPos: 7,
                margin: 142.333333,
                marginRatio: 0.178451,
                bankBalance: 1618.75,
                pPos: 101.666667,
                fee: 452.333333
            }
        }
    ],
    "Test # 16 -   Long + Long (Loss) + Short (Loss)-: -": [
        {
            pOracle: 100,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 95,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: 15,
                margin: 295,
                marginRatio: 0.228758,
                bankBalance: 1583.75,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 90,
            size: -8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 688.333333,
                qPos: 7,
                margin: 137.666667,
                marginRatio: 0.205387,
                bankBalance: 1583.75,
                pPos: 98.333333,
                fee: 421.666667
            }
        }
    ],
    "Test # 17 -   Long + Long (Loss) + Short (Profit)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: true,
            price: 95,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: 15,
                margin: 295,
                marginRatio: 0.213333,
                bankBalance: 1483.75,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 100,
            isTaker: true,
            price: 110,
            size: -8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 688.333333,
                qPos: 7,
                margin: 137.666667,
                marginRatio: 0.213333,
                bankBalance: 1602.416667,
                pPos: 98.333333,
                fee: 471
            }
        }
    ],

    "Test # 18 -   Long + Short (Profit) + Short (Profit) (Close)-: -": [
        {
            pOracle: 102,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.215686,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 105,
            size: -6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: 4,
                margin: 80,
                marginRatio: 0.191919,
                bankBalance: 1868.5,
                pPos: 100,
                fee: 321.5
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 110,
            size: -4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1922.5,
                pPos: 0,
                fee: 409.5
            }
        }
    ],
    "Test # 19 -   Long + Short (Profit) + Short (Loss) (Close)-: -": [
        {
            pOracle: 100,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: true,
            price: 105,
            size: -6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: 4,
                margin: 80,
                marginRatio: 0.2,
                bankBalance: 1805.5,
                pPos: 100,
                fee: 326
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 95,
            size: -4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1808.5,
                pPos: 0,
                fee: 402
            }
        }
    ],
    "Test # 20 -   Long + Short (Loss) + Short (Loss) (Close)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: false,
            price: 95,
            size: -6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: 4,
                margin: 80,
                marginRatio: 0.215686,
                bankBalance: 1711.5,
                pPos: 100,
                fee: 314
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 90,
            size: -4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1711.5,
                pPos: 0,
                fee: 372
            }
        }
    ],
    "Test # 21 -   Long + Short (Loss) + Short (Profit) (Close)-: -": [
        {
            pOracle: 99,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: false,
            price: 95,
            size: -6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: 4,
                margin: 80,
                marginRatio: 0.215686,
                bankBalance: 1811.5,
                pPos: 100,
                fee: 314
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 110,
            size: -4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1865.5,
                pPos: 0,
                fee: 402
            }
        }
    ],
    "Test # 22 -   Short + Short (Profit) + Short (Profit)-: -": [
        {
            pOracle: 101,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.188119,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: false,
            price: 95,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: -15,
                margin: 295,
                marginRatio: 0.18,
                bankBalance: 1531.25,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 100,
            isTaker: false,
            price: 90,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1925,
                qPos: -20,
                margin: 385,
                marginRatio: 0.155,
                bankBalance: 1418.75,
                pPos: 96.25,
                fee: 385
            }
        }
    ],
    "Test # 23 -   Short + Short (Profit) + Short (Loss)-: -": [
        {
            pOracle: 102,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.176471,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: false,
            price: 95,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: -15,
                margin: 295,
                marginRatio: 0.18,
                bankBalance: 1531.25,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 105,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 2000,
                qPos: -20,
                margin: 400,
                marginRatio: 0.212121,
                bankBalance: 1347.5,
                pPos: 100,
                fee: 400
            }
        }
    ],
    "Test # 24 -   Short + Short (Loss) + Short (Loss)-: -": [
        {
            pOracle: 101,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.188119,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 105,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: -15,
                margin: 305,
                marginRatio: 0.196078,
                bankBalance: 1466.25,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 110,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 2075,
                qPos: -20,
                margin: 415,
                marginRatio: 0.232673,
                bankBalance: 1328.75,
                pPos: 103.75,
                fee: 415
            }
        }
    ],
    "Test # 25 -   Short + Short (Loss) + Short (Profit)-: -": [
        {
            pOracle: 102,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.176471,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 105,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: -15,
                margin: 305,
                marginRatio: 0.232323,
                bankBalance: 1466.25,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 90,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1975,
                qPos: -20,
                margin: 395,
                marginRatio: 0.173267,
                bankBalance: 1308.75,
                pPos: 98.75,
                fee: 395
            }
        }
    ],
    "Test # 26 -   Short + Short (Profit) + Long (Profit)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.212121,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 95,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: -15,
                margin: 295,
                marginRatio: 0.168317,
                bankBalance: 1531.25,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 90,
            size: 8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 688.333333,
                qPos: -7,
                margin: 137.666667,
                marginRatio: 0.156863,
                bankBalance: 1647.25,
                pPos: 98.333333,
                fee: 439
            }
        }
    ],

    "Test # 27 -   Short + Short (Profit) + Long (Loss)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.212121,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: false,
            price: 95,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: -15,
                margin: 295,
                marginRatio: 0.18,
                bankBalance: 1531.25,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 105,
            size: 8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 688.333333,
                qPos: -7,
                margin: 137.666667,
                marginRatio: 0.168317,
                bankBalance: 1593.25,
                pPos: 98.333333,
                fee: 463
            }
        }
    ],
    "Test # 28 -   Short + Short (Loss) + Short (Loss)-: -": [
        {
            pOracle: 102,
            isTaker: false,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.176471,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 105,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: -15,
                margin: 305,
                marginRatio: 0.207921,
                bankBalance: 1618.75,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 110,
            size: 8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 711.666667,
                qPos: -7,
                margin: 142.333333,
                marginRatio: 0.196078,
                bankBalance: 1618.75,
                pPos: 101.666667,
                fee: 445
            }
        }
    ],
    "Test # 29 -   Short + Short (Loss) + Short (Profit)-: -": [
        {
            pOracle: 99,
            isTaker: false,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.212121,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 105,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: -15,
                margin: 305,
                marginRatio: 0.207921,
                bankBalance: 1618.75,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 90,
            size: 8,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 711.666667,
                qPos: -7,
                margin: 142.333333,
                marginRatio: 0.232323,
                bankBalance: 1838.75,
                pPos: 101.666667,
                fee: 410.333333
            }
        }
    ],
    "Test # 30 -   Short + Long (Profit) + Long (Profit) (Close)-: -": [
        {
            pOracle: 100,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 95,
            size: 6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: -4,
                margin: 80,
                marginRatio: 0.176471,
                bankBalance: 1714.5,
                pPos: 100,
                fee: 314
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 90,
            size: 4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1816.5,
                pPos: 0,
                fee: 372
            }
        }
    ],
    "Test # 31 -   Short + Long (Profit) + Long (Loss) (Close)-: -": [
        {
            pOracle: 100,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 95,
            size: 6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: -4,
                margin: 80,
                marginRatio: 0.188119,
                bankBalance: 1714.5,
                pPos: 100,
                fee: 314
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 105,
            size: 4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1714.5,
                pPos: 0,
                fee: 395
            }
        }
    ],
    "Test # 32 -   Short + Long (Loss) + Long (Loss) (Close)-: -": [
        {
            pOracle: 101,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.188119,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: false,
            price: 105,
            size: 6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: -4,
                margin: 80,
                marginRatio: 0.176471,
                bankBalance: 1708.5,
                pPos: 100,
                fee: 326
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 110,
            size: 4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1708.5,
                pPos: 0,
                fee: 388
            }
        }
    ],
    "Test # 33 -   Short + Long (Loss) + Long (Profit) (Close)-: -": [
        {
            pOracle: 102,
            isTaker: false,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.176471,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: true,
            price: 105,
            size: 6,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 400,
                qPos: -4,
                margin: 80,
                marginRatio: 0.2,
                bankBalance: 1750,
                pPos: 100,
                fee: 321.5
            }
        },
        {
            pOracle: 101,
            isTaker: true,
            price: 90,
            size: 4,
            leverage: 5,
            expect: {
                mro: 0,
                oiOpen: 0,
                qPos: 0,
                margin: 0,
                marginRatio: 1,
                bankBalance: 1816,
                pPos: 0,
                fee: 393.5
            }
        }
    ],
    "Test # 34 - Long + Long (Profit) + Short (Loss)-: -": [
        {
            pOracle: 99,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.191919,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 99,
            isTaker: false,
            price: 105,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1525,
                qPos: 15,
                margin: 305,
                marginRatio: 0.178451,
                bankBalance: 1618.75,
                pPos: 101.666667,
                fee: 305
            }
        },
        {
            pOracle: 99,
            isTaker: true,
            price: 95,
            size: -25,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 950,
                qPos: -10,
                margin: 190,
                marginRatio: 0.151515,
                bankBalance: 1286.25,
                pPos: 95,
                fee: 771.25
            }
        }
    ],
    "Test # 35 - Long + Long (Loss) + Short (Loss)-: -": [
        {
            pOracle: 100,
            isTaker: false,
            price: 100,
            size: 10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: 10,
                margin: 200,
                marginRatio: 0.2,
                bankBalance: 1750,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 102,
            isTaker: true,
            price: 95,
            size: 5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: 15,
                margin: 295,
                marginRatio: 0.228758,
                bankBalance: 1583.75,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 90,
            isTaker: true,
            price: 90,
            size: -25,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 900,
                qPos: -10,
                margin: 180,
                marginRatio: 0.2,
                bankBalance: 1268.75,
                pPos: 90,
                fee: 712.5
            }
        }
    ],

    "Test # 36 - Short + Short (Profit) + Long (Loss)-: -": [
        {
            pOracle: 99,
            isTaker: true,
            price: 100,
            size: -10,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1000,
                qPos: -10,
                margin: 200,
                marginRatio: 0.212121,
                bankBalance: 1650,
                pPos: 100,
                fee: 200
            }
        },
        {
            pOracle: 100,
            isTaker: false,
            price: 95,
            size: -5,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1475,
                qPos: -15,
                margin: 295,
                marginRatio: 0.18,
                bankBalance: 1531.25,
                pPos: 98.333333,
                fee: 295
            }
        },
        {
            pOracle: 101,
            isTaker: false,
            price: 105,
            size: 25,
            leverage: 5,
            expect: {
                mro: 0.2,
                oiOpen: 1050,
                qPos: 10,
                margin: 210,
                marginRatio: 0.168317,
                bankBalance: 1385,
                pPos: 105,
                fee: 820
            }
        }
    ]
};

describe("Trades with 5% Maker and 15% Taker fee", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let orderSigner: OrderSigner;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
    });

    const executeTests = async (testCases: Object) => {
        Object.keys(testCases).forEach((testName) => {
            describe(testName, () => {
                (testCases as any)[testName].forEach((testCase: any) => {
                    before(async () => {
                        await initState();
                    });

                    it(`Alice opens size:${Math.abs(testCase.size)} price:${
                        testCase.price
                    } leverage:${testCase.leverage}x ${
                        testCase.size > 0 ? "Long" : "Short"
                    } against Bob`, async () => {
                        // set price oracle price
                        const oraclePrice = toBigNumber(testCase.pOracle);
                        await contracts.priceOracle
                            .connect(owner)
                            .setPrice(bnToString(oraclePrice));

                        // true if long, false otherwise
                        const curMaker = testCase.isTaker ? bob : alice;
                        const curTaker = testCase.isTaker ? alice : bob;

                        const order = createOrder({
                            price: testCase.price,
                            quantity: Math.abs(testCase.size),
                            leverage: testCase.leverage,
                            isBuy: testCase.isTaker
                                ? !(testCase.size > 0)
                                : testCase.size > 0,
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

                        const positionBalance =
                            await Balance.getPositionBalance(
                                await alice.getAddress(),
                                contracts.perpetual as any
                            );
                        const marginBankBalance =
                            await Balance.getMarginBankBalance(
                                await alice.getAddress(),
                                contracts.marginbank as any
                            );

                        const feePoolAmount =
                            await Balance.getMarginBankBalance(
                                FEE_POOL_ADDRESS,
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
                                marginBankBalance,
                                feePoolAmount
                            )
                        );
                    });
                });
            });
        });
    };

    async function initState() {
        // deploy all contracts
        contracts = await deployAll({
            makerFee: toBigNumberStr(0.05),
            takerFee: toBigNumberStr(0.15),
            feePool: FEE_POOL_ADDRESS
        });

        await postDeployment(contracts, owner, {});

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

        await moveToStartOfTrading(contracts.perpetual);
    }

    executeTests(tests);
});
