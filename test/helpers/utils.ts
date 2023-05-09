import hardhat from "hardhat";
import { Signer } from "ethers";
import { BigNumber } from "../../submodules/library";
import { MarginBank, DummyUSDC } from "../../artifacts/typechain";
import { Perpetual, FundingOracle } from "../../artifacts/typechain";
import { Balance, toBigNumberStr } from "../../submodules/library";
import { TestPositionExpect } from "./interfaces";

export async function mintAndApprove(
    signer: Signer,
    token: DummyUSDC,
    bank: MarginBank,
    amount?: number
) {
    await (
        await token
            .connect(signer)
            .mint(
                await signer.getAddress(),
                toBigNumberStr(amount || 50_000, 6)
            )
    ).wait();
    await (
        await token
            .connect(signer)
            .approve(bank.address, toBigNumberStr(amount || 50_000, 6))
    ).wait();
}

//returns address in 0x73483212...74838189 format
export async function formattedAddress(address: string) {
    return address.slice(0, 10) + "..." + address.slice(address.length - 8);
}
export async function mintAndDeposit(
    signer: Signer,
    token: DummyUSDC,
    bank: MarginBank,
    amount?: number
) {
    const amt = amount || 100_000;
    await mintAndApprove(signer, token, bank, amt);
    await bank
        .connect(signer)
        .depositToBank(await signer.getAddress(), toBigNumberStr(amt, 6));
}

export async function mineBlocks(numOfBlocks: number) {
    while (numOfBlocks > 0) {
        await hardhat.ethers.provider.send("evm_mine", []);
        numOfBlocks--;
    }
}

export async function getBlockTimestamp() {
    return (await hardhat.ethers.provider.getBlock("latest")).timestamp;
}

export async function getBlockNumber() {
    return (await hardhat.ethers.provider.getBlock("latest")).number;
}

export async function increaseBlockTime(second: number, mode: number = 0) {
    // to do fix this
    if (mode == 1) {
        // this does not increase time consistently
        await hardhat.ethers.provider.send("evm_increaseTime", [second]);
        await hardhat.ethers.provider.send("evm_mine", []);
    } else {
        // but this one breaks for large values of `second`
        await mineBlocks(second);
    }
}

export async function moveToStartOfFirstWindow(oracle: FundingOracle) {
    const startingTimestamp = +(await oracle.fundingStart());
    const currentTime = await getBlockTimestamp();
    const timeToSkip = startingTimestamp - currentTime;
    if (timeToSkip > 0) await increaseBlockTime(timeToSkip);
}

export async function moveToStartOfTrading(perpetual: Perpetual) {
    const startingTimestamp = +(await perpetual.tradingStartTime());
    const currentTime = await getBlockTimestamp();
    const timeToSkip = startingTimestamp - currentTime;
    if (timeToSkip > 0) await increaseBlockTime(timeToSkip);
}

export function getExpectedTestPosition(expect: any): TestPositionExpect {
    return {
        isPosPositive: expect.qPos > 0,
        mro: new BigNumber(expect.mro),
        oiOpen: new BigNumber(expect.oiOpen),
        qPos: new BigNumber(Math.abs(expect.qPos)),
        margin: new BigNumber(expect.margin),
        pPos: new BigNumber(expect.pPos),
        marginRatio: new BigNumber(expect.marginRatio),
        bankBalance:
            expect.bankBalance != undefined
                ? new BigNumber(expect.bankBalance)
                : undefined,
        fee: expect.fee != undefined ? new BigNumber(expect.fee) : undefined
    } as TestPositionExpect;
}

export function toTestPositionExpect(
    balance: Balance,
    pPos: BigNumber,
    marginRatio: BigNumber,
    bankBalance?: BigNumber,
    fee?: BigNumber
): TestPositionExpect {
    return {
        isPosPositive: balance.isPosPositive,
        mro: balance.mro.shiftedBy(-18),
        oiOpen: balance.oiOpen.shiftedBy(-18),
        qPos: balance.qPos.shiftedBy(-18),
        margin: balance.margin.shiftedBy(-18),
        pPos: pPos.shiftedBy(-18),
        marginRatio: marginRatio.shiftedBy(-18),
        bankBalance: bankBalance ? bankBalance.shiftedBy(-18) : undefined,
        fee: fee ? fee.shiftedBy(-18) : undefined
    } as TestPositionExpect;
}
