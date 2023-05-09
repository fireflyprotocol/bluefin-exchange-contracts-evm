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
    "Test # 1 - Long Position + Long Trade (Increasing) + [MR > IMR]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 2 - Long Position + Short Trade (Reducing) + [MR > IMR]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 3 - Long Position + Short Trade (Closing) + [MR > IMR]+Proceed-0": [
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
                fee: 140
            }
        }
    ],
    "Test # 4 - Long Position + Short Trade (Flipping) + [MR > IMR]+Proceed-0":
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
                    fee: 70
                }
            },
            {
                pOracle: 86.363636,
                price: 76,
                size: -16,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 456,
                    qPos: -6,
                    margin: 114,
                    marginRatio: 0.1,
                    pPos: 76,
                    fee: 149.92
                }
            }
        ],
    "Test # 5 - Short Position + Short Trade (Increasing) + [MR > IMR]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 6 - Short Position + Long Trade (Reducing) + [MR > IMR]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 7 - Short Position + Long Trade (Closing) + [MR > IMR]+Proceed-0": [
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
                fee: 140
            }
        }
    ],
    "Test # 8 - Short Position + Long Trade (Flipping) + [MR > IMR]+Proceed-0":
        [
            {
                pOracle: 95,
                price: 95,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 950,
                    qPos: -10,
                    margin: 237.5,
                    marginRatio: 0.25,
                    pPos: 95,
                    fee: 66.5
                }
            },
            {
                pOracle: 104.166667,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 950,
                    qPos: -10,
                    margin: 237.5,
                    marginRatio: 0.14,
                    pPos: 95,
                    fee: 66.5
                }
            },
            {
                pOracle: 98.333333,
                price: 118,
                size: 16,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 708,
                    qPos: 6,
                    margin: 177,
                    marginRatio: 0.1,
                    pPos: 118,
                    fee: 182.56
                }
            }
        ],
    "Test # 9 - Long Position + Long Trade (Increasing) + [MR < MMR (MR Improves) ]+ Error- MR <= MMR position size can only be reduced":
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
                    fee: 70.7
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
                    fee: 70.7
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
    "Test # 11 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 84
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
                    fee: 84
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
                    fee: 154
                }
            }
        ],
    "Test # 12 - Long Position + Short Trade (Flipping) + [MR < MMR (MR Improves) ]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 140,
                price: 140,
                size: 10,
                leverage: 5,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1400,
                    qPos: 10,
                    margin: 280,
                    marginRatio: 0.2,
                    pPos: 140,
                    fee: 98
                }
            },
            {
                pOracle: 115.384615,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.2,
                    oiOpen: 1400,
                    qPos: 10,
                    margin: 280,
                    marginRatio: 0.029333,
                    pPos: 140,
                    fee: 98
                }
            },
            {
                pOracle: 115.384615,
                price: 100,
                size: -16,
                leverage: 5,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 13 - Short Position + Short Trade (Increasing) + [MR < MMR (MR Improves) ]+ Error- MR <= MMR position size can only be reduced":
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
                    fee: 69.3
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
                    fee: 69.3
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
    "Test # 15 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 57.4
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
                    fee: 57.4
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
                    fee: 127.4
                }
            }
        ],
    "Test # 16 - Short Position + Long Trade (Flipping) + [MR < MMR (MR Improves) ]+Error- Cannot trade when loss exceeds margin. Please add margin":
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
                    fee: 44.8
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
                    oiOpen: 640,
                    qPos: -10,
                    margin: 160,
                    marginRatio: 0.024,
                    pPos: 64,
                    fee: 44.8
                }
            },
            {
                pOracle: 78.125,
                price: 100,
                size: 16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 17 - Long Position + Long Trade (Increasing) + [MR < MMR (MR doesn’t change) ]+ Error- MR <= MMR position size can only be reduced":
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
                    fee: 70
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
    "Test # 18 - Long Position + Short Trade (Reducing) + [MR < MMR (MR doesn’t change) ]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 19 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 88.2
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
                    fee: 88.2
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
                    fee: 158.2
                }
            }
        ],
    "Test # 20 - Long Position + Short Trade (Flipping) + [MR < MMR (MR doesn’t change) ]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 153.846154,
                price: 153.846154,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1538.461538,
                    qPos: 10,
                    margin: 384.615385,
                    marginRatio: 0.25,
                    pPos: 153.846154,
                    fee: 107.692308
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
                    oiOpen: 1538.461538,
                    qPos: 10,
                    margin: 384.615385,
                    marginRatio: 0.04,
                    pPos: 153.846154,
                    fee: 107.692308
                }
            },
            {
                pOracle: 120.192308,
                price: 100,
                size: -16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 21 - Short Position + Short Trade (Increasing) + [MR < MMR (MR doesn’t change) ]+ Error- MR <= MMR position size can only be reduced":
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
                    fee: 70
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
    "Test # 22 - Short Position + Long Trade (Reducing) + [MR < MMR (MR doesn’t change) ]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 23 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 58.24
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
                    fee: 58.24
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
                    fee: 128.24
                }
            }
        ],
    "Test # 24 - Short Position + Long Trade (Flipping) + [MR < MMR (MR doesn’t change) ]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 65,
                price: 65,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 650,
                    qPos: -10,
                    margin: 162.5,
                    marginRatio: 0.25,
                    pPos: 65,
                    fee: 45.5
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
                    oiOpen: 650,
                    qPos: -10,
                    margin: 162.5,
                    marginRatio: 0.04,
                    pPos: 65,
                    fee: 45.5
                }
            },
            {
                pOracle: 78.125,
                price: 100,
                size: 16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 25 - Long Position + Long Trade (Increasing) + [MR < MMR (MR falls) ]+ Error- P35":
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
                    fee: 69.3
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
                    fee: 69.3
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
    "Test # 27 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 89.6
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
                    fee: 89.6
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
                    fee: 159.6
                }
            }
        ],
    "Test # 28 - Long Position + Short Trade (Flipping) + [MR < MMR (MR falls) ]+ Error- P34":
        [
            {
                pOracle: 153,
                price: 153,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1530,
                    qPos: 10,
                    margin: 382.5,
                    marginRatio: 0.25,
                    pPos: 153,
                    fee: 107.1
                }
            },
            {
                pOracle: 138.380409,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1530,
                    qPos: 10,
                    margin: 382.5,
                    marginRatio: 0.170764,
                    pPos: 153,
                    fee: 107.1
                }
            },
            {
                pOracle: 138.380409,
                price: 115.1325,
                size: -16,
                leverage: 4,
                expect: {
                    error: "P34"
                }
            }
        ],
    "Test # 29 - Short Position + Short Trade (Increasing) + [MR < MMR (MR falls) ]+ Error- P35":
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
                    fee: 71.75
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
                    fee: 71.75
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
    "Test # 31 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 58.45
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
                    fee: 58.45
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
                    fee: 128.45
                }
            }
        ],
    "Test # 32 - Short Position + Long Trade (Flipping) + [MR < MMR (MR falls) ]+ Error- P34":
        [
            {
                pOracle: 65.2,
                price: 65.2,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 652,
                    qPos: -10,
                    margin: 163,
                    marginRatio: 0.25,
                    pPos: 65.2,
                    fee: 45.64
                }
            },
            {
                pOracle: 63.544531,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 652,
                    qPos: -10,
                    margin: 163,
                    marginRatio: 0.282565,
                    pPos: 65.2,
                    fee: 45.64
                }
            },
            {
                pOracle: 63.544531,
                price: 81.337,
                size: 16,
                leverage: 4,
                expect: {
                    error: "P34"
                }
            }
        ],
    "Test # 33 - Long Position + Long Trade (Increasing) + [IMR > MR ≥ MMR (MR Improves)]+Proceed-0":
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
                    fee: 70.7
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
                    fee: 70.7
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
                    fee: 112.7
                }
            }
        ],
    "Test # 35 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 87.57
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
                    fee: 87.57
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
                    fee: 157.57
                }
            }
        ],
    "Test # 36 - Long Position + Short Trade (Flipping) + [IMR > MR ≥ MMR (MR Improves)]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 150,
                price: 150,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1500,
                    qPos: 10,
                    margin: 375,
                    marginRatio: 0.25,
                    pPos: 150,
                    fee: 105
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
                    oiOpen: 1500,
                    qPos: 10,
                    margin: 375,
                    marginRatio: 0.0514,
                    pPos: 150,
                    fee: 105
                }
            },
            {
                pOracle: 118.595825,
                price: 100,
                size: -16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 37 - Short Position + Short Trade (Increasing) + [IMR > MR ≥ MMR (MR Improves)]+Proceed-0":
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
                    fee: 69.3
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
                    fee: 69.3
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
                    fee: 111.3
                }
            }
        ],
    "Test # 39 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 58.8
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
                    fee: 58.8
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
                    fee: 128.8
                }
            }
        ],
    "Test # 40 - Short Position + Long Trade (Flipping) + [IMR > MR ≥ MMR (MR Improves)]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 66.75,
                price: 66.75,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 667.5,
                    qPos: -10,
                    margin: 166.875,
                    marginRatio: 0.25,
                    pPos: 66.75,
                    fee: 46.725
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
                    oiOpen: 667.5,
                    qPos: -10,
                    margin: 166.875,
                    marginRatio: 0.052425,
                    pPos: 66.75,
                    fee: 46.725
                }
            },
            {
                pOracle: 79.281184,
                price: 100,
                size: 16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 41 - Long Position + Long Trade (Increasing) + [IMR > MR ≥ MMR (MR Doesn’t Change)]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 42 - Long Position + Short Trade (Reducing) + [IMR > MR ≥ MMR (MR Doesn’t Change)]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 43 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 87.57
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
                    fee: 87.57
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
                    fee: 157.57
                }
            }
        ],
    "Test # 44 - Long Position + Short Trade (Flipping) + [IMR > MR ≥ MMR (MR Doesn’t Change)]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 149.588868,
                price: 149.588868,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1495.888678,
                    qPos: 10,
                    margin: 373.97217,
                    marginRatio: 0.25,
                    pPos: 149.588868,
                    fee: 104.712208
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
                    oiOpen: 1495.888678,
                    qPos: 10,
                    margin: 373.97217,
                    marginRatio: 0.054,
                    pPos: 149.588868,
                    fee: 104.712208
                }
            },
            {
                pOracle: 118.595825,
                price: 100,
                size: -16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 45 - Short Position + Short Trade (Increasing) + [IMR > MR ≥ MMR (MR Doesn’t Change)]+Proceed-0":
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
                    fee: 70
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
                    fee: 112
                }
            }
        ],
    "Test # 46 - Short Position + Long Trade (Reducing) + [IMR > MR ≥ MMR (MR Doesn’t Change)]+Proceed-0":
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
                    fee: 60.9
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
                    fee: 60.9
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
                    fee: 102.9
                }
            }
        ],
    "Test # 47 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 58.8
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
                    fee: 58.8
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
                    fee: 128.8
                }
            }
        ],
    "Test # 48 - Short Position + Long Trade (Flipping) + [IMR > MR ≥ MMR (MR Doesn’t Change)]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 66.849894,
                price: 66.849894,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 668.498943,
                    qPos: -10,
                    margin: 167.124736,
                    marginRatio: 0.25,
                    pPos: 66.849894,
                    fee: 46.794926
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
                    oiOpen: 668.498943,
                    qPos: -10,
                    margin: 167.124736,
                    marginRatio: 0.054,
                    pPos: 66.849894,
                    fee: 46.794926
                }
            },
            {
                pOracle: 79.281184,
                price: 100,
                size: 16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 49 - Long Position + Long Trade (Increasing) + [IMR > MR ≥ MMR (MR Falls)]+ Error- P35":
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
                    fee: 68.425
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
                    fee: 68.425
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
    "Test # 51 - Long Position + Short Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 87.57
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
                    fee: 87.57
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
                    fee: 157.57
                }
            }
        ],
    "Test # 52 - Long Position + Short Trade (Flipping) + [IMR > MR ≥ MMR (MR Falls)]+ Error- P34":
        [
            {
                pOracle: 149,
                price: 149,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1490,
                    qPos: 10,
                    margin: 372.5,
                    marginRatio: 0.25,
                    pPos: 149,
                    fee: 104.3
                }
            },
            {
                pOracle: 132.972604,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1490,
                    qPos: 10,
                    margin: 372.5,
                    marginRatio: 0.159601,
                    pPos: 149,
                    fee: 104.3
                }
            },
            {
                pOracle: 132.972604,
                price: 112.1225,
                size: -16,
                leverage: 4,
                expect: {
                    error: "P34"
                }
            }
        ],
    "Test # 53 - Short Position + Short Trade (Increasing) + [IMR > MR ≥ MMR (MR Falls)]+ Error- P35":
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
                    fee: 71.4
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
                    fee: 71.4
                }
            },
            {
                pOracle: 111.778196,
                price: 81.337,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P35"
                }
            }
        ],
    "Test # 55 - Short Position + Long Trade (Closing) + [Closing (MR = 100%)]+Proceed-0":
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
                    fee: 58.8
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
                    fee: 58.8
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
                    fee: 128.8
                }
            }
        ],
    "Test # 56 - Short Position + Long Trade (Flipping) + [IMR > MR ≥ MMR (MR Falls)]+ Error- P34":
        [
            {
                pOracle: 67,
                price: 67,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 670,
                    qPos: -10,
                    margin: 167.5,
                    marginRatio: 0.25,
                    pPos: 67,
                    fee: 46.9
                }
            },
            {
                pOracle: 66.265196,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 670,
                    qPos: -10,
                    margin: 167.5,
                    marginRatio: 0.263861,
                    pPos: 67,
                    fee: 46.9
                }
            },
            {
                pOracle: 66.265196,
                price: 83.5825,
                size: 16,
                leverage: 4,
                expect: {
                    error: "P34"
                }
            }
        ],
    "Test # 57 - Long Position + Long Trade (Increasing) + [MR < 0]+ Error- MR <= MMR position size can only be reduced":
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
                    fee: 68.425
                }
            },
            {
                pOracle: 57.75,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 977.5,
                    qPos: 10,
                    margin: 244.375,
                    marginRatio: -0.269481,
                    pPos: 97.75,
                    fee: 68.425
                }
            },
            {
                pOracle: 57.75,
                price: 74.534375,
                size: 6,
                leverage: 4,
                expect: {
                    error: "P36"
                }
            }
        ],
    "Test # 58 - Long Position + Short Trade (Reducing) + [MR < 0]+Error- P37":
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
                pOracle: 60,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1000,
                    qPos: 10,
                    margin: 250,
                    marginRatio: -0.25,
                    pPos: 100,
                    fee: 70
                }
            },
            {
                pOracle: 60,
                price: 76.25,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P37"
                }
            }
        ],
    "Test # 59 - Long Position + Short Trade (Closing w Loss <= Margin) + [MR < 0]+Proceed-0":
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
                    fee: 87.57
                }
            },
            {
                pOracle: 85.1,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: -0.102526,
                    pPos: 125.1,
                    fee: 87.57
                }
            },
            {
                pOracle: 85.1,
                price: 94.13775,
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
                    fee: 137.766375
                }
            }
        ],
    "Test # 60 - Long Position + Short Trade (Closing w Loss > Margin) + [MR < 0]+Error- Cannot trade when loss exceeds margin. Please add margin":
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
                    fee: 87.57
                }
            },
            {
                pOracle: 85.1,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1251,
                    qPos: 10,
                    margin: 312.75,
                    marginRatio: -0.102526,
                    pPos: 125.1,
                    fee: 87.57
                }
            },
            {
                pOracle: 85.1,
                price: 92.26125,
                size: -10,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 61 - Long Position + Short Trade (Flipping w Loss <= Margin) + [MR < 0]+Proceed-0":
        [
            {
                pOracle: 149,
                price: 149,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1490,
                    qPos: 10,
                    margin: 372.5,
                    marginRatio: 0.25,
                    pPos: 149,
                    fee: 104.3
                }
            },
            {
                pOracle: 109,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1490,
                    qPos: 10,
                    margin: 372.5,
                    marginRatio: -0.025229,
                    pPos: 149,
                    fee: 104.3
                }
            },
            {
                pOracle: 109,
                price: 112.1225,
                size: -16,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 672.735,
                    qPos: -6,
                    margin: 168.18375,
                    marginRatio: 0.285808,
                    pPos: 112.1225,
                    fee: 211.1777
                }
            }
        ],
    "Test # 62 - Long Position + Short Trade (Flipping w Loss > Margin) + [MR < 0]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 149,
                price: 149,
                size: 10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1490,
                    qPos: 10,
                    margin: 372.5,
                    marginRatio: 0.25,
                    pPos: 149,
                    fee: 104.3
                }
            },
            {
                pOracle: 109,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1490,
                    qPos: 10,
                    margin: 372.5,
                    marginRatio: -0.025229,
                    pPos: 149,
                    fee: 104.3
                }
            },
            {
                pOracle: 109,
                price: 109.8875,
                size: -16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],
    "Test # 63 - Short Position + Short Trade (Increasing) + [MR < 0]+ Error- P35":
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
                    fee: 71.4
                }
            },
            {
                pOracle: 142,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 1020,
                    qPos: -10,
                    margin: 255,
                    marginRatio: -0.102113,
                    pPos: 102,
                    fee: 71.4
                }
            },
            {
                pOracle: 142,
                price: 100,
                size: -6,
                leverage: 4,
                expect: {
                    error: "P35"
                }
            }
        ],
    "Test # 64 - Short Position + Long Trade (Reducing) + [MR < 0]+Error- P37":
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
                    fee: 60.9
                }
            },
            {
                pOracle: 127,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 870,
                    qPos: -10,
                    margin: 217.5,
                    marginRatio: -0.143701,
                    pPos: 87,
                    fee: 60.9
                }
            },
            {
                pOracle: 127,
                price: 100,
                size: 6,
                leverage: 4,
                expect: {
                    error: "P37"
                }
            }
        ],
    "Test # 65 - Short Position + Long Trade (Closing w Loss <= Margin) + [MR < 0]+Proceed-0":
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
                    fee: 58.8
                }
            },
            {
                pOracle: 124,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: -0.153226,
                    pPos: 84,
                    fee: 58.8
                }
            },
            {
                pOracle: 124,
                price: 104.79,
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
                    fee: 113.295
                }
            }
        ],
    "Test # 66 - Short Position + Long Trade (Closing w Loss > Margin) + [MR < 0]+Error- Cannot trade when loss exceeds margin. Please add margin":
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
                    fee: 58.8
                }
            },
            {
                pOracle: 124,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 840,
                    qPos: -10,
                    margin: 210,
                    marginRatio: -0.153226,
                    pPos: 84,
                    fee: 58.8
                }
            },
            {
                pOracle: 124,
                price: 106.05,
                size: 10,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ],

    "Test # 67 - Short Position + Long Trade (Flipping w Loss > Margin) + [MR < 0]+Error- Cannot trade when loss exceeds margin. Please add margin":
        [
            {
                pOracle: 67,
                price: 67,
                size: -10,
                leverage: 4,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 670,
                    qPos: -10,
                    margin: 167.5,
                    marginRatio: 0.25,
                    pPos: 67,
                    fee: 46.9
                }
            },
            {
                pOracle: 107,
                price: 0,
                size: 0,
                leverage: 0,
                expect: {
                    error: "",
                    mro: 0.25,
                    oiOpen: 670,
                    qPos: -10,
                    margin: 167.5,
                    marginRatio: -0.21729,
                    pPos: 67,
                    fee: 46.9
                }
            },
            {
                pOracle: 107,
                price: 84.5875,
                size: 16,
                leverage: 4,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ]
};

describe("Margin Tests with 2% and 5% Maker/Taker and 6.25% and 5% IMR/MMR fee", () => {
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

                                const fee = new BigNumber(
                                    await (
                                        await contracts.marginbank.getAccountBankBalance(
                                            FEE_POOL_ADDRESS
                                        )
                                    ).toHexString()
                                );

                                // create expected position
                                const expectedPosition =
                                    getExpectedTestPosition(testCase.expect);

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
            imr: toBigNumberStr(0.0625),
            mmr: toBigNumberStr(0.05),
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
