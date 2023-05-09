import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    toBigNumberStr,
    SigningMethod,
    toBigNumber,
    Trader,
    hexToBaseNumber,
    Balance,
    OrderSigner
} from "../../submodules/library/";
import {
    deployAll,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import { mintAndDeposit, moveToStartOfTrading } from "../helpers/utils";
import { AllContracts, TradeParams } from "../helpers/interfaces";
import { createOrder, tradeByOrder } from "../helpers/order";
import { FEE_POOL_ADDRESS, GAS_POOL_ADDRESS } from "../helpers/default";
import _ from "lodash";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Fees", () => {
    let contracts: AllContracts;
    let owner: Signer;
    let maker: Signer;
    let taker: Signer;
    let orderSigner: OrderSigner;

    before(async () => {
        [owner, maker, taker] = await hardhat.ethers.getSigners();
    });

    beforeEach(async () => {
        contracts = await deployAll({
            takerFee: toBigNumberStr(0.05),
            makerFee: toBigNumberStr(0.05),
            feePool: FEE_POOL_ADDRESS,
            gasPool: GAS_POOL_ADDRESS
        });

        await postDeployment(contracts, owner, {});

        await moveToStartOfTrading(contracts.perpetual);

        // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // set oracle price to 100
        await contracts.priceOracle.setPrice(toBigNumberStr(100));

        // mints and deposits 1000 to margin bank for marker and taker
        await mintAndDeposit(
            maker,
            contracts.token,
            contracts.marginbank,
            1000
        );
        await mintAndDeposit(
            taker,
            contracts.token,
            contracts.marginbank,
            1000
        );
    });

    describe("Gas Fee", () => {
        it("should charge 10 cents of gas fee from both maker and taker", async () => {
            await contracts.priceOracle.setPrice(toBigNumberStr(26));

            const order = createOrder({ price: 26, quantity: 20 });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                order
            );

            // owner is settlement operator
            await contracts.perpetual.trade(
                params.accounts,
                [params.data],
                toBigNumberStr(0.1)
            );

            expect(
                hexToBaseNumber(
                    await contracts.marginbank.getAccountBankBalance(
                        GAS_POOL_ADDRESS
                    )
                )
            ).to.be.equal(0.2);
        });

        xit("should revert when a non-settlement account tries to charge gas fee", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(26));

            const order = createOrder({ price: 26, quantity: 20 });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                order
            );
            await expect(
                contracts.perpetual.trade(
                    params.accounts,
                    [params.data],
                    toBigNumberStr(0.08)
                )
            ).to.be.eventually.rejectedWith(
                "Perpetual: Only settlement operator can apply gas charges"
            );
        });

        it("should charge gas fee from maker/taker just once", async () => {
            await contracts.priceOracle.setPrice(toBigNumberStr(26));

            const order = createOrder({ price: 26, quantity: 20 });

            const takerAddress = await maker.getAddress();
            const makerAddress = await taker.getAddress();

            const accounts = _.chain([takerAddress, makerAddress])
                .map(_.toLower)
                .sort()
                .sortedUniq()
                .value() as any as string[];

            const _takerOrder = {
                ...order,
                maker: takerAddress,
                isBuy: !order.isBuy
            };

            order.maker = makerAddress;

            const typedSignatureA = await orderSigner.getSignedOrder(
                order,
                SigningMethod.HardhatTypedData
            );

            const typedSignatureB = await orderSigner.getSignedOrder(
                _takerOrder,
                SigningMethod.HardhatTypedData
            );

            const tradeData = Trader.fillToTradeData(
                orderSigner,
                typedSignatureA,
                typedSignatureB,
                toBigNumber(10),
                order.price
            );

            const params = {
                accounts,
                data: {
                    makerIndex: accounts.indexOf(makerAddress.toLowerCase()),
                    takerIndex: accounts.indexOf(takerAddress.toLowerCase()),
                    trader: orderSigner.address,
                    data: tradeData
                }
            } as TradeParams;

            // owner is settlement operator
            await contracts.perpetual
                .connect(owner)
                .trade(params.accounts, [params.data], toBigNumberStr(0.1));

            expect(
                +(await contracts.marginbank.getAccountBankBalance(
                    GAS_POOL_ADDRESS
                ))
            ).to.be.equal(Number(toBigNumberStr(0.2)));

            // should not charge any fee
            await contracts.perpetual
                .connect(owner)
                .trade(params.accounts, [params.data], toBigNumberStr(0.1));

            expect(
                +(await contracts.marginbank.getAccountBankBalance(
                    GAS_POOL_ADDRESS
                ))
            ).to.be.equal(Number(toBigNumberStr(0.2)));
        });

        it("should successfully execute reducing trade for alice even though she has 0$ in margin to pay for gas fee", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(100));

            const order = createOrder({
                price: 100,
                quantity: 1,
                isBuy: true
            });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                order
            );

            await contracts.perpetual.trade(
                params.accounts,
                [params.data],
                toBigNumberStr(895)
            );

            // gas pool should have 1790$
            expect(
                hexToBaseNumber(
                    await contracts.marginbank.getAccountBankBalance(
                        GAS_POOL_ADDRESS
                    )
                )
            ).to.be.equal(1790);

            // maker and taker both have zero dollar left in margin
            const makerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await maker.getAddress()
                )
            );

            const takerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await taker.getAddress()
                )
            );

            expect(makerBalance).to.be.equal(0);
            expect(takerBalance).to.be.equal(0);

            const order2 = createOrder({
                price: 100,
                quantity: 1,
                isBuy: false,
                reduceOnly: true
            });

            const params2: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                order2
            );

            // charging 5$ in trades, the trade should go through even though
            // both maker and taker have 0$ in margin
            await contracts.perpetual.trade(
                params2.accounts,
                [params2.data],
                toBigNumberStr(5)
            );

            const makerPosition = await Balance.getPositionBalance(
                await maker.getAddress(),
                contracts.perpetual
            );

            // position is closed
            expect(+makerPosition.qPos).to.be.eq(0);

            // gas pool should have 1800$
            expect(
                hexToBaseNumber(
                    await contracts.marginbank.getAccountBankBalance(
                        GAS_POOL_ADDRESS
                    )
                )
            ).to.be.equal(1800);
        });
    });

    describe("Gasless Maker Orders", () => {
        it("should set gas less maker orders' notional value to 100", async () => {
            await contracts.trader.setGaslessOrderValue(toBigNumberStr(100));
            expect(
                hexToBaseNumber(await contracts.trader.gaslessOrders())
            ).to.be.equal(100);
        });

        it("should revert as gas less maker orders' notional value can not be < 100", async () => {
            await expect(
                contracts.trader.setGaslessOrderValue(toBigNumberStr(10))
            ).to.be.eventually.rejectedWith(
                "IsolatedTrader: Gasless orders must have notional value >= 100$"
            );
        });

        it("should charge both maker and taker 5$ as gas fee", async () => {
            const makerOrder = createOrder({
                makerAddress: await maker.getAddress(),
                isBuy: true,
                quantity: 2,
                leverage: 1,
                price: 100
            });

            const takerOrder = createOrder({
                makerAddress: await taker.getAddress(),
                isBuy: false,
                quantity: 0.5,
                leverage: 1,
                price: 100
            });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                makerOrder,
                takerOrder
            );

            await contracts.perpetual.trade(
                params.accounts,
                [params.data],
                toBigNumberStr(5)
            );

            const makerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await maker.getAddress()
                )
            );

            const takerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await taker.getAddress()
                )
            );

            expect(makerBalance).to.be.equal(942.5);
            expect(takerBalance).to.be.equal(942.5);
        });

        it("should charge gas fee from taker only as maker's orders notional value >= gas less orders", async () => {
            // any order with notional value > 100$ pays zero trade fee
            await contracts.trader.setGaslessOrderValue(toBigNumberStr(100));

            const makerOrder = createOrder({
                makerAddress: await maker.getAddress(),
                isBuy: true,
                quantity: 2,
                leverage: 1,
                price: 100
            });

            const takerOrder = createOrder({
                makerAddress: await taker.getAddress(),
                isBuy: false,
                quantity: 0.5,
                leverage: 1,
                price: 100
            });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                makerOrder,
                takerOrder
            );

            await contracts.perpetual.trade(
                params.accounts,
                [params.data],
                toBigNumberStr(1)
            );

            const makerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await maker.getAddress()
                )
            );

            const takerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await taker.getAddress()
                )
            );

            expect(makerBalance).to.be.equal(947.5);
            expect(takerBalance).to.be.equal(946.5);
        });

        it("should charge both maker and taker 5$ as gas fee", async () => {
            // any order with notional value > 500$ pays zero trade fee
            await contracts.trader.setGaslessOrderValue(toBigNumberStr(500));

            const makerOrder = createOrder({
                makerAddress: await maker.getAddress(),
                isBuy: true,
                quantity: 2,
                leverage: 1,
                price: 100
            });

            const takerOrder = createOrder({
                makerAddress: await taker.getAddress(),
                isBuy: false,
                quantity: 0.5,
                leverage: 1,
                price: 100
            });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                taker,
                maker,
                makerOrder,
                takerOrder
            );

            await contracts.perpetual.trade(
                params.accounts,
                [params.data],
                toBigNumberStr(2)
            );

            const makerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await maker.getAddress()
                )
            );

            const takerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await taker.getAddress()
                )
            );

            expect(makerBalance).to.be.equal(945.5);
            expect(takerBalance).to.be.equal(945.5);
        });
    });

    describe("Whitelisted Traders", () => {
        it("should set taker as whitelisted trader", async () => {
            await contracts.trader.setWhitelistedTrader(
                await taker.getAddress(),
                true,
                toBigNumberStr(0),
                toBigNumberStr(0.01)
            );

            const traderWLInfo = await contracts.trader.whitelistedTraders(
                await taker.getAddress()
            );

            expect(hexToBaseNumber(traderWLInfo.makerFee)).to.be.equal(0);

            expect(hexToBaseNumber(traderWLInfo.takerFee)).to.be.equal(0.01);
        });

        it("should revert when non admin tries to set whitelisted trader", async () => {
            await expect(
                contracts.trader
                    .connect(taker)
                    .setWhitelistedTrader(
                        await taker.getAddress(),
                        true,
                        toBigNumberStr(0),
                        toBigNumberStr(0.01)
                    )
            ).to.be.eventually.rejectedWith(
                "FFLYFiOwnableUpgrade: caller is not the owner"
            );
        });

        it("should charge 0.01% taker fee from bob", async () => {
            await contracts.trader.setWhitelistedTrader(
                await taker.getAddress(), // bob is taker
                true,
                toBigNumberStr(0),
                toBigNumberStr(0.01)
            );

            const order = createOrder({
                makerAddress: await maker.getAddress(),
                isBuy: true,
                quantity: 1,
                leverage: 1,
                price: 100
            });

            await tradeByOrder(
                taker,
                maker,
                order,
                orderSigner,
                contracts.perpetual
            );

            const takerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await taker.getAddress()
                )
            );

            // should be charged 100$ for trade + 0 for gas + 1% of 100$ as trade fee
            expect(takerBalance).to.be.equal(899);
        });

        it("should charge 0% maker fee from alice", async () => {
            await contracts.trader.setWhitelistedTrader(
                await maker.getAddress(), // alice is maker
                true,
                toBigNumberStr(0),
                toBigNumberStr(0)
            );

            await contracts.trader.setWhitelistedTrader(
                await taker.getAddress(), // bob is taker
                true,
                toBigNumberStr(0),
                toBigNumberStr(0.03)
            );

            const order = createOrder({
                makerAddress: await maker.getAddress(),
                isBuy: true,
                quantity: 1,
                leverage: 1,
                price: 100
            });

            await tradeByOrder(
                taker,
                maker,
                order,
                orderSigner,
                contracts.perpetual
            );

            const makerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await maker.getAddress()
                )
            );

            const takerBalance = hexToBaseNumber(
                await contracts.marginbank.getAccountBankBalance(
                    await taker.getAddress()
                )
            );

            // should be charged 100$ for trade + 0 for gas + 0% of 100$ as trade fee
            expect(makerBalance).to.be.equal(900);

            // should be charged 100$ for trade + 0 for gas + 3% of 100$ as trade fee
            expect(takerBalance).to.be.equal(897);
        });
    });
});
