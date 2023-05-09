// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface ITrader {
    /**
     * @notice Called by Perpetual to return the trade result. Reverts if the trade is not valid
     * @param  maker        Order maker
     * @param  taker        Order taker
     * @param  price        Current oracle price of asset
     * @param  data         Data passed into Perpetual's trade()
     * @return              Trade result
     */
    function trade(
        address maker,
        address taker,
        uint128 price,
        bytes calldata data
    ) external returns (Types.TradeResult memory);

    /**
     * @notice gets the unique trader flags
     */
    function getTraderFlag() external returns (bytes32);
}
