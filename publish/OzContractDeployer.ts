import hardhat from "hardhat";
import { Contract } from "ethers";

// @openzeppelin wrapper./../types
export class OzContractDeployer {
    ozInitMethodName: string;
    constructor(initializer = "initialize") {
        this.ozInitMethodName = initializer;
    }

    // deploy contract by open zeppelin upgrade plugin
    async deploy(contractFileName: string, args: any[]) {
        const contract = await hardhat.ethers.getContractFactory(
            contractFileName
        );

        const instance = await hardhat.upgrades.deployProxy(contract, args, {
            initializer: this.ozInitMethodName
        });

        await instance.deployed();

        return instance.address;
    }

    // prepare an upgrade for proxy that be pushed to proxy by admin
    async prepareUpgrade(
        proxy: string,
        contractFileName: string
    ): Promise<string> {
        const factory = await hardhat.ethers.getContractFactory(
            contractFileName
        );
        const address = await hardhat.upgrades.prepareUpgrade(proxy, factory);
        return address as string;
    }

    // upgrade a contract
    async upgrade(proxy: string, contractFileName: string): Promise<Contract> {
        const contract = await hardhat.ethers.getContractFactory(
            contractFileName
        );
        const instance = await hardhat.upgrades.upgradeProxy(proxy, contract);
        return instance;
    }

    // update admin of proxy
    async updateProxyAdmin(proxyAddress: string, adminAddress: string) {
        await hardhat.upgrades.admin.changeProxyAdmin(
            proxyAddress,
            adminAddress
        );
    }

    async transferProxyAdminOwnership(newAdmin: string): Promise<void> {
        await hardhat.upgrades.admin.transferProxyAdminOwnership(newAdmin);
    }
}
