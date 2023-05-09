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

chai.use(chaiAsPromised);
const expect = chai.expect;

// // all tests assume 0% maker taker fee and 2_000 dollars in maker/taker accounts

const tests = {
    "Test # 1 - Long Position + Long Trade (Increasing) + [MR > IMR] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 83.333333,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 83.333333,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1600,
                    qPos: 16,
                    margin: 400,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 2 - Long Position + Short Trade (Reducing) + [MR > IMR] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 83.333333,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 83.333333,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 100,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 3 - Long Position + Short Trade (Closing) + [MR > IMR] + Proceed": [
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
                fee: 0
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
                fee: 0
            }
        },
        {
            pOracle: 100,
            price: 100,
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
                fee: 0
            }
        }
    ],
    "Test # 4 - Long Position + Short Trade (Flipping) + [MR > IMR] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 85.227273,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.12,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 85.227273,
                price: 75,
                size: -16,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 450,
                    qPos: -6,
                    margin: 112.5,
                    marginRatio: 0.1,
                    pPos: 75,
                    fee: 0
                }
            }
        ],
    "Test # 5 - Short Position + Short Trade (Increasing) + [MR > IMR] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 113.636364,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 113.636364,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1600,
                    qPos: -16,
                    margin: 400,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 6 - Short Position + Long Trade (Reducing) + [MR > IMR] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 113.636364,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 113.636364,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: -4,
                    margin: 100,
                    marginRatio: 0.1,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 7 - Short Position + Long Trade (Closing) + [MR > IMR] + Proceed": [
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
                fee: 0
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
                fee: 0
            }
        },
        {
            pOracle: 100,
            price: 100,
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
                fee: 0
            }
        }
    ],
    "Test # 9 - Long Position + Long Trade (Increasing) + [MR < MMR (MR Improves)] + Error":
        [
            {
                pOracle: 101,
                price: 101,
                size: 10,
                leverage: 5,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 202,
                    marginRatio: 0.2,
                    pPos: 101,
                    fee: 0
                }
            },
            {
                pOracle: 83.854167,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 202,
                    marginRatio: 0.036422,
                    pPos: 101,
                    fee: 0
                }
            },
            {
                pOracle: 83.854167,
                price: 100,
                size: 6,
                leverage: 5,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 10 - Long Position + Short Trade (Reducing) + [MR < MMR (MR Improves)] + Proceed":
        [
            {
                pOracle: 100,
                price: 100,
                size: 10,
                leverage: 5,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 200,
                    marginRatio: 0.2,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 83.333333,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 200,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 83.333333,
                price: 100,
                size: -6,
                leverage: 5,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 80,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 11 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 120,
                price: 120,
                size: 10,
                leverage: 5,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1200,
                    qPos: 10,
                    margin: 240,
                    marginRatio: 0.2,
                    pPos: 120,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1200,
                    qPos: 10,
                    margin: 240,
                    marginRatio: 0.04,
                    pPos: 120,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
                size: -10,
                leverage: 5,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 0
                }
            }
        ],
    "Test # 13 - Short Position + Short Trade (Increasing) + [MR < MMR (MR Improves)] + Error":
        [
            {
                pOracle: 99,
                price: 99,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 990,
                    qPos: -10,
                    margin: 247.5,
                    marginRatio: 0.25,
                    pPos: 99,
                    fee: 0
                }
            },
            {
                pOracle: 119.441106,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 990,
                    qPos: -10,
                    margin: 247.5,
                    marginRatio: 0.036075,
                    pPos: 99,
                    fee: 0
                }
            },
            {
                pOracle: 119.441106,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 14 - Short Position + Long Trade (Reducing) + [MR < MMR (MR Improves)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 120.192308,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 120.192308,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: -4,
                    margin: 100,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 15 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 82,
                price: 82,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 820,
                    qPos: -10,
                    margin: 205,
                    marginRatio: 0.25,
                    pPos: 82,
                    fee: 0
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
                    oiOpen: 820,
                    qPos: -10,
                    margin: 205,
                    marginRatio: 0.025,
                    pPos: 82,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 17 - Long Position + Long Trade (Increasing) + [MR < MMR (MR doesn’t change)] + Error":
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
                    fee: 0
                }
            },
            {
                pOracle: 78.125,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 78.125,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 18 - Long Position + Short Trade (Reducing) + [MR < MMR (MR doesn’t change)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 78.125,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 78.125,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 100,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 19 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 126,
                price: 126,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1260,
                    qPos: 10,
                    margin: 315,
                    marginRatio: 0.25,
                    pPos: 126,
                    fee: 0
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
                    oiOpen: 1260,
                    qPos: 10,
                    margin: 315,
                    marginRatio: 0.055,
                    pPos: 126,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 21 - Short Position + Short Trade (Increasing) + [MR < MMR (MR doesn’t change)] + Error":
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
                    fee: 0
                }
            },
            {
                pOracle: 120.192308,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 120.192308,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 22 - Short Position + Long Trade (Reducing) + [MR < MMR (MR doesn’t change)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 120.192308,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 120.192308,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: -4,
                    margin: 100,
                    marginRatio: 0.04,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 23 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 83.2,
                price: 83.2,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 832,
                    qPos: -10,
                    margin: 208,
                    marginRatio: 0.25,
                    pPos: 83.2,
                    fee: 0
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
                    oiOpen: 832,
                    qPos: -10,
                    margin: 208,
                    marginRatio: 0.04,
                    pPos: 83.2,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 25 - Long Position + Long Trade (Increasing) + [MR < MMR (MR falls)] + Error":
        [
            {
                pOracle: 99,
                price: 99,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 990,
                    qPos: 10,
                    margin: 247.5,
                    marginRatio: 0.25,
                    pPos: 99,
                    fee: 0
                }
            },
            {
                pOracle: 77.636719,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 990,
                    qPos: 10,
                    margin: 247.5,
                    marginRatio: 0.043623,
                    pPos: 99,
                    fee: 0
                }
            },
            {
                pOracle: 77.636719,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "P35"
                }
            }
        ],
    "Test # 26 - Long Position + Short Trade (Reducing) + [MR < MMR (MR falls)] + Error":
        [
            {
                pOracle: 0,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 0
                }
            },
            {
                pOracle: 0,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 0
                }
            },
            {
                pOracle: 0,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 27 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 128,
                price: 128,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1280,
                    qPos: 10,
                    margin: 320,
                    marginRatio: 0.25,
                    pPos: 128,
                    fee: 0
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
                    oiOpen: 1280,
                    qPos: 10,
                    margin: 320,
                    marginRatio: 0.04,
                    pPos: 128,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 29 - Short Position + Short Trade (Increasing) + [MR < MMR (MR falls)] + Error":
        [
            {
                pOracle: 102.5,
                price: 102.5,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1025,
                    qPos: -10,
                    margin: 256.25,
                    marginRatio: 0.25,
                    pPos: 102.5,
                    fee: 0
                }
            },
            {
                pOracle: 122.070313,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1025,
                    qPos: -10,
                    margin: 256.25,
                    marginRatio: 0.0496,
                    pPos: 102.5,
                    fee: 0
                }
            },
            {
                pOracle: 122.070313,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P35"
                }
            }
        ],
    "Test # 30 - Short Position + Long Trade (Reducing) + [MR < MMR (MR falls)] + Error":
        [
            {
                pOracle: 0,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 0
                }
            },
            {
                pOracle: 0,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0,
                    oiOpen: 0,
                    qPos: 0,
                    margin: 0,
                    marginRatio: 1,
                    pPos: 0,
                    fee: 0
                }
            },
            {
                pOracle: 0,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 31 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 83.5,
                price: 83.5,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 835,
                    qPos: -10,
                    margin: 208.75,
                    marginRatio: 0.25,
                    pPos: 83.5,
                    fee: 0
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
                    oiOpen: 835,
                    qPos: -10,
                    margin: 208.75,
                    marginRatio: 0.04375,
                    pPos: 83.5,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 33 - Long Position + Long Trade (Increasing) + [IMR > MR >= MMR (MR Improves)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 79.776691,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 252.5,
                    marginRatio: 0.050475,
                    pPos: 101,
                    fee: 0
                }
            },
            {
                pOracle: 79.776691,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1610,
                    qPos: 16,
                    margin: 402.5,
                    marginRatio: 0.054,
                    pPos: 100.625,
                    fee: 0
                }
            }
        ],
    "Test # 34 - Long Position + Short Trade (Reducing) + [IMR > MR >= MMR (MR Improves)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 80.073996,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1010,
                    qPos: 10,
                    margin: 252.5,
                    marginRatio: 0.054,
                    pPos: 101,
                    fee: 0
                }
            },
            {
                pOracle: 80.073996,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 404,
                    qPos: 4,
                    margin: 101,
                    marginRatio: 0.054,
                    pPos: 101,
                    fee: 0
                }
            }
        ],
    "Test # 35 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 125.1,
                price: 125.1,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: 0.25,
                    pPos: 125.1,
                    fee: 0
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
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: 0.06175,
                    pPos: 125.1,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 37 - Short Position + Short Trade (Increasing) + [IMR > MR >= MMR (MR Improves)] + Proceed":
        [
            {
                pOracle: 99,
                price: 99,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 990,
                    qPos: -10,
                    margin: 247.5,
                    marginRatio: 0.25,
                    pPos: 99,
                    fee: 0
                }
            },
            {
                pOracle: 117.854602,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 990,
                    qPos: -10,
                    margin: 247.5,
                    marginRatio: 0.050023,
                    pPos: 99,
                    fee: 0
                }
            },
            {
                pOracle: 117.854602,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1590,
                    qPos: -16,
                    margin: 397.5,
                    marginRatio: 0.054,
                    pPos: 99.375,
                    fee: 0
                }
            }
        ],
    "Test # 38 - Short Position + Long Trade (Reducing) + [IMR > MR >= MMR (MR Improves)] + Proceed":
        [
            {
                pOracle: 87,
                price: 87,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: 0.25,
                    pPos: 87,
                    fee: 0
                }
            },
            {
                pOracle: 103.178368,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: 0.054,
                    pPos: 87,
                    fee: 0
                }
            },
            {
                pOracle: 103.178368,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 348,
                    qPos: -4,
                    margin: 87,
                    marginRatio: 0.054,
                    pPos: 87,
                    fee: 0
                }
            }
        ],
    "Test # 39 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 84,
                price: 84,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: 0.25,
                    pPos: 84,
                    fee: 0
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
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: 0.05,
                    pPos: 84,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 41 - Long Position + Long Trade (Increasing) + [IMR > MR >= MMR (MR Doesn’t Change)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 79.281184,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 79.281184,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1600,
                    qPos: 16,
                    margin: 400,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 42 - Long Position + Short Trade (Reducing) + [IMR > MR >= MMR (MR Doesn’t Change)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 79.281184,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 79.281184,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 100,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 43 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 125.1,
                price: 125.1,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: 0.25,
                    pPos: 125.1,
                    fee: 0
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
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: 0.06175,
                    pPos: 125.1,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],

    "Test # 45 - Short Position + Short Trade (Increasing) + [IMR > MR >= MMR (MR Doesn’t Change)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 118.595825,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: -10,
                    margin: 250,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 118.595825,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1600,
                    qPos: -16,
                    margin: 400,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 46 - Short Position + Long Trade (Reducing) + [IMR > MR >= MMR (MR Doesn’t Change)] + Proceed":
        [
            {
                pOracle: 87,
                price: 87,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: 0.25,
                    pPos: 87,
                    fee: 0
                }
            },
            {
                pOracle: 103.178368,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: 0.054,
                    pPos: 87,
                    fee: 0
                }
            },
            {
                pOracle: 103.178368,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 348,
                    qPos: -4,
                    margin: 87,
                    marginRatio: 0.054,
                    pPos: 87,
                    fee: 0
                }
            }
        ],
    "Test # 47 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 84,
                price: 84,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: 0.25,
                    pPos: 84,
                    fee: 0
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
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: 0.05,
                    pPos: 84,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],

    "Test # 49 - Long Position + Long Trade (Increasing) + [IMR > MR >= MMR (MR Falls)] + Error":
        [
            {
                pOracle: 97.75,
                price: 97.75,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 977.5,
                    qPos: 10,
                    margin: 244.375,
                    marginRatio: 0.25,
                    pPos: 97.75,
                    fee: 0
                }
            },
            {
                pOracle: 78.166292,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 977.5,
                    qPos: 10,
                    margin: 244.375,
                    marginRatio: 0.062096,
                    pPos: 97.75,
                    fee: 0
                }
            },
            {
                pOracle: 78.166292,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "P35"
                }
            }
        ],
    "Test # 50 - Long Position + Short Trade (Reducing) + [IMR > MR >= MMR (MR Falls)] + Proceed":
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
                    fee: 0
                }
            },
            {
                pOracle: 79.281184,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            },
            {
                pOracle: 79.281184,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 400,
                    qPos: 4,
                    margin: 100,
                    marginRatio: 0.054,
                    pPos: 100,
                    fee: 0
                }
            }
        ],
    "Test # 51 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 125.1,
                price: 125.1,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: 0.25,
                    pPos: 125.1,
                    fee: 0
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
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: 0.06175,
                    pPos: 125.1,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ],
    "Test # 53 - Short Position + Short Trade (Increasing) + [IMR > MR >= MMR (MR Falls)] + Error":
        [
            {
                pOracle: 102,
                price: 102,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1020,
                    qPos: -10,
                    margin: 255,
                    marginRatio: 0.25,
                    pPos: 102,
                    fee: 0
                }
            },
            {
                pOracle: 120.078273,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1020,
                    qPos: -10,
                    margin: 255,
                    marginRatio: 0.061807,
                    pPos: 102,
                    fee: 0
                }
            },
            {
                pOracle: 120.078273,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P35"
                }
            }
        ],
    "Test # 54 - Short Position + Long Trade (Reducing) + [IMR > MR >= MMR (MR Falls)] + Proceed":
        [
            {
                pOracle: 87,
                price: 87,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: 0.25,
                    pPos: 87,
                    fee: 0
                }
            },
            {
                pOracle: 103.178368,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: 0.054,
                    pPos: 87,
                    fee: 0
                }
            },
            {
                pOracle: 103.178368,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 348,
                    qPos: -4,
                    margin: 87,
                    marginRatio: 0.054,
                    pPos: 87,
                    fee: 0
                }
            }
        ],
    "Test # 55 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)] + Proceed":
        [
            {
                pOracle: 84,
                price: 84,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: 0.25,
                    pPos: 84,
                    fee: 0
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
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: 0.05,
                    pPos: 84,
                    fee: 0
                }
            },
            {
                pOracle: 100,
                price: 100,
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
                    fee: 0
                }
            }
        ]
};

describe("Margin Tests with 0% maker/taker fee and 6.25% and 5% IMR/MMR fee", () => {
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
                                // perform expects
                                expectPosition(
                                    expectedPosition,
                                    toTestPositionExpect(
                                        positionBalance,
                                        pPos,
                                        marginRatio
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
                                    testCase.expect.error
                                );
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
            imr: toBigNumberStr(0.0625),
            mmr: toBigNumberStr(0.05),
            tickSize: toBigNumberStr(0.0000001)
        });

        // perform post deployment steps and set contract to have 0 market/limit fee
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
