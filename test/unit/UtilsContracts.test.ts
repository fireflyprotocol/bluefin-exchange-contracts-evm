import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { deployOwnableContract } from "../helpers/initializePerpetual";
import { Signer } from "ethers";
import { ADDRESSES } from "../../submodules/library";
import { getBlockTimestamp, getBlockNumber } from "../helpers/utils";
import { DummyOwnableContract } from "../../artifacts/typechain";
import { expectEvent } from "../helpers/expect";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Utility Contracts", () => {
    let ownableContract: DummyOwnableContract;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
    });

    beforeEach(async () => {
        ownableContract = await deployOwnableContract();
    });

    describe("FFLYiOwnableUpgrade", () => {
        it("should be initialized with deployer account as owner", async () => {
            expect(await ownableContract.owner()).to.be.equal(
                await owner.getAddress()
            );
        });

        it("should have no candidate account", async () => {
            expect(await ownableContract.candidate()).to.be.equal(
                ADDRESSES.ZERO
            );
        });

        it("should renounce ownership", async () => {
            await ownableContract.renounceOwnership();
            expect(await ownableContract.owner()).to.be.equal(ADDRESSES.ZERO);
            expect(await ownableContract.candidate()).to.be.equal(
                ADDRESSES.ZERO
            );
        });

        it("should revert as ZERO address can not be set as owner", async () => {
            await expect(
                ownableContract.setOwner(ADDRESSES.ZERO)
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: zero address"
            );
        });

        it("should revert as new owner can not be same as current one", async () => {
            await expect(
                ownableContract.setOwner(await owner.getAddress())
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: same as original"
            );
        });

        it("should successfully name a new candidate for ownership", async () => {
            await ownableContract.setOwner(await alice.getAddress());
            expect(await ownableContract.candidate()).to.be.equal(
                await alice.getAddress()
            );
        });

        it("should revert as the new candidate can not be the same as existing one", async () => {
            await ownableContract.setOwner(await alice.getAddress());
            await expect(
                ownableContract.setOwner(await alice.getAddress())
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: same as candidate"
            );
        });

        it("should revert as owner can not be updated as candidate address is zero", async () => {
            await expect(
                ownableContract.updateOwner()
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: candidate is zero address"
            );
        });

        it("should revert as owner can not be updated as candidate address is zero", async () => {
            await ownableContract.setOwner(await alice.getAddress());

            await expect(
                ownableContract.connect(bob).updateOwner()
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: not the new owner"
            );
        });

        it("should successfully transfer ownership to alice", async () => {
            await ownableContract.setOwner(await alice.getAddress());
            const tx = await ownableContract.connect(alice).updateOwner();

            await expectEvent(tx, "OwnershipTransferred");
        });
    });

    describe("BlockContext", () => {
        it("should return current block time stamp", async () => {
            expect(+(await ownableContract.blockTimestamp())).to.be.equal(
                await getBlockTimestamp()
            );
        });

        it("should return current block number", async () => {
            expect(+(await ownableContract.blockNumber())).to.be.equal(
                await getBlockNumber()
            );
        });
    });
});
