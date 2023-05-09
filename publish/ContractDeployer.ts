import { OzContractDeployer } from "./OzContractDeployer";
import { DeploymentConfig } from "./DeploymentConfig";
import { config } from "dotenv";
import hardhat from "hardhat";
import { readFile } from "./helpers";
config({ path: ".env" });

export class ContractDeployer {
    public ozContractDeployer: OzContractDeployer;
    public addresses: { [id: string]: string } = {};

    constructor() {
        this.addresses = readFile(DeploymentConfig.filePath);
        if (this.addresses[DeploymentConfig.symbol]) {
            this.addresses = (this.addresses[DeploymentConfig.symbol] as any)[
                "Contracts"
            ];
        } else {
            this.addresses = {};
        }

        this.addresses["USDC"] = DeploymentConfig.addressUSDC;
        this.addresses["PriceOracleProxy"] =
            DeploymentConfig.addressPriceOracleProxy;
        this.addresses["MarginBank"] = DeploymentConfig.addressMarginBank;
        this.addresses["Guardian"] = DeploymentConfig.addressGuardian;
        this.ozContractDeployer = new OzContractDeployer();
    }

    async deployImmutableContract(contractName: string, ...args: any[]) {
        console.log(`Deploy Immutable Contract with args: [${args}]`);
        const factory = await hardhat.ethers.getContractFactory(contractName);
        const instance = await factory.deploy(...args);
        let key = contractName;
        key = key == "DummyUSDC" ? "USDC" : key;
        key = key == "DummyFunder" ? "FundingOracle" : key;

        this.addresses[key] = instance.address;
        console.log(`${contractName} deployed to: ${instance.address}`);
        return instance.address;
    }

    async deployUpgradableContract(contractName: string, ...args: any[]) {
        console.log(`Deploy Upgradable Contract with args: [${args}]`);
        this.addresses[contractName] = await this.ozContractDeployer.deploy(
            contractName,
            args
        );
        console.log(
            `${contractName} deployed to: ${this.addresses[contractName]}`
        );
        return this.addresses[contractName];
    }

    async prepareUpgradeContract(
        contractAddress: string,
        contractFileName: string
    ): Promise<string> {
        return await this.ozContractDeployer.prepareUpgrade(
            contractAddress,
            contractFileName
        );
    }

    public async getContract(contractName: string) {
        if (contractName in this.addresses) {
            return hardhat.ethers.getContractAt(
                contractName,
                this.addresses[contractName]
            );
        } else {
            throw new Error(
                `ContractDeployer::getContract: ${contractName} is not deployed`
            );
        }
    }
}
