// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// oz
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

// utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BaseRelayRecipient} from "./utils/BaseRelayRecipient.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IMarginBank} from "./interfaces/IMarginBank.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";

// libraries
import {Types} from "./libraries/Types.sol";
import {Require} from "./libraries/Require.sol";

/**
 * @title Margin Bank
 * @author Team Bluefin <engineering@bluefin.io>
 * @notice Controls all the funds in perpetual protocol. Users must lock in their margin into margin bank
 * before it can be used to open any position on any perpetual market.
 * @dev When trades are executed to open/close position, the margin always remain in margin bank, just exchanges
 * address from one account to another. The accounts must withdraw margin to move it out of margin bank
 * The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract MarginBank is
    IMarginBank,
    FFLYFiOwnableUpgrade,
    BaseRelayRecipient,
    BlockContext
{
    //
    // EVENTS
    //

    /// @notice event emitted when a change in user balance occurrs in margin bank
    /// @dev DEPOST action implies deposit of funds to margin bank
    /// @dev WITHDRAW action implies funds are withdrawn from margin bank by an account
    /// @dev INTERNAL action implies funds are moved from one account to another by bank operators
    event BankBalanceUpdate(
        Action action,
        address indexed srcAddress,
        address indexed destAddress,
        uint128 amount,
        uint128 srcBalance,
        uint128 destBalance,
        uint128 timestamp
    );

    /// @notice event emitted when account move funds from bank into a Perpetual position
    event BankTransferToPerpetual(
        address indexed account,
        address destination,
        uint128 amount,
        uint128 balance,
        uint128 timestamp
    );
    /// @notice event emitted when a bank operator is added or removed
    event MarginBankOperatorUpdate(address operator, bool approved);

    //
    // ENUMS
    //
    enum Action {
        DEPOSIT,
        WITHDRAW,
        INTERNAL
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    /// @notice address of the erc20 margin token used to collateralize positions
    /// @dev collateral token is supposed to be USDC with 6 decimal units
    address public token;

    /// @notice mapping of addresses allowed to move funds on behalf of accounts.
    /// @dev These are always Perpetual/Liquidation contract addresses only set by admin.
    mapping(address => bool) public bankOperators;

    /// @notice mapping between account and available margin bank balance
    /// @dev margin amount is stored in 18 decimals
    mapping(address => uint128) public bankBalances;

    /// @notice address of the guardian contract
    address public guardianContract;

    /// @notice status of the withdrawal as set by the Guardian
    Types.GuardianStatus private withdrawalStatus;

    uint256[50] private __gap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyBankOPerators() {
        require(
            bankOperators[_msgSender()],
            "MarginBank: caller is not a bank operator"
        );
        _;
    }

    /**
     * Throws if called by any account other than the guardian
     */
    modifier onlyGuardianContract() {
        require(
            guardianContract == _msgSender(),
            "MarginBank: caller is not the guardian contract"
        );
        _;
    }

    /**
     * @notice initializes the contract
     * @param  _token  address of the token to use for margin-deposits
     * @param  _guardian address of the guardian contract
     * @param  _trustedForwarder The address of trusted relayer node
     */
    function initialize(
        address _token,
        address _guardian,
        address _trustedForwarder
    ) public initializer {
        token = _token;
        guardianContract = _guardian;

        __MetaTransaction_init(_trustedForwarder);
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    /**
     * @notice Add or remove a Bank Operator address.
     * @dev Must be called by the  admin.
     * @param  _operator  The address for which to enable or disable bank operator privileges.
     * @param  _approved  True if approved, false if disapproved.
     */
    function setBankOperator(address _operator, bool _approved)
        external
        override
        onlyOwner
        nonReentrant
    {
        // TODO implement EIP165 to ensure operator is PERPETUAL or LIQUIDATION contract
        bankOperators[_operator] = _approved;

        emit MarginBankOperatorUpdate(_operator, _approved);
    }

    /**
     * @notice Updates withdrawal status of this market
     * @param _newStatus status of withdrawal for this market. If not allowed then
     * funds cannot be withdrawn from the MarginBank
     */
    function setWithdrawalStatus(Types.GuardianStatus _newStatus)
        external
        override
        nonReentrant
        onlyGuardianContract
    {
        withdrawalStatus = _newStatus;
    }

    /**
     * @notice Deposits collateral token from caller's address to provided
     * account address in margin bank.
     * @dev the caller must approve margin bank to take funds on their behalf
     * from collateral token before invoking this method
     * @dev amount is expected to be in 6 decimal units as the collateral token is USDC
     * @param  _account receiver account address
     * @param  _amount amount of tokens to be deposited
     * @return true if deposit successful.
     */
    function depositToBank(address _account, uint128 _amount)
        external
        override
        nonReentrant
        returns (bool)
    {
        // gas less transaction, decode sender address
        address caller = msgSender();

        // transfer amount from caller to margin bank for provided account
        /// @dev will revert if caller does not have enough funds
        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(token),
            caller,
            address(this),
            _amount
        );

        //  updated account's balance
        /// * @dev convert 6 decimal unit amount to 18 decimals
        bankBalances[_account] += _amount * 1e12;

        emit BankBalanceUpdate(
            Action.DEPOSIT,
            caller,
            _account,
            _amount * 1e12,
            bankBalances[caller],
            bankBalances[_account],
            _blockTimestamp()
        );
        return true;
    }

    /**
     * @notice Performs a withdrawal of margin tokens from the the bank to a provided address
     * @param  _destination Desitation address to receive the transferred tokens
     * @param  _amount Number of margin tokens to transfer
     */
    function withdrawFromBank(address _destination, uint128 _amount)
        external
        override
        nonReentrant
    {
        // gas less transaction, decode sender address
        address caller = msgSender();

        require(
            isWithdrawalAllowed(),
            "MarginBank: Withdrawals not allowed at the moment"
        );

        // transfer tokens destination address in collateral token
        /// @dev will revert if margin bank does not have enough tokens
        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(token),
            _destination,
            _amount
        );

        // reduce balance in margin bank
        /// @dev will throw error if user does not have enough funds
        /// @dev convert amount to 18 decimal places
        bankBalances[caller] -= (_amount * 1e12);

        emit BankBalanceUpdate(
            Action.WITHDRAW,
            caller,
            _destination,
            _amount * 1e12,
            bankBalances[caller],
            bankBalances[_destination],
            _blockTimestamp()
        );
    }

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
    ) external override nonReentrant onlyBankOPerators {
        // Ensure account has enough funds for trade
        Require.that(
            bankBalances[_account] >= _amount,
            "Insufficient account funds",
            _account
        );

        bankBalances[_account] -= _amount;

        bankBalances[_destination] += _amount;

        emit BankBalanceUpdate(
            Action.INTERNAL,
            _account,
            _destination,
            _amount,
            bankBalances[_account],
            bankBalances[_destination],
            _blockTimestamp()
        );
    }

    //===========================================================//
    //                         GETTERS
    //===========================================================//

    /**
     * @notice Get the bank balance of an account.
     * @param _account The address of the account to query the balances of.
     */
    function getAccountBankBalance(address _account)
        external
        view
        override
        returns (uint128)
    {
        return bankBalances[_account];
    }

    /**
     * Returns true if withdrawal is allowed for this market else false
     */
    function isWithdrawalAllowed() public view override returns (bool) {
        return withdrawalStatus == Types.GuardianStatus.ALLOWED;
    }
}
