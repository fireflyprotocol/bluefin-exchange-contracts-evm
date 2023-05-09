import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumberStr,
    BigNumber,
    Balance,
    SigningMethod,
    toBigNumber,
    bnToString,
    Trader
} from "../../submodules/library";
import { OrderSigner } from "../../submodules/library";
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
import { createOrder } from "../helpers/order";
import { expectPosition } from "../helpers/expect";

chai.use(chaiAsPromised);
const expect = chai.expect;

// all tests assume 5% maker/taker fee, imr/mmr 6.25/5% and 2_000 dollars in maker/taker accounts
// all tests are for taker
const tests = {
    "Test # 1 - Long Position Add Margin + [MR > IMR] + Proceed": [
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
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 85,
            price: 0,
            size: 0,
            leverage: 0,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.117647,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 85,
            price: 85,
            addMargin: 100,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 350,
                marginRatio: 0.235294,
                pPos: 100,
                fee: 100,
                bankBalance: 1600
            }
        }
    ],
    "Test # 2 - Long Position Remove Margin  + [MR > IMR] + Proceed": [
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
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 120,
            price: 0,
            size: 0,
            leverage: 0,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.375,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 120,
            price: 120,

            removeMargin: 100,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 150,
                marginRatio: 0.291667,
                pPos: 100,
                fee: 100,
                bankBalance: 1800
            }
        }
    ],
    "Test # 3 - Short Position Add Margin + [MR > IMR] + Proceed": [
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
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 102,
            price: 0,
            size: 0,
            leverage: 0,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.22549,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 102,
            price: 102,
            addMargin: 100,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 350,
                marginRatio: 0.323529,
                pPos: 100,
                fee: 100,
                bankBalance: 1600
            }
        }
    ],
    "Test # 4 - Short Position Remove Margin  + [MR > IMR] + Proceed": [
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
                fee: 100,
                bankBalance: 1700
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
                qPos: -10,
                margin: 250,
                marginRatio: 0.5625,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 80,
            price: 80,

            removeMargin: 100,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 150,
                marginRatio: 0.4375,
                pPos: 100,
                fee: 100,
                bankBalance: 1800
            }
        }
    ],
    "Test # 5 - Long Position Add Margin + [MR < MMR (MR Improves)] + Proceed":
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
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 73.60673,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: -0.018929,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 73.60673,
                price: 73.60673,
                addMargin: 50,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 300,
                    marginRatio: 0.049,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1650
                }
            }
        ],
    "Test # 6 - Short Position Add Margin + [MR < MMR (MR Improves)] + Proceed":
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
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 123.92755,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.008654,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 123.92755,
                price: 123.92755,
                addMargin: 50,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 300,
                    marginRatio: 0.049,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1650
                }
            }
        ],
    "Test # 7 - Long Position Remove Margin  + [MR < MMR (MR falls)] + Error": [
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
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 77.381443,
            price: 0,
            size: 0,
            leverage: 0,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.030775,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 77.381443,
            price: 77.381443,
            removeMargin: 20,
            expect: {
                error: "P16"
            }
        }
    ],
    "Test # 8 - Short Position Remove Margin  + [MR < MMR (MR falls)] + Error":
        [
            {
                pOracle: 64,
                price: 64,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 640,
                    qPos: -10,
                    margin: 160,
                    marginRatio: 0.25,
                    pPos: 64,
                    fee: 64,
                    bankBalance: 1808
                }
            },
            {
                pOracle: 76.213592,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 640,
                    qPos: -10,
                    margin: 160,
                    marginRatio: 0.049682,
                    pPos: 64,
                    fee: 64,
                    bankBalance: 1808
                }
            },
            {
                pOracle: 76.213592,
                price: 76.213592,
                removeMargin: 15,
                expect: {
                    error: "P16"
                }
            }
        ],
    "Test # 9 - Long Position Add Margin + [IMR > MR ≥ MMR (MR Improves)] + Proceed":
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
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 76.638478,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.021379,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 76.638478,
                price: 76.638478,
                addMargin: 25,

                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 275,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1675
                }
            }
        ],

    "Test # 10 - Short Position Add Margin + [IMR > MR ≥ MMR (MR Improves)] + Proceed":
        [
            {
                pOracle: 126,
                price: 126,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1260,
                    qPos: -10,
                    margin: 315,
                    marginRatio: 0.25,
                    pPos: 126,
                    fee: 126,
                    bankBalance: 1622
                }
            },
            {
                pOracle: 151.802657,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1260,
                    qPos: -10,
                    margin: 315,
                    marginRatio: 0.037531,
                    pPos: 126,
                    fee: 126,
                    bankBalance: 1622
                }
            },
            {
                pOracle: 151.802657,
                price: 151.802657,
                addMargin: 25,

                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1260,
                    qPos: -10,
                    margin: 340,
                    marginRatio: 0.054,
                    pPos: 126,
                    fee: 126,
                    bankBalance: 1597
                }
            }
        ],
    "Test # 11 - Long Position Remove Margin  + [IMR > MR ≥ MMR (MR Falls)] + Error":
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
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 79.598309,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.057769,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 79.598309,
                price: 79.598309,

                removeMargin: 3,
                expect: {
                    error: "P16"
                }
            }
        ],
    "Test # 12 - Short Position Remove Margin  + [IMR > MR ≥ MMR (MR Falls)] + Error":
        [
            {
                pOracle: 153,
                price: 153,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1530,
                    qPos: -10,
                    margin: 382.5,
                    marginRatio: 0.25,
                    pPos: 153,
                    fee: 153,
                    bankBalance: 1541
                }
            },
            {
                pOracle: 180.502846,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1530,
                    qPos: -10,
                    margin: 382.5,
                    marginRatio: 0.05954,
                    pPos: 153,
                    fee: 153,
                    bankBalance: 1541
                }
            },
            {
                pOracle: 180.502846,
                price: 180.502846,

                removeMargin: 10,
                expect: {
                    error: "P16"
                }
            }
        ],
    "Test # 13 - Long Position + Add more than Bank + [Cannot add more than bank] + Error":
        [
            {
                pOracle: 101,
                price: 100,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.257426,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 101,
                price: 0,

                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.257426,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 101,
                price: 0,
                addMargin: 2200,

                expect: {
                    error: "Insufficient account funds: 0x3c44cddd...fa4293bc"
                }
            }
        ],
    "Test # 14 - Short Position + Add more than Bank + [Cannot add more than bank] + Error":
        [
            {
                pOracle: 101,
                price: 100,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.237624,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 101,
                price: 0,

                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.237624,
                    pPos: 100,
                    fee: 100,
                    bankBalance: 1700
                }
            },
            {
                pOracle: 101,
                price: 0,
                addMargin: 2200,

                expect: {
                    error: "Insufficient account funds: 0x3c44cddd...fa4293bc"
                }
            }
        ],
    "Test # 15 - Long Position + Remove more than Margin + [P16] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,

            removeMargin: 270,
            expect: {
                error: "P16"
            }
        }
    ],

    "Test # 16 - Short Position + Remove more than Margin + [P16] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,

            removeMargin: 270,
            expect: {
                error: "P16"
            }
        }
    ],
    "Test # 17 - Long Position + Remove more than MRO + [P16] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            removeMargin: 20,
            expect: {
                error: "P16"
            }
        }
    ],
    "Test # 18 - Short Position + Remove more than MRO + [P16] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            removeMargin: 20,

            expect: {
                error: "P16"
            }
        }
    ],

    "Test # 23 - Long Position + Adding 0 Margin + [] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            addMargin: 0,
            expect: {
                error: "P13",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        }
    ],
    "Test # 24 - Short Position + Adding 0 Margin + [] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            addMargin: 0,

            expect: {
                error: "P13",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        }
    ],
    "Test # 25 - Long Position + Removing 0 Margin + [P15] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            removeMargin: 0,
            expect: {
                error: "P15"
            }
        }
    ],
    "Test # 26 - Short Position + Removing 0 Margin + [P15] + Error": [
        {
            pOracle: 101,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            removeMargin: 0,
            expect: {
                error: "P15",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        }
    ],
    "Test # 27 - Long Position + Add max + [] + Proceed": [
        {
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            addMargin: 50,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 300,
                marginRatio: 0.306931,
                pPos: 100,
                fee: 100,
                bankBalance: 1650
            }
        },
        {
            pOracle: 101,
            price: 0,
            addMargin: 1650,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 1950,
                marginRatio: 1.940594,
                pPos: 100,
                fee: 100,
                bankBalance: 0
            }
        }
    ],
    "Test # 28 - Short Position + Add max + [] + Proceed": [
        {
            pOracle: 101,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 101,
            price: 0,
            addMargin: 50,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 300,
                marginRatio: 0.287129,
                pPos: 100,
                fee: 100,
                bankBalance: 1650
            }
        },
        {
            pOracle: 101,
            addMargin: 1650,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 1950,
                marginRatio: 1.920792,
                pPos: 100,
                fee: 100,
                bankBalance: 0
            }
        }
    ],
    "Test # 29 - Long Position + Remove Max + [] + Proceed": [
        {
            pOracle: 101,
            price: 100,
            size: 10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.257426,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 200,
            price: 0,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 250,
                marginRatio: 0.625,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 200,
            price: 0,

            removeMargin: 250,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: 10,
                margin: 0,
                marginRatio: 0.5,
                pPos: 100,
                fee: 100,
                bankBalance: 1950
            }
        }
    ],
    "Test # 30 - Short Position + Remove Max + [] + Proceed": [
        {
            pOracle: 101,
            price: 100,
            size: -10,
            leverage: 4,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 0.237624,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 50,
            price: 0,

            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 250,
                marginRatio: 1.5,
                pPos: 100,
                fee: 100,
                bankBalance: 1700
            }
        },
        {
            pOracle: 50,
            price: 0,
            removeMargin: 250,
            expect: {
                error: "",
                mro: 0.25,
                oiOpen: 1000,
                qPos: -10,
                margin: 0,
                marginRatio: 1,
                pPos: 100,
                fee: 100,
                bankBalance: 1950
            }
        }
    ],
    "Test # 31 - Long Position + Remove previously added margin + [] + Proceed":
        [
            {
                pOracle: 101,
                price: 101,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 252.5,
                    marginRatio: 0.25,
                    pPos: 101,
                    fee: 101,
                    bankBalance: 1697
                }
            },
            {
                pOracle: 101,
                price: 0,
                addMargin: 250,

                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 502.5,
                    marginRatio: 0.497525,
                    pPos: 101,
                    fee: 101,
                    bankBalance: 1447
                }
            },
            {
                pOracle: 101,
                price: 0,

                removeMargin: 250,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 252.5,
                    marginRatio: 0.25,
                    pPos: 101,
                    fee: 101,
                    bankBalance: 1697
                }
            }
        ],
    "Test # 32 - Short Position + Remove previously added margin + [] + Proceed":
        [
            {
                pOracle: 101,
                price: 101,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: -10,
                    margin: 252.5,
                    marginRatio: 0.25,
                    pPos: 101,
                    fee: 101,
                    bankBalance: 1697
                }
            },
            {
                pOracle: 101,
                addMargin: 250,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: -10,
                    margin: 502.5,
                    marginRatio: 0.497525,
                    pPos: 101,
                    fee: 101,
                    bankBalance: 1447
                }
            },
            {
                pOracle: 101,
                removeMargin: 250,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: -10,
                    margin: 252.5,
                    marginRatio: 0.25,
                    pPos: 101,
                    fee: 101,
                    bankBalance: 1697
                }
            }
        ]
};

