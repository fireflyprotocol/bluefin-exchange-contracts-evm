import hardhat from "hardhat";
import { OzContractDeployer } from "../../publish/OzContractDeployer";
import {
    IsolatedTrader,
    Perpetual,
    MarginBank,
    DummyPriceOracle,
    FundingOracle,
    DummyFunder,
    DummyUSDC,
    DummyOwnableContract,
    IsolatedLiquidation,
    Evaluator,
    Guardian,
    IsolatedADL
} from "../../artifacts/typechain";
import { address, toBigNumberStr, ADDRESSES } from "../../submodules/library";
import { OrderSigner } from "../../submodules/library";
import { AllContracts } from "./interfaces";
import { Signer } from "ethers";
import { getBlockTimestamp } from "../helpers/utils";
import { INSURANCE_POOL_ADDRESS, FEE_POOL_ADDRESS } from "../helpers/default";

const ozContractDeployer = new OzContractDeployer();
const chainId = hardhat.network.config.chainId;

if (chainId != 31337) {
    console.log("Testing on non-hardhat blockchain!");
    process.exit(1);
}

// only works for hard hat chain
export function createOrderSigner(trader: address) {
    return new OrderSigner(hardhat.web3, chainId as number, trader);
}

export async function deployMockFunder(): Promise<DummyFunder> {
    const factory = await hardhat.ethers.getContractFactory("DummyFunder");
    const contract = await factory.deploy();
    await contract.deployed();
    return contract as any as DummyFunder;
}

export async function deployFundingOracle(
    perpetual: address,
    guardian: address,
    maxAllowedFR?: string
): Promise<FundingOracle> {
    const address = await ozContractDeployer.deploy("FundingOracle", [
        perpetual,
        guardian,
        maxAllowedFR || toBigNumberStr(0.001)
    ]);
    const factory = await hardhat.ethers.getContractFactory("FundingOracle");
    const contract = await factory.attach(address);
    return contract as any as FundingOracle;
}

export async function deployMockToken(params: {
    name?: string;
    initSupply?: number;
}): Promise<DummyUSDC> {
    const tokenName = params.name || "USDC";
    const factory = await hardhat.ethers.getContractFactory("DummyUSDC");
    const contract = await factory.deploy(
        tokenName,
        tokenName,
        toBigNumberStr(params.initSupply || 0)
    );
    await contract.deployed();
    return contract as any as DummyUSDC;
}

export async function deployEvaluator(params: {
    minOrderPrice?: string;
    maxOrderPrice?: string;
    tickSize?: string;
    minTradeQty?: string;
    maxTradeQtyLimit?: string;
    maxTradeQtyMarket?: string;
    stepSize?: string;
    mtbLong?: string;
    mtbShort?: string;
    maxOIOpen?: string[];
}): Promise<Evaluator> {
    const address = await ozContractDeployer.deploy("Evaluator", [
        params.minOrderPrice || toBigNumberStr(1),
        params.maxOrderPrice || toBigNumberStr(1000),
        params.tickSize || toBigNumberStr(0.0000001),
        params.minTradeQty || toBigNumberStr(0.1),
        params.maxTradeQtyLimit || toBigNumberStr(500000),
        params.maxTradeQtyMarket || toBigNumberStr(40000),
        params.stepSize || toBigNumberStr(0.0001),
        params.mtbLong || toBigNumberStr(0.5),
        params.mtbShort || toBigNumberStr(0.5),
        params.maxOIOpen || [
            toBigNumberStr(1_000_000), //1x
            toBigNumberStr(1_000_000), //2x
            toBigNumberStr(500_000), //3x
            toBigNumberStr(500_000), //4x
            toBigNumberStr(250_000), //5x
            toBigNumberStr(250_000), //6x
            toBigNumberStr(250_000), //7x
            toBigNumberStr(250_000), //8x
            toBigNumberStr(100_000), //9x
            toBigNumberStr(100_000) //10x
        ]
    ]);
    const factory = await hardhat.ethers.getContractFactory("Evaluator");
    const contract = await factory.attach(address);
    return contract as any as Evaluator;
}

export async function deployMarginMath() {
    return await ozContractDeployer.deploy("MarginMath", []);
}

