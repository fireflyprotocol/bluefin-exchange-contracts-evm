import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumberStr,
    SigningMethod,
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
    moveToStartOfTrading
} from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { OrderSigner } from "../../submodules/library";
import { createOrder } from "../helpers/order";

chai.use(chaiAsPromised);
const expect = chai.expect;

const tests = {
    //TEST 1
    "Test # 1 - Case I: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 70,
            price: 70,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 1 - Case II: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 70,
            price: 70,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 1 - Case III: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 70,
            price: 70,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 1 - Case IV: Long position, Long Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 70,
            price: 70,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 2
    "Test # 2 - Case I: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 99,
            price: 99,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 98,
            price: 98,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 2 - Case II: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 99,
            price: 99,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 98,
            price: 98,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 2 - Case III: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 98,
            price: 98,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 99,
            price: 99,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 2 - Case IV: Long position, Long Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: 100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 99,
            price: 99,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 98,
            price: 98,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 3
    "Test # 3 - Case I: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 45,
            price: 45,
            size: 0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 3 - Case II: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 45,
            price: 45,
            size: 0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 3 - Case III: Long position, Long Order = Error on 3rd order": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 45,
            price: 45,
            size: 0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 3 - Case IV: Long position, Long Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 95,
            price: 95,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 80,
            price: 80,
            size: 0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 45,
            price: 45,
            size: 0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 4
    "Test # 4 - Case I: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 112,
            price: 112,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 130,
            price: 130,
            size: -0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 4 - Case II: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 112,
            price: 112,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 130,
            price: 130,
            size: -0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 4 - Case III: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 130,
            price: 130,
            size: -0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 112,
            price: 112,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 4 - Case IV: Short position, Short Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 112,
            price: 112,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 130,
            price: 130,
            size: -0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 5
    "Test # 5 - Case I: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 101,
            price: 101,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 104,
            price: 104,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 5 - Case II: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 101,
            price: 101,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 104,
            price: 104,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 5 - Case III: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 104,
            price: 104,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 101,
            price: 101,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 5 - Case IV: Short position, Short Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: -100,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 104,
            price: 120,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 101,
            price: 101,
            size: -0.1,
            leverage: 10,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 10,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 6
    "Test # 6 - Case I: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 105,
            price: 105,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 200,
            price: 200,
            size: -0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 6 - Case II: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 200,
            price: 200,
            size: -0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 105,
            price: 105,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 6 - Case III: Short position, Short Order = Error on 3rd error": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 105,
            price: 105,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 200,
            price: 200,
            size: -0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        }
    ],
    "Test # 6 - Case IV: Short position, Short Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 105,
            price: 105,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 120,
            price: 120,
            size: -0.1,
            leverage: 2,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 200,
            price: 200,
            size: -0.1,
            leverage: 2,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 7
    "Test # 7 - Case V: No position, Long Order = Error: `P36`": [
        //taking only same side orders in order of execution
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 70,
            price: 70,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 8
    "Test # 8 - Case VII: No position, Long and Short Order = Error: `P36`": [
        //taking only same side orders in order of execution
        {
            pOracle: 100,
            price: 100,
            size: 50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 70,
            price: 70,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 9
    "Test # 9 - Case V: No position, Short Order = Error: `P36`": [
        //taking only same side orders in order of execution
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 112,
            price: 112,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 130,
            price: 130,
            size: -0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    //TEST 10
    "Test # 10 - Case VII: No position, Long and Short Order = Error: `P36`": [
        //taking only same side orders in order of execution
        {
            pOracle: 100,
            price: 100,
            size: -50,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 103,
            price: 103,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 110,
            price: 110,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 112,
            price: 112,
            size: -0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 130,
            price: 130,
            size: -0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    "Test # A - Case IV: Long position, Long and Short Order = Error: `P36`": [
        {
            pOracle: 100,
            price: 100,
            size: 100,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        //orders
        {
            pOracle: 97,
            price: 97,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 90,
            price: 90,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 88,
            price: 88,
            size: 0.1,
            leverage: 5,
            expect: {
                error: ""
            }
        },
        {
            pOracle: 40,
            price: 40,
            size: 0.1,
            leverage: 5,
            expect: {
                error: "P36"
            }
        }
    ],
    "Test # B - Case IV: Long position, Long and Short Order = Error: `Cannot trade when loss exceeds margin. Please add margin`":
        [
            {
                pOracle: 100,
                price: 100,
                size: 100,
                leverage: 5,
                expect: {
                    error: ""
                }
            },
            //orders
            {
                pOracle: 97,
                price: 97,
                size: 0.1,
                leverage: 5,
                expect: {
                    error: ""
                }
            },
            {
                pOracle: 90,
                price: 90,
                size: 0.1,
                leverage: 5,
                expect: {
                    error: ""
                }
            },
            {
                pOracle: 88,
                price: 88,
                size: 0.1,
                leverage: 5,
                expect: {
                    error: ""
                }
            },
            {
                pOracle: 40,
                price: 40,
                size: -0.1,
                leverage: 5,
                expect: {
                    error: "Cannot trade when loss exceeds margin. Please add margin"
                }
            }
        ]
};

describe("Firefly Math MR Tests with 2% and 5% Maker/Taker and 6.25% and 5% IMR/MMR fee", () => {
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
        // deploy all contracts and set imr and mmr to 6.25 percent and 5 percent
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
            2_000_000
        );
        await mintAndDeposit(
            taker,
            contracts.token,
            contracts.marginbank,
            2_000_000
        );

        await moveToStartOfTrading(contracts.perpetual);
    }

    executeTests(tests);
});
