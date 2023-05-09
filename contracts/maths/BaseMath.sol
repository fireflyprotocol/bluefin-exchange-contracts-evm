// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

library BaseMath {
    // 1e18 uint.
    uint128 internal constant BASE_UINT = 10**18;

    // 1e18 int.
    int256 internal constant BASE_INT = 10**18;

    /**
     * @dev Getter for constants as reading directly from libraries isn't allowed
     */
    function baseInt() internal pure returns (int256) {
        return BASE_INT;
    }

    /**
     * @dev Getter function since constants can't be read directly from libraries.
     */
    function baseUInt() internal pure returns (uint128) {
        return BASE_UINT;
    }

    /**
     * @dev Multiplies a value by a base value (result is rounded down).
     */
    function baseMul(uint128 value, uint128 baseValue)
        internal
        pure
        returns (uint128)
    {
        return uint128((uint256(value) * uint256(baseValue)) / BASE_UINT);
    }

    /**
     * @dev Multiplication by a base value with the result rounded down
     */
    function baseMul(int256 value, int256 baseValue)
        internal
        pure
        returns (int256)
    {
        return (value * baseValue) / BASE_INT;
    }

    /**
     * @dev * @dev Multiplication by a base value with the result rounded down
     */
    function baseMul(uint128 value, int256 baseValue)
        internal
        pure
        returns (int256)
    {
        return (int256(uint256(value)) * baseValue) / BASE_INT;
    }

    /**
     * @dev Division by a base value with the result rounded down
     */
    function baseDiv(uint128 value, uint128 baseValue)
        internal
        pure
        returns (uint128)
    {
        return
            uint128((uint256(value) * uint256(BASE_UINT)) / uint256(baseValue));
    }

    /**
     * @dev Divide a value by a base value (result is rounded down).
     */
    function baseDiv(int256 value, int256 baseValue)
        internal
        pure
        returns (int256)
    {
        return (value * BASE_INT) / baseValue;
    }

    /**
     * @dev Multiplies a value by a base value (result is rounded up).
     */
    function baseMulRoundUp(uint128 value, uint128 baseValue)
        internal
        pure
        returns (uint128)
    {
        if (value == 0 || baseValue == 0) {
            return 0;
        }
        return
            uint128(((uint256(value) * uint256(baseValue)) - 1) / BASE_UINT) +
            1;
    }

    /**
     * @dev Returns absolute of the number
     */
    function absolute(int256 number) internal pure returns (uint128) {
        return
            number >= 0
                ? uint128(uint256(number))
                : uint128(uint256(-1 * number));
    }

    /**
     * @dev Returns the maximum between a and b.
     */
    function max(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the minimum between a and b.
     */
    function min(uint128 a, uint128 b) internal pure returns (uint128) {
        return a < b ? a : b;
    }

    /**
     * @dev returns uint256(max(number, 0))
     */
    function toPositive(int256 number) internal pure returns (uint128) {
        return number >= 0 ? uint128(uint256(number)) : 0;
    }

    /**
     * @dev Returns ceil(a,m)
     */
    function ceil(uint128 a, uint128 m) internal pure returns (uint128) {
        return ((a + m - 1) / m) * m;
    }
}
