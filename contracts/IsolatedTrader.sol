// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BaseRelayRecipient} from "./utils/BaseRelayRecipient.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {ITrader} from "./interfaces/ITrader.sol";
import {IIsolatedTrader} from "./interfaces/IIsolatedTrader.sol";
import {IEvaluator} from "./interfaces/IEvaluator.sol";
import {IMarginBank} from "./interfaces/IMarginBank.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";

// libraries
import {TypedSignature} from "./libraries/TypedSignature.sol";
import {Types} from "./libraries/Types.sol";
import {Require} from "./libraries/Require.sol";

/**
 * @title Isolated Trader
 * @author Team Bluefin <engineering@firefly.exchange>
 * @notice Used to perform on-chain order cancellation and normal trade execution.
 * The trade() method on the contract is only invokable by the perpetual market.
 * The taker of the trade ( or settlement operator or a sub account) must invoke
 * trade() on perpetual to execte a trade of two orders (maker/taker)
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract IsolatedTrader is
    ITrader,
    IIsolatedTrader,
    FFLYFiOwnableUpgrade,
    BaseRelayRecipient,
    BlockContext
{
    using BaseMath for uint128;
    using BaseMath for int256;

    //
    // EVENTS
    //

    /// @notice Emitted when an order is cancelled
    event OrderCancel(
        address indexed maker,
        bytes32 orderHash,
        uint128 timestamp
    );

    /// @notice event emitted when order is filled
    event OrderFill(
        bytes32 orderHash,
        Order order,
        address sigMaker,
        Fill fill,
        uint128 newFilledQuantity,
        uint128 timestamp
    );

    /// @notice Emitted when a cancellation operator is updated.
    event CancellationOperatorUpdate(address account);

    /**
     * @notice Emitted when an order is cancelled by operator
     */
    event OrderCancelledByOperator(bytes32 orderHash, uint128 timestamp);

    event GasChargesPaid(
        address account,
        bytes32 orderHash,
        uint128 charges,
        uint128 timestamp
    );

    event GasPoolUpdate(address pool);

    event GaslessOrderValueUpdate(uint128 value);

    event TraderWhitelisted(
        address account,
        bool status,
        uint128 makerFee,
        uint128 takerFee
    );

    //
    // ENUMS
    //
    enum OrderStatus {
        Open,
        Canceled
    }

    //
    // STRUCTS
    //

    struct OrderStatusQuery {
        OrderStatus status;
        uint128 filledAmount;
    }

    /// @dev Trade data expected by trade method of this contract
    struct TradeData {
        // Maker order
        Order orderA;
        // Taker Order
        Order orderB;
        // Fill describing the trade
        Fill fill;
        // Maker's signature for the maker order
        TypedSignature.Signature signatureA;
        // Taker's signature for the taker order
        TypedSignature.Signature signatureB;
    }

    /// @dev order object to be signed and submitted to perpetual contract in trade data
    struct Order {
        /// encoded order flags, isBuy, decreasOnly
        bytes8 flags;
        // quantity of asset to be traded
        uint128 quantity;
        // price at which trade is to be made
        uint128 price;
        // stop order price
        uint128 triggerPrice;
        // leverage (in whole numbers) for trade
        uint128 leverage;
        // address of order maker
        address maker;
        // time after which order becomes invalid
        uint128 expiration;
    }

    /// @dev struct with trade quantity and price
    struct Fill {
        // Fill amount being deducted from both orders' amount
        uint128 quantity;
        // Fill price, both orders must agree on
        uint128 price;
    }

    // intermediate variables computed during isolated margin application
    // used to prevent stack too deep issue
    struct IMVariables {
        uint128 oldQPos;
        uint128 closingFeePerUnit;
        uint128 pPos;
        uint128 marginPerUnit;
        int256 equityPerUnit;
        int256 pnlPerUnit;
        int256 fundsFlow;
        bool isBuy;
        bool isReduceOnly;
    }

    struct IMResponse {
        Types.PositionBalance balance;
        int256 fundsFlow;
        int256 pnl;
        uint128 fee;
    }

    struct WhitelistedTrader {
        bool status;
        uint128 makerFee;
        uint128 takerFee;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    //
    // EIP 712 Constants
    //

    /// @dev EIP191 header for EIP712 prefix
    bytes2 public constant EIP191_HEADER = 0x1901;

    /// @dev EIP712 Domain Name value
    string public constant EIP712_DOMAIN_NAME = "IsolatedTrader";

    /// @dev EIP712 Domain Version value
    string public constant EIP712_DOMAIN_VERSION = "1.0";

    /// @dev Hash of the EIP712 Domain Separator Schema
    bytes32 public constant EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH =
        keccak256(
            abi.encodePacked(
                "EIP712Domain(",
                "string name,",
                "string version,",
                "uint128 chainId,",
                "address verifyingContract",
                ")"
            )
        );

    /// @dev Hash of the EIP712 LimitOrder struct
    bytes32 private constant EIP712_ORDER_STRUCT_SCHEMA_HASH =
        keccak256(
            abi.encodePacked(
                "Order(",
                "bytes8 flags,",
                "uint128 quantity,",
                "uint128 price,",
                "uint128 triggerPrice,",
                "uint128 leverage,",
                "address maker,",
                "uint128 expiration",
                ")"
            )
        );

    /// @dev Trder flag 1 for this contract
    bytes32 public constant TRADER_ID = bytes32(uint256(1));

    /// @dev Hash of the EIP712 Domain Separator data
    bytes32 public _EIP712_DOMAIN_HASH_;

    /// @dev Bitmasks for the flags field
    bytes8 public constant FLAG_MASK_NULL = bytes8(0);
    bytes8 public constant FLAG_MASK_IS_BUY =
        bytes8(bytes32(uint256(1 << 192)));
    bytes8 public constant FLAG_MASK_IS_REDUCE_ONLY =
        bytes8(bytes32(uint256(1 << 193)));

    /// added by mistake, its now part of the deployed contract on prod, can not be removed!
    uint256 public temp;

    /// @notice address of the perpetual contract
    address public perpetual;

    /// @notice address of the evaluator contract
    address public evaluator;

    /// @notice map containing filled quanrtity of each order
    mapping(bytes32 => uint128) public filledQuantity;

    /// @notice map of order status
    mapping(bytes32 => OrderStatus) public orderStatus;

    /// @notice address of whitelisted account able to cancel order just by their hash
    address public cancellationOperator;

    address public gasPool;

    address public marginBank;

    uint256[50] private __gap;

    /// @notice maker orders with notional value > provided value won't be charged any trade fee
    uint128 public gaslessOrders;

    /// @notice whitelisted traders don't get applied any fee on their maker or taker orders
    mapping(address => WhitelistedTrader) public whitelistedTraders;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * Throws if called by any account other than the white listed account.
     */
    modifier onlyCancellationOperator() {
        /**
         * @dev using msgSender() instead of _msgSender(), as the methods
         * using onlyCancellationOperator modifier are gasless, can be invoked by
         * a trusted relayer
         */
        require(
            cancellationOperator == msgSender(),
            "IsolatedTrader: caller is not the cancellation operator"
        );
        _;
    }

    /**
     * @notice initializes the contract
     * @dev makes deployer of the contract default cancelaltion operator
     * @param _perpetual address of perpetual contract
     * @param _evelautor address of evaluator contract
     * @param  _trustedForwarder The address of trusted relayer node
     * @param _chainId id of the chain
     */
    function initialize(
        address _perpetual,
        address _evelautor,
        address _marginBank,
        address _gasPool,
        address _trustedForwarder,
        uint128 _chainId
    ) public initializer {
        perpetual = _perpetual;
        evaluator = _evelautor;
        marginBank = _marginBank;
        gasPool = _gasPool;

        _EIP712_DOMAIN_HASH_ = keccak256(
            abi.encode(
                EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH,
                keccak256(bytes(EIP712_DOMAIN_NAME)),
                keccak256(bytes(EIP712_DOMAIN_VERSION)),
                _chainId,
                address(this)
            )
        );

        cancellationOperator = _msgSender();

        __MetaTransaction_init(_trustedForwarder);
        __Ownable_init();
        __ReentrancyGuard_init();

        emit CancellationOperatorUpdate(cancellationOperator);
        emit GasPoolUpdate(gasPool);
    }

    /**
     * @notice Allows a taker to match with a cryptographically signed maker order
     * @param  maker        Order maker
     * @param  taker        Order taker
     * @param  price        Current oracle price of asset
     * @param  data         Trade data struct (of type TradeData)
     * @return              TradeResult indicating the result of the trade
     */
    function trade(
        address maker,
        address taker,
        uint128 price,
        bytes calldata data
    ) external override nonReentrant returns (Types.TradeResult memory) {
        require(
            _msgSender() == perpetual,
            "IsolatedTrader: Msg sender must be Perpetual"
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));
        bytes32 orderAHash = _getOrderHash(tradeData.orderA);
        bytes32 orderBHash = _getOrderHash(tradeData.orderB);

        // Validate orders are open & have correct signatures.
        _verifyOrderStateAndSignature(
            tradeData.orderA,
            orderAHash,
            tradeData.fill,
            tradeData.signatureA
        );

        _verifyOrderStateAndSignature(
            tradeData.orderB,
            orderBHash,
            tradeData.fill,
            tradeData.signatureB
        );

        // Limit price is 0 for market orders. Only the taker order can ever be a market order.
        if (tradeData.orderB.price == 0) {
            tradeData.orderB.price = tradeData.fill.price;
        }

        // set leverage to 0 precision
        tradeData.orderA.leverage = _getPreciseLeverage(
            tradeData.orderA.leverage
        );
        tradeData.orderB.leverage = _getPreciseLeverage(
            tradeData.orderB.leverage
        );

        // verify maker/taker, orders can be filled at their desired price
        _verifyTradeRequest(tradeData, maker, taker);

        // verify that trade conforms to price/quantity/market take bound checks;

        IEvaluator(evaluator).verifyPriceChecks(tradeData.fill.price, maker);

        IEvaluator(evaluator).verifyQuantityChecks(
            tradeData.fill.quantity,
            maker
        );

        IEvaluator(evaluator).verifyMarketTakeBoundChecks(
            tradeData.fill.price,
            price,
            _isBuy(tradeData.orderB),
            taker
        );

        IMResponse memory makerData = _applyIM(
            tradeData.orderA,
            tradeData.fill,
            tradeData.fill.price.baseMul(
                whitelistedTraders[maker].status == true
                    ? whitelistedTraders[maker].makerFee
                    : IPerpetual(perpetual).defaultMakerFee()
            )
        );

        IMResponse memory takerData = _applyIM(
            tradeData.orderB,
            tradeData.fill,
            tradeData.fill.price.baseMul(
                whitelistedTraders[taker].status == true
                    ? whitelistedTraders[taker].takerFee
                    : IPerpetual(perpetual).defaultTakerFee()
            )
        );

        return
            Types.TradeResult({
                makerHash: orderAHash,
                takerHash: orderBHash,
                makerBalance: makerData.balance,
                takerBalance: takerData.balance,
                makerFundsFlow: makerData.fundsFlow,
                takerFundsFlow: takerData.fundsFlow,
                makerFee: makerData.fee,
                takerFee: takerData.fee,
                makerPnl: makerData.pnl,
                takerPnl: takerData.pnl,
                tradeQuantity: tradeData.fill.quantity,
                price: tradeData.fill.price,
                isBuy: !_isBuy(tradeData.orderA), // from taker's perspective
                traderFlags: TRADER_ID
            });
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    /**
     * @notice sets current cancellation operator to new operator provided.
     * @param _newOperator address of new operator
     */
    function setCancellationOperator(address _newOperator)
        public
        onlyOwner
        nonReentrant
    {
        require(
            _newOperator != cancellationOperator,
            "IsolatedTrader: New cancellation operator should be different from current one"
        );
        cancellationOperator = _newOperator;
        emit CancellationOperatorUpdate(cancellationOperator);
    }

    /**
     * @notice sets gas pool address to provided one.
     * @param _pool address of new operator
     */
    function setGasPool(address _pool) public onlyOwner nonReentrant {
        require(
            _pool != gasPool,
            "IsolatedTrader: New gas pool address should be different from current one"
        );
        gasPool = _pool;
        emit GasPoolUpdate(gasPool);
    }

    /**
     * @notice On-chain cancels an order.
     * @param _order The order that will be permanently canceled.
     */
    function cancelOrder(Order calldata _order) public {
        require(
            _msgSender() == _order.maker,
            "IsolatedTrader: Order cannot be canceled by non-maker"
        );
        bytes32 orderHash = _getOrderHash(_order);
        orderStatus[orderHash] = OrderStatus.Canceled;
        emit OrderCancel(_msgSender(), orderHash, _blockTimestamp());
    }

    /**
     * @notice Sets value of maker orders notional value for which there is no trade fee
     * @param _value The new value to be set
     */
    function setGaslessOrderValue(uint128 _value)
        public
        onlyOwner
        nonReentrant
    {
        require(
            _value >= 100 * BaseMath.baseUInt(),
            "IsolatedTrader: Gasless orders must have notional value >= 100$"
        );
        gaslessOrders = _value;
        emit GaslessOrderValueUpdate(_value);
    }

    /**
     * @notice Sets value of maker orders notional value for which there is no trade fee
     */
    function setWhitelistedTrader(
        address account,
        bool status,
        uint128 makerFee,
        uint128 takerFee
    ) public onlyOwner nonReentrant {
        whitelistedTraders[account] = WhitelistedTrader({
            status: status,
            makerFee: makerFee,
            takerFee: takerFee
        });

        emit TraderWhitelisted(account, status, makerFee, takerFee);
    }

    /**
     * @notice On-chain cancels list of given order.
     * @param _orders The orders that will be permanently canceled.
     */
    function cancelOrders(Order[] calldata _orders) public {
        for (uint128 i = 0; i < _orders.length; i++) {
            cancelOrder(_orders[i]);
        }
    }

    /**
     * @notice Cancel an order on-chain
     * @param  _orderHash  Hash of the order to be canceled
     */
    function cancelOrderByHash(bytes32 _orderHash)
        public
        onlyCancellationOperator
    {
        orderStatus[_orderHash] = OrderStatus.Canceled;
        emit OrderCancelledByOperator(_orderHash, _blockTimestamp());
    }

    /**
     * @notice On-chain cancels list of given order.
     * @param  _orderHashes  Hashes of orders that will be permanently canceled.
     */
    function cancelOrdersByHash(bytes32[] calldata _orderHashes)
        public
        onlyCancellationOperator
    {
        for (uint128 i = 0; i < _orderHashes.length; i++) {
            cancelOrderByHash(_orderHashes[i]);
        }
    }

    //===========================================================//
    //                         GETTERS
    //===========================================================//

    /**
     * @notice returns the trader flag
     */
    function getTraderFlag() public pure override returns (bytes32) {
        return TRADER_ID;
    }

    /**
     * @notice Gets the status (open/canceled) and filled amount of each order in a list.
     * @param  _orderHashes list of order hashes to get
     * @return A list of OrderStatusQuery structs containing the status and filled
     * amount of each order.
     */
    function getOrdersStatus(bytes32[] calldata _orderHashes)
        external
        view
        returns (OrderStatusQuery[] memory)
    {
        OrderStatusQuery[] memory result = new OrderStatusQuery[](
            _orderHashes.length
        );
        for (uint128 i = 0; i < _orderHashes.length; i++) {
            bytes32 orderHash = _orderHashes[i];
            result[i] = OrderStatusQuery({
                status: orderStatus[orderHash],
                filledAmount: filledQuantity[orderHash]
            });
        }
        return result;
    }

    /**
     * @notice Computes EIP712 hash and returns it
     * @param _order Order
     * @return Returns the EIP712 hash of an order.
     */
    function getOrderHash(Order memory _order) public view returns (bytes32) {
        return _getOrderHash(_order);
    }

    //===========================================================//
    //                      INTERNAL METHODS
    //===========================================================//

    /**
     * @dev applies isolated margin to the account placing the order
     * @param order Order on which IM is to be applied
     * @param fill Fill quantity of trade
     * @param feePerUnit Fee per unit (Maker or taker) for the trade
     */
    function _applyIM(
        Order memory order,
        Fill memory fill,
        uint128 feePerUnit
    ) internal returns (IMResponse memory) {
        IMVariables memory vars;

        Types.PositionBalance memory balance = IPerpetual(perpetual)
            .getAccountBalance(order.maker);
        balance.mro = BaseMath.baseUInt().baseDiv(order.leverage);

        vars.isBuy = _isBuy(order);
        vars.isReduceOnly = _isReduceOnly(order);

        vars.pPos = balance.oiOpen == 0
            ? 0
            : balance.oiOpen.baseDiv(balance.qPos);

        // case 1: Opening position or adding to position size
        if (balance.qPos == 0 || vars.isBuy == balance.isPosPositive) {
            balance.oiOpen = balance.oiOpen + fill.quantity.baseMul(fill.price);
            balance.qPos = balance.qPos + fill.quantity;
            vars.marginPerUnit = fill.price.baseMul(balance.mro);
            vars.fundsFlow = int256(
                uint256(fill.quantity.baseMul(vars.marginPerUnit + feePerUnit))
            );
            balance.margin =
                balance.margin +
                fill.quantity.baseMul(fill.price).baseMul(balance.mro);
            balance.isPosPositive = vars.isBuy;

            IEvaluator(evaluator).verifyOIOpenForAccount(order.maker, balance);
        }
        // case 2: Reduce only order
        else if (
            vars.isReduceOnly ||
            (vars.isBuy != balance.isPosPositive &&
                fill.quantity <= balance.qPos)
        ) {
            vars.oldQPos = balance.qPos;

            balance.qPos = balance.qPos - fill.quantity;

            balance.oiOpen = balance.oiOpen.baseMul(balance.qPos).baseDiv(
                vars.oldQPos
            );

            vars.marginPerUnit = balance.margin.baseDiv(vars.oldQPos);

            vars.pnlPerUnit = balance.isPosPositive
                ? int256(uint256(fill.price)) - int256(uint256(vars.pPos))
                : int256(uint256(vars.pPos)) - int256(uint256(fill.price));

            vars.equityPerUnit =
                int256(uint256(vars.marginPerUnit)) +
                vars.pnlPerUnit;

            Require.that(
                vars.equityPerUnit >= 0,
                "Cannot trade when loss exceeds margin. Please add margin",
                order.maker
            );

            if (feePerUnit > vars.equityPerUnit.toPositive()) {
                feePerUnit = vars.equityPerUnit.toPositive();
            }

            vars.fundsFlow =
                fill.quantity.baseMul(
                    -vars.pnlPerUnit + int256(uint256(feePerUnit))
                ) -
                int256(
                    uint256(
                        balance.margin.baseMul(fill.quantity).baseDiv(
                            vars.oldQPos
                        )
                    )
                );

            vars.fundsFlow = vars.fundsFlow > int256(0)
                ? int256(0)
                : vars.fundsFlow;

            balance.margin = balance.margin.baseMul(balance.qPos).baseDiv(
                vars.oldQPos
            );

            // even if position size is zero we are setting isPosPositive to false
            // this is what default value for isPosPositive is
            balance.isPosPositive = balance.qPos > 0
                ? balance.isPosPositive
                : false;

            vars.pnlPerUnit = vars.pnlPerUnit.baseMul(
                int256(int128(fill.quantity))
            );
        }
        // case 3: flipping position side
        else {
            uint128 oldQPos = balance.qPos;
            balance.qPos = fill.quantity - balance.qPos;

            balance.oiOpen = balance.qPos.baseMul(fill.price);

            vars.marginPerUnit = balance.margin.baseDiv(oldQPos);

            vars.pnlPerUnit = balance.isPosPositive
                ? int256(uint256(fill.price)) - int256(uint256(vars.pPos))
                : int256(uint256(vars.pPos)) - int256(uint256(fill.price));

            vars.equityPerUnit =
                int256(uint256(vars.marginPerUnit)) +
                vars.pnlPerUnit;

            Require.that(
                vars.equityPerUnit >= 0,
                "Cannot trade when loss exceeds margin. Please add margin",
                order.maker
            );

            // fee paid on closing the current position
            uint128 closingFeePerUnit = feePerUnit;

            if (closingFeePerUnit > vars.equityPerUnit.toPositive()) {
                closingFeePerUnit = vars.equityPerUnit.toPositive();
            }

            vars.fundsFlow =
                oldQPos.baseMul(
                    -1 * vars.pnlPerUnit + int256(uint256(closingFeePerUnit))
                ) -
                int256(uint256(balance.margin)) +
                int256(
                    uint256(
                        balance.qPos.baseMul(
                            fill.price.baseMul(balance.mro) + feePerUnit
                        )
                    )
                );

            balance.isPosPositive = !balance.isPosPositive;

            feePerUnit = ((oldQPos.baseMul(closingFeePerUnit)) +
                (balance.qPos.baseMul(feePerUnit))).baseDiv(fill.quantity);
            IEvaluator(evaluator).verifyOIOpenForAccount(order.maker, balance);

            balance.margin = balance.oiOpen.baseMul(balance.mro);
            vars.pnlPerUnit = vars.pnlPerUnit.baseMul(int256(uint256(oldQPos)));
        }

        //  if position is closed due to reducing trade or liquidaiton,
        // reset mro to zero
        if (balance.qPos == 0) {
            balance.mro = 0;
        }

        return
            IMResponse({
                balance: balance,
                fundsFlow: vars.fundsFlow,
                pnl: vars.pnlPerUnit,
                fee: feePerUnit.baseMul(fill.quantity)
            });
    }

    /**
     * @dev verifies if order is open and is signed by the maker of order
     * @param order Order to be verified
     * @param orderHash hash of the above provided order
     * @param signature signature of the order
     */
    function _verifyOrderStateAndSignature(
        Order memory order,
        bytes32 orderHash,
        Fill memory fill,
        TypedSignature.Signature memory signature
    ) internal {
        // Obtain order status, will default to 0 (Open) if orderHash does not exist.
        OrderStatus status = orderStatus[orderHash];

        Require.that(
            status != OrderStatus.Canceled,
            "IsolatedTrader: Order was already canceled",
            order.maker
        );

        // recover address from signature
        address sigMaker = TypedSignature.recover(orderHash, signature);

        // If not cancelled, order is open. Proceed to verify signature
        // if recovered address is 0, it implies incorrect order signature
        Require.that(
            sigMaker != address(0) &&
                (order.maker == sigMaker ||
                    IPerpetual(perpetual).getIsSubAccount(
                        order.maker,
                        sigMaker
                    )),
            "IsolatedTrader: Order has an invalid signature",
            order.maker
        );

        // fill quantity of order
        _fillQuantity(order, orderHash, fill, sigMaker);
    }

    /**
     * @dev verifies if the trade request is correct or not
     * @param tradeData containing TradeData
     * @param maker address of the maker account
     * @param taker address of the taker account
     */
    function _verifyTradeRequest(
        TradeData memory tradeData,
        address maker,
        address taker
    ) internal view {
        // orderA.maker should be the maker of the trade
        _verifyOrderMaker(tradeData.orderA, maker);

        // orderB.maker should be the taker of the trade
        _verifyOrderMaker(tradeData.orderB, taker);

        // confirm that both orders can be filled
        _verifyOrderFills(tradeData.orderA, tradeData.fill);
        _verifyOrderFills(tradeData.orderB, tradeData.fill);

        // confirm that the leverage of the order is same as MRO;
        _verifyOrderLeverage(maker, tradeData.orderA.leverage);
        _verifyOrderLeverage(taker, tradeData.orderB.leverage);
    }

    /**
     * @dev verifies if the order leverage is correct or not
     * @param account address of the account
     * @param leverage current leverage specified in order
     */
    function _verifyOrderLeverage(address account, uint128 leverage)
        internal
        view
    {
        Require.that(leverage > 0, "Leverage must be > 0", account);
        uint128 mro = IPerpetual(perpetual).getAccountBalance(account).mro;
        Require.that(
            mro == 0 || BaseMath.baseUInt().baseDiv(leverage) == mro,
            "Invalid leverage",
            account
        );
    }

    /**
     * @dev confirms if the maker and taker of the provided order are correct.
     * @param order   orders data to be verified
     * @param maker   maker's address
     */
    function _verifyOrderMaker(Order memory order, address maker)
        internal
        view
    {
        // order.maker should be the maker of the trade
        require(
            order.maker == maker,
            "IsolatedTrader: Order maker does not match trade maker"
        );

        // confirm that the order is not expired
        // order with expiration = 0 will never expire by itself; a user must cancel it.
        Require.that(
            order.expiration >= _blockTimestamp() || order.expiration == 0,
            "IsolatedTrader: Order has expired",
            order.maker
        );
    }

    /**
     * @dev Verifies that the fill satisfies price & fee for a a given order
     * @param  order      The order to verify.
     * @param  fill       The fill data to verify against the order.
     */
    function _verifyOrderFills(Order memory order, Fill memory fill)
        private
        view
    {
        bool isBuyOrder = _isBuy(order); // from the maker's perspective.

        // Ensure order is being filled at the specified or better price
        // For long/buy orders, the fill price must be equal or lower
        // For short/sell orders, the fill price must be equal or higher
        bool validPrice = isBuyOrder
            ? fill.price <= order.price
            : fill.price >= order.price;

        Require.that(
            validPrice,
            "IsolatedTrader: Fill price is invalid",
            order.maker
        );

        // For reduce only orders, ensure that the order would result in an
        // open position's size to reduce (fill amount <= open position size)

        if (_isReduceOnly(order)) {
            Types.PositionBalance memory balance = IPerpetual(perpetual)
                .getAccountBalance(order.maker);
            Require.that(
                isBuyOrder != balance.isPosPositive && // Reduce only order must be in the opposite direction as open position (a positive position size means open position is Buy)
                    fill.quantity <= balance.qPos, // Reduce only order size must be less than open position size. Size sign is stored separately (sizeIsPositive) so this is an absolute value comparison regardless of position direction (Buy or Sell)
                "IsolatedTrader: Fill does not decrease size",
                order.maker
            );
        }
    }

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
    ) external override {
        TradeData memory tradeData = abi.decode(data, (TradeData));

        // apply gas charges
        // to taker
        _applyGasCharges(tradeData.orderB, gasCharges, tradeData.fill.quantity);

        // to maker
        // adjust gas charges
        // if notional value of maker order is > gasless orders notional value
        // Gas charges are zero else apply provided gas charges
        gasCharges = (gaslessOrders == 0 ||
            oraclePrice.baseMul(tradeData.orderA.quantity) <= gaslessOrders)
            ? gasCharges
            : 0;

        if (gasCharges > 0) {
            _applyGasCharges(
                tradeData.orderA,
                gasCharges,
                tradeData.fill.quantity
            );
        }
    }

    /**
     * @dev Applies trading gas fee on the account for provided order
     * @param  order  Order to be applied gas charges on
     * @param  charges  Quantity of order filled
     */
    function _applyGasCharges(
        Order memory order,
        uint128 charges,
        uint128 fillQty
    ) public {
        bytes32 orderHash = _getOrderHash(order);

        // gas charges are only applied when order is being filled for the first time
        if (filledQuantity[orderHash] - fillQty == 0) {
            IMarginBank(marginBank).transferMarginToAccount(
                order.maker,
                gasPool,
                charges
            );

            emit GasChargesPaid(
                order.maker,
                orderHash,
                charges,
                _blockTimestamp()
            );
        }
    }

    /**
     * @dev Updates order filled amount in filledQuantity map
     * @param  order  The order to update filled amount against
     * @param  orderHash The hash of the order
     * @param  fill   Fill struct specifying fill amount
     */
    function _fillQuantity(
        Order memory order,
        bytes32 orderHash,
        Fill memory fill,
        address sigMaker
    ) private {
        uint128 newFilledQuantity = filledQuantity[orderHash] + fill.quantity;

        Require.that(
            newFilledQuantity <= order.quantity,
            "IsolatedTrader: Cannot overfill maker order",
            order.maker
        );

        filledQuantity[orderHash] = newFilledQuantity;

        emit OrderFill(
            orderHash,
            order,
            sigMaker,
            fill,
            newFilledQuantity,
            _blockTimestamp()
        );
    }

    /**
     * @dev Returns the EIP712 hash of an order.
     */
    function _getOrderHash(Order memory order) internal view returns (bytes32) {
        // compute the overall signed struct hash
        bytes32 structHash = keccak256(
            abi.encode(EIP712_ORDER_STRUCT_SCHEMA_HASH, order)
        );

        // compute eip712 compliant hash
        return
            keccak256(
                abi.encodePacked(
                    EIP191_HEADER,
                    _EIP712_DOMAIN_HASH_,
                    structHash
                )
            );
    }

    /**
     * @dev returns true if order is of long side
     */
    function _isBuy(Order memory order) private pure returns (bool) {
        return (order.flags & FLAG_MASK_IS_BUY) != FLAG_MASK_NULL;
    }

    /**
     * @dev returns true if order is reduce only
     */
    function _isReduceOnly(Order memory order) private pure returns (bool) {
        return (order.flags & FLAG_MASK_IS_REDUCE_ONLY) != FLAG_MASK_NULL;
    }

    /**
     * @dev returns leverage rounded down to a whole number
     */
    function _getPreciseLeverage(uint128 leverage)
        internal
        pure
        returns (uint128)
    {
        return (leverage / BaseMath.baseUInt()) * BaseMath.baseUInt();
    }
}
