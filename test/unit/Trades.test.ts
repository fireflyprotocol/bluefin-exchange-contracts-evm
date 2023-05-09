import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import hardhat from "hardhat";
import { Signer } from "ethers";
import {
    ADDRESSES,
    Balance,
    Order,
    toBigNumber
} from "../../submodules/library";
import {
    toBigNumberStr,
    BigNumber,
    SigningMethod,
    Trader,
    OrderSigner
} from "../../submodules/library";

import {
    deployAll,
    deployIsolatedTrader,
    createOrderSigner,
    postDeployment
} from "../helpers/initializePerpetual";
import {
    getBlockTimestamp,
    increaseBlockTime,
    mintAndDeposit,
    moveToStartOfFirstWindow,
    moveToStartOfTrading
} from "../helpers/utils";
import { AllContracts, TradeParams } from "../helpers/interfaces";
import { GuardianStatus } from "../../types";

import { createOrder, defaultOrder, tradeByOrder } from "../helpers/order";

import { expectEvent, parseEvent } from "../helpers/expect";
import { GAS_POOL_ADDRESS } from "../helpers/default";
import _ from "lodash";
import { FundingOracle } from "../../artifacts/typechain";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Trades", () => {
    let contracts: AllContracts;
    let orderSigner: OrderSigner;
    let owner: Signer;
    let alice: Signer;
    let bob: Signer;
    let cat: Signer;
    let dog: Signer;
    let order: Order;

    before(async () => {
        [owner, alice, bob, cat, dog] = await hardhat.ethers.getSigners();
    });

    beforeEach(async () => {
        // deploy all contracts
        contracts = await deployAll({
            makerFee: toBigNumberStr(0.005),
            takerFee: toBigNumberStr(0.01),
            gasPool: GAS_POOL_ADDRESS
        });

        await postDeployment(contracts, owner, {});

        // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // set oracle price to 10
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(10));

        // mints and deposits 10K token to margin bank for marker and taker
        await mintAndDeposit(alice, contracts.token, contracts.marginbank);
        await mintAndDeposit(bob, contracts.token, contracts.marginbank);

        order = createOrder({
            makerAddress: await alice.getAddress()
        });

        await moveToStartOfTrading(contracts.perpetual);
    });

    it("should revert when guardian disabled trading", async () => {
        await contracts.guardian.setTradingStatus(
            contracts.perpetual.address,
            GuardianStatus.Disallowed
        );

        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));
        const order = createOrder({ price: 26, quantity: 20 });
        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            order
        );

        await expect(
            contracts.perpetual.trade(params.accounts, [params.data], 0)
        ).to.be.eventually.rejectedWith("P7");
    });

    it("Should revert as trading is not yet started", async () => {
        contracts = await deployAll({});
        await expect(
            tradeByOrder(
                bob,
                alice,
                defaultOrder,
                orderSigner,
                contracts.perpetual
            )
        ).to.be.eventually.rejectedWith("P8");
    });

    it("should revert as trade must contain at least 1 account", async () => {
        await expect(
            contracts.perpetual.trade(
                [],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 0,
                        trader: ADDRESSES.ZERO,
                        data: "0x0000000000000000000000000000000000000000000000000000000000001a910000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000000000000000001a900000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c33944000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d469a5f23d784889dfb152844fe9117ab72f5b036bf31a7bac8b11e05b5176d00750cfad4ccdb3bc456f3064a9e7747c5a45bd0f6873939d4202d0c4bceb073b1b0100000000000000000000000000000000000000000000000000000000000019e9e673c4c4a2b8219b7f63ba15bafc4eecd5fc6b95b95802a6c0f7f1163a7c145fe1bd6c65c394201bb61a0b42c1670f2ff21aaf25061960ab54d8cd5559031c01000000000000000000000000000000000000000000000000000000000000"
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith("P31");
    });

    it("should revert as trade must contain unique accounts", async () => {
        await expect(
            contracts.perpetual.trade(
                [await alice.getAddress(), await alice.getAddress()],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 0,
                        trader: ADDRESSES.ZERO,
                        data: "0x0000000000000000000000000000000000000000000000000000000000001a910000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000000000000000001a900000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c33944000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d469a5f23d784889dfb152844fe9117ab72f5b036bf31a7bac8b11e05b5176d00750cfad4ccdb3bc456f3064a9e7747c5a45bd0f6873939d4202d0c4bceb073b1b0100000000000000000000000000000000000000000000000000000000000019e9e673c4c4a2b8219b7f63ba15bafc4eecd5fc6b95b95802a6c0f7f1163a7c145fe1bd6c65c394201bb61a0b42c1670f2ff21aaf25061960ab54d8cd5559031c01000000000000000000000000000000000000000000000000000000000000"
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith("P32");
    });

    it("should revert as trader is not whitelisted", async () => {
        await expect(
            contracts.perpetual.trade(
                [await bob.getAddress(), await alice.getAddress()],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 0,
                        trader: contracts.funder.address, // making funder the trader
                        data: "0x0000000000000000000000000000000000000000000000000000000000001a910000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000000000000000001a900000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c33944000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d469a5f23d784889dfb152844fe9117ab72f5b036bf31a7bac8b11e05b5176d00750cfad4ccdb3bc456f3064a9e7747c5a45bd0f6873939d4202d0c4bceb073b1b0100000000000000000000000000000000000000000000000000000000000019e9e673c4c4a2b8219b7f63ba15bafc4eecd5fc6b95b95802a6c0f7f1163a7c145fe1bd6c65c394201bb61a0b42c1670f2ff21aaf25061960ab54d8cd5559031c01000000000000000000000000000000000000000000000000000000000000"
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith("P9");
    });

    it("should revert as trade method on Isolated Trader contract can only be invoked by a whitelisted PERPETUAL contract", async () => {
        // this orders contract has zero address whitelisted as perpetual contract
        const ordersTemp = await deployIsolatedTrader({});

        // whitelist this new orders contract in perpetual
        await contracts.perpetual
            .connect(owner)
            .setTradeContract(ordersTemp.address, true);

        await expect(
            contracts.perpetual.trade(
                [await bob.getAddress(), await alice.getAddress()],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 0,
                        trader: ordersTemp.address,
                        data: "0x0000000000000000000000000000000000000000000000000000000000001a910000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000000000000000001a900000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c33944000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d469a5f23d784889dfb152844fe9117ab72f5b036bf31a7bac8b11e05b5176d00750cfad4ccdb3bc456f3064a9e7747c5a45bd0f6873939d4202d0c4bceb073b1b0100000000000000000000000000000000000000000000000000000000000019e9e673c4c4a2b8219b7f63ba15bafc4eecd5fc6b95b95802a6c0f7f1163a7c145fe1bd6c65c394201bb61a0b42c1670f2ff21aaf25061960ab54d8cd5559031c01000000000000000000000000000000000000000000000000000000000000"
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith(
            "IsolatedTrader: Msg sender must be Perpetual"
        );
    });

    xit("should revert as sender(alice) does not have permission for taker", async () => {
        await expect(
            contracts.perpetual.connect(alice).trade(
                [await bob.getAddress(), await alice.getAddress()],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 0,
                        trader: contracts.trader.address,
                        data: "0x0000000000000000000000000000000000000000000000000000000000001a910000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000000000000000001a900000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c339440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000bbf81e000000000000000000000000000000000000000000000000012fcb63ab08a4c0000000000000000000000000000000000000000000000000016cb550c33944000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d469a5f23d784889dfb152844fe9117ab72f5b036bf31a7bac8b11e05b5176d00750cfad4ccdb3bc456f3064a9e7747c5a45bd0f6873939d4202d0c4bceb073b1b0100000000000000000000000000000000000000000000000000000000000019e9e673c4c4a2b8219b7f63ba15bafc4eecd5fc6b95b95802a6c0f7f1163a7c145fe1bd6c65c394201bb61a0b42c1670f2ff21aaf25061960ab54d8cd5559031c01000000000000000000000000000000000000000000000000000000000000"
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith(
            "Perpetual: Sender does not have permissions for the taker"
        );
    });

    it("should revert alice's order is cancelled", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));
        const makerOrder = createOrder({ price: 26, quantity: 20 });
        const tradeReq: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            makerOrder
        );
        const txResult = await contracts.perpetual
            .connect(owner)
            .trade(tradeReq.accounts, [tradeReq.data], 0);
        await txResult.wait();

        const solidityOrder = OrderSigner.orderToSolidity(makerOrder);

        await contracts.trader.connect(alice).cancelOrder(solidityOrder);

        await expect(
            contracts.perpetual.connect(owner).trade(
                [await bob.getAddress(), await alice.getAddress()],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 1,
                        trader: contracts.trader.address,
                        data: tradeReq.data.data
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith(
            "IsolatedTrader: Order was already canceled: 0x70997970...17dc79c8"
        );
    });

    it("should revert as order has invalid signature", async () => {
        await expect(
            contracts.perpetual.connect(owner).trade(
                [await alice.getAddress(), await cat.getAddress()],
                [
                    {
                        makerIndex: 0,
                        takerIndex: 1,
                        trader: contracts.trader.address,
                        data: "0x0000183ca13f98800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc00000000000000000000000000000000000000000000000000000000d9e4b2530000183ba13f98810000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000015d34aaf54267db7d7c367839aaf71a00a2c6a6500000000000000000000000000000000000000000000000000000000d9e4b2530000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a7640000faff970d309473e942f5b9283942797202b54ed45a7936fd9ea68351e8ad55d711c626ea643b99ec80e4b450dfd717a060aec2a3c0a1ebd44f47bdaef812b8611b000000000000000000000000000000000000000000000000000000000000008db21c0322c017190ea4b6614fef005642f2468f7159f9e7e74c546566e36ce37aeeba14bb07bbc078e0bb1a264482e830d93d1050ab2c030dff6c701442ef781b00000000000000000000000000000000000000000000000000000000000000"
                    }
                ],
                0
            )
        ).to.be.eventually.rejectedWith(
            "Order has an invalid signature: 0x3c44cddd...fa4293bc"
        );
    });

    it("should revert as order is expired", async () => {
        order.expiration = new BigNumber(await getBlockTimestamp());
        await expect(
            tradeByOrder(bob, alice, order, orderSigner, contracts.perpetual)
        ).to.be.eventually.rejectedWith(
            "IsolatedTrader: Order has expired: 0x70997970...17dc79c8"
        );
    });

    it("should revert as Order maker does not match trade maker", async () => {
        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            order
        );

        await expect(
            contracts.perpetual.trade(
                [await dog.getAddress(), await cat.getAddress()],
                [params.data],
                0
            )
        ).to.be.rejectedWith(
            "IsolatedTrader: Order maker does not match trade maker"
        );
    });

    it("should revert as fill price is invalid", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));
        const makerOrder = createOrder({
            makerAddress: await alice.getAddress(),
            price: 26,
            quantity: 20
        });
        const takerOrder = createOrder({
            makerAddress: await bob.getAddress(),
            isBuy: true,
            price: 25,
            quantity: 20
        });

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            makerOrder,
            takerOrder
        );
        await expect(
            contracts.perpetual.trade(params.accounts, [params.data], 0)
        ).to.be.rejectedWith("Fill price is invalid: 0x3c44cddd...fa4293bc");
    });

    it("should revert as fill does not decrease size", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));

        const order = createOrder({ price: 26, quantity: 20 });

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            order
        );

        const txResult = await contracts.perpetual.trade(
            params.accounts,
            [params.data],
            0
        );

        await txResult.wait();

        const makerOrder = createOrder({
            makerAddress: await alice.getAddress(),
            price: 26,
            quantity: 20
        });
        const takerOrder = createOrder({
            makerAddress: await bob.getAddress(),
            isBuy: true,
            price: 26,
            quantity: 20,
            reduceOnly: true
        });

        const params1: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            makerOrder,
            takerOrder
        );
        await expect(
            contracts.perpetual.trade(params1.accounts, [params1.data], 0)
        ).to.be.rejectedWith(
            "IsolatedTrader: Fill does not decrease size: 0x3c44cddd...fa4293bc"
        );
    });

    it("should revert order A is being overfilled", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));

        const makerOrder = createOrder({
            makerAddress: await alice.getAddress(),
            isBuy: false,
            price: 26,
            quantity: 20
        });

        const takerOrder = createOrder({
            makerAddress: await bob.getAddress(),
            isBuy: true,
            price: 26,
            quantity: 15
        });

        const takerAddress = await alice.getAddress();
        const makerAddress = await bob.getAddress();

        const accounts = _.chain([takerAddress, makerAddress])
            .map(_.toLower)
            .sort()
            .sortedUniq()
            .value() as any as string[];

        const typedSignatureA = await orderSigner.getSignedOrder(
            makerOrder,
            SigningMethod.HardhatTypedData
        );

        const typedSignatureB = await orderSigner.getSignedOrder(
            takerOrder,
            SigningMethod.HardhatTypedData
        );

        const tradeData = Trader.fillToTradeData(
            orderSigner,
            typedSignatureA,
            typedSignatureB,
            toBigNumber(20),
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

        await expect(
            contracts.perpetual
                .connect(owner)
                .trade(params.accounts, [params.data], 0)
        ).to.be.rejectedWith(
            "IsolatedTrader: Cannot overfill maker order: 0x3c44cddd...fa4293bc"
        );
    });

    it("should revert as leverage will be rounded down to 0", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));

        const order = createOrder({ price: 26, quantity: 20, leverage: 0.8 });

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            order
        );

        await expect(
            contracts.perpetual.trade(params.accounts, [params.data], 0)
        ).to.be.rejectedWith("Leverage must be > 0");
    });

    it("should successfully open a position", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));

        const order = createOrder({ price: 26, quantity: 20 });

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            order
        );
        const txResult = await contracts.perpetual.trade(
            params.accounts,
            [params.data],
            0
        );

        await txResult.wait();
    });

    it("should revert as alice has more funding due then margin in her position", async () => {
        contracts = await deployAll({
            makerFee: toBigNumberStr(0.005),
            takerFee: toBigNumberStr(0.01),
            gasPool: GAS_POOL_ADDRESS,
            useRealFunder: true,
            maxAllowedFR: toBigNumberStr(1000)
        });

        await postDeployment(contracts, owner, {
            updateFRProvider: true
        });

        // move funding rate off-chain
        await contracts.guardian.setFundingRateStatus(
            contracts.funder.address,
            GuardianStatus.Disallowed
        );

        // create order signer
        orderSigner = createOrderSigner(contracts.trader.address);

        // mints and deposits 10K token to margin bank for marker and taker
        await mintAndDeposit(alice, contracts.token, contracts.marginbank);
        await mintAndDeposit(bob, contracts.token, contracts.marginbank);

        await moveToStartOfTrading(contracts.perpetual);

        await moveToStartOfFirstWindow(contracts.funder as FundingOracle);
        await increaseBlockTime(3600, 1);
        expect(+(await contracts.funder.expectedFundingWindow())).to.be.equal(
            2
        );

        // set FR as 100%
        await contracts.perpetual.setOffChainFundingRate(toBigNumberStr(1));

        await contracts.priceOracle
            .connect(owner)
            .setPrice(toBigNumberStr(100));

        const order = createOrder({ price: 100, quantity: 10, leverage: 10 });

        await tradeByOrder(bob, alice, order, orderSigner, contracts.perpetual);

        await increaseBlockTime(3600, 1);

        expect(+(await contracts.funder.expectedFundingWindow())).to.be.equal(
            3
        );
        // set FR as 100%
        await contracts.perpetual.setOffChainFundingRate(toBigNumberStr(1));

        const newOrder = { ...order, quantity: toBigNumber(5) };

        await expect(
            tradeByOrder(bob, alice, newOrder, orderSigner, contracts.perpetual)
        ).to.be.eventually.rejectedWith("P33: 0x3c44cddd...fa4293bc");
    });

    it("should revert when non-settlement operator tries to trade", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));

        const order = createOrder({ price: 26, quantity: 20 });

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            order
        );

        // owner is settlement operator
        await expect(
            contracts.perpetual
                .connect(bob)
                .trade(params.accounts, [params.data], toBigNumberStr(0.1))
        ).to.be.eventually.rejectedWith("P10");
    });

    it("should successfully execute the trade when a sub account signs order for a parent account", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));
        // whitelist bob as sub account of alice
        await contracts.perpetual
            .connect(alice)
            .setSubAccount(await bob.getAddress(), true);

        const accounts = _.chain([
            await bob.getAddress(),
            await alice.getAddress()
        ])
            .map(_.toLower)
            .sort()
            .sortedUniq()
            .value() as any as string[];

        const makerOrder = createOrder({
            price: 26,
            quantity: 20,
            makerAddress: await alice.getAddress()
        });
        const takerOrder = {
            ...makerOrder,
            maker: await bob.getAddress(),
            isBuy: !order.isBuy
        };

        const tsMaker = await orderSigner.getSignedOrder(
            makerOrder,
            SigningMethod.HardhatTypedData,
            await bob.getAddress()
        );

        const tsTaker = await orderSigner.getSignedOrder(
            takerOrder,
            SigningMethod.HardhatTypedData
        );

        const tradeData = Trader.fillToTradeData(
            orderSigner,
            tsMaker,
            tsTaker,
            makerOrder.quantity,
            makerOrder.price
        );

        const params = {
            accounts,
            data: {
                makerIndex: accounts.indexOf(makerOrder.maker.toLowerCase()),
                takerIndex: accounts.indexOf(takerOrder.maker.toLowerCase()),
                trader: orderSigner.address,
                data: tradeData
            }
        } as TradeParams;

        const txResult = await contracts.perpetual.trade(
            params.accounts,
            [params.data],
            0
        );

        await txResult.wait();
    });

    it("should successfully open a position when bob is placing a market order with price zero", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));
        const makerOrder = createOrder({ price: 26, quantity: 20 });
        const takerOrder = createOrder({
            quantity: 20,
            makerAddress: await bob.getAddress()
        });

        takerOrder.price = new BigNumber(0);

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            bob,
            alice,
            makerOrder,
            takerOrder
        );
        const txResult = await contracts.perpetual.trade(
            params.accounts,
            [params.data],
            0
        );

        await txResult.wait();
    });

    it("should do nothing, and not open position when both maker/taker are same account", async () => {
        await contracts.priceOracle.connect(owner).setPrice(toBigNumberStr(26));

        const order = createOrder({ price: 26, quantity: 20 });

        const params: TradeParams = await Trader.setupNormalTrade(
            orderSigner,
            SigningMethod.HardhatTypedData,
            alice,
            alice,
            order
        );

        const txResult = await contracts.perpetual.trade(
            params.accounts,
            [params.data],
            0
        );

        const event = await parseEvent(txResult, "TradeExecuted");
        expect(event).to.be.equal(undefined);
    });

    describe("Add/Remove Margin", () => {
        it("should allow bob(sub account) to add/remove margin for alice account", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(26));

            const order = createOrder({ price: 26, quantity: 20 });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                bob,
                alice,
                order
            );
            await contracts.perpetual.trade(params.accounts, [params.data], 0);

            await contracts.marginbank
                .connect(owner)
                .setBankOperator(contracts.perpetual.address, true); // allow perp contract to transfer margin

            await contracts.perpetual
                .connect(alice)
                .setSubAccount(await bob.getAddress(), true);

            const txResult = await contracts.perpetual
                .connect(bob)
                .addMargin(await alice.getAddress(), 200);
            expectEvent(txResult, "AccountPositionUpdate");

            const txResult2 = await contracts.perpetual
                .connect(bob)
                .removeMargin(await alice.getAddress(), 200);
            expectEvent(txResult2, "AccountPositionUpdate");
        });

        it("should not allow bob(invalid operator) to add/remove margin for alice account", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(26));

            const order = createOrder({ price: 26, quantity: 20 });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                bob,
                alice,
                order
            );
            await contracts.perpetual.trade(params.accounts, [params.data], 0);

            await contracts.marginbank
                .connect(owner)
                .setBankOperator(contracts.perpetual.address, true); // allow perp contract to transfer margin

            await expect(
                contracts.perpetual
                    .connect(bob)
                    .addMargin(await alice.getAddress(), 200)
            ).to.be.eventually.rejectedWith("P5");

            await expect(
                contracts.perpetual
                    .connect(bob)
                    .removeMargin(await alice.getAddress(), 200)
            ).to.be.eventually.rejectedWith("P5");
        });

        it("should allow alice(herself) to add/remove margin for alice account", async () => {
            await contracts.priceOracle
                .connect(owner)
                .setPrice(toBigNumberStr(26));

            const order = createOrder({ price: 26, quantity: 20 });

            const params: TradeParams = await Trader.setupNormalTrade(
                orderSigner,
                SigningMethod.HardhatTypedData,
                bob,
                alice,
                order
            );
            await contracts.perpetual.trade(params.accounts, [params.data], 0);

            await contracts.marginbank
                .connect(owner)
                .setBankOperator(contracts.perpetual.address, true); // allow perp contract to transfer margin

            const txResult = await contracts.perpetual
                .connect(alice)
                .addMargin(await alice.getAddress(), 200);
            expectEvent(txResult, "AccountPositionUpdate");

            const txResult2 = await contracts.perpetual
                .connect(alice)
                .removeMargin(await alice.getAddress(), 200);
            expectEvent(txResult2, "AccountPositionUpdate");
        });

        it("should mine multiple transactions in one block", (done) => {
            (async () => {
                await contracts.priceOracle
                    .connect(owner)
                    .setPrice(toBigNumberStr(26));

                const order = createOrder({ price: 26, quantity: 20 });

                const params: TradeParams = await Trader.setupNormalTrade(
                    orderSigner,
                    SigningMethod.HardhatTypedData,
                    bob,
                    alice,
                    order
                );
                await contracts.perpetual.trade(
                    params.accounts,
                    [params.data],
                    0
                );

                await contracts.marginbank
                    .connect(owner)
                    .setBankOperator(contracts.perpetual.address, true); // allow perp contract to transfer margin

                // disable auto mine to mine multiple transactions in one block
                await hardhat.network.provider.send("evm_setAutomine", [false]);
                await hardhat.network.provider.send("evm_setIntervalMining", [
                    1000
                ]);

                contracts.perpetual
                    .connect(alice)
                    .addMargin(await alice.getAddress(), 200);

                contracts.perpetual
                    .connect(alice)
                    .addMargin(await alice.getAddress(), 200);
            })();

            let eventCount = 0;
            contracts.perpetual.on(
                "AccountPositionUpdate",
                async (...args: []) => {
                    // once received 4 events, finish the test
                    if (++eventCount == 4) {
                        await hardhat.network.provider.send("evm_setAutomine", [
                            true
                        ]);
                        done();
                    }
                }
            );
        });

        it("should revert when trying to add margin with zero positions open", async () => {
            await contracts.marginbank
                .connect(owner)
                .setBankOperator(contracts.perpetual.address, true); // allow perp contract to transfer margin

            await expect(
                contracts.perpetual
                    .connect(alice)
                    .addMargin(await alice.getAddress(), 200)
            ).to.be.rejectedWith("P14");
        });
    });
});
