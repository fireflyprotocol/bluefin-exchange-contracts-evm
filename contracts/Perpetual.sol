// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BaseRelayRecipient} from "./utils/BaseRelayRecipient.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IFundingOracle} from "./interfaces/IFundingOracle.sol";
import {IMarginBank} from "./interfaces/IMarginBank.sol";
import {ITrader} from "./interfaces/ITrader.sol";
import {IEvaluator} from "./interfaces/IEvaluator.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";
import {IMarginMath} from "./interfaces/IMarginMath.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IIsolatedTrader} from "./interfaces/IIsolatedTrader.sol";
import {AggregatorV3Interface as IPriceOracle} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";
import {PositionBalanceMath} from "./maths/PositionBalanceMath.sol";

// libraries
import {Types} from "./libraries/Types.sol";
import {Require} from "./libraries/Require.sol";

/**
 * @title Perpetual
 * @author Team Bluefin <engineering@bluefin.io>
 * @notice Represents a perpetual being traded on firefly exchange. Each perpetual is pegged against the real
 * world asset via the price provded by the perpetual.
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract Perpetual is
    IPerpetual,
    FFLYFiOwnableUpgrade,
    BaseRelayRecipient,
    BlockContext
{
    using BaseMath for uint128;
    using BaseMath for int256;
    using PositionBalanceMath for Types.PositionBalance;

    //
    // EVENTS
    //

    /// @notice Emitted when perpetual is delisted by admin
    event PerpetualDelisted(uint128 settlementPrice);

    /// @notice Emitted when settlement amount is applied to account
    event AccountSettlementUpdate(
        address indexed account,
        Types.PositionBalance balance,
        bool settlementIsPositive,
        uint128 settlementAmount,
        uint128 price,
        int256 fundingRate,
        uint128 timestamp
    );

    /// @notice Emitted when an account withdraws using closePosition
    event PositionClosed(
        address indexed account,
        uint128 amount,
        uint128 timestamp
    );

    /// @notice Emitted when trading on perpetual starts
    event TradingStarted(uint128 startTime);

    /// @notice Emitted when trading on perpetual stops
    event TradingStopped(uint128 stopTime);

    /// @notice Emitted when a sub account is updated
    event SubAccountUpdate(
        address indexed sender,
        address operator,
        bool approved
    );

    /// @notice Emitted when settlement operator status is updated
    event SettlementOperatorUpdate(address operator, bool approved);

    /// @notice Emitted when trader contract status is updated
    event TradeContractUpdate(address tradeContract, bool approved);

    /// @notice Emitted when a trade is settled
    event TradeExecuted(
        address trader,
        address indexed maker,
        address indexed taker,
        bytes32 makerOrderHash,
        bytes32 takerOrderHash,
        uint128 makerMRO,
        uint128 takerMRO,
        uint128 makerFee,
        uint128 takerFee,
        int256 makerPnl,
        int256 takerPnl,
        uint128 tradeQuantity,
        uint128 price,
        bool isBuy, // from the perspective of taker
        uint128 timestamp
    );

    /// @notice Emitted when a position of account is updated
    event AccountPositionUpdate(
        address indexed account,
        address sender,
        Types.PositionBalance position,
        Action action,
        int256 index,
        uint128 timestamp
    );

    /// @notice Emitted when price oracle address is updated
    event PriceOracleUpdate(address oracle);

    /// @notice Emitted when funding oracle address is updated
    event FundingOracleUpdate(address funder);

    /// @notice Emitted when fee pool address is updated
    event FeePoolUpdate(address feePool);

    /// @notice Emitted when market order (taker) fee is adjusted
    event DefaultTakerFeeUpdate(uint128 defaultTakerFee);

    /// @notice Emitted when limit order fee (maker) is adjusted
    event DefaultMakerFeeUpdate(uint128 defaultMakerFee);

    /// @notice Emitted maintenance margin is updated
    event MMRUpdate(int256 maintenanceMargin);

    /// @notice Emitted initial margin is updated
    event IMRUpdate(int256 initialMargin);

    /// @notice emitted when funding rate operator isupdated
    event OffchainFROperatorUpdate(address provider);

    /// @notice emitted when a liquidator account pays for settling and account's pending settlement amount
    event LiquidatorPaidForAccountSettlement(
        address liquidator,
        address account,
        uint128 amount
    );

    /// @notice emitted when funding rate operator isupdated
    event DeleveragingOperatorUpdate(address operator);

    /// @notice emitted when oi open of account < settlement amount during adl trade
    event SettlementAmountNotPaidCompletely(
        address account,
        uint128 amountNotPaid
    );

    /// @notice emitted when account margin < settlement during adl trade
    event SettlementAmtDueByMaker(address account, uint128 settlementAmount);

    /// @notice emitted when global index is updated
    event GlobalIndexUpdate(int256 index, uint128 timestamp);

    //
    // ENUMS
    //
    enum Action {
        TRADE,
        ADD_MARGIN,
        REMOVE_MARGIN,
        ADJUST_LEVERAGE,
        FINAL_WITHDRAWAL
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    /// @dev Trder flag 0 for this contract
    bytes32 internal constant TRADER_ID = bytes16(uint128(0));

    /// @notice map containing every user's current position state
    mapping(address => Types.PositionBalance) internal positionBalances;

    /// @notice a map of user's local(funding rate) indexes
    mapping(address => Types.Index) internal localIndexes;

    /// @notice whitelisted account addresses that can perform trade on behalf of taker/maker
    mapping(address => bool) public settlementOperators;

    /// @notice whitlisted trade contract addresses (Liquidation.sol, Orders.sol)
    mapping(address => bool) public tradeContracts;

    /// @notice whitelisted accounts that can perfrom trade on a maker's behalf
    mapping(address => mapping(address => bool)) internal subAccounts;

    /// @notice latest system wide index used for funding rate settlements
    Types.Index public globalIndex;

    /// @notice addresses used across the cotnract
    Addresses public addresses;

    /// @notice records the time at which trading becomes active
    uint128 public tradingStartTime;

    /**
     * @notice determines whether the perpetual has been delisted or not
     * No more trades, liquidations, etc. will be supported after
     */
    bool public delisted;

    /// @notice price for delisting. All positions will be closed at this price
    uint128 public delistingPrice;

    /**
     * @notice initial margin requirement, defined as a percentage.
     * Determines the minimum margin needed to open positions and consequently
     * Determines the maximum allowed leverage
     */
    int256 public override initialMarginRequired;

    /**
     * @notice maintenance margin requirement, defined as a percentage.
     * Determines the ratio at which an account is undercollateralized.
     */
    int256 public override maintenanceMarginRequired;

    /// @notice Default taker order fee for this Perpetual
    uint128 public override defaultTakerFee;

    /// @notice Default maker order fee for this Perpetual
    uint128 public override defaultMakerFee;

    /// @notice name of the market DOT/BTC etc..
    string public marketName;

    /// @notice status of the trading as set by the Guardian
    Types.GuardianStatus private tradingStatus;

    /// @notice address of whitelisted account allowed to set offchain funding rate
    address private offchainFROperator;

    uint256[50] private __gap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    /// @notice address of operator that can execute Deleveraging trades
    address private deleveragingOperator;

    /// @notice keeps track of gas charges accrued
    uint128 public gasPoolAccruedAmt;

    /// @notice keeps track of fee accrued
    uint128 public feePoolAccruedAmt;

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * @dev Modifier to ensure the function is not run after perpetual is delisted
     */
    modifier notDelisted() {
        require(!delisted, "P1");
        _;
    }

    /**
     * @dev Modifier to ensure the function is only run after perpetual is delisted
     */
    modifier afterDelisting() {
        require(delisted, "P2");
        _;
    }

    /**
     * Throws if called by any account other than the guardian contract
     */
    modifier onlyGuardianContract() {
        require(addresses.guardian == _msgSender(), "P3");
        _;
    }

    /**
     * Throws if called by any account other than the white listed account.
     */
    modifier onlyoffchainFROperator() {
        /// @dev applied to a gas less method so using msgSender() instead of _msgSender
        require(offchainFROperator == msgSender(), "P4");
        _;
    }

    modifier onlyValidCaller(address account) {
        /**
         * @dev using msgSender() instead of _msgSender(), as the methods
         * using onlyValidCaller modifier are gasless, can be invoked by
         * a trusted relayer
         */
        require(
            account == msgSender() || subAccounts[account][msgSender()],
            "P5"
        );
        _;
    }

    /**
     * @param  _marketName          The name of the perpetual market dot/movr/btc/eth etc..
     * @param  _addresses           The address of contracts/pool to be stored in perpetual
     * @param  _trustedForwarder    The address of trusted relayer node
     * @param  _initialMargin       The initial margin to use for opening positions.
     * @param  _maintenanceMargin   The minimum allowed initial collateralization percentage.
     * @param  _defaultMakerFee     The default fee to be paid on trade by maker
     * @param  _defaultTakerFee     The default fee to be paid on trade by taker
     */
    function initialize(
        string memory _marketName,
        Addresses memory _addresses,
        address _trustedForwarder,
        int256 _initialMargin,
        int256 _maintenanceMargin,
        uint128 _defaultMakerFee,
        uint128 _defaultTakerFee
    ) public initializer {
        require(_addresses.marginMath != address(0), "P6");

        marketName = _marketName;

        addresses = _addresses;

        offchainFROperator = _msgSender();
        deleveragingOperator = _msgSender();

        globalIndex.timestamp = _blockTimestamp();

        __MetaTransaction_init(_trustedForwarder);
        __Ownable_init();
        __ReentrancyGuard_init();

        setFeePool(_addresses.feePool);
        setDefaultMakerFee(_defaultMakerFee);
        setDefaultTakerFee(_defaultTakerFee);
        setInitialMargin(_initialMargin);
        setMaintenanceMargin(_maintenanceMargin);

        emit OffchainFROperatorUpdate(offchainFROperator);
        emit DeleveragingOperatorUpdate(deleveragingOperator);
    }

    /**
     * @notice Performs one or multiple matches between two or more trading parties
     * @param  _accounts  A sorted list of traders
     * @param  _trades    A sorted list of trades to execute
     */
    function trade(
        address[] memory _accounts,
        TradeArg[] memory _trades,
        uint128 gasCharges
    ) public override notDelisted nonReentrant {
        require(
            IGuardian(addresses.guardian).isTradingAllowed(address(this)),
            "P7"
        );

        require(
            tradingStartTime > 0 && _blockTimestamp() > tradingStartTime,
            "P8"
        );

        _verifyAccounts(_accounts);

        Types.Context memory context = _loadContext(false);

        // all trades will have the same trader i.e. orders/liquidaiton/adl
        address trader = _trades[0].trader;

        // Trader must be whitlisted in tradeContracts
        require(tradeContracts[trader], "P9");

        bytes32 traderFlags = ITrader(trader).getTraderFlag();

        /// @dev the method is not gasless the caller must pay the trade fee
        address sender = _msgSender();

        // settle accounts for any pending funding payments
        Types.PositionBalance[]
            memory initialPositionBalances = _applyFundingRate(
                context,
                _accounts,
                traderFlags,
                sender
            );

        // if a normal trade is requested
        if (traderFlags == bytes32(uint256(1))) {
            require(settlementOperators[sender] == true, "P10");
        }
        // if deleveraging trade is being performed
        else if (traderFlags == bytes32(uint256(3))) {
            require(sender == deleveragingOperator, "P11");
        }

        for (uint128 i = 0; i < _trades.length; i++) {
            address maker = _accounts[_trades[i].makerIndex];
            address taker = _accounts[_trades[i].takerIndex];

            // if liquidation trade
            if (traderFlags == bytes32(uint256(2))) {
                // then liquidator must be taker of trades
                require(
                    taker == sender || getIsSubAccount(taker, sender),
                    "P12"
                );
            }

            Types.TradeResult memory tradeResult = ITrader(trader).trade(
                maker,
                taker,
                context.price,
                _trades[i].data
            );

            // Self-trade prevention; position updates aren't needed
            if (maker == taker) {
                continue;
            }

            feePoolAccruedAmt += tradeResult.makerFee + tradeResult.takerFee;

            // if a normal trade is being performed, apply gas charges if provided
            if (traderFlags == bytes32(uint256(1)) && gasCharges > 0) {
                (uint128 makerCharges, uint128 takerCharges) = IIsolatedTrader(
                    trader
                ).applyGasCharges(_trades[i].data, gasCharges, context.price);
                gasPoolAccruedAmt += makerCharges + takerCharges;
                tradeResult.makerFundsFlow += int256(uint256(makerCharges));
                tradeResult.takerFundsFlow += int256(uint256(takerCharges));
            }

            /**
             * @dev Transfer margin from bank to perpetual or perpetual to margin bank
             * depending on flow of funds. Note USDC are never moved to perpetual contract,
             * margin bank holds them
             */

            // perform (+) margin transfer before (-)
            if (tradeResult.makerFundsFlow >= 0) {
                // for maker
                _transferMargin(maker, tradeResult.makerFundsFlow);
                // for taker
                _transferMargin(taker, tradeResult.takerFundsFlow);
            } else {
                // for taker
                _transferMargin(taker, tradeResult.takerFundsFlow);
                // for maker
                _transferMargin(maker, tradeResult.makerFundsFlow);
            }

            // update position balance
            positionBalances[maker] = tradeResult.makerBalance;
            positionBalances[taker] = tradeResult.takerBalance;

            emit AccountPositionUpdate(
                maker,
                sender,
                tradeResult.makerBalance,
                Action.TRADE,
                globalIndex.value,
                _blockTimestamp()
            );

            emit AccountPositionUpdate(
                taker,
                sender,
                tradeResult.takerBalance,
                Action.TRADE,
                globalIndex.value,
                _blockTimestamp()
            );

            emit TradeExecuted(
                trader,
                maker,
                taker,
                tradeResult.makerHash,
                tradeResult.takerHash,
                tradeResult.makerBalance.mro,
                tradeResult.takerBalance.mro,
                tradeResult.makerFee,
                tradeResult.takerFee,
                tradeResult.makerPnl,
                tradeResult.takerPnl,
                tradeResult.tradeQuantity,
                tradeResult.price,
                tradeResult.isBuy, // from the perspective of taker
                _blockTimestamp()
            );
        }

        // @dev if liquidaiton trade, maker and taker hashes returned are empty
        _verifyAccountState(
            context,
            _accounts,
            initialPositionBalances,
            traderFlags
        );
    }

    /**
     * @notice Allows caller to add margin to an account's position
     * @param _account address of the account to add margin to
     * @param _amount amount of margin to be added
     */
    function addMargin(address _account, uint128 _amount)
        public
        onlyValidCaller(_account)
        notDelisted
        nonReentrant
    {
        require(_amount > 0, "P13");

        require(positionBalances[_account].qPos > 0, "P14");

        Types.Context memory context = _loadContext(false);

        // transfer margin to perpetual address
        IMarginBank(addresses.marginBank).transferMarginToAccount(
            _account,
            address(this),
            _amount
        );

        // update margin of user in storage
        positionBalances[_account].margin += _amount;

        // apply funding rate
        // user must add enough funding rate that can pay for its all settlement dues
        _applyFundRateToAccount(context, _account, TRADER_ID, msgSender());

        emit AccountPositionUpdate(
            _account,
            msgSender(),
            positionBalances[_account],
            Action.ADD_MARGIN,
            globalIndex.value,
            _blockTimestamp()
        );
    }

    /**
     * @notice Allows caller to add remove margin from an account's position
     * @param _account address of the account to remove margin from
     * @param _amount amount of margin to be removed
     */
    function removeMargin(address _account, uint128 _amount)
        public
        onlyValidCaller(_account)
        notDelisted
        nonReentrant
    {
        require(_amount > 0, "P15");

        Types.Context memory context = _loadContext(false);

        // get initial position balance
        Types.PositionBalance memory positionBalance = positionBalances[
            _account
        ];

        // compute max removable margin over here:
        uint128 maxRemovableAmount = IMarginMath(addresses.marginMath)
            .getMaxRemoveableMargin(positionBalance, context.price);

        require(_amount <= maxRemovableAmount, "P16");

        // transfer margin from perpetual address to acccount
        IMarginBank(addresses.marginBank).transferMarginToAccount(
            address(this),
            _account,
            _amount
        );

        // update margin of user in storage
        positionBalances[_account].margin -= _amount;

        // apply funding rate
        _applyFundRateToAccount(context, _account, TRADER_ID, msgSender());

        // verify that imr/mmr checks still hold
        _verifyMarginRatioForAccount(
            _account,
            positionBalance,
            context.price,
            TRADER_ID
        );

        emit AccountPositionUpdate(
            _account,
            msgSender(),
            positionBalances[_account],
            Action.REMOVE_MARGIN,
            globalIndex.value,
            _blockTimestamp()
        );
    }

    /**
     * @notice Allows caller to adjust/change leverage of an account's position
     * @param _account address of the account for which to adjust leverage
     * @param _leverage updated leverage to be set
     */
    function adjustLeverage(address _account, uint128 _leverage)
        public
        onlyValidCaller(_account)
        notDelisted
        nonReentrant
    {
        // get precise(whole number) leverage 1, 2, 3...n
        _leverage = (_leverage / BaseMath.baseUInt()) * BaseMath.baseUInt();

        require(_leverage > 0, "P17");

        Types.Context memory context = _loadContext(false);

        // apply funding rate and get updated position Balance
        Types.PositionBalance memory positionBalance = _applyFundRateToAccount(
            context,
            _account,
            TRADER_ID,
            msgSender()
        );

        uint128 targetMargin = IMarginMath(addresses.marginMath)
            .getTargetMargin(positionBalance, _leverage, context.price);

        // if user position has more margin than required for leverage, move extra margin back to bank
        if (positionBalance.margin > targetMargin) {
            // will revert it perpetual does not have funds. Will only happen if perpetual is not net zero
            IMarginBank(addresses.marginBank).transferMarginToAccount(
                address(this),
                _account,
                positionBalance.margin - targetMargin
            );
        }
        // if user position has < margin than required target margin, move required margin from bank to perpetual
        else if (positionBalance.margin < targetMargin) {
            // this will revert if user does not have enough free collateral / margin in bank
            IMarginBank(addresses.marginBank).transferMarginToAccount(
                _account,
                address(this),
                targetMargin - positionBalance.margin
            );
        }

        // update mro to target leverage
        positionBalances[_account].mro = BaseMath.baseUInt().baseDiv(_leverage);
        // update margin to be target margin
        positionBalances[_account].margin = targetMargin;

        // verify oi open
        IEvaluator(addresses.evaluator).verifyOIOpenForAccount(
            _account,
            positionBalances[_account]
        );

        // verify that imr/mmr checks still hold
        _verifyMarginRatioForAccount(
            _account,
            positionBalance,
            context.price,
            TRADER_ID
        );

        emit AccountPositionUpdate(
            _account,
            msgSender(),
            positionBalances[_account],
            Action.ADJUST_LEVERAGE,
            globalIndex.value,
            _blockTimestamp()
        );
    }

    /**
     * @notice Withdraw the number of margin tokens equal to the value of the account at the time
     *  perpetual was delisted. A position can only be closed once.
     * @param _account the address of account for which to close position
     */
    function closePosition(address _account)
        external
        override
        onlyValidCaller(_account)
        afterDelisting
        nonReentrant
    {
        require(positionBalances[_account].qPos > 0, "P18");

        Types.Context memory context = _loadContext(false);

        // Apply the funding rate to account
        Types.PositionBalance memory balance = _applyFundRateToAccount(
            context,
            _account,
            TRADER_ID,
            msgSender()
        );

        uint128 perpBalance = IMarginBank(addresses.marginBank)
            .getAccountBankBalance(address(this)) -
            feePoolAccruedAmt -
            gasPoolAccruedAmt;

        /// @dev get margin to be returned to user
        uint128 marginLeft = IMarginMath(addresses.marginMath).getMarginLeft(
            balance,
            delistingPrice,
            perpBalance
        );

        // set user position to zero
        positionBalances[_account].qPos = 0;

        // transfer margin to user account
        IMarginBank(addresses.marginBank).transferMarginToAccount(
            address(this),
            _account,
            marginLeft
        );

        emit PositionClosed(_account, marginLeft, _blockTimestamp());

        emit AccountPositionUpdate(
            _account,
            msgSender(),
            positionBalances[_account],
            Action.FINAL_WITHDRAWAL,
            globalIndex.value,
            _blockTimestamp()
        );
    }

    /**
     * @notice Delists the perpetual if the oracle price is between the provided bounds.
     * Once delisted, users can close their open position using closePosition()
     * @dev The current result of the price oracle must be between the two bounds supplied.
     * @param  _priceLowerBound  The lower-bound (inclusive) of the acceptable price range.
     * @param  _priceUpperBound  The upper-bound (inclusive) of the acceptable price range.
     */
    function delistPerpetual(uint128 _priceLowerBound, uint128 _priceUpperBound)
        external
        onlyOwner
        notDelisted
        nonReentrant
    {
        // Update the Global Index and grab the Price.
        Types.Context memory context = _loadContext(false);

        // Check price bounds.
        require(context.price >= _priceLowerBound, "P19");
        require(context.price <= _priceUpperBound, "P20");

        delistingPrice = context.price;
        delisted = true;

        emit PerpetualDelisted(delistingPrice);
    }

    //===========================================================//
    //                          SETTERS
    //===========================================================//

    /**
     * @notice Sets a new contract address for the price oracle
     * @param  _oracle  The new contract address for the price oracle
     */
    function setOracle(address _oracle) external onlyOwner nonReentrant {
        (, int256 price, , , ) = IPriceOracle(_oracle).latestRoundData();
        require(price != 0, "P21");
        addresses.oracle = _oracle;
        emit PriceOracleUpdate(_oracle);
    }

    /**
     * @notice Sets a new funder contract.
     * @param  _funder  The address of the new funder contract.
     */
    function setFunder(address _funder) external onlyOwner nonReentrant {
        // TODO implement EIP165
        addresses.funder = _funder;
        emit FundingOracleUpdate(_funder);
    }

    /**
     * @notice Sets a new Fee Pool contract.
     * @param  _feePool  The address of the new funder contract.
     */
    function setFeePool(address _feePool)
        public
        override
        onlyOwner
        nonReentrant
    {
        require(_feePool != address(0), "P22");
        addresses.feePool = _feePool;
        emit FeePoolUpdate(_feePool);
    }

    /**
     * @notice Updates status of trading for this market
     * @param _newStatus status of trading for this market. If not allowed then no new trades can be placed
     */
    function setTradingStatus(Types.GuardianStatus _newStatus)
        external
        override
        onlyGuardianContract
        nonReentrant
    {
        tradingStatus = _newStatus;
    }

    /**
     * @notice Enable trading on the Perpetual.
     * @param _startingTime the timestamp at which trading will start
     */
    function startTrading(uint128 _startingTime)
        external
        onlyOwner
        nonReentrant
    {
        require(tradingStartTime == 0, "P23");
        require(_startingTime > _blockTimestamp(), "P24");

        IFundingOracle(addresses.funder).startFunding(_startingTime);

        tradingStartTime = _startingTime;

        emit TradingStarted(tradingStartTime);
    }

    /**
     * @notice Disable trading on the Perpetual.
     * @dev only admin can invoke this
     */
    function stopTrading() external onlyOwner nonReentrant {
        tradingStartTime = 0;
        IFundingOracle(addresses.funder).stopFunding();
        emit TradingStopped(_blockTimestamp());
    }

    /**
     * @notice Grants or revokes permission for another account to perform certain actions on behalf
     *  of the sender.
     * @param  _operator  The account that is approved or disapproved.
     * @param  _approved  True for approval, false for disapproval.
     */
    function setSubAccount(address _operator, bool _approved)
        external
        override
    {
        subAccounts[_msgSender()][_operator] = _approved;
        emit SubAccountUpdate(_msgSender(), _operator, _approved);
    }

    /**
     * @notice Add or remove a Settlement Operator address.
     * @dev Must be called by the Perpetual admin. Emits the SettlementOperatorUpdate event.
     *
     * @param  _operator  The address for which to enable or disable Settlement operator privileges.
     * @param  _approved  True if approved, false if disapproved.
     */
    function setSettlementOperator(address _operator, bool _approved)
        external
        onlyOwner
        nonReentrant
    {
        settlementOperators[_operator] = _approved;
        emit SettlementOperatorUpdate(_operator, _approved);
    }

    /**
     * @notice sets offchain funding rate operator
     * @param _newOperator address of new funding rate operator
     */
    function setOffChainFROperator(address _newOperator)
        external
        onlyOwner
        nonReentrant
    {
        offchainFROperator = _newOperator;
        emit OffchainFROperatorUpdate(offchainFROperator);
    }

    /**
     * @notice sets Deleveraging Operator
     * @param _newOperator address of new deleveraging operator
     */
    function setDeleveragingOperator(address _newOperator)
        external
        onlyOwner
        nonReentrant
    {
        deleveragingOperator = _newOperator;
        emit DeleveragingOperatorUpdate(deleveragingOperator);
    }

    /**
     * @notice Add or remove a Trader contract address.
     * @param  _trader  The address of contract.
     * @param  _approved  True if approved, false if disapproved.
     */
    function setTradeContract(address _trader, bool _approved)
        external
        onlyOwner
        nonReentrant
    {
        //TODO implement EIP165
        tradeContracts[_trader] = _approved;
        emit TradeContractUpdate(_trader, _approved);
    }

    /**
     * @notice Sets a new value for the market trade fee percentage.
     * @param  _defaultTakerFee  The new value of the market trade fee percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setDefaultTakerFee(uint128 _defaultTakerFee)
        public
        override
        onlyOwner
        nonReentrant
    {
        // validate if fee is always less than or equal to 25%
        require(_defaultTakerFee <= 0.25e18, "P25");
        defaultTakerFee = _defaultTakerFee;
        emit DefaultTakerFeeUpdate(_defaultTakerFee);
    }

    /**
     * @notice Sets a new value for the limit trade fee percentage.
     * @param  _defaultMakerFee  The new value of the limit trade fee percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setDefaultMakerFee(uint128 _defaultMakerFee)
        public
        override
        onlyOwner
        nonReentrant
    {
        // validate if fee is always less than or equal to 25%
        require(_defaultMakerFee <= 0.25e18, "P26");
        defaultMakerFee = _defaultMakerFee;
        emit DefaultMakerFeeUpdate(_defaultMakerFee);
    }

    /**
     * @notice allows caller to set funding rate.
     * @dev updates global index based on last funding rate, before updating funding rate
     */
    function setFundingRate() external nonReentrant {
        // update global index based on last funding rate
        _loadContext(true);

        // Set funding rate
        IFundingOracle(addresses.funder).setFundingRate();
    }

    /**
     * @notice allows caller to set funding rate.
     * @dev updates global index based on last funding rate, before updating funding rate
     * @param offchainFundingRate the value of funding rate in percentage to be set
     */
    function setOffChainFundingRate(int256 offchainFundingRate)
        external
        onlyoffchainFROperator
        nonReentrant
    {
        // update global index based on last funding rate
        _loadContext(true);

        // Set funding rate
        IFundingOracle(addresses.funder).setOffChainFundingRate(
            offchainFundingRate
        );
    }

    /**
     * @notice Sets a new value for the minimum collateralization percentage.
     * @param  _maintenanceMargin  The new value of the minimum initial collateralization percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setMaintenanceMargin(int256 _maintenanceMargin)
        public
        onlyOwner
        nonReentrant
    {
        require(_maintenanceMargin > 0, "P27");
        require(_maintenanceMargin <= initialMarginRequired, "P28");

        maintenanceMarginRequired = _maintenanceMargin;

        emit MMRUpdate(_maintenanceMargin);
    }

    /**
     * @notice Sets a new value for the initial margin collateralization percentage.
     * @param  _initialMargin  The new value of the initial margin collateralization percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setInitialMargin(int256 _initialMargin)
        public
        onlyOwner
        nonReentrant
    {
        require(_initialMargin > 0, "P29");
        require(_initialMargin >= maintenanceMarginRequired, "P30");

        initialMarginRequired = _initialMargin;
        emit IMRUpdate(_initialMargin);
    }

    /**
     * @notice Transfers all accured fee from perpetual to fee pool
     */
    function transferAccruedFee() public onlyOwner nonReentrant {
        // transfer fee of trade to fee pool
        IMarginBank(addresses.marginBank).transferMarginToAccount(
            address(this),
            addresses.feePool,
            feePoolAccruedAmt
        );

        // reset fee amount accrued
        feePoolAccruedAmt = 0;
    }

    /**
     * @notice Transfers all accured gas from perpetual to provided pool
     * @param pool address of pool where to transfer gas charges
     * @dev the perpetual contract is not aware about gas pool address hence taken as input from admin
     */
    function transferAccruedGas(address pool) public onlyOwner nonReentrant {
        // transfer gas charges accrued from perp to provided pool
        IMarginBank(addresses.marginBank).transferMarginToAccount(
            address(this),
            pool,
            gasPoolAccruedAmt
        );

        gasPoolAccruedAmt = 0;
    }

    //===========================================================//
    //                          GETTERS
    //===========================================================//

    /**
     * @notice Get the balance of an account, without accounting for changes in the index.
     *
     * @param  account  The address of the account to query the balances of.
     * @return          The balances of the account.
     */
    function getAccountBalance(address account)
        external
        view
        override
        returns (Types.PositionBalance memory)
    {
        return positionBalances[account];
    }

    /**
     * @notice Gets the sub account status of an operator for a particular account.
     *
     * @param  account   The account to query the operator for.
     * @param  operator  The address of the operator to query the status of.
     * @return           True if the operator is a sub account of the account, false otherwise.
     */
    function getIsSubAccount(address account, address operator)
        public
        view
        override
        returns (bool)
    {
        return subAccounts[account][operator];
    }

    /**
     * @notice Gets the local index of account, used to compute and apply pending funding rate.
     *
     * @param  account   The account to query the operator for.
     * @return           Index local index of account.
     */
    function getLocalIndex(address account)
        external
        view
        returns (Types.Index memory)
    {
        return localIndexes[account];
    }

    /**
     * Returns true if trading is allowed for this market else false
     */
    function isTradingAllowed() external view override returns (bool) {
        return tradingStatus == Types.GuardianStatus.ALLOWED;
    }

    //===========================================================//
    //                      INTERNAL METHODS
    //===========================================================//

    function _transferMargin(address account, int256 fundsFlow) internal {
        (address src, address dest) = fundsFlow < 0
            ? (address(this), account)
            : (account, address(this));

        IMarginBank(addresses.marginBank).transferMarginToAccount(
            src,
            dest,
            BaseMath.absolute(fundsFlow)
        );
    }

    /**
     * @dev returns the context contaning current oracle price, funding rate and global index
     * @param updateGlobalIndex a boolean indicating if new global index is to be computed
     */
    function _loadContext(bool updateGlobalIndex)
        internal
        returns (Types.Context memory)
    {
        // load old index
        Types.Index memory index = globalIndex;

        // get Price (P)
        (, int256 price, , , ) = IPriceOracle(addresses.oracle)
            .latestRoundData();
        price = price * 1e10; // chainlink returns price in 1e^8

        uint128 timeDelta = _blockTimestamp() - index.timestamp;

        int256 fundingRate = IFundingOracle(addresses.funder).getFundingRate();

        if (timeDelta > 0 && updateGlobalIndex) {
            int256 fundingValue = (fundingRate * int256(int128(timeDelta)))
                .baseMul(int256(int128(price)));

            // Update the index according to the funding rate, applied over the time delta.
            index.value = index.value + fundingValue;
            // update index timestamp
            index.timestamp = _blockTimestamp();

            globalIndex = index;

            emit GlobalIndexUpdate(globalIndex.value, index.timestamp);
        }

        return
            Types.Context({
                price: uint128(int128(price)),
                fundingRate: fundingRate,
                index: index
            });
    }

    /**
     * @dev Verify that `accounts` contains at least one address and that the contents are unique.
     *  We verify uniqueness by requiring that the array is sorted.
     */
    function _verifyAccounts(address[] memory accounts) private pure {
        require(accounts.length > 0, "P31");

        // Require accounts to be unique and sorted
        address prevAccount = accounts[0];
        for (uint128 i = 1; i < accounts.length; i++) {
            address account = accounts[i];
            require(account > prevAccount, "P32");
            prevAccount = account;
        }
    }

    /**
     * @dev Given a list of accounts, apply funding and return resulting balances
     */
    function _applyFundingRate(
        Types.Context memory context,
        address[] memory accounts,
        bytes32 traderFlags,
        address caller
    ) internal returns (Types.PositionBalance[] memory) {
        uint8 numAccounts = uint8(accounts.length); // typecast as accounts.length is in 256 bits

        Types.PositionBalance[] memory result = new Types.PositionBalance[](
            numAccounts
        );

        for (uint8 i = 0; i < numAccounts; i++) {
            result[i] = _applyFundRateToAccount(
                context,
                accounts[i],
                traderFlags,
                caller
            );
        }

        return result;
    }

    /**
     * @dev Given a single accounts, apply funding and return resulting balance
     */
    function _applyFundRateToAccount(
        Types.Context memory context,
        address account,
        bytes32 traderFlags,
        address caller
    ) internal returns (Types.PositionBalance memory) {
        Types.Index memory newIndex = context.index;

        Types.Index memory oldIndex = localIndexes[account];

        Types.PositionBalance memory balance = positionBalances[account];

        // Cache this account's index
        localIndexes[account] = newIndex;

        // If timestamp didn't change, index doesn't change
        if (oldIndex.timestamp == newIndex.timestamp || balance.qPos == 0) {
            return balance;
        }

        // Considering position direction, compute the correct difference between indices
        int256 indexDiff = balance.isPosPositive
            ? oldIndex.value - newIndex.value // for long: local - global
            : newIndex.value - oldIndex.value; // for short: global - local

        // Apply the funding payment as the difference of indices scaled by position quantity
        // To avoid capital leakage due to rounding errors, round debits up and credits down
        uint128 settlementAmount;

        if (indexDiff > 0) {
            settlementAmount = indexDiff.absolute().baseMul(balance.qPos);
            balance.margin += settlementAmount;
        } else {
            settlementAmount = indexDiff.absolute().baseMulRoundUp(
                balance.qPos
            );

            // if margin is being updated, leverage is being adjusted or a
            // a normal trade is being performed, ensure that user has margin
            // to putup for pending settlement amount
            if (
                traderFlags == bytes32(uint256(0)) ||
                traderFlags == bytes32(uint256(1))
            ) {
                Require.that(
                    balance.margin >= settlementAmount,
                    "P33",
                    account
                );
            }
            // if liquidation is being performed
            else if (traderFlags == bytes32(uint256(2))) {
                // and the user has not enough margin to pay for settlement
                if (balance.margin < settlementAmount) {
                    // the liquidator collateralized the position to pay for settlement amount
                    uint128 mrl = settlementAmount - balance.margin;
                    IMarginBank(addresses.marginBank).transferMarginToAccount(
                        caller,
                        address(this),
                        mrl
                    );
                    emit LiquidatorPaidForAccountSettlement(
                        caller,
                        account,
                        mrl
                    );
                    settlementAmount -= mrl;
                }
            }
            // a deleveraging trade is being performed
            else {
                // and the user has not enough margin to pay for settlement
                if (balance.margin < settlementAmount) {
                    // Don't settle the funding against perpetual for the maker.
                    // modifying it this way will make the contract solvent because the taker
                    // will ADL at a worse price than the bankruptcy price, leaving the money
                    // to keep the contract solvent due to maker's negative funding due
                    // in the contract.
                    if (balance.isPosPositive) {
                        balance.oiOpen = balance.oiOpen + settlementAmount;
                    } else {
                        if (settlementAmount > balance.oiOpen) {
                            balance.oiOpen = 0;
                            emit SettlementAmountNotPaidCompletely(
                                account,
                                settlementAmount - balance.oiOpen
                            );
                        } else {
                            balance.oiOpen = balance.oiOpen - settlementAmount;
                        }
                    }
                    emit SettlementAmtDueByMaker(account, settlementAmount);
                    settlementAmount = 0;
                }
            }
            balance.margin -= settlementAmount;
        }

        positionBalances[account] = balance;

        emit AccountSettlementUpdate(
            account,
            balance,
            indexDiff > 0,
            settlementAmount,
            context.price,
            context.fundingRate,
            _blockTimestamp()
        );

        return balance;
    }

    function _verifyAccountState(
        Types.Context memory context,
        address[] memory accounts,
        Types.PositionBalance[] memory initialPositionBalances,
        bytes32 traderFlags
    ) private view {
        for (uint128 i = 0; i < accounts.length; i++) {
            Types.PositionBalance
                memory initialBalance = initialPositionBalances[i];

            _verifyMarginRatioForAccount(
                accounts[i],
                initialBalance,
                context.price,
                traderFlags
            );
        }
    }

    function _verifyMarginRatioForAccount(
        address account,
        Types.PositionBalance memory initialBalance,
        uint128 price,
        bytes32 traderFlags
    ) internal view {
        Types.PositionBalance memory currentBalance = positionBalances[account];

        int256 oldMarginRatio = initialBalance.getMarginRatio(price);
        int256 curMarginRatio = currentBalance.getMarginRatio(price);

        // Case 0: Current Margin Ratio >= IMR: User can increase and reduce positions.
        if (curMarginRatio >= initialMarginRequired) {
            return;
        }

        // Case I: For MR < IMR: If flipping or new trade, current ratio can only be >= IMR
        Require.that(
            currentBalance.isPosPositive == initialBalance.isPosPositive &&
                initialBalance.qPos > 0,
            "P34",
            account
        );

        // Case II: For MR < IMR: require MR to have improved or stayed the same
        Require.that(curMarginRatio >= oldMarginRatio, "P35", account);

        // Case III: For MR <= MMR require qPos to go down or stay the same
        Require.that(
            curMarginRatio > maintenanceMarginRequired ||
                (initialBalance.qPos >= currentBalance.qPos &&
                    initialBalance.isPosPositive ==
                    currentBalance.isPosPositive),
            "P36",
            account
        );

        // Case IV: For MR < 0 require that it’s a liquidation
        // @dev Orders.sol flag = bytes32(uint128(1))
        // @dev Liquidaiton.sol flag = bytes32(uint128(2))
        Require.that(
            curMarginRatio >= 0 ||
                traderFlags == bytes32(uint256(2)) ||
                traderFlags == bytes32(uint256(3)),
            "P37",
            account
        );
    }
}