export async function deployPerpetual(params: {
    marginMath: string;
    feePool: string;
    marketName?: string;
    marginbank?: address;
    priceOracle?: address;
    funder?: address;
    evaluator?: address;
    trustedForwarder?: address;
    guardian?: address;
    imr?: string;
    mmr?: string;
    makerFee?: string;
    takerFee?: string;
}): Promise<Perpetual> {
    const address = await ozContractDeployer.deploy("Perpetual", [
        params.marketName || "DOT-PERP",

        {
            marginMath: params.marginMath,
            oracle: params.priceOracle || ADDRESSES.ZERO,
            funder: params.funder || ADDRESSES.ZERO,
            marginBank: params.marginbank || ADDRESSES.ZERO,
            evaluator: params.evaluator || ADDRESSES.ZERO,
            guardian: params.guardian || ADDRESSES.ZERO,
            feePool: params.feePool
        },
        params.trustedForwarder || ADDRESSES.ZERO,
        params.imr || toBigNumberStr(0.1),
        params.mmr || toBigNumberStr(0.0625),
        params.makerFee || toBigNumberStr(0),
        params.takerFee || toBigNumberStr(0)
    ]);

    const factory = await hardhat.ethers.getContractFactory("Perpetual");
    const contract = factory.attach(address);
    return contract as any as Perpetual;
}

export async function deployIsolatedTrader(params: {
    trustedForwarder?: address;
    perpetual?: address;
    evaluator?: address;
    marginBank?: address;
    gasPool?: address;
}): Promise<IsolatedTrader> {
    const address = await ozContractDeployer.deploy("IsolatedTrader", [
        params.perpetual || ADDRESSES.ZERO,
        params.evaluator || ADDRESSES.ZERO,
        params.marginBank || ADDRESSES.ZERO,
        params.gasPool || ADDRESSES.ZERO,
        params.trustedForwarder || ADDRESSES.ZERO,
        chainId
    ]);
    const factory = await hardhat.ethers.getContractFactory("IsolatedTrader");
    const contract = factory.attach(address);
    return contract as any as IsolatedTrader;
}

export async function deployMarginBank(
    usdc: address,
    guardian: address,
    trustedForwarder?: address
): Promise<MarginBank> {
    const address = await ozContractDeployer.deploy("MarginBank", [
        usdc,
        guardian,
        trustedForwarder || ADDRESSES.ZERO
    ]);
    const factory = await hardhat.ethers.getContractFactory("MarginBank");
    const contract = factory.attach(address);
    return contract as any as MarginBank;
}

export async function deployGuardian(): Promise<Guardian> {
    const address = await ozContractDeployer.deploy("Guardian", []);
    const factory = await hardhat.ethers.getContractFactory("Guardian");
    const contract = factory.attach(address);
    return contract as any as Guardian;
}

export async function deployDummyPriceOracle(
    initialPrice?: string
): Promise<DummyPriceOracle> {
    const address = await ozContractDeployer.deploy("DummyPriceOracle", [
        initialPrice || toBigNumberStr(20000)
    ]);
    const factory = await hardhat.ethers.getContractFactory("DummyPriceOracle");
    const contract = factory.attach(address);
    return contract as any as DummyPriceOracle;
}

export async function deployLiquidation(
    pool: string,
    perpetual?: string,
    marginBank?: string,
    evaluator?: string,
    percentage?: string
): Promise<IsolatedLiquidation> {
    const address = await ozContractDeployer.deploy("IsolatedLiquidation", [
        perpetual || ADDRESSES.ZERO,
        marginBank || ADDRESSES.ZERO,
        evaluator || ADDRESSES.ZERO,
        pool,
        percentage || toBigNumberStr(0.7)
    ]);
    const factory = await hardhat.ethers.getContractFactory(
        "IsolatedLiquidation"
    );
    const contract = await factory.attach(address);
    return contract as any as IsolatedLiquidation;
}

export async function deployADL(
    perpetual?: string,
    evaluator?: string
): Promise<IsolatedADL> {
    const address = await ozContractDeployer.deploy("IsolatedADL", [
        perpetual || ADDRESSES.ZERO,
        evaluator || ADDRESSES.ZERO
    ]);
    const factory = await hardhat.ethers.getContractFactory("IsolatedADL");
    const contract = await factory.attach(address);
    return contract as any as IsolatedADL;
}

export async function deployOwnableContract(): Promise<DummyOwnableContract> {
    const address = await ozContractDeployer.deploy("DummyOwnableContract", []);
    const factory = await hardhat.ethers.getContractFactory(
        "DummyOwnableContract"
    );
    const contract = await factory.attach(address);
    return contract as any as DummyOwnableContract;
}

