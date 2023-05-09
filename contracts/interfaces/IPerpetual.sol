// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface IPerpetual {
    //
    // STRUCTS
    //

    /// @dev Argument for the trade method
    struct TradeArg {
        // index of taker account in first argument to trade function
        uint128 takerIndex;
        // index of maker account in first argument to trade function
        uint128 makerIndex;
        // address of a trader contract implementing the Trader interface and
        address trader;
        // A struct of type TradeData. Passed in as bytes since TradeData type is different for each trader
        bytes data;
    }

    /// @dev Addresses used across the contract
    struct Addresses {
        /// @notice address of the contract to be used for performing margin maths
        address marginMath;
        /// @notice address of the oracle contract providing index price
        address oracle;
        /// @notice address of the funder contract providing the hourly funding rate
        address funder;
        /// @notice address of the margin bank contract used to store account bank balances
        address marginBank;
        /// @notice address of the evaluator contract
        address evaluator;
        /// @notice address of the fee pool. All trades fees are sent to this address.
        address feePool;
        /// @notice address of the guardian contract
        address guardian;
    }

    /**
     * @notice Performs one or multiple matches between two or more trading parties
     * @param  _accounts  A sorted list of traders
     * @param  _trades    A sorted list of trades to execute
     */
    function trade(
        address[] calldata _accounts,
        TradeArg[] calldata _trades,
        uint128 gasCharges
    ) external;

    /**
     * @notice Allows traders with positions in a delisted market to withdraw the margin token equal to the
     *  equity in the position calculated at the delisting oracle price
     * @param  _account account with a position to close
     */
    function closePosition(address _account) external;

    /**
     * @notice Sets or removes certain permissions for the operator to act on behalf of the sender.
     * @param  _operator  The account for which permissions are being granted or revoked.
     * @param  _approved  True for granting permissions, false for revoking them.
     */
    function setSubAccount(address _operator, bool _approved) external;

    /**
     * @notice Sets a new Fee Pool contract.
     * @param  _feePool  The address of the new funder contract.
     */
    function setFeePool(address _feePool) external;

    /**
     * @notice Sets a new value for the market trade fee percentage.
     * @param  _defaultTakerFee  The new value of the market trade fee percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setDefaultTakerFee(uint128 _defaultTakerFee) external;

    /**
     * @notice Sets a new value for the limit trade fee percentage.
     * @param  _defaultMakerFee  The new value of the limit trade fee percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setDefaultMakerFee(uint128 _defaultMakerFee) external;

    /**
     * @notice Updates status of trading for this market
     * @dev Must be called by the Guardian
     * @param _newStatus status of trading for this market. If not allowed then no new trades can be performed
     */
    function setTradingStatus(Types.GuardianStatus _newStatus) external;

    /// @notice Returns maintenance marging required to sustain a position
    function maintenanceMarginRequired() external returns (int256);

    /// @notice Returns initial margin required to open a position
    function initialMarginRequired() external returns (int256);

    /// @notice Returns default maker fee
    function defaultMakerFee() external returns (uint128);

    /// @notice Returns default taker fee
    function defaultTakerFee() external returns (uint128);

    /**
     * @notice Get the balance of an account
     * @param  _account The address of the account to query the balances of.
     */
    function getAccountBalance(address _account)
        external
        view
        returns (Types.PositionBalance memory);

    /**
     * @notice Returns true if trading is allowed for this market else false
     */
    function isTradingAllowed() external view returns (bool);

    /**
     * @notice Gets the sub account status of an operator for a particular account.
     *
     * @param  account   The account to query the operator for.
     * @param  operator  The address of the operator to query the status of.
     * @return           True if the operator is a sub account of the account, false otherwise.
     */
    function getIsSubAccount(address account, address operator)
        external
        view
        returns (bool);
}
