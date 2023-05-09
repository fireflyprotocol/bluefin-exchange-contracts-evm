import chai, { expect } from "chai";
import { AllContracts, TestPositionExpect } from "./interfaces";
import {
    Balance,
    BASE_DECIMALS,
    BigNumber,
    BIGNUMBER_BASE,
    hexToBigNumber,
    Order,
    OrderSigner
} from "../../submodules/library";
import { OrderStatus } from "../../types";
import { IsolatedTrader } from "../../artifacts/typechain";
import { Signer } from "ethers";
import { getExpectedTestPosition, toTestPositionExpect } from "./utils";
import { FEE_POOL_ADDRESS, INSURANCE_POOL_ADDRESS } from "./default";

export async function expectStatus(
    orderSigner: OrderSigner,
    itContract: IsolatedTrader,
    order: Order,
    status: OrderStatus
) {
    const orderHash = orderSigner.getOrderHash(order);
    const states: any[] = await itContract.getOrdersStatus([orderHash]);

    expect(states[0][0]).to.equal(status);
}

export async function parseEvent(resp: any, eventName: string): Promise<any> {
    const receipt = await resp.wait();
    const event = receipt.events?.filter((x: any) => {
        return x.event == eventName;
    });
    return event ? event[0]?.args : false;
}

export async function expectEvent(resp: any, eventName: string) {
    const event = await parseEvent(resp, eventName);
    return chai.expect(event).to.be.not.equal(undefined);
}

export async function expectThrow(promise: Promise<any>, reason: string) {
    try {
        await promise;
        throw new Error("Did not throw");
    } catch (e) {
        assertCertainError(e as any, reason);
    }
}

function assertCertainError(error: Error, expected_error_msg: string) {
    const message = error.message;
    const matchedIndex = message.search(expected_error_msg);
    let matchedString = message;
    if (matchedIndex === 0) {
        matchedString = message.substring(
            matchedIndex,
            matchedIndex + (expected_error_msg as string).length
        );
    }
    chai.expect(matchedString).to.eq(expected_error_msg);
}

export function expectPosition(
    expected: TestPositionExpect,
    actual: TestPositionExpect
) {
    expect(expected.isPosPositive).to.be.equal(actual.isPosPositive);
    expect(actual.mro.toFixed(3)).to.be.equal(expected.mro.toFixed(3));
    expect(actual.oiOpen.toFixed(3)).to.be.equal(expected.oiOpen.toFixed(3));
    expect(actual.qPos.toFixed(0)).to.be.equal(expected.qPos.toFixed(0));

    expect(actual.margin.toFixed(3)).to.be.equal(expected.margin.toFixed(3));

    expect(actual.marginRatio.toFixed(3)).to.be.equal(
        actual.marginRatio.toFixed(3)
    );
    expect(actual.pPos.toFixed(3)).to.be.equal(expected.pPos.toFixed(3));

    if (actual.bankBalance)
        expect(actual.bankBalance.toFixed(6)).to.be.equal(
            expected.bankBalance.toFixed(6)
        );

    if (actual.fee)
        expect(actual.fee.toFixed(6)).to.be.equal(expected.fee.toFixed(6));
}

export async function evaluateExpect(
    account: Signer,
    expectedValues: any,
    oraclePrice: any,
    pnl: BigNumber,
    contracts: AllContracts
) {
    const positionBalance = await Balance.getPositionBalance(
        await account.getAddress(),
        contracts.perpetual as any
    );
    const marginBankBalance = await Balance.getMarginBankBalance(
        await account.getAddress(),
        contracts.marginbank as any
    );

    const marginRatio = Balance.getMarginRatio(positionBalance, oraclePrice);

    const pPos = positionBalance.qPos.gt(0)
        ? positionBalance.oiOpen
              .multipliedBy(BIGNUMBER_BASE)
              .dividedBy(positionBalance.qPos)
        : new BigNumber("0");

    // create expected position
    const expectedPosition = getExpectedTestPosition(expectedValues);

    // perform expects
    expectPosition(
        expectedPosition,
        toTestPositionExpect(
            positionBalance,
            pPos,
            marginRatio,
            marginBankBalance
        )
    );

    if (expectedValues.pnl != undefined) {
        expect(pnl.shiftedBy(-BASE_DECIMALS).toFixed(6)).to.be.equal(
            BigNumber(expectedValues.pnl).toFixed(6)
        );
    }
}

export async function evaluateSystemExpect(
    expectedSystemValues: any,
    contracts: AllContracts
) {
    if (expectedSystemValues.fee) {
        const fee = hexToBigNumber(
            await contracts.marginbank.getAccountBankBalance(FEE_POOL_ADDRESS)
        ).shiftedBy(-18);
        expect(fee.toFixed(6)).to.be.equal(
            new BigNumber(expectedSystemValues.fee).toFixed(6)
        );
    }

    if (expectedSystemValues.IFBalance) {
        const insurance = hexToBigNumber(
            await contracts.marginbank.getAccountBankBalance(
                INSURANCE_POOL_ADDRESS
            )
        ).shiftedBy(-BASE_DECIMALS);
        expect(insurance.toFixed(6)).to.be.equal(
            new BigNumber(expectedSystemValues.IFBalance).toFixed(6)
        );
    }

    if (expectedSystemValues.perpetual) {
        const perpetual = hexToBigNumber(
            await contracts.marginbank.getAccountBankBalance(
                contracts.perpetual.address
            )
        ).shiftedBy(-BASE_DECIMALS);
        expect(perpetual.toFixed(6)).to.be.equal(
            new BigNumber(expectedSystemValues.perpetual).toFixed(6)
        );
    }
}