export async function deployAll(params: {
    useRealFunder?: boolean;
    imr?: string;
    mmr?: string;
    makerFee?: string;
    takerFee?: string;
    minOrderPrice?: string;
    maxOrderPrice?: string;
    tickSize?: string;
    minTradeQty?: string;
    maxTradeQtyLimit?: string;
    maxTradeQtyMarket?: string;
    stepSize?: string;
    mtbLong?: string;
    mtbShort?: string;
    maxOIOpen?: string[];
    priceDiff?: string;
    insurancePoolPercentage?: string;
    insurancePool?: string;
    feePool?: string;
    gasPool?: string;
    maxAllowedFR?: string;
    trustedForwarder?: string;
    initialOraclePrice?: string;
}): Promise<AllContracts> {
    // initialize empty contracts instance
    const contracts: AllContracts = {} as any as AllContracts;

    contracts.evaluator = await deployEvaluator(params);

    // guardian contract
    contracts.guardian = await deployGuardian();

    // fake price oracle
    contracts.priceOracle = await deployDummyPriceOracle(
        params.initialOraclePrice
    );

    if (params.useRealFunder) {
        contracts.funder = await deployFundingOracle(
            ADDRESSES.ZERO,
            contracts.guardian.address,
            params.maxAllowedFR
        );
    } else {
        // fake funder
        contracts.funder = await deployMockFunder();
    }

    // fake usdc
    contracts.token = await deployMockToken({});

    // margin bank contract
    contracts.marginbank = await deployMarginBank(
        contracts.token.address,
        contracts.guardian.address,
        params.trustedForwarder
    );

    // margin math contract
    const marginMathAddress = await deployMarginMath();

    // perpetual
    contracts.perpetual = await deployPerpetual({
        ...params,
        marginMath: marginMathAddress,
        feePool: params.feePool || FEE_POOL_ADDRESS,
        priceOracle: contracts.priceOracle.address,
        funder: contracts.funder.address,
        marginbank: contracts.marginbank.address,
        evaluator: contracts.evaluator.address,
        guardian: contracts.guardian.address
    });

    contracts.trader = await deployIsolatedTrader({
        trustedForwarder: params.trustedForwarder,
        perpetual: contracts.perpetual.address,
        evaluator: contracts.evaluator.address,
        marginBank: contracts.marginbank.address,
        gasPool: params.gasPool
    });

    contracts.liquidation = await deployLiquidation(
        params.insurancePool || INSURANCE_POOL_ADDRESS,
        contracts.perpetual.address,
        contracts.marginbank.address,
        contracts.evaluator.address,
        params.insurancePoolPercentage || toBigNumberStr(0.1)
    );

    contracts.adl = await deployADL(
        contracts.perpetual.address,
        contracts.evaluator.address
    );

    return contracts;
}

export async function postDeployment(
    contracts: AllContracts,
    owner: Signer,
    params: {
        marketFee?: number;
        limitFee?: number;
        tradingStartTime?: number;
        mmr?: number;
        imr?: number;
        feePoolAddress?: string;
        updateFRProvider?: boolean;
    }
) {
    // whitelist isolated trader contract as valid trader
    await contracts.perpetual
        .connect(owner)
        .setTradeContract(contracts.trader.address, true);

    // whitelist liquidation contract as valid trader
    await contracts.perpetual
        .connect(owner)
        .setTradeContract(contracts.liquidation.address, true);

    // whitelist adl contract as valid trade
    await contracts.perpetual
        .connect(owner)
        .setTradeContract(contracts.adl.address, true);

    // whitelist settlement operator
    await contracts.perpetual
        .connect(owner)
        .setSettlementOperator(await owner.getAddress(), true);

    // set perpetual contract as bank operator
    await contracts.marginbank
        .connect(owner)
        .setBankOperator(contracts.perpetual.address, true);

    // set isolated trader contract as bank operator
    await contracts.marginbank
        .connect(owner)
        .setBankOperator(contracts.trader.address, true);

    // set liquidation contract as bank operator
    await contracts.marginbank
        .connect(owner)
        .setBankOperator(contracts.liquidation.address, true);

    // update funding rate provider if asked to
    if (params.updateFRProvider) {
        await contracts.funder.setFundingRateProvider(
            contracts.perpetual.address
        );
    }

    // set market(taker)/limit(maker) fee
    if (params.marketFee) {
        await contracts.perpetual
            .connect(owner)
            .setDefaultTakerFee(toBigNumberStr(params.marketFee || 0));
    }

    if (params.limitFee) {
        await contracts.perpetual
            .connect(owner)
            .setDefaultMakerFee(toBigNumberStr(params.limitFee || 0));
    }

    if (params.imr) {
        await contracts.perpetual
            .connect(owner)
            .setInitialMargin(toBigNumberStr(params.imr));
    }

    if (params.mmr) {
        await contracts.perpetual
            .connect(owner)
            .setMaintenanceMargin(toBigNumberStr(params.mmr));
    }

    // set fee pool address if provided
    if (params.feePoolAddress) {
        await contracts.perpetual
            .connect(owner)
            .setFeePool(params.feePoolAddress);
    }

    // start trading
    await contracts.perpetual
        .connect(owner)
        .startTrading(
            params.tradingStartTime || (await getBlockTimestamp()) + 10
        );
}
