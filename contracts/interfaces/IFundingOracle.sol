// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface IFundingOracle {
    /**
     * @notice Starts funding oracle's 1st window at specified time
     * @param _timestamp time at which funding will start
     */
    function startFunding(uint128 _timestamp) external;

    /**
     * @notice Stops funding oracle
     */
    function stopFunding() external;

    /**
     * @notice Updates aggregated stats for on-going funding window with
     * provieded trade price and oracle price
     * @param _tradePrice price at which trade was executed
     * @param _oraclePrice price of the oracle at the time of trade execution
     */
    function recordTrade(uint128 _tradePrice, uint128 _oraclePrice) external;

    /**
     * @notice allows caller to set funding rate for the on-going window
     * can only be invoked by funding rate provider
     */
    function setFundingRate() external;

    /**
     * @notice Updates funding rate status of this market
     * @dev Must be called by the Guardian
     * @param _newStatus status of funding rate for this market.
     * If not allowed then on-chain funding rate is neither applied nor calculated
     */
    function setFundingRateStatus(Types.GuardianStatus _newStatus) external;

    /**
     * @notice allows caller to set funding rate for the on-going window
     * can only be invoked by funding rate provider
     * @param _offchainFundingRate offchain computed funding rate which override the on-chain computed funding rate
     */
    function setOffChainFundingRate(int256 _offchainFundingRate) external;

    /**
     * Returns true if on-chain funding rate is recorded or applied else false
     */
    function isFundingRateAllowed() external view returns (bool);

    /**
     * @notice returns current funding rate
     */
    function getFundingRate() external view returns (int256);
}
