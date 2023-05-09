import { config } from "dotenv";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "hardhat-typechain";
import "hardhat-contract-sizer";
import "hardhat-watcher";

import { processEnvRpcURL, processEnvAddress } from "./publish/envHelpers";

config({ path: ".env" });

module.exports = {
    solidity: {
        version: "0.8.4",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    mocha: {
        timeout: 100000000,
        retries: 10
    },

    typechain: {
        outDir: "artifacts/typechain",
        target: "ethers-v5"
    },

    paths: {
        sources: "./contracts",
        tests: "./test/unit",
        cache: "./cache",
        artifacts: "./artifacts"
    },

    gasReporter: {
        enabled: process.env.REPORT_GAS === "true" ? true : false
    },

    defaultNetwork: process.env.DEPLOY_ON,

    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
            mining: {
                auto: true
            }
        },
        ganache: {
            gas: "auto",
            gasPrice: "auto",
            chainId: 1337,
            url:
                processEnvRpcURL(process.env.RPC_URL) ||
                "http://127.0.0.1:8545",
            accounts: processEnvAddress(process.env.DEPLOYER_KEY)
        }
    },

    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: true
    },

    watcher: {
        test: {
            tasks: ["test"],
            files: ["./contracts/**/*", "./test/**/*"],
            verbose: true
        }
    }
};
