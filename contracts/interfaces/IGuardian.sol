// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface IGuardian {
    /**
     * @dev Must be called by the Guardian
     * @param _perpetual represents address of Perpetual contract for a market
     * @param _newStatus status of trading for this market. If not allowed then no new trades can be performed
     */
    function setTradingStatus(
        address _perpetual,
        Types.GuardianStatus _newStatus
    ) external;

    /**
     * @dev Must be called by the Guardian
     * @param _fundingOracle represents address of FundingOracle contract for a market
     * @param _newStatus if true then on-chain funding rate is neither calculated nor applied to new trades
     */
    function setFundingRateStatus(
        address _fundingOracle,
        Types.GuardianStatus _newStatus
    ) external;

    /**
     * @dev Must be called by the Guardian
     * @param _marginBank represents address of MarginBank contract for a market
     * @param _newStatus if true then withdrawl from margin bank is allowed for the given market else not
     */
    function setWithdrawalStatus(
        address _marginBank,
        Types.GuardianStatus _newStatus
    ) external;

    /**
     * @param _marketAddress address of the Perpetual contract for a given market, returns true
     * is exchange accepts new trades including liquidation trades else false
     */
    function isTradingAllowed(address _marketAddress)
        external
        view
        returns (bool);

    /**
     * @param _marketAddress address of the FundingOracle contract for a given market, returns true
     * if funding rate can be set for the given market on trades else false
     */
    function isFundingRateAllowed(address _marketAddress)
        external
        view
        returns (bool);

    /**
     * @param _marketAddress address of the MarginBank contract for a given market, returns true if
     * withdrawals from margin bank are allowed for the given market else false
     */
    function isWithdrawalAllowed(address _marketAddress)
        external
        view
        returns (bool);

    /**
     * returns the address of the guardian account
     */
    function guardianOperator() external view returns (address);
}
