import hardhat from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer } from "ethers";

import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import {
    toBigNumberStr,
    bnToString,
    Balance,
    OrderSigner,
    bigNumber
} from "../../submodules/library";
import { Evaluator } from "../../artifacts/typechain";
import { deployEvaluator } from "../helpers/initializePerpetual";
import { AllContracts } from "../helpers/interfaces";
import {
    mintAndDeposit,
    moveToStartOfTrading,
    getBlockTimestamp
} from "../helpers/utils";
import { createOrder, tradeByOrder } from "../helpers/order";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Evaluator", () => {
    let evaluatorContract: Evaluator;
    let contracts: AllContracts;
    let orderSigner: OrderSigner;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;

    before(async () => {
        [owner, alice, bob] = await hardhat.ethers.getSigners();
    });

    describe("Initialization", () => {
        it("should revert when trying to deploy evaluator contract with min trade price as zero", async () => {
            expect(
                deployEvaluator({
                    minOrderPrice: toBigNumberStr(0)
                })
            ).to.be.eventually.rejectedWith("Minimum order price must be > 0");
        });

        it("should revert when trying to deploy evaluator contract with max trade price < min trade price", async () => {
            expect(
                deployEvaluator({
                    minOrderPrice: toBigNumberStr(15),
                    maxOrderPrice: toBigNumberStr(10)
                })
            ).to.be.eventually.rejectedWith(
                "Minimum order price must be <  maximum order price"
            );
        });

        it("should revert when trying to deploy evaluator contract with min trade quantity > max trade quantity", async () => {
            expect(
                deployEvaluator({
                    minTradeQty: toBigNumberStr(100),
                    maxTradeQtyLimit: toBigNumberStr(10),
                    maxTradeQtyMarket: toBigNumberStr(200)
                })
            ).to.be.eventually.rejectedWith(
                "Minimum trade quantity must be < max trade quantity"
            );
        });

        it("should revert when trying to deploy evaluator contract with min trade quantity as zero", async () => {
            expect(
                deployEvaluator({
                    minTradeQty: toBigNumberStr(0)
                })
            ).to.be.eventually.rejectedWith(
                "Minimum trade quantity must be > 0"
            );
        });

        it("should revert when trying to deploy evaluator contract with tick size zero", async () => {
            expect(
                deployEvaluator({
                    tickSize: toBigNumberStr(0)
                })
            ).to.be.eventually.rejectedWith("Tick size must be > 0");
        });

        it("should revert when trying to deploy evaluator contract with step size zero", async () => {
            expect(
                deployEvaluator({
                    stepSize: toBigNumberStr(0)
                })
            ).to.be.eventually.rejectedWith("Step size must be > 0");
        });

        it("should revert when trying to deploy evaluator contract with take bound long as zero", async () => {
            expect(
                deployEvaluator({
                    mtbLong: toBigNumberStr(0)
                })
            ).to.be.eventually.rejectedWith(
                "Take bounds must be > 0 for both sides"
            );
        });

        it("should revert when trying to deploy evaluator contract with take bound short as zero", async () => {
            expect(
                deployEvaluator({
                    mtbShort: toBigNumberStr(0)
                })
            ).to.be.eventually.rejectedWith(
                "Take bounds must be > 0 for both sides"
            );
        });

        it("should revert when trying to deploy evaluator contract with take bound short as 100%", async () => {
            expect(
                deployEvaluator({
                    mtbShort: toBigNumberStr(1)
                })
            ).to.be.eventually.rejectedWith(
                "Take Bound for short trades must be < 100%"
            );
        });
    });

    describe("Setters", () => {
        beforeEach(async () => {
            [owner, alice, bob] = await hardhat.ethers.getSigners();
            evaluatorContract = await deployEvaluator({});
        });

        it("should allow setting valid minimum Trade Price", async () => {
            await evaluatorContract
                .connect(owner)
                .setMinOrderPrice(toBigNumberStr(0.5));
            const minPrice = await evaluatorContract.minPrice();
            expect(bnToString(+minPrice)).to.be.equal(toBigNumberStr(0.5));
        });

        it("should not allow setting minimum Trade Price as zero or (greater or equal) than maximum trade pride", async () => {
            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMinOrderPrice(toBigNumberStr(0))
            ).to.eventually.be.rejectedWith("Minimum order price must be > 0");
            const maxPrice = await evaluatorContract.connect(owner).maxPrice();
            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMinOrderPrice(bnToString(+maxPrice))
            ).to.eventually.be.rejectedWith(
                "Minimum trade price must be < maximum trade price"
            );
        });

        it("should allow setting valid maximum Trade Price", async () => {
            await evaluatorContract.setMaxOrderPrice(toBigNumberStr(2000));
            const maxPrice = await evaluatorContract.maxPrice();
            expect(bnToString(+maxPrice)).to.be.equal(toBigNumberStr(2000));
        });

        it("should not allow setting maximum Trade Price less then or equal to minimum Trade Price", async () => {
            const minPrice = await evaluatorContract.minPrice();

            await expect(
                evaluatorContract.setMaxOrderPrice(bnToString(+minPrice))
            ).to.eventually.be.rejectedWith(
                "Maximum trade price must be > min trade price"
            );
        });

        it("should allow setting valid tick Size", async () => {
            await evaluatorContract.setTickSize(toBigNumberStr(0.02));
            const tickSize = await evaluatorContract.tickSize();
            expect(bnToString(+tickSize)).to.be.equal(toBigNumberStr(0.02));
        });

        it("should not allow setting Tick Size as Zero", async () => {
            await expect(
                evaluatorContract.connect(owner).setTickSize(bnToString(0))
            ).to.eventually.be.rejectedWith("Tick Size Must be > 0");
        });

        it("should allow setting valid minimum Trade quantity", async () => {
            await evaluatorContract.setMinQty(toBigNumberStr(0.2));
            const minQty = await evaluatorContract.minQty();
            expect(bnToString(+minQty)).to.be.equal(toBigNumberStr(0.2));
        });

        it("should not allow setting minimum Trade Quantity zero or (equal or greater) than maximum trade Quantity", async () => {
            const maxLimitQty = await evaluatorContract.maxQtyLimit();
            const maxMarketQty = await evaluatorContract.maxQtyMarket();

            await expect(
                evaluatorContract.connect(owner).setMinQty(bnToString(0))
            ).to.eventually.be.rejectedWith(
                "Minimum trade quantity must be > 0"
            );

            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMinQty(bnToString(+maxLimitQty))
            ).to.eventually.be.rejectedWith(
                "Minimum trade quantity must be < max trade quantity"
            );

            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMinQty(bnToString(+maxMarketQty.add(toBigNumberStr(1))))
            ).to.eventually.be.rejectedWith(
                "Minimum trade quantity must be < max trade quantity"
            );
        });

        it("should allow setting valid maximum Market Trade quantity", async () => {
            await evaluatorContract
                .connect(owner)
                .setMaxQtyMarket(toBigNumberStr(20000));
            const maxTradeMarketQty = await evaluatorContract.maxQtyMarket();
            expect(bnToString(+maxTradeMarketQty)).to.be.equal(
                toBigNumberStr(20000)
            );
        });

        it("should not allow setting Maximum Market Trade Quantity less than or equal to  minimum trade Quantity", async () => {
            const minQty = await evaluatorContract.minQty();
            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMaxQtyMarket(bnToString(+minQty))
            ).to.eventually.be.rejectedWith(
                "Maximum Market Trade quantity must be > minimum trade quantity"
            );

            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMaxQtyMarket(
                        bnToString(+minQty.sub(toBigNumberStr(0.01)))
                    )
            ).to.eventually.be.rejectedWith(
                "Maximum Market Trade quantity must be > minimum trade quantity"
            );
        });

        it("should allow setting valid maximum Limit Trade quantity", async () => {
            await evaluatorContract
                .connect(owner)
                .setMaxQtyLimit(toBigNumberStr(20000));
            const maxTradeLimitQty = await evaluatorContract.maxQtyLimit();
            expect(bnToString(+maxTradeLimitQty)).to.be.equal(
                toBigNumberStr(20000)
            );
        });

        it("should not allow setting Maximum Limit Trade Quantity less than or equal to  minimum trade Quantity", async () => {
            const minQty = await evaluatorContract.minQty();
            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMaxQtyLimit(bnToString(+minQty))
            ).to.eventually.be.rejectedWith(
                "Maximum Limit Trade quantity must be > minimum trade quantity"
            );

            await expect(
                evaluatorContract
                    .connect(owner)
                    .setMaxQtyLimit(
                        bnToString(+minQty.sub(toBigNumberStr(0.01)))
                    )
            ).to.eventually.be.rejectedWith(
                "Maximum Limit Trade quantity must be > minimum trade quantity"
            );
        });

        it("should allow setting valid Step Size", async () => {
            await evaluatorContract
                .connect(owner)
                .setStepSize(toBigNumberStr(0.0002));
            const stepSize = await evaluatorContract.stepSize();
            expect(bnToString(+stepSize)).to.be.equal(toBigNumberStr(0.0002));
        });

        it("should not allow setting Step Size as Zero", async () => {
            await expect(
                evaluatorContract.connect(owner).setStepSize(bnToString(0))
            ).to.eventually.be.rejectedWith("Step Size must be > 0");
        });

        it("should allow setting valid MTB bound for Long Trades", async () => {
            await evaluatorContract
                .connect(owner)
                .setMTBLong(toBigNumberStr(30));
            const MTBLong = await evaluatorContract.mtbLong();
            expect(bnToString(+MTBLong)).to.be.equal(toBigNumberStr(30));
        });

        it("should not allow setting MTB for Long Trades as Zero", async () => {
            await expect(
                evaluatorContract.connect(owner).setMTBLong(bnToString(0))
            ).to.eventually.be.rejectedWith(
                "Market Take Bound for long trades must be > 0"
            );
        });

        it("should allow setting valid MTB bound for Short Trades", async () => {
            await evaluatorContract
                .connect(owner)
                .setMTBShort(toBigNumberStr(0.3));
            const MTBShort = await evaluatorContract.mtbShort();
            expect(bnToString(+MTBShort)).to.be.equal(toBigNumberStr(0.3));
        });

        it("should not allow setting MTB for Short Trades as Zero", async () => {
            await expect(
                evaluatorContract.connect(owner).setMTBShort(toBigNumberStr(0))
            ).to.eventually.be.rejectedWith(
                "Market Take Bound for short trades must be > 0"
            );
        });

        it("should not allow setting MTB for Short Trades as 100", async () => {
            await expect(
                evaluatorContract.connect(owner).setMTBShort(toBigNumberStr(1))
            ).to.eventually.be.rejectedWith(
                "Market Take Bound for short trades must be < 100%"
            );
        });
    });

    describe("Price Checks", () => {
        before(async () => {
            contracts = await deployAll({});
            orderSigner = createOrderSigner(contracts.trader.address);

            // perform post deployment steps and set contract to have 0 market/limit fee
            await postDeployment(contracts, owner, {});

            // mints and deposits 2K token to margin bank for marker and taker
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                2_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                2_000
            );

            await moveToStartOfTrading(contracts.perpetual);
        });

        it("should revert when trying to trade at price < min trade price", async () => {
            // set min trade price to 10
            await contracts.evaluator.setMinOrderPrice(toBigNumberStr(10));

            // create an order for price 9
            const order = createOrder({ price: 9 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade price is < min allowed price: 0x70997970...17dc79c8"
            );
        });

        it("should revert when trying to trade at price > max trade price", async () => {
            // set max trade price to 20
            await contracts.evaluator.setMaxOrderPrice(toBigNumberStr(20));

            // create an order for price 21
            const order = createOrder({ price: 21 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade price is > max allowed price: 0x70997970...17dc79c8"
            );
        });

        it("should revert when trying to trade at a price of invalid tick size # 1", async () => {
            // set tick size to be 0.1 // 12.1 is allowed but 12.14 is not
            await contracts.evaluator.setTickSize(toBigNumberStr(0.1));

            // create an order for price 12.14
            const order = createOrder({ price: 12.14 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade price does not conforms to allowed tick size"
            );
        });

        it("should revert when trying to trade at a price of invalid tick size # 2", async () => {
            // set tick size to be 0.01 // 12.01, 12.12 is allowed but not 12.123
            await contracts.evaluator.setTickSize(toBigNumberStr(0.01));

            const order = createOrder({ price: 12.123 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade price does not conforms to allowed tick size"
            );
        });

        it("should successfully execute the trade when all price checks are met", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(10));

            const order = createOrder({ price: 10.11 });
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
        });
    });

    describe("Quantity Checks", () => {
        before(async () => {
            contracts = await deployAll({});
            orderSigner = createOrderSigner(contracts.trader.address);

            // perform post deployment steps and set contract to have 0 market/limit fee
            await postDeployment(contracts, owner, {});

            // mints and deposits 2K token to margin bank for marker and taker
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                2_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                2_000
            );

            await moveToStartOfTrading(contracts.perpetual);
        });

        it("should revert when trying to trade at quantity < min allowed tradable quantity", async () => {
            // set min trade quantity 5
            await contracts.evaluator.setMinQty(toBigNumberStr(5));

            // create an order with quantity 4
            const order = createOrder({ quantity: 4 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade quantity is < min tradeable quantity: 0x70997970...17dc79c8"
            );
        });

        it("should revert when trying to trade at quantity > max limit quantity allowed", async () => {
            // set max limit quantity to 60
            await contracts.evaluator.setMaxQtyLimit(toBigNumberStr(60));

            // create an order with quantity 61
            const order = createOrder({ quantity: 61 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade quantity is > max allowed limit quantity: 0x70997970...17dc79c8"
            );
        });

        it("should revert when trying to trade at quantity > max market quantity allowed", async () => {
            // set max market quantity to 50
            await contracts.evaluator.setMaxQtyMarket(toBigNumberStr(50));

            // create an order with quantity 51
            const order = createOrder({ quantity: 51 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade quantity is > max allowed market quantity"
            );
        });

        it("should revert when trying to trade with quantity of invalid step size # 1", async () => {
            // set step size to be 0.1 // 12.1 is allowed but 12.14 is not
            await contracts.evaluator.setStepSize(toBigNumberStr(0.1));

            // create an order with quantity 12.14
            const order = createOrder({ quantity: 12.14 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade quantity does not conforms to allowed step size"
            );
        });

        it("should revert when trying to trade with quantity of invalid step size # 2", async () => {
            // set step size to be 0.01 // 12.01, 12.12 is allowed but not 12.123
            await contracts.evaluator.setStepSize(toBigNumberStr(0.01));

            const order = createOrder({ quantity: 12.123 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Trade quantity does not conforms to allowed step size"
            );
        });

        it("should successfully execute the trade when all quantity checks are met", async () => {
            await contracts.priceOracle.setPrice(toBigNumberStr(10));
            const order = createOrder({ quantity: 10.11, price: 10 });
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
        });
    });

    describe("Market Take Bounds Checks", () => {
        before(async () => {
            contracts = await deployAll({});
            orderSigner = createOrderSigner(contracts.trader.address);

            // perform post deployment steps and set contract to have 0 market/limit fee
            await postDeployment(contracts, owner, {});

            // mints and deposits 2K token to margin bank for marker and taker
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                2_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                2_000
            );

            await moveToStartOfTrading(contracts.perpetual);
        });

        it("should revert when trying to trade at price < short take bound", async () => {
            // set oracle price to 20
            await contracts.priceOracle.setPrice(toBigNumberStr(20));
            // set market take bound short to 20%
            await contracts.evaluator.setMTBShort(toBigNumberStr(0.2));

            // create an order for price 15 < short market take bound
            const order = createOrder({ price: 15, isBuy: true });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ) //when contracts give correct address, this expect needs to change
                .to.be.eventually.rejectedWith(
                    "Trade price is < Market Take Bound for short side: 0x3c44cddd...fa4293bc"
                );
        });
        it("should successfully trade when trying to trade at price > long take bound when taker is going short", async () => {
            // set oracle price to 20
            await contracts.priceOracle.setPrice(toBigNumberStr(20));

            // set market take bound short to 20%
            await contracts.evaluator.setMTBShort(toBigNumberStr(0.2));

            // create an order for price 30 > long market take bound
            const order = createOrder({ price: 30, isBuy: true });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
        });

        it("should revert when trying to trade at price > long take bound", async () => {
            // set oracle price to 30
            await contracts.priceOracle.setPrice(toBigNumberStr(30));

            // set market take bound short to 20%
            await contracts.evaluator.setMTBLong(toBigNumberStr(0.2));

            // create an order for price 36.1 > long market take bound
            const order = createOrder({ price: 36.1 });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ) //when contracts give correct address, this expect needs to change
                .to.be.eventually.rejectedWith(
                    "Trade price is > Market Take Bound for long side: 0x3c44cddd...fa4293bc"
                );
        });

        it("should successfully trade when trying to trade at price < short take bound when taker is going long", async () => {
            // set oracle price to 30
            await contracts.priceOracle.setPrice(toBigNumberStr(30));

            // set market take bound short to 20%
            await contracts.evaluator.setMTBLong(toBigNumberStr(0.2));

            // create an order for price 20 < short market take bound
            const order = createOrder({ price: 20 });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
        });

        it("should successfully execute the trade when all market take bound checks are met", async () => {
            // set oracle price to 10
            await contracts.priceOracle.setPrice(toBigNumberStr(10));

            // set market take bound short to 20%
            await contracts.evaluator.setMTBLong(toBigNumberStr(0.2));
            await contracts.evaluator.setMTBShort(toBigNumberStr(0.2));

            const order = createOrder({ price: 8 });
            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
        });
    });

    describe("Max OI Open Checks", () => {
        beforeEach(async () => {
            contracts = await deployAll({ maxOIOpen: [] });
            orderSigner = createOrderSigner(contracts.trader.address);

            // perform post deployment steps and set contract to have 0 market/limit fee
            await postDeployment(contracts, owner, {});

            // set oracle price to 10
            await contracts.priceOracle.setPrice(toBigNumberStr(10));
            // mints and deposits 2K token to margin bank for marker and taker
            await mintAndDeposit(
                alice,
                contracts.token,
                contracts.marginbank,
                2_000_000
            );
            await mintAndDeposit(
                bob,
                contracts.token,
                contracts.marginbank,
                2_000_000
            );

            await moveToStartOfTrading(contracts.perpetual);
        });

        it("should set Max OI Open Tiers", async () => {
            await contracts.evaluator.setMaxOIOpen([
                toBigNumberStr(500_000), //1x
                toBigNumberStr(500_000), //2x
                toBigNumberStr(500_000), //3x
                toBigNumberStr(500_000), //4x
                toBigNumberStr(250_000) //5x
            ]);

            expect(
                bnToString(
                    await (
                        await contracts.evaluator.maxAllowedOIOpen(
                            toBigNumberStr(1)
                        )
                    ).toHexString()
                )
            ).to.be.equal(toBigNumberStr(500_000));
        });

        it("should open a position at 5x leverage with 250K OI Open", async () => {
            const order = createOrder({
                price: 10,
                leverage: 5,
                quantity: 25_000
            });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
            const positionBalance = await Balance.getPositionBalance(
                await alice.getAddress(),
                contracts.perpetual as any
            );

            expect(positionBalance.oiOpen.toFixed(0)).to.be.eql(
                toBigNumberStr(250_000)
            );
        });

        it("should open a position at 5x leverage with 300K OI Open as there are no oi open thresholds set", async () => {
            const order = createOrder({
                price: 10,
                leverage: 5,
                quantity: 30_000
            });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );
            const positionBalance = await Balance.getPositionBalance(
                await alice.getAddress(),
                contracts.perpetual as any
            );

            expect(positionBalance.oiOpen.toFixed(0)).to.be.eql(
                toBigNumberStr(300_000)
            );
        });

        it("should revert when trying to open 300K OI open position at 5x", async () => {
            await contracts.evaluator.setMaxOIOpen([
                toBigNumberStr(1_000_000), //1x
                toBigNumberStr(1_000_000), //2x
                toBigNumberStr(500_000), //3x
                toBigNumberStr(500_000), //4x
                toBigNumberStr(250_000) //5x
            ]);

            const order = createOrder({
                price: 10,
                leverage: 5,
                quantity: 30_000
            });

            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "OI open for selected leverage > max allowed oi open"
            );
        });

        it("should revert when trying to adjust leverage as OI Open goes max allowed OI Open for newly selected leverage", async () => {
            await contracts.evaluator.setMaxOIOpen([
                toBigNumberStr(1_000_000), //1x
                toBigNumberStr(1_000_000), //2x
                toBigNumberStr(500_000), //3x
                toBigNumberStr(500_000), //4x
                toBigNumberStr(250_000), //5x
                toBigNumberStr(250_000), //6x
                toBigNumberStr(250_000), //7x
                toBigNumberStr(250_000), //8x
                toBigNumberStr(100_000), //9x
                toBigNumberStr(100_000) //10x
            ]);

            const order = createOrder({
                price: 10,
                leverage: 5,
                quantity: 25_000
            });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            await expect(
                contracts.perpetual
                    .connect(alice)
                    .adjustLeverage(await alice.getAddress(), toBigNumberStr(9))
            ).to.be.eventually.rejectedWith(
                "OI open for selected leverage > max allowed oi open"
            );
        });

        it("should not throw for any OI Verification", async () => {
            const maxAllowedOIOpen = [
                "5000000000000000000000000",
                "5000000000000000000000000",
                "2500000000000000000000000",
                "2500000000000000000000000",
                "1000000000000000000000000",
                "1000000000000000000000000",
                "250000000000000000000000",
                "250000000000000000000000",
                "200000000000000000000000",
                "200000000000000000000000",
                "175000000000000000000000",
                "175000000000000000000000",
                "150000000000000000000000",
                "150000000000000000000000",
                "125000000000000000000000",
                "125000000000000000000000",
                "100000000000000000000000",
                "100000000000000000000000",
                "75000000000000000000000",
                "75000000000000000000000"
            ];

            const evaluator = await deployEvaluator({
                maxOIOpen: maxAllowedOIOpen
            });

            for (let leverage = 1; leverage <= 20; leverage++) {
                await evaluator.verifyOIOpenForAccount(
                    await alice.getAddress(),
                    {
                        isPosPositive: false,
                        mro: toBigNumberStr(1 / leverage),
                        qPos: toBigNumberStr(0),
                        margin: toBigNumberStr(0),
                        oiOpen: maxAllowedOIOpen[leverage - 1]
                    }
                );

                await expect(
                    evaluator.verifyOIOpenForAccount(await alice.getAddress(), {
                        isPosPositive: false,
                        mro: toBigNumberStr(1 / leverage),
                        qPos: toBigNumberStr(0),
                        margin: toBigNumberStr(0),
                        oiOpen: bigNumber(maxAllowedOIOpen[leverage - 1])
                            .plus(1)
                            .toFixed()
                    })
                ).to.be.eventually.rejectedWith(
                    "OI open for selected leverage > max allowed oi open"
                );
            }
        });

        it("should revert when trying to increase position when OI open after increasing position is > max allowed oi open", async () => {
            await contracts.evaluator.setMaxOIOpen([
                toBigNumberStr(1_000_000), //1x
                toBigNumberStr(1_000_000), //2x
                toBigNumberStr(500_000), //3x
                toBigNumberStr(500_000), //4x
                toBigNumberStr(250_000), //5x
                toBigNumberStr(250_000) //6x
            ]);

            // below max allowed oi
            const order = createOrder({
                price: 10,
                leverage: 5,
                quantity: 23_000
            });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            const positionBalance = await Balance.getPositionBalance(
                await alice.getAddress(),
                contracts.perpetual as any
            );

            // should pass
            expect(positionBalance.oiOpen.toFixed(0)).to.be.eql(
                toBigNumberStr(230_000)
            );

            const order2 = createOrder({
                price: 10,
                leverage: 5,
                quantity: 3_000
            });

            // should revert as at 5x max oi open allowed is 250K, after the trade oi open becomes 260K
            await expect(
                tradeByOrder(
                    bob,
                    alice,
                    order2,
                    orderSigner,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "OI open for selected leverage > max allowed oi open"
            );
        });
    });
});
