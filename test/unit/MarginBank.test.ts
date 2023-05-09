import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { MarginBank, DummyUSDC, Guardian } from "../../artifacts/typechain";
import {
    deployMockToken,
    deployMarginBank,
    deployPerpetual,
    deployGuardian,
    deployMarginMath
} from "../helpers/initializePerpetual";
import { Signer } from "ethers";
import { GuardianStatus } from "../../types";
import { expectEvent } from "../helpers/expect";
import { bnToString, toBigNumberStr } from "../../submodules/library";
import { mintAndApprove } from "../helpers/utils";
import { FEE_POOL_ADDRESS } from "../helpers/default";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("MarginBank Contract", () => {
    let marginbankContract: MarginBank;
    let guardianContract: Guardian;
    let tokenContract: DummyUSDC;
    let marginMathAddress: string;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
        marginMathAddress = await deployMarginMath();
        tokenContract = await deployMockToken({});
    });

    beforeEach(async () => {
        guardianContract = await deployGuardian();

        marginbankContract = await deployMarginBank(
            tokenContract.address,
            guardianContract.address
        );

        // mint 50K USDC to owner and approve margin bank
        await mintAndApprove(owner, tokenContract, marginbankContract, 50_000);
    });

    describe("Deposits and Withdraw", () => {
        it("should deposit 10K USDC to margin bank for alice", async () => {
            const txResult = await marginbankContract.depositToBank(
                await alice.getAddress(),
                toBigNumberStr(10_000, 6)
            );

            await expectEvent(txResult, "BankBalanceUpdate");

            expect(
                bnToString(
                    +(await marginbankContract.getAccountBankBalance(
                        await alice.getAddress()
                    ))
                )
            ).to.be.equal(toBigNumberStr(10_000));
        });

        it("should withdraw 1K USDC from margin bank from alice account", async () => {
            // deposit 10k to alice account
            await marginbankContract
                .connect(owner)
                .depositToBank(
                    await alice.getAddress(),
                    toBigNumberStr(10_000, 6)
                );

            // take out 1K
            const txResult = await marginbankContract
                .connect(alice)
                .withdrawFromBank(
                    await alice.getAddress(),
                    toBigNumberStr(1000, 6)
                );

            await expectEvent(txResult, "BankBalanceUpdate");

            expect(
                bnToString(
                    +(await marginbankContract
                        .connect(owner)
                        .getAccountBankBalance(await alice.getAddress()))
                )
            ).to.be.equal(toBigNumberStr(9_000));
        });

        it("should revert alice does not have enough funds to withdraw", async () => {
            // lock 10K
            await marginbankContract
                .connect(owner)
                .depositToBank(
                    await alice.getAddress(),
                    toBigNumberStr(10_000, 6)
                );

            // try to with draw 20K
            await expect(
                marginbankContract
                    .connect(alice)
                    .withdrawFromBank(
                        await alice.getAddress(),
                        toBigNumberStr(20_000, 6)
                    )
            ).to.eventually.be.rejectedWith(
                "VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds balance'"
            );
        });

        it("should revert when guardian disabled withdraw", async () => {
            await guardianContract.setWithdrawalStatus(
                marginbankContract.address,
                GuardianStatus.Disallowed
            );

            await marginbankContract
                .connect(owner)
                .depositToBank(
                    await alice.getAddress(),
                    toBigNumberStr(10_000, 6)
                );

            await expect(
                marginbankContract
                    .connect(alice)
                    .withdrawFromBank(
                        await alice.getAddress(),
                        toBigNumberStr(1000, 6)
                    )
            ).to.be.eventually.rejectedWith(
                "MarginBank: Withdrawals not allowed at the moment"
            );
        });
    });

    describe("Bank Operators", () => {
        it("should revert as transfer margin to bank could only be done by Bank Operator", async () => {
            await expect(
                marginbankContract.transferMarginToAccount(
                    await owner.getAddress(),
                    await bob.getAddress(),
                    toBigNumberStr(10)
                )
            ).to.be.eventually.rejectedWith(
                "MarginBank: caller is not a bank operator"
            );
        });

        it("should make perpetual contract bank operator", async () => {
            const perpetualContract = await deployPerpetual({
                marginMath: marginMathAddress,
                guardian: guardianContract.address,
                feePool: FEE_POOL_ADDRESS
            });
            const txResult = await marginbankContract
                .connect(owner)
                .setBankOperator(perpetualContract.address, true);
            await expectEvent(txResult, "MarginBankOperatorUpdate");
        });
    });

    describe("Guardian protection", () => {
        it("should revert as withdraw from margin bank not allowed when guardian disabled withdrawals", async () => {
            await guardianContract
                .connect(owner)
                .setWithdrawalStatus(
                    marginbankContract.address,
                    GuardianStatus.Disallowed
                );

            await marginbankContract
                .connect(owner)
                .depositToBank(
                    await alice.getAddress(),
                    toBigNumberStr(10_000, 6)
                );

            await expect(
                marginbankContract
                    .connect(alice)
                    .withdrawFromBank(
                        await alice.getAddress(),
                        toBigNumberStr(1000, 6)
                    )
            ).to.be.eventually.rejectedWith(
                "MarginBank: Withdrawals not allowed at the moment"
            );
        });

        it("should revert as only guardian contract can set withdrawal status", async () => {
            await expect(
                marginbankContract
                    .connect(owner)
                    .setWithdrawalStatus(GuardianStatus.Disallowed)
            ).to.be.eventually.rejectedWith(
                "MarginBank: caller is not the guardian contract"
            );
        });
    });
});
