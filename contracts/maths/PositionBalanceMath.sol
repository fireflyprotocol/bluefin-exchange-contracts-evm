// // SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {BaseMath} from "../maths/BaseMath.sol";
import {Types} from "../libraries/Types.sol";

library PositionBalanceMath {
    /**
     * @dev returns margin ratio of position
     * @param positionBalance position of account on perpetual
     * @param price current oracle price
     */
    function getMarginRatio(
        Types.PositionBalance memory positionBalance,
        uint128 price
    ) internal pure returns (int256) {
        int256 marginRatio = 0;
        if (positionBalance.isPosPositive) {
            int256 balance = int256(
                (uint256(price) * uint256(positionBalance.qPos)) /
                    BaseMath.baseUInt()
            );
            int256 debt = int256(int128(positionBalance.oiOpen)) -
                int256(int128(positionBalance.margin));

            marginRatio = balance > 0
                ? BaseMath.baseInt() - ((debt * BaseMath.baseInt()) / balance)
                : BaseMath.baseInt();
        } else {
            int256 debt = int256(int128(positionBalance.oiOpen)) +
                int256(int128(positionBalance.margin));

            int256 balance = (int256(int128(price)) *
                int256(int128(positionBalance.qPos))) / BaseMath.baseInt();

            marginRatio = balance > 0
                ? ((debt * BaseMath.baseInt()) / balance) - BaseMath.baseInt()
                : BaseMath.baseInt();
        }

        return marginRatio;
    }

    /**
     * @dev returns average entry price for position
     * @param positionBalance account's position
     */
    function getAverageEntryPrice(Types.PositionBalance memory positionBalance)
        internal
        pure
        returns (uint128)
    {
        return
            positionBalance.oiOpen == 0
                ? 0
                : BaseMath.baseDiv(
                    positionBalance.oiOpen,
                    positionBalance.qPos
                );
    }
}
