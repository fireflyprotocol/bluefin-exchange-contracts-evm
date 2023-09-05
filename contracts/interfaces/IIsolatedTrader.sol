// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface IIsolatedTrader {
    /**
     * @notice applies provided gas charges to the
     * maker/taker accounts and transfers them to margin bank
     * @dev caller must ensure that gas charges > 0
     * @param data TradeData
     * @param gasCharges amount to be charged
     * @param oraclePrice current oracle price
     */
    function applyGasCharges(
        bytes calldata data,
        uint128 gasCharges,
        uint128 oraclePrice
    ) external returns (uint128, uint128);
}
