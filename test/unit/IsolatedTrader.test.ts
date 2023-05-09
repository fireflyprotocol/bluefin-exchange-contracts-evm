import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import {
    createOrderSigner,
    deployIsolatedTrader
} from "../helpers/initializePerpetual";
import { IsolatedTrader } from "../../artifacts/typechain";
import { OrderStatus } from "../../types";
import { createOrder, defaultOrder } from "../helpers/order";
import { Signer } from "ethers";
import { expectEvent, expectStatus } from "../helpers/expect";
import {
    SigningMethod,
    Order,
    OrderSigner,
    ADDRESSES
} from "../../submodules/library";
import { GAS_POOL_ADDRESS } from "../helpers/default";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Isolated Trader Contract", () => {
    let traderContract: IsolatedTrader;
    let orderSigner: OrderSigner;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let fullFlagOrder: Order;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
        fullFlagOrder = createOrder({
            reduceOnly: true,
            makerAddress: await alice.getAddress()
        });
    });

    beforeEach(async () => {
        traderContract = await deployIsolatedTrader({
            perpetual: "0xe83515fEa858D4ac48278F27DF375fbF2bff441d"
        });

        orderSigner = await createOrderSigner(traderContract.address);
    });

    it("should initialize the contract with provided perpetual address", async () => {
        traderContract = await deployIsolatedTrader({
            perpetual: "0xe83515fEa858D4ac48278F27DF375fbF2bff441d"
        });

        expect(await traderContract.perpetual()).to.be.equal(
            "0xe83515fEa858D4ac48278F27DF375fbF2bff441d"
        );
    });

    it("should initialize the contract with provided trusted forwarder address", async () => {
        traderContract = await deployIsolatedTrader({
            trustedForwarder: "0xe83515fEa858D4ac48278F27DF375fbF2bff441d"
        });

        expect(
            await traderContract.isTrustedForwarder(
                "0xe83515fEa858D4ac48278F27DF375fbF2bff441d"
            )
        ).to.be.equal(true);
    });

    it("should return the trader flags as 1", async () => {
        traderContract = await deployIsolatedTrader({
            perpetual: "0xe83515fEa858D4ac48278F27DF375fbF2bff441d"
        });

        expect(await traderContract.getTraderFlag()).to.be.equal(
            "0x0000000000000000000000000000000000000000000000000000000000000001"
        );
    });

    describe("off-chain helpers", () => {
        it("Signs correctly for hash", async () => {
            defaultOrder.maker = await owner.getAddress();

            const typedSignature = await orderSigner.signOrder(
                defaultOrder,
                SigningMethod.Hash
            );

            const validSignature = orderSigner.orderHasValidSignature({
                ...defaultOrder,
                typedSignature
            });
            expect(validSignature).to.be.true;
        });

        it("Signs correctly for typed data", async () => {
            defaultOrder.maker = await owner.getAddress();

            const typedSignature = await orderSigner.signOrder(
                defaultOrder,
                SigningMethod.HardhatTypedData
            );

            const validSignature = orderSigner.orderHasValidSignature({
                ...defaultOrder,
                typedSignature
            });
            expect(validSignature).to.be.true;
        });

        it("Signs an order cancelation", async () => {
            const hashSignature = await orderSigner.signCancelOrder(
                defaultOrder,
                SigningMethod.Hash
            );
            const validHashSignature = orderSigner.cancelOrderHasValidSignature(
                defaultOrder,
                hashSignature
            );
            expect(validHashSignature).to.be.true;
        });
    });

    describe("Gas Pool", function () {
        it("should revert when trying to update gas pool address ( new address, same as current one)", async () => {
            await expect(
                traderContract.setGasPool(ADDRESSES.ZERO)
            ).to.be.eventually.rejectedWith(
                "IsolatedTrader: New gas pool address should be different from current one"
            );
        });

        it("should successfully change gas pool address", async () => {
            await traderContract.setGasPool(GAS_POOL_ADDRESS);
            expect(await traderContract.gasPool()).to.be.equal(
                GAS_POOL_ADDRESS
            );
        });
    });

    describe("Order Cancellation", function () {
        it("Succeeds in cancelling order", async () => {
            const solidityOrder = OrderSigner.orderToSolidity(fullFlagOrder);
            const txResult = await traderContract
                .connect(alice)
                .cancelOrder(solidityOrder);
            await expectEvent(txResult, "OrderCancel");
            await expectStatus(
                orderSigner,
                traderContract,
                fullFlagOrder,
                OrderStatus.Canceled
            );
        });

        it("Fails if caller is not the maker", async () => {
            const solidityOrder = OrderSigner.orderToSolidity(fullFlagOrder);
            await expect(
                traderContract.connect(bob).cancelOrder(solidityOrder)
            ).to.eventually.be.rejectedWith(
                "IsolatedTrader: Order cannot be canceled by non-maker"
            );
        });

        it("off-chain hash is the same as on-chain hash", async () => {
            const order = createOrder({
                makerAddress: await alice.getAddress(),
                price: 100,
                quantity: 20,
                leverage: 2,
                salt: 871
            });
            const offChainHash = orderSigner.getOrderHash(order);
            const solidityOrder = OrderSigner.orderToSolidity(order);
            const onchainHash = await traderContract.getOrderHash(
                solidityOrder
            );
            expect(offChainHash).is.equal(onchainHash);
        });

        it("single order cancel", async () => {
            // create order for cancellation
            const solidityOrder = OrderSigner.orderToSolidity(
                createOrder({
                    makerAddress: await alice.getAddress(),
                    price: 100,
                    quantity: 20,
                    leverage: 2,
                    salt: 871
                })
            );
            let onchainHash = await traderContract.getOrderHash(solidityOrder);

            // before cancellation status should be 0
            let statusResponse = await traderContract.getOrdersStatus([
                onchainHash
            ]);
            expect(statusResponse.length).to.be.equal(1);
            expect(statusResponse[0].status).to.be.equal(0);

            // cancel order
            await traderContract.connect(alice).cancelOrder(solidityOrder);

            // after cancellation status should be 1
            statusResponse = await traderContract.getOrdersStatus([
                onchainHash
            ]);
            expect(statusResponse.length).to.be.equal(1);
            expect(statusResponse[0].status).to.be.equal(1);
        });

        it("batch order cancel", async () => {
            // create orders for cancellation
            let solidityOrders = [];
            solidityOrders.push(
                OrderSigner.orderToSolidity(
                    createOrder({
                        makerAddress: await alice.getAddress(),
                        salt: 871
                    })
                )
            );
            solidityOrders.push(
                OrderSigner.orderToSolidity(
                    createOrder({
                        makerAddress: await alice.getAddress(),
                        salt: 872
                    })
                )
            );
            solidityOrders.push(
                OrderSigner.orderToSolidity(
                    createOrder({
                        makerAddress: await alice.getAddress(),
                        salt: 113
                    })
                )
            );
            // compute hash of cancelled orders calling an onchain method
            let onchainHashes = [];
            for (let i = 0; i < solidityOrders.length; i++) {
                onchainHashes.push(
                    await traderContract.getOrderHash(solidityOrders[i])
                );
            }

            // before cancellation status should be 0
            let statusResponse = await traderContract.getOrdersStatus(
                onchainHashes
            );
            expect(statusResponse.length).to.be.equal(solidityOrders.length);
            for (let i = 0; i < solidityOrders.length; i++) {
                expect(statusResponse[i].status).to.be.equal(0);
            }

            // cancel the orders
            await traderContract.connect(alice).cancelOrders(solidityOrders);

            // after cancellation status should be 1
            statusResponse = await traderContract.getOrdersStatus(
                onchainHashes
            );
            expect(statusResponse.length).to.be.equal(solidityOrders.length);
            for (let i = 0; i < solidityOrders.length; i++) {
                expect(statusResponse[i].status).to.be.equal(1);
            }
        });

        it("should be initialized with owner as cancellation operator", async () => {
            const ownerAddress = await owner.getAddress();
            const operator = await traderContract
                .connect(owner)
                .cancellationOperator();
            expect(operator).to.be.equal(ownerAddress);
        });

        it("should be able to change cancellation operator when caller is admin", async () => {
            const newAddress = await alice.getAddress();
            const txResult = await traderContract
                .connect(owner)
                .setCancellationOperator(newAddress);
            expectEvent(txResult, "CancellationOperatorUpdate");
            const operator = await traderContract.cancellationOperator();
            expect(operator).to.be.equal(newAddress);
        });

        it("should revert if cancellation operator is set to the same again", async () => {
            await expect(
                traderContract
                    .connect(owner)
                    .setCancellationOperator(await owner.getAddress())
            ).to.eventually.be.rejectedWith(
                "IsolatedTrader: New cancellation operator should be different from current one"
            );
        });

        it("should revert when non-admin changes cancellation operator", async () => {
            const newAddress = await alice.getAddress();
            await expect(
                traderContract.connect(bob).setCancellationOperator(newAddress)
            ).to.eventually.be.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should revert if cancellation by hash not invoked by cancellation operator", async () => {
            const solidityOrder = OrderSigner.orderToSolidity(
                createOrder({
                    makerAddress: await alice.getAddress(),
                    price: 100,
                    quantity: 20,
                    leverage: 2,
                    salt: 871
                })
            );
            let onchainHash = await traderContract.getOrderHash(solidityOrder);
            await expect(
                traderContract.connect(alice).cancelOrderByHash(onchainHash)
            ).to.eventually.be.rejectedWith(
                "IsolatedTrader: caller is not the cancellation operator"
            );
        });

        it("single order cancel using order hash", async () => {
            // create order for cancellation
            const solidityOrder = OrderSigner.orderToSolidity(
                createOrder({
                    makerAddress: await alice.getAddress(),
                    price: 100,
                    quantity: 20,
                    leverage: 2,
                    salt: 871
                })
            );
            let onchainHash = await traderContract.getOrderHash(solidityOrder);

            // before cancellation status should be 0
            let statusResponse = await traderContract.getOrdersStatus([
                onchainHash
            ]);
            expect(statusResponse.length).to.be.equal(1);
            expect(statusResponse[0].status).to.be.equal(0);

            const txResult = await traderContract
                .connect(owner)
                .cancelOrderByHash(onchainHash);
            expectEvent(txResult, "OrderCancelledByOperator");

            // after cancellation status should be 1
            statusResponse = await traderContract.getOrdersStatus([
                onchainHash
            ]);
            expect(statusResponse.length).to.be.equal(1);
            expect(statusResponse[0].status).to.be.equal(1);
        });

        it("batch order cancel using order hashes", async () => {
            // create orders for cancellation
            let solidityOrders = [];
            solidityOrders.push(
                OrderSigner.orderToSolidity(
                    createOrder({
                        makerAddress: await alice.getAddress(),
                        salt: 871
                    })
                )
            );
            solidityOrders.push(
                OrderSigner.orderToSolidity(
                    createOrder({
                        makerAddress: await alice.getAddress(),
                        salt: 872
                    })
                )
            );
            solidityOrders.push(
                OrderSigner.orderToSolidity(
                    createOrder({
                        makerAddress: await alice.getAddress(),
                        salt: 113
                    })
                )
            );
            // compute hash of cancelled orders calling an onchain method
            let onchainHashes = [];
            for (let i = 0; i < solidityOrders.length; i++) {
                onchainHashes.push(
                    await traderContract.getOrderHash(solidityOrders[i])
                );
            }

            // before cancellation status should be 0
            let statusResponse = await traderContract.getOrdersStatus(
                onchainHashes
            );
            expect(statusResponse.length).to.be.equal(solidityOrders.length);
            for (let i = 0; i < solidityOrders.length; i++) {
                expect(statusResponse[i].status).to.be.equal(0);
            }

            // cancel the orders
            const txResult = await traderContract
                .connect(owner)
                .cancelOrdersByHash(onchainHashes);
            expectEvent(txResult, "OrderCancelledByOperator");

            // after cancellation status should be 1
            statusResponse = await traderContract.getOrdersStatus(
                onchainHashes
            );
            expect(statusResponse.length).to.be.equal(solidityOrders.length);
            for (let i = 0; i < solidityOrders.length; i++) {
                expect(statusResponse[i].status).to.be.equal(1);
            }
        });
    });
});
