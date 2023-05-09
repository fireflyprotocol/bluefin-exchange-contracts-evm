// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface IEvaluator {
    /**
     * @dev verifies if the trade quantity conforms to quantity checks
     * @param _tradeQuantity the quantity of trade
     */
    function verifyQuantityChecks(uint128 _tradeQuantity, address _maker)
        external;

    /**
     * @dev verifies if the trade price conforms to price checks
     * @param _price the price of trade
     */
    function verifyPriceChecks(uint128 _price, address _maker) external;

    /**
     * @dev verifies if the trade price conforms to min max price checks
     * @param _price the price of trade
     */
    function verifyMinMaxPriceChecks(uint128 _price, address _maker) external;

    /**
     * @dev verifies if the trade price conforms to min max quantity checks
     * @param _tradeQuantity the quantity of trade
     */
    function verifyMinMaxQuantityChecks(uint128 _tradeQuantity, address _maker)
        external;

    /**
     * @dev verifies if the trade price for both long and short
     * parties confirms to market take bound checks
     * @param _tradePrice the price of trade
     * @param _oraclePrice the price of oracle
     * @param _isBuy is buy flag from taker's perspective
     * @param _taker address of taker
     */
    function verifyMarketTakeBoundChecks(
        uint128 _tradePrice,
        uint128 _oraclePrice,
        bool _isBuy,
        address _taker
    ) external;

    /**
     * @dev verifies if the provided account has oi oppen <= maximum allowed oi open for current leverage
     * @param _account address of account
     * @param _balance Position balance of the account
     */
    function verifyOIOpenForAccount(
        address _account,
        Types.PositionBalance memory _balance
    ) external;

    /**
     * @notice returns the minimum allowed price for trade
     */
    function minPrice() external returns (uint128);

    /**
     * @notice returns the maximum allowed price for trade
     */
    function maxPrice() external returns (uint128);

    /**
     * @notice returns the tick size for price
     */
    function tickSize() external returns (uint128);

    /**
     * @notice returns the minimum allowed quantity for order
     */
    function minQty() external returns (uint128);

    /**
     * @notice returns the max allowed quantity for limit order
     */
    function maxQtyLimit() external returns (uint128);

    /**
     * @notice returns the max allowed quantity for market order
     */
    function maxQtyMarket() external returns (uint128);

    /**
     * @notice returns the quantity step size
     */
    function stepSize() external returns (uint128);

    /**
     * @notice returns market take bound for long side. The returned value is in percentage
     */
    function mtbLong() external returns (uint128);

    /**
     * @notice returns market take bound for short side. The returned value is in percentage
     */
    function mtbShort() external returns (uint128);

    /**
     * @notice returns max allowed oi open interst for provided leverage
     * @dev max allowed oi open is only stored for 1,2,3...N leverage not for 1.2 or other floating values
     * @param _leverage value of leverage in 1e18 format
     */
    function maxAllowedOIOpen(uint128 _leverage) external returns (uint128);
}
