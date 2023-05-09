// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Types} from "../libraries/Types.sol";

interface IMarginBank {
    /**
     * @notice Deposits collateral token from caller's address to provided
     * account address in margin bank.
     * @dev the caller must approve margin bank to take funds on their behalf
     * from collateral token before invoking this method. Amount is expected
     * to be in 6 decimal units as the collateral token is USDC
     * @param  _account receiver account address
     * @param  _amount amount of tokens to be deposited
     * @return true if deposit successful.
     */
    function depositToBank(address _account, uint128 _amount)
        external
        returns (bool);

    /**
     * @notice Withdraws provided amount from caller address to provided destination address
     * @param  _destination The address to which the tokens are transferred.
     * @param  _amount The amount of tokens to withdraw.
     */
    function withdrawFromBank(address _destination, uint128 _amount) external;

    /**
     * @notice allows bank operators to transfer margin from an account to another account
     * @dev bank operators i.e. perpetual and liquidation contracts move funds during a trade
     * between accounts
     * @param _account address of account from which to take margin out
     * @param _destination address of destination where funds are to be deposited
     * @param _amount amount of margin to be transfered
     */
    function transferMarginToAccount(
        address _account,
        address _destination,
        uint128 _amount
    ) external;

    /**
     * @notice Add or remove a Bank Operator address.
     * @dev Must be called by the  admin.
     * @param  _operator  The address for which to enable or disable bank operator privileges.
     * @param  _approved  True if approved, false if disapproved.
     */
    function setBankOperator(address _operator, bool _approved) external;

    /**
     * @notice Get the bank balance of an account.
     * @param  _account  The address of the account to query the balances of.
     */
    function getAccountBankBalance(address _account)
        external
        view
        returns (uint128);

    /**
     * @notice Updates withdrawal status of this market
     * @dev Must be called by the Guardian
     * @param _newStatus status of withdrawals for this market. If not allowed then funds cannot be withdrawn from MarginBank
     */
    function setWithdrawalStatus(Types.GuardianStatus _newStatus) external;

    /**
     * Returns true if withdrawal is allowed from MarginBank else returns false
     */
    function isWithdrawalAllowed() external view returns (bool);
}
