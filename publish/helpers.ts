import { Wallet } from "ethers";
import { config } from "dotenv";

config({ path: ".env" });

import {
    Perpetual__factory,
    MarginBank__factory,
    DummyUSDC__factory,
    FundingOracle__factory,
    Evaluator__factory,
    IsolatedTrader__factory,
    IsolatedLiquidation__factory,
    Guardian__factory,
    MarginMath__factory,
    IsolatedADL__factory
} from "../artifacts/typechain";

const fs = require("fs");

export function readFile(filePath: string): any {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : {};
}

export function writeFile(filePath: string, jsonData: any): any {
    fs.writeFileSync(filePath, JSON.stringify(jsonData));
}

export function loadContracts(
    chainName: string,
    pairName: string,
    wallet: Wallet
) {
    const contractAddress: {
        USDC: string;
        PriceOracle: string;
        MarginBank: string;
        Guardian: string;
        Evaluator: string;
        FundingOracle: string;
        Perpetual: string;
        IsolatedTrader: string;
        IsolatedLiquidation: string;
        MarginMath: string;
        IsolatedADL: string;
    } = require(`../deployments/${chainName}.json`)[pairName]["Contracts"];

    const contracts = {
        perpetual: Perpetual__factory.connect(
            contractAddress.Perpetual as any as string,
            wallet
        ),
        marginbank: MarginBank__factory.connect(
            contractAddress.MarginBank as any as string,
            wallet
        ),
        trader: IsolatedTrader__factory.connect(
            contractAddress.IsolatedTrader as any as string,
            wallet
        ),
        funder: FundingOracle__factory.connect(
            contractAddress.FundingOracle as any as string,
            wallet
        ),
        token: DummyUSDC__factory.connect(
            contractAddress.USDC as any as string,
            wallet
        ),
        liquidation: IsolatedLiquidation__factory.connect(
            contractAddress.IsolatedLiquidation as any as string,
            wallet
        ),
        evaluator: Evaluator__factory.connect(
            contractAddress.Evaluator as any as string,
            wallet
        ),
        guardian: Guardian__factory.connect(
            contractAddress.Guardian as any as string,
            wallet
        ),
        marginMath: MarginMath__factory.connect(
            contractAddress.MarginMath as any as string,
            wallet
        ),
        adl: IsolatedADL__factory.connect(
            contractAddress.IsolatedADL as any as string,
            wallet
        )
    };

    return contracts;
}

export function loadContractsAddressFromJson(chainName: string) {
    const contractAddress: {
        [key in string]: {
            Contracts: {
                USDC: string;
                PriceOracle: string;
                MarginBank: string;
                FundingOracle: string;
                Perpetual: string;
                IsolatedTrader: string;
            };
        };
    } = require(`../deployments/${chainName}.json`);

    return Object.keys(contractAddress).reduce(
        (
            address: {
                [key in string]: {
                    USDC: string;
                    PriceOracle: string;
                    MarginBank: string;
                    FundingOracle: string;
                    Perpetual: string;
                    IsolatedTrader: string;
                };
            },
            market
        ) => {
            return { ...address, [market]: contractAddress[market].Contracts };
        },
        {}
    );
}

export function processTradingStartTime(tradingStartTime: any): string {
    const threshold = 180; // threshold is set to 3 min as contracts take this much time to deploy
    if (process.env.ENV == "DEV") {
        return tradingStartTime == 0 || tradingStartTime == ""
            ? String(Math.floor(Date.now() / 1000) + threshold)
            : String(tradingStartTime);
    } else {
        if (tradingStartTime == 0 || tradingStartTime == "") {
            const nextPossibleHourTime =
                Math.floor(Math.floor(Date.now() / 1000) / 3600) * 3600 + 3600;
            // check for corner cases
            if (
                nextPossibleHourTime - Math.floor(Date.now() / 1000) >
                threshold
            ) {
                return String(nextPossibleHourTime);
            } else {
                return String(nextPossibleHourTime + 3600);
            }
        } else {
            if (
                tradingStartTime % 3600 == 0 &&
                tradingStartTime > Math.floor(Date.now() / 1000)
            ) {
                return tradingStartTime;
            } else {
                throw "tradingStartTime must be in hourly units/future time";
            }
        }
    }
}
