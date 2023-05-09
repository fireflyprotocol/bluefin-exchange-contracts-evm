import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployAll } from "../helpers/initializePerpetual";
import {
    Guardian,
    MarginBank,
    Perpetual,
    FundingOracle,
    DummyPriceOracle
} from "../../artifacts/typechain";
import { expectEvent } from "../helpers/expect";
import { Signer } from "ethers";
import hardhat from "hardhat";
import { GuardianStatus } from "../../types";
import { AllContracts } from "../helpers/interfaces";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Guardian Contract", () => {
    let contracts: AllContracts;
    let marginbankContract: MarginBank;
    let guardianContract: Guardian;
    let fundingOracleContract: FundingOracle;
    let perpetualContract: Perpetual;
    let priceOracleContract: DummyPriceOracle;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
    });

    beforeEach(async () => {
        contracts = await deployAll({ useRealFunder: true });

        guardianContract = contracts.guardian;
        marginbankContract = contracts.marginbank;
        perpetualContract = contracts.perpetual;
        fundingOracleContract = contracts.funder as FundingOracle;
        priceOracleContract = contracts.priceOracle;
    });

    describe("Only guardian account can enable/disable trading ", () => {
        it("non owner should not be able to set trade status", async () => {
            // only owner can set a new guardian
            await expect(
                guardianContract
                    .connect(bob)
                    .setGuardian(await alice.getAddress())
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );

            // owner makes alice guardian
            let txResult = await guardianContract
                .connect(owner)
                .setGuardian(await alice.getAddress());
            expectEvent(txResult, "GuardianAccountUpdate");

            // since alice is the new guardian, so transaction should revert
            await expect(
                guardianContract
                    .connect(owner)
                    .setTradingStatus(
                        perpetualContract.address,
                        GuardianStatus.Allowed
                    )
            ).to.be.eventually.rejectedWith(
                "Guardian: caller is not the guardian"
            );
        });

        it("guardian enable/disable trading", async () => {
            // by default trading is allowed
            let status = await guardianContract
                .connect(owner)
                .isTradingAllowed(perpetualContract.address);
            expect(status).is.true;

            // guardian disables trading
            let txResult = await guardianContract
                .connect(owner)
                .setTradingStatus(
                    perpetualContract.address,
                    GuardianStatus.Disallowed
                );
            expectEvent(txResult, "TradingStatusUpdate");

            status = await guardianContract
                .connect(owner)
                .isTradingAllowed(perpetualContract.address);
            expect(status).is.false;

            // guardian enables trading
            txResult = await guardianContract
                .connect(owner)
                .setTradingStatus(
                    perpetualContract.address,
                    GuardianStatus.Allowed
                );
            expectEvent(txResult, "TradingStatusUpdate");

            status = await guardianContract
                .connect(owner)
                .isTradingAllowed(perpetualContract.address);
            expect(status).is.true;
        });
    });

    describe("Only guardian account can enable/disable withdrawals ", () => {
        it("non guardian should not be able to set withdrawal status", async () => {
            let txResult = await guardianContract
                .connect(owner)
                .setGuardian(await alice.getAddress());
            expectEvent(txResult, "GuardianAccountUpdate");

            await expect(
                guardianContract
                    .connect(owner)
                    .setWithdrawalStatus(
                        marginbankContract.address,
                        GuardianStatus.Allowed
                    )
            ).to.be.eventually.rejectedWith(
                "Guardian: caller is not the guardian"
            );
        });

        it("guardian enable/disable withdrawals", async () => {
            // by default withdrawal is allowed
            let status = await guardianContract
                .connect(owner)
                .isWithdrawalAllowed(marginbankContract.address);
            expect(status).is.true;

            // guardian disables withdrawals
            let txResult = await guardianContract
                .connect(owner)
                .setWithdrawalStatus(
                    marginbankContract.address,
                    GuardianStatus.Disallowed
                );
            expectEvent(txResult, "WithdrawalStatusUpdate");

            status = await guardianContract
                .connect(owner)
                .isWithdrawalAllowed(marginbankContract.address);
            expect(status).is.false;

            // guardian enables withdrawals
            txResult = await guardianContract
                .connect(owner)
                .setWithdrawalStatus(
                    marginbankContract.address,
                    GuardianStatus.Allowed
                );
            expectEvent(txResult, "WithdrawalStatusUpdate");

            status = await guardianContract
                .connect(owner)
                .isWithdrawalAllowed(marginbankContract.address);
            expect(status).is.true;
        });
    });

    describe("Only guardian account can enable/disable funding rate status ", () => {
        it("non guardian should not be able to set funding rate status", async () => {
            let txResult = await guardianContract
                .connect(owner)
                .setGuardian(await alice.getAddress());
            expectEvent(txResult, "GuardianAccountUpdate");

            await expect(
                guardianContract
                    .connect(owner)
                    .setFundingRateStatus(
                        fundingOracleContract.address,
                        GuardianStatus.Allowed
                    )
            ).to.be.eventually.rejectedWith(
                "Guardian: caller is not the guardian"
            );
        });

        it("guardian enable/disable setting funding rate", async () => {
            // by default funding rate is allowed
            let status = await guardianContract
                .connect(owner)
                .isFundingRateAllowed(fundingOracleContract.address);
            expect(status).is.true;

            // guardian disables funding rate
            let txResult = await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    fundingOracleContract.address,
                    GuardianStatus.Disallowed
                );
            expectEvent(txResult, "FRStatusUpdate");

            status = await guardianContract
                .connect(owner)
                .isFundingRateAllowed(fundingOracleContract.address);
            expect(status).is.false;

            txResult = await guardianContract
                .connect(owner)
                .setFundingRateStatus(
                    fundingOracleContract.address,
                    GuardianStatus.Allowed
                );
            expectEvent(txResult, "FRStatusUpdate");

            status = await guardianContract
                .connect(owner)
                .isFundingRateAllowed(fundingOracleContract.address);
            expect(status).is.true;
        });
    });

    describe("Only owner can set someone as guardian ", () => {
        it("owner should be able to set a new guardian", async () => {
            const txResult = await guardianContract
                .connect(owner)
                .setGuardian(await alice.getAddress());

            expectEvent(txResult, "GuardianAccountUpdate");
        });

        it("non owner should not be able to make someone guardian", async () => {
            await expect(
                guardianContract
                    .connect(alice)
                    .setGuardian(await owner.getAddress())
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });
        it("Test getGuardian", async () => {
            await guardianContract
                .connect(owner)
                .setGuardian(await alice.getAddress());
            const txResult = await guardianContract.guardianOperator();
            expect(txResult).equal(await alice.getAddress());
        });
    });
});
