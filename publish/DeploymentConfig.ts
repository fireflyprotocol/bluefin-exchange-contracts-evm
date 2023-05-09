import { config } from "dotenv";
import { toBigNumberStr } from "../submodules/library";
import { processEnvString } from "./envHelpers";
import { processTradingStartTime } from "./helpers";
import { getBlockNumber } from "../test/helpers/utils";
const params = require("../deploymentConfig.json");

config({ path: ".env" });

interface DeploymentConfig {
    symbol: string;
    quoteAssetSymbol: string;
    quoteAssetName: string;
    baseAssetSymbol: string;
    baseAssetName: string;
    defaultLeverage: string;
    addressUSDC: string;
    addressPriceOracleProxy: string;
    addressGuardian: string;
    addressMarginBank: string;
    initialMarginReq: string;
    maintenanceMarginReq: string;
    defaultTakerFee: string;
    defaultMakerFee: string;
    minOrderPrice: string;
    maxOrderPrice: string;
    tickSize: string;
    minTradeQty: string;
    maxTradeQtyMarket: string;
    maxTradeQtyLimit: string;
    stepSize: string;
    mtbLong: string;
    mtbShort: string;
    maxFundingRate: string;
    maxAllowedOIOpen: string[];
    insurancePoolRatio: string;
    insurancePool: string;
    tradingStartTime: string;
    filePath: string;
    feePool: string;
    gasPool: string;
    deploymentBlockNumber: string;
    trustedForwarder: string;
}

export const DeploymentConfig: DeploymentConfig = {
    // Market Pair symbol ETH-PERP/BTC-PERP
    symbol: processEnvString(process.env.SYMBOL),
    // short name for quote asset symbol USDT/USDC
    quoteAssetSymbol: params.quoteAssetSymbol,
    // complete name of quote symbol Circle USD / Tether USD
    quoteAssetName: params.quoteAssetName,
    // short name used on exchanges for asset ETH/BTC/DOT
    baseAssetSymbol: params.baseAssetSymbol,
    // complete name of the asset being deployed
    baseAssetName: params.baseAssetName,
    // default leverage to be used on dapi (has nothing to do with contract deployment)
    defaultLeverage: params.defaultLeverage,
    // address of usdt contract, if not provided will be deployed
    addressUSDC: params.addressUSDC,
    // address of price oracle contract, if not provided will be deployed
    addressPriceOracleProxy: params.addressPriceOracleProxy,
    // address of guardian contract, if not provided will be deployed
    addressGuardian: params.addressGuardian,
    // address of margin bank contract, if not provided will be deployed
    addressMarginBank: params.addressMarginBank,
    // imr in %age (0 to 1)
    initialMarginReq: toBigNumberStr(params.imr),
    // mmr in %age  (0 to 1)
    maintenanceMarginReq: toBigNumberStr(params.mmr),
    // taker fee in %age (0 to 1)
    defaultTakerFee: toBigNumberStr(params.defaultTakerFee),
    // maker fee in %age (0 to 1)
    defaultMakerFee: toBigNumberStr(params.defaultMakerFee),
    // minimum trade price for perp
    minOrderPrice: toBigNumberStr(params.minOrderPrice),
    // maximum trade price for perp
    maxOrderPrice: toBigNumberStr(params.maxOrderPrice),
    // tick size, price of order must confirm to this
    tickSize: toBigNumberStr(params.tickSize),
    // min quantity of perp that can be traded
    minTradeQty: toBigNumberStr(params.minTradeQty),
    // max maker quantity
    maxTradeQtyMarket: toBigNumberStr(params.maxMarketTradeQty),
    // max taker quantity
    maxTradeQtyLimit: toBigNumberStr(params.maxLimitTradeQty),
    // step size for quantity
    stepSize: toBigNumberStr(params.stepSize),
    // market take bound for long(+) in percent (0 to 1)
    mtbLong: toBigNumberStr(params.takeBoundLong),
    // market take bound for long(-) in percent (0 to 1)
    mtbShort: toBigNumberStr(params.takeBoundShort),
    // max allowed funding rate applicable to an account within a window
    maxFundingRate: toBigNumberStr(params.maxFundingRate),
    // max allowed open interest at leverages.
    maxAllowedOIOpen: params.maxAllowedOIOpen.map((value: number) =>
        toBigNumberStr(value)
    ),
    // percentage of liquidation's premium to be transferred to insurance pool
    insurancePoolRatio: toBigNumberStr(params.insurancePoolRatio),
    // address of insurance pool to which (INSURANCE_POOL_PERCENTAGE) amount of liquidation's
    // premium will be transferred upon successful liquidations
    insurancePool: params.insurancePool,
    // the time at which trading begins in unix timestamp in seconds.
    // if 0 or not provided, will start trading 180 seconds after deployment when ENV is dev
    // on the other hand, if ENV is PROD , will start trading in the next possible hour.
    tradingStartTime: processTradingStartTime(params.tradingStartTime),
    // address of fee pool
    feePool: params.feePool,
    // address of gas pool
    gasPool: params.gasPool,
    // address of trusted biconomy relayer
    trustedForwarder: params.trustedForwarder,

    // configs will be stored at this path
    filePath: `./deployments/${process.env.DEPLOY_ON}.json`,
    // the deployment block number for the contract
    deploymentBlockNumber: ""
};
