// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;
import {TypedSignature} from "./TypedSignature.sol";

library Types {
    //
    // STRUCTS
    //

    /**
     * @dev Represents the current local cached index of account.
     *  Used to compute the funding settlement amount to be applied to the account
     */
    struct Index {
        uint128 timestamp;
        int256 value;
    }

    /**
     * @dev Used to represent user's position on chain
     */
    struct PositionBalance {
        // is position long/short buy/sell
        bool isPosPositive;
        // margin ratio at open
        uint128 mro;
        // quantity of asset e.g. DOT,BTC etc..
        uint128 qPos;
        // margin/collateral locked in position
        uint128 margin;
        // Open interest at open
        uint128 oiOpen;
    }

    /**
     * @dev Caches commonly used variable across the protocol, to save gas
     */
    struct Context {
        // current oracle price
        uint128 price;
        // funding rate to be applied
        int256 fundingRate;
        // global index (used for computing settlement amount)
        Index index;
    }

    /**
     * @dev Returned response from contracts implementing ITrader interface
     */
    struct TradeResult {
        // maker order hash
        bytes32 makerHash;
        // taker order hash
        bytes32 takerHash;
        // maker's updated positon baalnce after trade
        PositionBalance makerBalance;
        // taker's updated positon baalnce after trade
        PositionBalance takerBalance;
        // funds flow for maker (+ive means from bank -ive means to bank)
        int256 makerFundsFlow;
        // funds flow for taker (+ive means from bank -ive means to bank)
        int256 takerFundsFlow;
        // quantity of asset traded
        uint128 tradeQuantity;
        // price at which trade took place
        uint128 price;
        // fee paid by maker
        uint128 makerFee;
        // fee paid by taker
        uint128 takerFee;
        // pnl of maker
        int256 makerPnl;
        // pnl of taker
        int256 takerPnl;
        // from taker's perspective
        bool isBuy;
        // flag representing the trader contract which executed this trade
        bytes32 traderFlags;
    }

    /**
     * @dev status set by guardian for controlled methods
     */
    enum GuardianStatus {
        ALLOWED,
        NOT_ALLOWED
    }
}
