// // SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";
import {BaseMath} from "../maths/BaseMath.sol";
import {PositionBalanceMath} from "../maths/PositionBalanceMath.sol";
import {IMarginMath} from "../interfaces/IMarginMath.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title Margin Math
 * @author Team Firefly <engineering@firefly.exchange>
 * @notice Computes margin to be moved out off or into the user position under different
 * circumstances
 */
contract MarginMath is IMarginMath, Initializable {
    using BaseMath for uint128;
    using BaseMath for int256;
    using PositionBalanceMath for Types.PositionBalance;

    function initialize() public initializer {}

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
    ) public pure override returns (uint128) {
        uint128 pPos = _positionBalance.getAverageEntryPrice();
        uint128 marginLeft;

        if (_positionBalance.isPosPositive) {
            marginLeft = BaseMath.toPositive(
                int256(
                    uint256(
                        _positionBalance.margin +
                            _positionBalance
                                .oiOpen
                                .baseMul(_delistingPrice)
                                .baseDiv(pPos)
                    )
                ) - int256(uint256(_positionBalance.oiOpen))
            );
        } else {
            marginLeft = BaseMath.toPositive(
                int256(
                    uint256(_positionBalance.margin + _positionBalance.oiOpen)
                ) -
                    int256(
                        uint256(
                            _positionBalance
                                .oiOpen
                                .baseMul(_delistingPrice)
                                .baseDiv(pPos)
                        )
                    )
            );
        }

        // if not enough balance in perpetual, margin left is equal to total
        // amount left in perpetual
        marginLeft = BaseMath.min(marginLeft, _perpetualBalance);

        return marginLeft;
    }

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
    ) public pure override returns (uint128) {
        uint128 targetMargin = 0;

        if (_positionBalance.isPosPositive) {
            // if long
            targetMargin = BaseMath.absolute(
                BaseMath.max(
                    0,
                    (
                        int256(
                            uint256(
                                _positionBalance
                                    .qPos
                                    .baseMul(_oraclePrice)
                                    .baseDiv(_leverage)
                            )
                        )
                    ) -
                        int256(
                            uint256(_positionBalance.qPos.baseMul(_oraclePrice))
                        ) +
                        int256(uint256(_positionBalance.oiOpen))
                )
            );
        } else {
            // if short
            targetMargin = BaseMath.absolute(
                BaseMath.max(
                    0,
                    (
                        int256(
                            uint256(
                                _positionBalance
                                    .qPos
                                    .baseMul(_oraclePrice)
                                    .baseDiv(_leverage)
                            )
                        )
                    ) +
                        int256(
                            uint256(_positionBalance.qPos.baseMul(_oraclePrice))
                        ) -
                        int256(uint256(_positionBalance.oiOpen))
                )
            );
        }

        return targetMargin;
    }

    /**
     * @dev returns the maximum removeable amount of margin from an accounts position
     * before the account becomes under collat
     * @param _positionBalance account's position on perpetual
     * @param _oraclePrice price of the asset
     */
    function getMaxRemoveableMargin(
        Types.PositionBalance memory _positionBalance,
        uint128 _oraclePrice
    ) public pure override returns (uint128) {
        uint128 maxRemovableAmount = 0;

        if (_positionBalance.isPosPositive) {
            maxRemovableAmount = BaseMath.min(
                _positionBalance.margin,
                BaseMath.absolute(
                    BaseMath.max(
                        0,
                        int256(uint256(_positionBalance.margin)) -
                            int256(uint256(_positionBalance.oiOpen)) +
                            int256(
                                uint256(
                                    _positionBalance.qPos.baseMul(
                                        _oraclePrice.baseMul(
                                            BaseMath.baseUInt() -
                                                _positionBalance.mro
                                        )
                                    )
                                )
                            )
                    )
                )
            );
        } else {
            // if short
            maxRemovableAmount = BaseMath.min(
                _positionBalance.margin,
                BaseMath.absolute(
                    BaseMath.max(
                        0,
                        int256(
                            uint256(
                                _positionBalance.margin +
                                    _positionBalance.oiOpen
                            )
                        ) -
                            int256(
                                uint256(
                                    _positionBalance.qPos.baseMul(
                                        _oraclePrice.baseMul(
                                            BaseMath.baseUInt() +
                                                _positionBalance.mro
                                        )
                                    )
                                )
                            )
                    )
                )
            );
        }

        return maxRemovableAmount;
    }
}
