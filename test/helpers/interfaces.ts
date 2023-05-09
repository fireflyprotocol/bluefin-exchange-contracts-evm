import { BigNumber } from "../../submodules/library";
import {
    IsolatedTrader,
    Perpetual,
    MarginBank,
    DummyFunder,
    DummyUSDC,
    FundingOracle,
    IsolatedLiquidation,
    Evaluator,
    Guardian,
    DummyPriceOracle,
    IsolatedADL
} from "../../artifacts/typechain";

export interface AllContracts {
    perpetual: Perpetual;
    marginbank: MarginBank;
    trader: IsolatedTrader;
    guardian: Guardian;
    liquidation: IsolatedLiquidation;
    priceOracle: DummyPriceOracle;
    evaluator: Evaluator;
    funder: DummyFunder | FundingOracle;
    token: DummyUSDC;
    adl: IsolatedADL;
}
export interface TradeData {
    makerIndex: number;
    takerIndex: number;
    trader: string;
    data: string;
}

export interface TradeParams {
    accounts: string[];
    data: TradeData;
}

export interface TestPositionExpect {
    isPosPositive: boolean;
    mro: BigNumber;
    oiOpen: BigNumber;
    qPos: BigNumber;
    margin: BigNumber;
    pPos: BigNumber;
    marginRatio: BigNumber;
    bankBalance: BigNumber;
    fee: BigNumber;
}
