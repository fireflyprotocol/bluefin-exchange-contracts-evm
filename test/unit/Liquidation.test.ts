import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import { ADDRESSES, BigNumber } from "../../submodules/library";
import { toBigNumberStr } from "../../submodules/library";
import {
    deployAll,
    postDeployment,
    createOrderSigner,
    deployLiquidation
} from "../helpers/initializePerpetual";
import { mintAndDeposit, moveToStartOfTrading } from "../helpers/utils";
import { AllContracts } from "../helpers/interfaces";
import { createOrder, tradeByOrder, liqTradeByOrder } from "../helpers/order";
import { OrderSigner } from "../../submodules/library";
import { INSURANCE_POOL_ADDRESS, TRADE_DATA } from "../helpers/default";
import { expectEvent } from "../helpers/expect";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Liquidation", () => {
    let contracts: AllContracts;
    let orderSigner: OrderSigner;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let cat: Signer;
    let liquidator: Signer;

    before(async () => {
        [owner, alice, bob, cat, liquidator] =
            await hardhat.ethers.getSigners();
    });

    beforeEach(async () => {
        // deploy all contracts
        contracts = await deployAll({});

        await postDeployment(contracts, owner, {});

        // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        await mintAndDeposit(alice, contracts.token, contracts.marginbank);
        await mintAndDeposit(bob, contracts.token, contracts.marginbank);
        await mintAndDeposit(cat, contracts.token, contracts.marginbank);
        await mintAndDeposit(liquidator, contracts.token, contracts.marginbank);

        await moveToStartOfTrading(contracts.perpetual);
    });

    describe("Initialize", () => {
        it("should revert as address of insurance pool can not be zero", async () => {
            await expect(
                deployLiquidation(
                    ADDRESSES.ZERO,
                    contracts.perpetual.address,
                    contracts.marginbank.address,
                    contracts.evaluator.address,
                    toBigNumberStr(0.7)
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: pool address can not be zero"
            );
        });

        it("should revert as liquidator's reward percentage can not > 100%", async () => {
            await expect(
                deployLiquidation(
                    INSURANCE_POOL_ADDRESS,
                    contracts.perpetual.address,
                    contracts.marginbank.address,
                    contracts.evaluator.address,
                    toBigNumberStr(1.01)
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: insurance pool percentage can not be > 100%"
            );
        });

        it("should successfully deploy liquidation contract", async () => {
            const txResult = deployLiquidation(
                INSURANCE_POOL_ADDRESS,
                contracts.perpetual.address,
                contracts.marginbank.address,
                contracts.evaluator.address,
                toBigNumberStr(0.7)
            );
            expectEvent(txResult, "InsurancePoolUpdate");
        });
    });

    describe("Setters", () => {
        it("should revert when whitelisting an account as liquidator address can not be zero", async () => {
            expect(
                contracts.liquidation.setWhitelistedLiquidator(
                    ADDRESSES.ZERO,
                    true
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: pool address can not be zero"
            );
        });

        it("should whitelist a liquidator", async () => {
            const txResult =
                await contracts.liquidation.setWhitelistedLiquidator(
                    await liquidator.getAddress(),
                    true
                );
            await expectEvent(txResult, "WhiteListedLiquidator");
            expect(
                await contracts.liquidation.whitelistedLiquidators(
                    await liquidator.getAddress()
                )
            ).to.be.equal(true);
        });

        it("should blacklist a liquidator", async () => {
            await contracts.liquidation.setWhitelistedLiquidator(
                await liquidator.getAddress(),
                true
            );
            expect(
                await contracts.liquidation.whitelistedLiquidators(
                    await liquidator.getAddress()
                )
            ).to.be.equal(true);

            await contracts.liquidation.setWhitelistedLiquidator(
                await liquidator.getAddress(),
                false
            );
            expect(
                await contracts.liquidation.whitelistedLiquidators(
                    await liquidator.getAddress()
                )
            ).to.be.equal(false);
        });

        it("should revert when setting insurance pool address to zero", async () => {
            expect(
                contracts.liquidation.setInsurancePoolAddress(ADDRESSES.ZERO)
            ).to.be.eventually.rejectedWith(
                "Liquidation: pool address can not be zero"
            );
        });

        it("should successfully set insurance pool address", async () => {
            const txResult =
                await contracts.liquidation.setInsurancePoolAddress(
                    INSURANCE_POOL_ADDRESS
                );
            await expectEvent(txResult, "InsurancePoolUpdate");
            expect(await contracts.liquidation.insurancePool()).to.be.equal(
                INSURANCE_POOL_ADDRESS
            );
        });

        it("should revert when trying to set liquidator's reward percentage > 100%", async () => {
            expect(
                contracts.liquidation.setInsurancePoolPercentage(
                    toBigNumberStr(1.1)
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: insurance pool percentage can not be > 100%"
            );
        });

        it("should successfully change insurance pool's reward percentage to 50%", async () => {
            const txResult =
                await contracts.liquidation.setInsurancePoolPercentage(
                    toBigNumberStr(0.5)
                );
            await expectEvent(txResult, "InsurancePoolPercentageUpdate");
            expect(
                new BigNumber(
                    (
                        await contracts.liquidation.insurancePoolPercentage()
                    ).toHexString()
                ).toFixed(0)
            ).to.be.equal(toBigNumberStr(0.5));
        });
    });

    describe("Trade", () => {
        it("should revert as caller to liquidation trade method is not perpetual", async () => {
            // this orders contract has zero address whitelisted as perpetual contract
            const liquidationTemp = await deployLiquidation(
                INSURANCE_POOL_ADDRESS
            );

            // whitelist this new orders contract in perpetual
            await contracts.perpetual
                .connect(owner)
                .setTradeContract(liquidationTemp.address, true);

            await expect(
                contracts.perpetual.connect(alice).trade(
                    [await bob.getAddress(), await alice.getAddress()],
                    [
                        {
                            makerIndex: 0,
                            takerIndex: 1,
                            trader: liquidationTemp.address,
                            data: TRADE_DATA
                        }
                    ],
                    0
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: msg sender must be Perpetual"
            );
        });

        it("should revert as caller to liquidation trade is not taker of trade", async () => {
            await expect(
                contracts.perpetual.trade(
                    [await bob.getAddress(), await alice.getAddress()],
                    [
                        {
                            makerIndex: 0,
                            takerIndex: 1,
                            trader: contracts.liquidation.address,
                            data: TRADE_DATA
                        }
                    ],
                    0
                )
            ).to.be.eventually.rejectedWith("P12");
        });

        it("should revert as account being liquidated is not under collat", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

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

            await expect(
                liqTradeByOrder(
                    liquidator,
                    alice,
                    order,
                    contracts.liquidation,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: Cannot liquidate since maker is not undercollateralized"
            );
        });

        it("should revert as all or nothing flag is set and asked quantity for trade is > total quantity of maker", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

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

            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(90));

            await expect(
                liqTradeByOrder(
                    liquidator,
                    alice,
                    order,
                    contracts.liquidation,
                    contracts.perpetual,
                    { quantity: toBigNumberStr(15), allOrNothing: true }
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: allOrNothing is true and liquidation quantity < specified quantity"
            );
        });

        it("should revert liquidation must decrease maker's position size", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

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

            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(90));

            await expect(
                liqTradeByOrder(
                    liquidator,
                    alice,
                    order,
                    contracts.liquidation,
                    contracts.perpetual,
                    { isBuy: false }
                )
            ).to.be.eventually.rejectedWith(
                `Liquidation: Cannot add to maker's position quantity`
            );
        });

        it("should revert as liquidators leverage is invalid", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

            const orderA = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            // trade between alice and bob
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
                leverage: 2, // liquidator is at 2x leverage
                isBuy: true
            });

            // trade between liquidator and cat
            await tradeByOrder(
                cat,
                liquidator,
                orderB,
                orderSigner,
                contracts.perpetual
            );

            // alice becomes liqudate-able
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(90));

            await expect(
                liqTradeByOrder(
                    liquidator,
                    alice,
                    orderA,
                    contracts.liquidation,
                    contracts.perpetual,
                    { leverage: toBigNumberStr(4) }
                )
            ).to.be.eventually.rejectedWith(
                `Liquidation: Liquidator leverage is invalid`
            );
        });

        it("should successfully liquidate an undercollat position", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));
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
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(92));

            const txResult = await liqTradeByOrder(
                liquidator,
                alice,
                order,
                contracts.liquidation,
                contracts.perpetual
            );
            await expectEvent(txResult, "TradeExecuted");
        });

        it("should successfully liquidate an undercollat position", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            await expect(
                liqTradeByOrder(
                    liquidator,
                    alice,
                    order,
                    contracts.liquidation,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: Maker has no position to liquidate"
            );
        });

        it("should successfully liquidate a position when a sub account performs liquidation", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

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
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(92));

            // liquidator whitelists bob as sub account
            await contracts.perpetual
                .connect(liquidator)
                .setSubAccount(await bob.getAddress(), true);

            const txResult = await liqTradeByOrder(
                liquidator,
                alice,
                order,
                contracts.liquidation,
                contracts.perpetual,
                { sender: bob }
            );
            await expectEvent(txResult, "TradeExecuted");
        });

        it("should liquidate the position and transfer entire premium to liquidator", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            await contracts.liquidation.setInsurancePoolPercentage(
                toBigNumberStr(0)
            );

            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(92));

            await liqTradeByOrder(
                liquidator,
                alice,
                order,
                contracts.liquidation,
                contracts.perpetual
            );

            // 100% means, 0$ premium went to INSURANCE_POOL_ADDRESS
            expect(
                +(await contracts.marginbank.getAccountBankBalance(
                    INSURANCE_POOL_ADDRESS
                ))
            ).to.be.equal(0);
        });

        it("should liquidate the position and transfer entire premium to insurance pool", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            await tradeByOrder(
                bob,
                alice,
                order,
                orderSigner,
                contracts.perpetual
            );

            await contracts.liquidation.setInsurancePoolPercentage(
                toBigNumberStr(1)
            );

            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(92));

            await liqTradeByOrder(
                liquidator,
                alice,
                order,
                contracts.liquidation,
                contracts.perpetual
            );

            // 100% means, 20$ premium went to INSURANCE_POOL_ADDRESS
            expect(
                +(await contracts.marginbank.getAccountBankBalance(
                    INSURANCE_POOL_ADDRESS
                ))
            ).to.be.equal(Number(toBigNumberStr(20)));
        });

        it("should revert when trying to liquidate a whitelisted liquidation operator", async () => {
            // set oracle price
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));
            const order = createOrder({
                price: 100,
                quantity: 10,
                leverage: 10,
                isBuy: true
            });

            await contracts.liquidation.setWhitelistedLiquidator(
                await liquidator.getAddress(),
                true
            );

            // open a position at 10x, price 100 at oracle price 100
            await tradeByOrder(
                bob,
                liquidator,
                order,
                orderSigner,
                contracts.perpetual
            );

            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(92));

            // alice tries to liquidate the liquidator
            await expect(
                liqTradeByOrder(
                    alice,
                    liquidator,
                    order,
                    contracts.liquidation,
                    contracts.perpetual
                )
            ).to.be.eventually.rejectedWith(
                "Liquidation: Whitelisted liquidator address can not be liquidated"
            );
        });
    });

    it("should return the trader flags as 2", async () => {
        const liq = await deployLiquidation(INSURANCE_POOL_ADDRESS);
        expect(await liq.getTraderFlag()).to.be.equal(
            "0x0000000000000000000000000000000000000000000000000000000000000002"
        );
    });
});
