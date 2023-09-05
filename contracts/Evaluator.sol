// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

//utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";

// interfaces
import {IEvaluator} from "./interfaces/IEvaluator.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";
import {PositionBalanceMath} from "./maths/PositionBalanceMath.sol";

// libraries
import {Types} from "./libraries/Types.sol";
import {Require} from "./libraries/Require.sol";

/**
 * @title Evaluator
 * @author Team Bluefin <engineering@bluefin.io>
 * @notice Stores perpetual configurations and evaluates if a trade is allowed to be executed based on perpetual configurations.
 * Houses the variables needed to perform pre-trade checks for price, quantity and max allowed open interest.
 * Implements IEvalautor interface to allow contracts to acccess these variables
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract Evaluator is IEvaluator, FFLYFiOwnableUpgrade {
    using BaseMath for uint128;
    using PositionBalanceMath for Types.PositionBalance;

    //
    // EVENTS
    //

    /// @notice Emitted when min price is set
    event MinOrderPriceUpdate(uint128 newPrice);

    /// @notice Emitted when max price is set
    event MaxOrderPriceUpdate(uint128 newPrice);

    /// @notice Emitted when tick size is set
    event TickSizeUpdate(uint128 newSize);

    /// @notice Emitted when min quantityis set
    event MinQuantityUpdate(uint128 newQuantity);

    /// @notice Emitted when max limit quantity is set
    event MaxQuantityLimitUpdate(uint128 newQuantity);

    /// @notice Emitted when max market quantity is set
    event MaxQuantityMarketUpdate(uint128 newQuantity);

    /// @notice Emitted when market take bound long is set
    event MTBLongUpdate(uint128 newValue);

    /// @notice Emitted market take bound short is set
    event MTBShortUpdate(uint128 newValue);

    /// @notice Emitted when step size is set
    event StepSizeUpdate(uint128 newSize);

    /// @notice Emitted when max oi open for leverage is set
    event MaxOIOpenUpdate(uint128 leverage, uint128 maxAllowedOIOpen);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    /// @notice minimum price at which asset can be traded
    uint128 public override minPrice;

    /// @notice maximum price at which asset can be traded
    uint128 public override maxPrice;

    /// @notice the smallest decimal unit supported by asset for price
    uint128 public override tickSize;

    /// @notice minimum quantity of asset that can be traded
    uint128 public override minQty;

    /// @notice maximum quantity of asset that can be traded for limit order
    uint128 public override maxQtyLimit;

    /// @notice maximum quantity of asset that can be traded for market order
    uint128 public override maxQtyMarket;

    /// @notice the smallest decimal unit supported by asset for quantity
    uint128 public override stepSize;

    /// @notice market take bound for long side
    /// @dev ( 10% == 100000000000000000)
    uint128 public override mtbLong;

    /// @notice market take bound for short side
    /// @dev ( 10% == 100000000000000000)
    uint128 public override mtbShort;

    /// @notice mapping of leverage to max allowed oi open for the leverage
    /// @dev leverage is represented in 18 decimal units
    mapping(uint128 => uint128) public override maxAllowedOIOpen;

    uint256[50] private __gap;

    uint128 internal constant HALF_BASE_UINT = 5 * 10**17;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * @notice initializes the contract
     * @param _minOrderPrice min price at which order can be executed
     * @param _maxOrderPrice max price at which order can be executed
     * @param _tickSize tick size for price
     * @param _minTradeQty minimum order quantity
     * @param _maxTradeQtyLimit maximum limit order quantity
     * @param _maxTradeQtyMarket maximum market order quantity
     * @param _stepSize step size for quantity
     * @param _mtbLong market take bound for long side
     * @param _mtbShort market take bound for short side
     */
    function initialize(
        uint128 _minOrderPrice,
        uint128 _maxOrderPrice,
        uint128 _tickSize,
        uint128 _minTradeQty,
        uint128 _maxTradeQtyLimit,
        uint128 _maxTradeQtyMarket,
        uint128 _stepSize,
        uint128 _mtbLong,
        uint128 _mtbShort,
        uint128[] calldata _maxOIOpen
    ) public initializer {
        require(_minOrderPrice > 0, "Minimum order price must be > 0");
        require(
            _minOrderPrice < _maxOrderPrice,
            "Minimum order price must be <  maximum order price"
        );
        require(
            _minTradeQty < _maxTradeQtyLimit &&
                _minTradeQty < _maxTradeQtyMarket,
            "Minimum trade quantity must be < max trade quantity"
        );
        require(_minTradeQty > 0, "Minimum trade quantity must be > 0");
        require(_tickSize > 0, "Tick size must be > 0");
        require(_stepSize > 0, "Step size must be > 0");
        require(
            _mtbLong > 0 && _mtbShort > 0,
            "Take bounds must be > 0 for both sides"
        );

        /// @dev updating price variables
        minPrice = _minOrderPrice;
        maxPrice = _maxOrderPrice;
        tickSize = _tickSize;

        /// @dev updating size/qty vairables
        minQty = _minTradeQty;
        maxQtyLimit = _maxTradeQtyLimit;
        maxQtyMarket = _maxTradeQtyMarket;
        stepSize = _stepSize;

        /// @dev updating market take bound
        mtbLong = _mtbLong;
        mtbShort = _mtbShort;

        /// @dev updating max oi open
        uint128 leverage = BaseMath.baseUInt();
        for (uint128 i = 0; i < _maxOIOpen.length; i++) {
            maxAllowedOIOpen[leverage] = _maxOIOpen[i];
            emit MaxOIOpenUpdate(leverage, maxAllowedOIOpen[leverage]);
            leverage = leverage + BaseMath.baseUInt();
        }

        __Ownable_init();
        __ReentrancyGuard_init();

        emit MinOrderPriceUpdate(_minOrderPrice);
        emit MaxOrderPriceUpdate(_maxOrderPrice);
        emit TickSizeUpdate(tickSize);
        emit MinQuantityUpdate(_minTradeQty);
        emit MaxQuantityLimitUpdate(_maxTradeQtyLimit);
        emit MaxQuantityMarketUpdate(_maxTradeQtyMarket);
        emit StepSizeUpdate(_stepSize);
        emit MTBLongUpdate(_mtbLong);
        emit MTBShortUpdate(_mtbShort);
    }

    //===========================================================//
    //                  Checks Verification Methods
    //===========================================================//

    /**
     * @dev verifies if the trade quantity conforms to min/max quantity and step size
     * @param _tradeQuantity the quantity of trade
     */
    function verifyQuantityChecks(uint128 _tradeQuantity, address _maker)
        public
        view
        override
    {
        verifyMinMaxQuantityChecks(_tradeQuantity, _maker);

        require(
            _tradeQuantity % stepSize == 0,
            "Trade quantity does not conforms to allowed step size"
        );
    }

    /**
     * @dev verifies if the trade price conforms to min max quantity checks
     * @param _tradeQuantity the quantity of trade
     */
    function verifyMinMaxQuantityChecks(uint128 _tradeQuantity, address _maker)
        public
        view
        override
    {
        Require.that(
            _tradeQuantity >= minQty,
            "Trade quantity is < min tradeable quantity",
            _maker
        );
        Require.that(
            _tradeQuantity <= maxQtyLimit,
            "Trade quantity is > max allowed limit quantity",
            _maker
        );
        Require.that(
            _tradeQuantity <= maxQtyMarket,
            "Trade quantity is > max allowed market quantity",
            _maker
        );
    }

    /**
     * @dev verifies if the trade price conforms to min/max price and tick size
     * @param _price the price of trade
     */
    function verifyPriceChecks(uint128 _price, address _maker)
        public
        view
        override
    {
        verifyMinMaxPriceChecks(_price, _maker);
        require(
            _price % tickSize == 0,
            "Trade price does not conforms to allowed tick size"
        );
    }

    /**
     * @dev verifies if the trade price conforms to min max price checks
     * @param _price the price of trade
     */
    function verifyMinMaxPriceChecks(uint128 _price, address _maker)
        public
        view
        override
    {
        Require.that(
            _price >= minPrice,
            "Trade price is < min allowed price",
            _maker
        );
        Require.that(
            _price <= maxPrice,
            "Trade price is > max allowed price",
            _maker
        );
    }

    /**
     * @dev verifies if the trade price for both long and short
     * parties confirms to market take bound checks
     * @param _tradePrice the price of trade
     * @param _oraclePrice the price of oracle
     * @param _isBuy from takers perspective
     * @param _taker address of taker
     */
    function verifyMarketTakeBoundChecks(
        uint128 _tradePrice,
        uint128 _oraclePrice,
        bool _isBuy,
        address _taker
    ) public view override {
        if (_isBuy) {
            Require.that(
                _tradePrice <= (_oraclePrice + _oraclePrice.baseMul(mtbLong)),
                "Trade price is > Market Take Bound for long side",
                _taker
            );
        } else {
            Require.that(
                _tradePrice >= (_oraclePrice - _oraclePrice.baseMul(mtbShort)),
                "Trade price is < Market Take Bound for short side",
                _taker
            );
        }
    }

    /**
     * @dev verifies if the provided account has oi open <= maximum allowed oi open for current leverage
     * @param _account address of account
     * @param _balance Position balance of the account
     */
    function verifyOIOpenForAccount(
        address _account,
        Types.PositionBalance memory _balance
    ) public view override {
        // convert mro to leverage (1/mro)
        uint128 leverage = BaseMath.baseUInt().baseDiv(_balance.mro);

        uint128 remainder = leverage % BaseMath.baseUInt();

        if (remainder > HALF_BASE_UINT) {
            leverage = BaseMath.ceil(leverage, BaseMath.baseUInt());
        } else {
            leverage = (leverage / BaseMath.baseUInt()) * BaseMath.baseUInt();
        }

        Require.that(
            // no max oi open specified for the leverage
            maxAllowedOIOpen[leverage] == 0 ||
                // or oi open is <= specified max allowed oi open
                _balance.oiOpen <= maxAllowedOIOpen[leverage],
            "OI open for selected leverage > max allowed oi open",
            _account
        );
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    /**
     * @notice Changes minimum trade price to the provided one
     * @param _price  The new minimum trade price
     */
    function setMinOrderPrice(uint128 _price) public onlyOwner {
        require(_price > 0, "Minimum order price must be > 0");
        require(
            _price < maxPrice,
            "Minimum trade price must be < maximum trade price"
        );
        minPrice = _price;
        emit MinOrderPriceUpdate(_price);
    }

    /**
     * @notice Changes minimum trade price to the provided one
     * @param _price  The new minimum trade price
     */
    function setMaxOrderPrice(uint128 _price) public onlyOwner {
        require(
            _price > minPrice,
            "Maximum trade price must be > min trade price"
        );
        maxPrice = _price;
        emit MaxOrderPriceUpdate(_price);
    }

    /**
     * @notice Changes Tick Size to the provided one
     * @dev the size is represented in 18 decimals
     * 1 tick size is represented as 1 * 1e18, implying no decimals are allowed
     * 0.01 tick size is represented as  0.01 * 1e18, implying two decimal points are allowed
     * @param _size The new tick size
     */
    function setTickSize(uint128 _size) public onlyOwner {
        require(_size > 0, "Tick Size Must be > 0");
        tickSize = _size;
        emit TickSizeUpdate(_size);
    }

    /**
     * @notice Changes Minimum Quantity to the provided one
     * @param _quantity  The new minimum quantity
     */
    function setMinQty(uint128 _quantity) public onlyOwner {
        require(
            _quantity < maxQtyLimit && _quantity < maxQtyMarket,
            "Minimum trade quantity must be < max trade quantity"
        );
        require(_quantity > 0, "Minimum trade quantity must be > 0");
        minQty = _quantity;
        emit MinQuantityUpdate(_quantity);
    }

    /**
     * @notice Changes Maximum Limit Quantity to the provided one
     * @param _quantity The new maximum Limit Quantity
     */
    function setMaxQtyLimit(uint128 _quantity) public onlyOwner {
        require(
            _quantity > minQty,
            "Maximum Limit Trade quantity must be > minimum trade quantity"
        );
        maxQtyLimit = _quantity;
        emit MaxQuantityLimitUpdate(_quantity);
    }

    /**
     * @notice Changes Maximum Market Quantity to the provided one
     * @param _quantity The new maximum Marktet Quantity
     */
    function setMaxQtyMarket(uint128 _quantity) public onlyOwner {
        require(
            _quantity > minQty,
            "Maximum Market Trade quantity must be > minimum trade quantity"
        );
        maxQtyMarket = _quantity;
        emit MaxQuantityMarketUpdate(_quantity);
    }

    /**
     * @notice Changes Step Size to the provided one
     * @dev 1 size is represented as 1 * 1e18, implying no decimals are allowed
     * 0.01 size is represented as  0.01 * 1e18, implying two decimal points are allowed
     * @param _size The new Step size
     */
    function setStepSize(uint128 _size) public onlyOwner {
        require(_size > 0, "Step Size must be > 0");
        stepSize = _size;
        emit StepSizeUpdate(_size);
    }

    /**
     * @notice Changes Market Take Bound for Long Trades to the provided one
     * @param _value The new long market bound value
     */
    function setMTBLong(uint128 _value) public onlyOwner {
        require(_value > 0, "Market Take Bound for long trades must be > 0");
        mtbLong = _value;
        emit MTBLongUpdate(_value);
    }

    /**
     * @notice Changes Market Take Bound for Short Trades to the provided one
     * @param _value The new Short market bound value
     */
    function setMTBShort(uint128 _value) public onlyOwner {
        require(_value > 0, "Market Take Bound for short trades must be > 0");
        require(
            _value < BaseMath.baseUInt(),
            "Market Take Bound for short trades must be < 100%"
        );

        mtbShort = _value;
        emit MTBShortUpdate(_value);
    }

    /**
     * @notice allows admin to set max allowed oi open for selected mro
     * @param _maxLimit the max allowed oi open array. Each index corresponds to leverage
     */
    function setMaxOIOpen(uint128[] memory _maxLimit) public onlyOwner {
        uint128 leverage = BaseMath.baseUInt();
        for (uint128 i = 0; i < _maxLimit.length; i++) {
            maxAllowedOIOpen[leverage] = _maxLimit[i];
            emit MaxOIOpenUpdate(leverage, maxAllowedOIOpen[leverage]);
            leverage = leverage + BaseMath.baseUInt();
        }
    }
}
