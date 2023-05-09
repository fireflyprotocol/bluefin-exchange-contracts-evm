import { Signer } from "ethers";
import {
    IsolatedADL,
    IsolatedLiquidation,
    Perpetual
} from "../../artifacts/typechain";
import {
    toBigNumber,
    toBigNumberStr,
    BigNumber,
    Order,
    ADDRESSES,
    SigningMethod,
    BigNumberable,
    OrderSigner,
    Trader
} from "../../submodules/library";

export const defaultOrder: Order = {
    price: toBigNumber(1),
    quantity: toBigNumber(1),
    leverage: toBigNumber(1),
    isBuy: true,
    reduceOnly: false,
    triggerPrice: new BigNumber(0),
    maker: ADDRESSES.ZERO,
    expiration: new BigNumber(3655643731),
    salt: new BigNumber("425")
};

export function createOrder(params: {
    triggerPrice?: number;
    isBuy?: boolean;
    price?: number;
    quantity?: number;
    leverage?: number;
    reduceOnly?: boolean;
    makerAddress?: string;
    expiration?: number;
    salt?: number;
}): Order {
    return {
        triggerPrice: params.triggerPrice
            ? toBigNumber(params.triggerPrice)
            : new BigNumber(0),
        price: params.price ? toBigNumber(params.price) : defaultOrder.price,
        isBuy: params.isBuy == true,
        reduceOnly: params.reduceOnly == true,
        quantity: params.quantity
            ? toBigNumber(params.quantity)
            : defaultOrder.quantity,
        leverage: params.leverage
            ? toBigNumber(params.leverage)
            : defaultOrder.leverage,
        expiration: params.expiration
            ? new BigNumber(params.expiration)
            : defaultOrder.expiration,
        salt: params.salt
            ? new BigNumber(params.salt)
            : new BigNumber(Date.now()),
        maker: params.makerAddress ? params.makerAddress : defaultOrder.maker
    } as Order;
}

export async function tradeByOrder(
    taker: Signer | string,
    maker: Signer | string,
    order: Order,
    orderSigner: OrderSigner,
    perpContract: Perpetual,
    takerOrder?: Order
) {
    const params = await Trader.setupNormalTrade(
        orderSigner,
        SigningMethod.HardhatTypedData,
        taker,
        maker,
        order,
        takerOrder
    );
    return perpContract.trade(params.accounts, [params.data], 0);
}

export async function liqTradeByOrder(
    taker: Signer | string,
    maker: Signer | string,
    makerOrder: Order,
    liqContract: string | IsolatedLiquidation,
    perpContract: Perpetual,
    options?: {
        quantity?: BigNumberable;
        leverage?: BigNumberable;
        allOrNothing?: boolean;
        isBuy?: boolean;
        sender?: Signer;
    }
) {
    const params = await Trader.setupLiquidationTrade(
        {
            // complete order quantity or the specified one
            quantity: options?.quantity || makerOrder.quantity,
            // is buy should always be same as maker order is buy. For testing isBuy can be !(makerOrder.isBuy)
            isBuy:
                options?.isBuy != undefined ? options.isBuy : makerOrder.isBuy,
            // use default leverage as one
            leverage: options?.leverage || toBigNumberStr(1),
            // if all of nothing is not specified use TRUE else use the one provided
            allOrNothing:
                options?.allOrNothing == undefined
                    ? true
                    : options?.allOrNothing
        },
        taker,
        maker,
        typeof liqContract == "string"
            ? liqContract
            : (liqContract as IsolatedLiquidation).address
    );

    return perpContract
        .connect(options?.sender || taker)
        .trade(params.accounts, [params.data], 0);
}

export async function adlTradeByOrder(
    taker: Signer | string,
    maker: Signer | string,
    makerOrder: Order,
    adlContract: string | IsolatedADL,
    perpContract: Perpetual,
    options?: {
        quantity?: BigNumberable;
        allOrNothing?: boolean;
        isBuy?: boolean;
        sender?: Signer;
    }
) {
    const params = await Trader.setupDeleveragingTrade(
        {
            // complete order quantity or the specified one
            quantity: options?.quantity || makerOrder.quantity,
            // is buy should always be same as maker order is buy. For testing isBuy can be !(makerOrder.isBuy)
            isBuy:
                options?.isBuy != undefined ? options.isBuy : !makerOrder.isBuy,
            // if all of nothing is not specified use TRUE else use the one provided
            allOrNothing:
                options?.allOrNothing == undefined
                    ? true
                    : options?.allOrNothing
        },
        taker,
        maker,
        typeof adlContract == "string"
            ? adlContract
            : (adlContract as IsolatedADL).address
    );

    return perpContract
        .connect(options?.sender || taker)
        .trade(params.accounts, [params.data], 0);
}
