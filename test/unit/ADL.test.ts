import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import { toBigNumberStr } from "../../submodules/library";
import {
    deployAll,
    postDeployment,
    createOrderSigner,
    deployADL
} from "../helpers/initializePerpetual";
import { mintAndDeposit, moveToStartOfTrading } from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { createOrder, tradeByOrder, adlTradeByOrder } from "../helpers/order";
import { OrderSigner } from "../../submodules/library";
import { TRADE_DATA } from "../helpers/default";
import { expectEvent } from "../helpers/expect";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("ADL", () => {
    let contracts: AllContracts;
    let orderSigner: OrderSigner;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let cat: Signer;
    let dog: Signer;
    let operator: Signer;

    before(async () => {
        [owner, alice, bob, cat, dog, operator] =
            await hardhat.ethers.getSigners();
    });

    beforeEach(async () => {
        // deploy all contracts
        contracts = await deployAll({});

        await postDeployment(contracts, owner, {});

        await mintAndDeposit(alice, contracts.token, contracts.marginbank);
        await mintAndDeposit(bob, contracts.token, contracts.marginbank);
        await mintAndDeposit(cat, contracts.token, contracts.marginbank);
        await mintAndDeposit(dog, contracts.token, contracts.marginbank);

        await moveToStartOfTrading(contracts.perpetual);

        await contracts.perpetual.setDeleveragingOperator(
            await operator.getAddress()
        );
        orderSigner = createOrderSigner(contracts.trader.address);
    });

    describe("Initialize", () => {
        it("should successfully deploy adl contract", async () => {
            await deployADL(
                contracts.perpetual.address,
                contracts.evaluator.address
            );
        });
    });

    describe("ADL Trade", () => {
        it("should revert as caller to adl trade method is not perpetual", async () => {
            // this orders contract has zero address whitelisted as perpetual contract
            const adlTemp = await deployADL();

            // whitelist this new orders contract in perpetual
            await contracts.perpetual.setTradeContract(adlTemp.address, true);

            await expect(
                contracts.perpetual.connect(operator).trade(
                    [await bob.getAddress(), await alice.getAddress()],
                    [
                        {
                            makerIndex: 0,
                            takerIndex: 0,
                            trader: adlTemp.address,
                            data: TRADE_DATA
                        }
                    ],
                    0
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Msg sender must be Perpetual"
            );
        });

        it("should revert as only deleveraging operator can perform ADL trades", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            await expect(
                adlTradeByOrder(
                    operator,
                    alice,
                    order,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: bob }
                )
            ).to.be.eventually.rejectedWith("P11");
        });

        it("should revert as account being deleveraged is not under water ( Above MMR )", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            await contracts.priceOracle.setPrice(toBigNumberStr(96));

            await expect(
                adlTradeByOrder(
                    dog,
                    alice,
                    order,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Cannot deleverage since maker is not underwater"
            );
        });

        it("should revert as account being deleveraged is not under water ( Above bankruptcy )", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            await contracts.priceOracle.setPrice(toBigNumberStr(91.2));

            await expect(
                adlTradeByOrder(
                    dog,
                    alice,
                    order,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Cannot deleverage since maker is not underwater"
            );
        });

        it("should revert as taker account is under water ", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                dog,
                cat,
                order,
                orderSigner,
                contracts.perpetual
            );

            await contracts.priceOracle.setPrice(toBigNumberStr(89.2));

            await expect(
                adlTradeByOrder(
                    cat,
                    alice,
                    order,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Cannot deleverage since taker is underwater"
            );
        });

        it("should revert as all or nothing flag is set and maker's position size is < adl quantity", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            // alice is under water
            await contracts.priceOracle.setPrice(toBigNumberStr(89.1));

            await expect(
                adlTradeByOrder(
                    dog,
                    alice,
                    order,
                    contracts.adl,
                    contracts.perpetual,
                    {
                        sender: operator,
                        allOrNothing: true,
                        quantity: toBigNumberStr(11)
                    }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: allOrNothing is set and maker position is < quantity"
            );
        });

        it("should revert as maker and taker can not have same side position", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // alice and bob trade - alice is long
            await tradeByOrder(
                bob,
                alice,
                orderA,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 10,
                leverage: 2,
                isBuy: true
            });

            // cat and dog trade - cat is long
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            // alice is under water
            await contracts.priceOracle.setPrice(toBigNumberStr(89.1));

            await expect(
                adlTradeByOrder(
                    cat,
                    alice,
                    orderA,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Taker and maker can not have same side positions"
            );
        });

        it("should revert as all or nothing flag is set and taker's position size is < adl quantity", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // alice and bob trade - alice is long
            await tradeByOrder(
                bob,
                alice,
                orderA,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 5,
                leverage: 2,
                isBuy: false
            });

            // cat and dog trade - cat is long
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            // alice is under water
            await contracts.priceOracle.setPrice(toBigNumberStr(89.1));

            await expect(
                adlTradeByOrder(
                    cat,
                    alice,
                    orderA,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator, allOrNothing: true }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: allOrNothing is set and taker position is < quantity"
            );
        });

        it("should revert as deleveraging trade must reduce maker's position", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // alice and bob trade - alice is long
            await tradeByOrder(
                bob,
                alice,
                orderA,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 10,
                leverage: 2,
                isBuy: false
            });

            // cat and dog trade - cat is long
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            // alice is under water
            await contracts.priceOracle.setPrice(toBigNumberStr(89.1));

            await expect(
                adlTradeByOrder(
                    cat,
                    alice,
                    orderA,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator, isBuy: true }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: deleveraging must not increase maker's position size"
            );
        });

        it("should revert as maker has zero position size", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            await expect(
                adlTradeByOrder(
                    cat,
                    alice,
                    orderA,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Maker has zero position"
            );
        });

        it("should revert as taker has zero position size", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // alice and bob trade - alice is long
            await tradeByOrder(
                bob,
                alice,
                orderA,
                orderSigner,
                contracts.perpetual
            );

            await expect(
                adlTradeByOrder(
                    cat,
                    alice,
                    orderA,
                    contracts.adl,
                    contracts.perpetual,
                    { sender: operator }
                )
            ).to.be.eventually.rejectedWith(
                "IsolatedADL: Taker has zero position"
            );
        });

        it("should successfully deleverage maker", async () => {
            // set oracle price
            await contracts.priceOracle.setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // alice and bob trade - alice is long
            await tradeByOrder(
                bob,
                alice,
                orderA,
                orderSigner,
                contracts.perpetual
            );

            const orderB = createOrder({
                price: 100,
                quantity: 10,
                leverage: 2,
                isBuy: false
            });

            // cat and dog trade - cat is long
            await tradeByOrder(
                dog,
                cat,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            // alice is under water
            await contracts.priceOracle.setPrice(toBigNumberStr(89.1));

            const tx = await adlTradeByOrder(
                cat,
                alice,
                orderA,
                contracts.adl,
                contracts.perpetual,
                { sender: operator }
            );
            await expectEvent(tx, "TradeExecuted");
        });
    });
});
