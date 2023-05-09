// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

//utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IGuardian} from "./interfaces/IGuardian.sol";
import {IFundingOracle} from "./interfaces/IFundingOracle.sol";
import {IMarginBank} from "./interfaces/IMarginBank.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";

// libraries
import {Types} from "./libraries/Types.sol";

/**
 * @title Guardian
 * @author Team Firefly <engineering@firefly.exchange>
 * @notice Guardian contract, able to control certain aspects of the protocol including:
 * 1. starting/stopping trade on a perpetual
 * 2. starting/stopping withdrawal of funds from margin bank
 * 3. moving funding rate computation off-chain and vice versa
 * Will become obselete once governance is live
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract Guardian is IGuardian, FFLYFiOwnableUpgrade, BlockContext {
    //
    // EVENTS
    //

    /// @notice Emitted when guardian address is updated
    event GuardianAccountUpdate(address newGuardian);

    /// @notice Emitted when trading is enabled or disabled for a certain market
    event TradingStatusUpdate(
        address marketAddress,
        Types.GuardianStatus status
    );

    /// @notice Emitted when funding is enabled or disabled for a certain market
    event FRStatusUpdate(address marketAddress, Types.GuardianStatus status);

    /// @notice Emitted when withdrawal is enabled or disabled from margin bank
    event WithdrawalStatusUpdate(
        address marketAddress,
        Types.GuardianStatus status
    );

    /// @notice Emitted when Price Oracle Updates are enabled or disabled for certain market
    event POStatusUpdate(string marketKey, Types.GuardianStatus status);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    /// @notice The address of the guardian account
    /// the guardian is used to enable/disable trading, funding and withdrawals functionality
    address public override guardianOperator;

    uint256[50] private __gap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * Throws if called by any account other than the guardian
     */
    modifier onlyGuardianOperator() {
        require(
            guardianOperator == _msgSender(),
            "Guardian: caller is not the guardian operator"
        );
        _;
    }

    /**
     * @notice initializes the contract
     * @dev sets the deployer as guardian account
     */
    function initialize() public initializer {
        guardianOperator = _msgSender();

        __Ownable_init();
        __ReentrancyGuard_init();

        emit GuardianAccountUpdate(guardianOperator);
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    /**
     * @notice Sets a new guardian account
     * @param _newGuardian  The address of the new guardian.
     */
    function setGuardian(address _newGuardian) external onlyOwner nonReentrant {
        guardianOperator = _newGuardian;
        emit GuardianAccountUpdate(guardianOperator);
    }

    /**
     * @dev sets the status of trading on/off
     * @param _perpetual represents address of Perpetual contract address for a market
     * @param _newStatus status of trading for this market. If not allowed then no new trades can be performed
     */
    function setTradingStatus(
        address _perpetual,
        Types.GuardianStatus _newStatus
    ) external override onlyGuardianOperator nonReentrant {
        IPerpetual(_perpetual).setTradingStatus(_newStatus);
        emit TradingStatusUpdate(_perpetual, _newStatus);
    }

    /**
     * @dev sets the funding rate status on-chain/off-chain
     * @param _fundingOracle represents address of FundingOracle contract address for a market
     * @param _newStatus if true then applying funding rate is allowed for the given market else not
     */
    function setFundingRateStatus(
        address _fundingOracle,
        Types.GuardianStatus _newStatus
    ) external override onlyGuardianOperator nonReentrant {
        IFundingOracle(_fundingOracle).setFundingRateStatus(_newStatus);
        emit FRStatusUpdate(_fundingOracle, _newStatus);
    }

    /**
     * @dev enables/disables withdrawl of funds from bank
     * @param _marginBank represents address of MarginBank contract address for a market
     * @param _newStatus if true then withdrawl from margin bank is allowed else not
     */
    function setWithdrawalStatus(
        address _marginBank,
        Types.GuardianStatus _newStatus
    ) external override onlyGuardianOperator nonReentrant {
        IMarginBank(_marginBank).setWithdrawalStatus(_newStatus);
        emit WithdrawalStatusUpdate(_marginBank, _newStatus);
    }

    //===========================================================//
    //                      GETTERS
    //===========================================================//

    /**
     * @param _perpetual address of the Perpetual contract for a given market, returns true
     * is exchange accepts new trades including liquidation trades else false
     */
    function isTradingAllowed(address _perpetual)
        external
        view
        override
        returns (bool)
    {
        return IPerpetual(_perpetual).isTradingAllowed();
    }

    /**
     * @param _fundingOracle address of the FundingOracle contract for a given market, returns true
     * if funding rate can be set for the given market on trades else false
     */
    function isFundingRateAllowed(address _fundingOracle)
        external
        view
        override
        returns (bool)
    {
        return IFundingOracle(_fundingOracle).isFundingRateAllowed();
    }

    /**
     * @param _marginBank address of the MarginBank contract for a given market, returns true if
     * withdrawals from margin bank are allowed for the given market else false
     */
    function isWithdrawalAllowed(address _marginBank)
        external
        view
        override
        returns (bool)
    {
        return IMarginBank(_marginBank).isWithdrawalAllowed();
    }
}
