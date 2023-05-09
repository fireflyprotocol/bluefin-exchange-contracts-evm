import hardhat from "hardhat";
import { ContractDeployer } from "./ContractDeployer";
import { DeploymentConfig } from "./DeploymentConfig";
import { readFile, writeFile, getAggregatorAddress } from "./helpers";
import { toBigNumberStr, ADDRESSES } from "../submodules/library";
import { getBlockNumber } from "../test/helpers/utils";

async function main() {
    const deployer = new ContractDeployer();
    const chainId = hardhat.network.config.chainId;

    // deploy USDC token if its address is not provided
    const deployUSDC = () => {
        if (DeploymentConfig.addressUSDC == "") {
            return async (): Promise<void> => {
                console.log(`\n-> Deploying Mock USDC Token...`);
                await deployer.deployImmutableContract(
                    "DummyUSDC",
                    "USDC",
                    "USDC",
                    toBigNumberStr(1_000_000)
                );
            };
        }
    };

    const deployEvaluator = () => {
        return async (): Promise<void> => {
            console.log(`\n-> Deploying Evaluator...`);
            await deployer.deployUpgradableContract(
                "Evaluator",
                DeploymentConfig.minOrderPrice,
                DeploymentConfig.maxOrderPrice,
                DeploymentConfig.tickSize,
                DeploymentConfig.minTradeQty,
                DeploymentConfig.maxTradeQtyLimit,
                DeploymentConfig.maxTradeQtyMarket,
                DeploymentConfig.stepSize,
                DeploymentConfig.mtbLong,
                DeploymentConfig.mtbShort,
                DeploymentConfig.maxAllowedOIOpen
            );
        };
    };

    const deployGuardian = () => {
        if (DeploymentConfig.addressGuardian == "") {
            return async (): Promise<void> => {
                console.log(`\n-> Deploying Guardian...`);
                await deployer.deployUpgradableContract("Guardian");
            };
        }
    };

    const deployPriceOracle = () => {
        if (DeploymentConfig.addressPriceOracleProxy == "") {
            return async (): Promise<void> => {
                console.log(`\n-> Deploying Price Oracle...`);
                await deployer.deployUpgradableContract("DummyPriceOracle", 0);
                deployer.addresses["PriceOracleProxy"] =
                    deployer.addresses["DummyPriceOracle"];
            };
        } else {
            return async (): Promise<void> => {
                const aggregatorAddress = await getAggregatorAddress(
                    DeploymentConfig.addressPriceOracleProxy
                );
                deployer.addresses["PriceOracleAggregator"] = aggregatorAddress;
            };
        }
    };

    const deployMarginBank = () => {
        if (DeploymentConfig.addressMarginBank == "") {
            return async (): Promise<void> => {
                console.log(`\n-> Deploying Margin Bank...`);
                await deployer.deployUpgradableContract(
                    "MarginBank",
                    deployer.addresses["USDC"],
                    deployer.addresses["Guardian"],
                    DeploymentConfig.trustedForwarder
                );
            };
        }
    };

    const deployFundingOracle = () => {
        return async (): Promise<void> => {
            console.log(`\n-> Deploying Funding Oracle...`);
            await deployer.deployUpgradableContract(
                "FundingOracle",
                ADDRESSES.ZERO,
                deployer.addresses["Guardian"],
                DeploymentConfig.maxFundingRate
            );
        };
    };

    const deployMarginMath = () => {
        return async (): Promise<void> => {
            console.log(`\n-> Deploying Margin Math...`);
            await deployer.deployUpgradableContract("MarginMath");
        };
    };

    const deployPerpetual = () => {
        return async (): Promise<void> => {
            console.log(
                `\n-> Deploying Perpetual for market ${DeploymentConfig.symbol}...`
            );

            await deployer.deployUpgradableContract(
                "Perpetual",
                DeploymentConfig.symbol,
                {
                    marginMath: deployer.addresses["MarginMath"],
                    oracle: deployer.addresses["PriceOracleProxy"],
                    funder: deployer.addresses["FundingOracle"],
                    marginBank: deployer.addresses["MarginBank"],
                    evaluator: deployer.addresses["Evaluator"],
                    guardian: deployer.addresses["Guardian"],
                    feePool: DeploymentConfig.feePool
                },
                DeploymentConfig.trustedForwarder,
                DeploymentConfig.initialMarginReq,
                DeploymentConfig.maintenanceMarginReq,
                DeploymentConfig.defaultMakerFee,
                DeploymentConfig.defaultTakerFee
            );
        };
    };

    const deployIsolatedTrader = () => {
        return async (): Promise<void> => {
            console.log(
                `\n-> Deploying Isolated Trader for ${DeploymentConfig.symbol}...`
            );
            await deployer.deployUpgradableContract(
                "IsolatedTrader",
                deployer.addresses["Perpetual"],
                deployer.addresses["Evaluator"],
                deployer.addresses["MarginBank"],
                DeploymentConfig.gasPool,
                DeploymentConfig.trustedForwarder,
                chainId
            );
        };
    };

    const deployIsolatedLiquidation = () => {
        return async (): Promise<void> => {
            console.log(
                `\n-> Deploying IsolatedLiquidation for ${DeploymentConfig.symbol}...`
            );
            await deployer.deployUpgradableContract(
                "IsolatedLiquidation",
                deployer.addresses["Perpetual"],
                deployer.addresses["MarginBank"],
                deployer.addresses["Evaluator"],
                DeploymentConfig.insurancePool,
                DeploymentConfig.insurancePoolRatio
            );
        };
    };

    const deployIsolatedADL = () => {
        return async (): Promise<void> => {
            console.log(
                `\n-> Deploying IsolatedADL for ${DeploymentConfig.symbol}...`
            );
            await deployer.deployUpgradableContract(
                "IsolatedADL",
                deployer.addresses["Perpetual"],
                deployer.addresses["Evaluator"]
            );
        };
    };

    const setTrader = (trader: string) => {
        return async (): Promise<void> => {
            console.log(`\n-> Whitelisting ${trader} Contract in Perpetual...`);
            const perpetual = await deployer.getContract("Perpetual");
            await perpetual.setTradeContract(deployer.addresses[trader], true);
        };
    };

    const setBankOperators = () => {
        return async (): Promise<void> => {
            const marginbank = await deployer.getContract("MarginBank");

            console.log(`\n-> Setting Perpetual as Bank Operator...`);
            await marginbank.setBankOperator(
                deployer.addresses["Perpetual"],
                true
            );

            console.log(`\n-> Setting Isolated Trader as Bank Operator...`);
            await marginbank.setBankOperator(
                deployer.addresses["IsolatedTrader"],
                true
            );

            console.log(
                `\n-> Setting Isolated Liquidation as Bank Operator...`
            );
            await marginbank.setBankOperator(
                deployer.addresses["IsolatedLiquidation"],
                true
            );
        };
    };

    const setFundingRateProvider = () => {
        return async (): Promise<void> => {
            console.log(`\n-> Setting Perpetual as Funding Rate Provider...`);
            const fundingOracle = await deployer.getContract("FundingOracle");
            await (
                await fundingOracle.setFundingRateProvider(
                    deployer.addresses["Perpetual"]
                )
            ).wait();
        };
    };

    const startTrading = () => {
        return async (): Promise<void> => {
            console.log(`\n-> Starting trading of Perpetual...`);
            const perpetual = await deployer.getContract("Perpetual");
            await (
                await perpetual.startTrading(DeploymentConfig.tradingStartTime)
            ).wait();
        };
    };

    // list of tasks(deployment, change of ownership etc.)
    // to be executed
    const tasks = [
        deployUSDC(),
        deployEvaluator(),
        deployGuardian(),
        deployPriceOracle(),
        deployMarginBank(),
        deployFundingOracle(),
        deployMarginMath(),
        deployPerpetual(),
        deployIsolatedTrader(),
        deployIsolatedLiquidation(),
        deployIsolatedADL(),
        setTrader("IsolatedTrader"),
        setTrader("IsolatedLiquidation"),
        setTrader("IsolatedADL"),
        setBankOperators(),
        setFundingRateProvider(),
        startTrading()
    ];

    const execute = async () => {
        const network = process.env.DEPLOY_ON;
        console.log("---------------------------------------------------");
        console.log(
            ` Deploying Contracts on ${network} and executing Genesis Events`
        );
        console.log("---------------------------------------------------");

        for (const task of tasks) {
            if (task) {
                await task();
            }
        }

        DeploymentConfig.addressUSDC =
            DeploymentConfig.addressUSDC || deployer.addresses["USDC"];

        DeploymentConfig.addressMarginBank =
            DeploymentConfig.addressMarginBank ||
            deployer.addresses["MarginBank"];

        DeploymentConfig.addressPriceOracleProxy =
            DeploymentConfig.addressPriceOracleProxy ||
            deployer.addresses["PriceOracleProxy"];

        DeploymentConfig.addressGuardian =
            DeploymentConfig.addressGuardian || deployer.addresses["Guardian"];

        DeploymentConfig.deploymentBlockNumber = (
            await getBlockNumber()
        ).toString();

        const filePath = DeploymentConfig.filePath;
        const symbol = DeploymentConfig.symbol;
        const deploymentDetails = readFile(filePath);

        deploymentDetails[symbol] = {
            Contracts: deployer.addresses,
            Config: DeploymentConfig
        };

        // remove file path
        delete deploymentDetails[symbol]["Config"]["filePath"];

        await writeFile(filePath, deploymentDetails);
        console.log(`\nCreated deployment file: ${filePath}`);
        console.log("---------------------------------------------------");
        console.log(` Finished `);
        console.log("---------------------------------------------------");
    };

    await execute();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
