// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";
import {PositionBalanceMath} from "../maths/PositionBalanceMath.sol";

interface IMarginMath {
    /**
     * @dev returns margin left in an account's position at the time of position closure
     * post perpetual delisting
     * @param _positionBalance account's position on perpetual
     * @param _delistingPrice price of oracle for delisting
     * @param _perpetualBalance amount of balance, USDC perpetual has
     */
    function getMarginLeft(
        Types.PositionBalance memory _positionBalance,
        uint128 _delistingPrice,
        uint128 _perpetualBalance
    ) external pure returns (uint128);

    /**
     * @dev returns the target margin required when adjusting leverage
     * @param _positionBalance account's position on perpetual
     * @param _leverage new leverage
     * @param _oraclePrice price of the asset
     */
    function getTargetMargin(
        Types.PositionBalance memory _positionBalance,
        uint128 _leverage,
        uint128 _oraclePrice
    ) external pure returns (uint128);

    /**
     * @dev returns the maximum removeable amount of margin from an accounts position
     * before the account becomes under collat
     * @param _positionBalance account's position on perpetual
     * @param _oraclePrice price of the asset
     */
    function getMaxRemoveableMargin(
        Types.PositionBalance memory _positionBalance,
        uint128 _oraclePrice
    ) external pure returns (uint128);
}