describe("Add/Remove Margin Tests with 5% Maker/Taker Fee and 6.25%/5% IMR/MMR", () => {
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
                            : testCase.addMargin >= 0
                            ? `Bob adds margin ${testCase.addMargin}`
                            : testCase.removeMargin >= 0
                            ? `Bob removes margin ${testCase.removeMargin}`
                            : `Price oracle updated to ${testCase.pOracle}`;

                    it(testCaseName, async () => {
                        // set price oracle price
                        const oraclePrice = toBigNumber(testCase.pOracle);
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
                        if (testCase.addMargin >= 0) {
                            if (testCase.expect.error == "") {
                                await contracts.perpetual
                                    .connect(taker)
                                    .addMargin(
                                        await taker.getAddress(),
                                        toBigNumberStr(testCase.addMargin)
                                    );
                            } else {
                                // an error is expected
                                await expect(
                                    contracts.perpetual
                                        .connect(taker)
                                        .addMargin(
                                            await taker.getAddress(),
                                            toBigNumberStr(testCase.addMargin)
                                        )
                                ).to.be.eventually.rejectedWith(
                                    `VM Exception while processing transaction: reverted with reason string '${testCase.expect.error}'`
                                );
                                return;
                            }
                        }

                        // check if margin is to be removed
                        if (testCase.removeMargin >= 0) {
                            if (testCase.expect.error == "") {
                                await contracts.perpetual
                                    .connect(taker)
                                    .removeMargin(
                                        await taker.getAddress(),
                                        toBigNumberStr(testCase.removeMargin)
                                    );
                            } else {
                                // an error is expected
                                await expect(
                                    contracts.perpetual
                                        .connect(taker)
                                        .removeMargin(
                                            await taker.getAddress(),
                                            toBigNumberStr(
                                                testCase.removeMargin
                                            )
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
                                  .multipliedBy("1e18")
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
        // deploy all contracts
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
