// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {ITrader} from "./interfaces/ITrader.sol";
import {IEvaluator} from "./interfaces/IEvaluator.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";
import {PositionBalanceMath} from "./maths/PositionBalanceMath.sol";

// libraries
import {Types} from "./libraries/Types.sol";
import {Require} from "./libraries/Require.sol";

/**
 * @title Isolated Auto Deleveraging
 * @author Team Firefly <engineering@firefly.exchange>
 * @notice Used to perform on-chain deleveraging of accounts.
 * The trade method on the contract is only invokable by the perpetual contract.
 * The ADL Operator or any account must invoke trade method on perpetual with trader
 * flag of this contract to deleverage accounts.
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract IsolatedADL is ITrader, FFLYFiOwnableUpgrade, BlockContext {
    using BaseMath for uint128;
    using BaseMath for int256;
    using PositionBalanceMath for Types.PositionBalance;

    //
    // EVENTS
    //

    /// @notice Emitted when an order is cancelled
    event OrderCancel(
        address indexed maker,
        bytes32 orderHash,
        uint128 timestamp
    );

    //
    // STRUCTS
    //

    /// @dev Trade data expected by trade method of this contract
    struct TradeData {
        uint128 quantity;
        bool isBuy; // from taker's perspective
        bool allOrNothing; // if true, will revert if maker's position is less than the amount
    }

    /// @dev response returned by _applyIM method
    struct IMResponse {
        Types.PositionBalance updatedBalance;
        int256 fundsFlow;
        int256 pnl;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    /// @dev Trder flag 1 for this contract
    bytes32 public constant TRADER_ID = bytes32(uint256(3));

    /// @notice address of the perpetual contract
    address public perpetual;

    /// @notice address of the margin bank contract
    address public marginBank;

    /// @notice address of the evaluator contract
    address public evaluator;

    uint256[50] private __gap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * @notice initializes the contract
     * @dev makes deployer of the contract default cancelaltion operator
     * @param _perpetual address of perpetual contract
     * @param _evelautor address of evaluator contract
     */
    function initialize(address _perpetual, address _evelautor)
        public
        initializer
    {
        perpetual = _perpetual;
        evaluator = _evelautor;

        __Ownable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @notice Deleveraging trade can be invoked by the Deleveraging operator for positions below 0 MR.
     * The maker and taker's positions are reduced by the quantity provided
     * @param  maker   bankrupt account
     * @param  taker   Account having surplus pnl
     * @param  price   Current oracle price of asset
     * @param  data    Deleveraging trade data struct (of type TradeData)
     * @return         TradeResult indicating the result of Deleveraging
     */
    function trade(
        address maker,
        address taker,
        uint128 price,
        bytes calldata data
    ) external override nonReentrant returns (Types.TradeResult memory) {
        require(
            _msgSender() == perpetual,
            "IsolatedADL: Msg sender must be Perpetual"
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));

        Types.PositionBalance memory makerBalance = IPerpetual(perpetual)
            .getAccountBalance(maker);

        Types.PositionBalance memory takerBalance = IPerpetual(perpetual)
            .getAccountBalance(taker);

        // round oracle price to conform to tick size
        price = _roundPrice(price);

        // Pre trade checks
        IEvaluator(evaluator).verifyMinMaxPriceChecks(price, maker);

        IEvaluator(evaluator).verifyQuantityChecks(tradeData.quantity, maker);

        _verifyTrade(tradeData, makerBalance, takerBalance, price);

        // Bound the execution amount by the size of the maker and taker positions.
        uint128 amount = BaseMath.min(
            tradeData.quantity,
            BaseMath.min(makerBalance.qPos, takerBalance.qPos)
        );

        // compute bankruptcy price
        uint128 bankruptcy = makerBalance.isPosPositive
            ? (makerBalance.oiOpen - makerBalance.margin).baseDiv(
                makerBalance.qPos
            )
            : (makerBalance.oiOpen + makerBalance.margin).baseDiv(
                makerBalance.qPos
            );

        IMResponse memory makerResponse = _applyIM(
            maker,
            makerBalance,
            bankruptcy,
            amount
        );

        IMResponse memory takerResponse = _applyIM(
            taker,
            takerBalance,
            bankruptcy,
            amount
        );

        return
            Types.TradeResult({
                makerHash: "",
                takerHash: "",
                makerBalance: makerResponse.updatedBalance,
                takerBalance: takerResponse.updatedBalance,
                makerFundsFlow: makerResponse.fundsFlow,
                takerFundsFlow: takerResponse.fundsFlow,
                makerFee: 0,
                takerFee: 0,
                makerPnl: makerResponse.pnl,
                takerPnl: takerResponse.pnl,
                tradeQuantity: amount,
                price: bankruptcy,
                isBuy: tradeData.isBuy, // from taker's perspective
                traderFlags: TRADER_ID
            });
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    //===========================================================//
    //                         GETTERS
    //===========================================================//

    /**
     * @notice returns the trader flag
     */
    function getTraderFlag() public pure override returns (bytes32) {
        return TRADER_ID;
    }

    //===========================================================//
    //                      INTERNAL METHODS
    //===========================================================//

    function _applyIM(
        address maker,
        Types.PositionBalance memory balance,
        uint128 bankruptcy,
        uint128 quantity
    ) internal pure returns (IMResponse memory) {
        uint128 pPos = balance.oiOpen == 0
            ? 0
            : balance.oiOpen.baseDiv(balance.qPos);

        // case 2: Reducing trade

        uint128 oldQPos = balance.qPos;
        balance.qPos = balance.qPos - quantity;

        balance.oiOpen = (balance.oiOpen.baseMul(balance.qPos)).baseDiv(
            oldQPos
        );

        uint128 marginPerUnit = balance.margin.baseDiv(oldQPos);

        int256 pnlPerUnit = balance.isPosPositive
            ? int256(uint256(bankruptcy)) - int256(uint256(pPos))
            : int256(uint256(pPos)) - int256(uint256(bankruptcy));

        int256 equityPerUnit = int256(uint256(marginPerUnit)) + pnlPerUnit;

        Require.that(
            (equityPerUnit + 100_000_000_000_000) >= 0,
            "Cannot trade when loss exceeds margin. Please add margin",
            maker
        );

        int256 fundsFlow = quantity.baseMul(-pnlPerUnit) -
            int256(uint256(balance.margin.baseMul(quantity).baseDiv(oldQPos)));

        fundsFlow = fundsFlow > int256(0) ? int256(0) : fundsFlow;

        balance.margin = balance.margin.baseMul(balance.qPos).baseDiv(oldQPos);

        // even if position size is zero we are setting isPosPositive to false
        // this is what default value for isPosPositive is
        balance.isPosPositive = balance.qPos > 0
            ? balance.isPosPositive
            : false;

        pnlPerUnit = pnlPerUnit.baseMul(int256(int128(quantity)));

        //  if position is closed due reset mro to zero
        if (balance.qPos == 0) {
            balance.mro = 0;
        }

        return
            IMResponse({
                updatedBalance: balance,
                fundsFlow: fundsFlow,
                pnl: pnlPerUnit
            });
    }

    /**
     * @dev verifies if the trade request is correct or not
     * @param tradeData containing TradeData (quantity, isBuy etc..)
     * @param makerBalance position balance of the bankrupt account
     * @param takerBalance position balance of the account having surplus pnl
     * @param price oracle price
     */
    function _verifyTrade(
        TradeData memory tradeData,
        Types.PositionBalance memory makerBalance,
        Types.PositionBalance memory takerBalance,
        uint128 price
    ) internal pure {
        require(makerBalance.qPos > 0, "IsolatedADL: Maker has zero position");

        require(takerBalance.qPos > 0, "IsolatedADL: Taker has zero position");

        require(
            makerBalance.getMarginRatio(price) <= 0,
            "IsolatedADL: Cannot deleverage since maker is not underwater"
        );

        require(
            takerBalance.getMarginRatio(price) > 0,
            "IsolatedADL: Cannot deleverage since taker is underwater"
        );

        require(
            !tradeData.allOrNothing || makerBalance.qPos >= tradeData.quantity,
            "IsolatedADL: allOrNothing is set and maker position is < quantity"
        );
        require(
            takerBalance.isPosPositive != makerBalance.isPosPositive,
            "IsolatedADL: Taker and maker can not have same side positions"
        );
        require(
            !tradeData.allOrNothing || takerBalance.qPos >= tradeData.quantity,
            "IsolatedADL: allOrNothing is set and taker position is < quantity"
        );
        require(
            tradeData.isBuy != makerBalance.isPosPositive,
            "IsolatedADL: deleveraging must not increase maker's position size"
        );
    }

    /**
     * @dev rounds price to conform to tick size
     * if price is 12.56 and tick size is 0.1, will round up the price to 12.6
     * if price is 12.53 and tick size is 0.1, will round down the price to 12.5
     */
    function _roundPrice(uint128 price) internal returns (uint128) {
        uint128 decimals = IEvaluator(evaluator).tickSize();
        price = price + (decimals * 5) / 10;
        return price - (price % decimals);
    }
}
