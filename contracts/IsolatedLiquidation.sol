// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IMarginBank} from "./interfaces/IMarginBank.sol";
import {ITrader} from "./interfaces/ITrader.sol";
import {IEvaluator} from "./interfaces/IEvaluator.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";
import {PositionBalanceMath} from "./maths/PositionBalanceMath.sol";

// libraries
import {TypedSignature} from "./libraries/TypedSignature.sol";
import {Types} from "./libraries/Types.sol";
import {Require} from "./libraries/Require.sol";

/**
 * @title Isolated Liquidation
 * @author Team Bluefin <engineering@firefly.exchange>
 * @notice Isolated Liquidation is a trader contract that executes liquidaiton trades.
 * The trade method on the contract is only invokable by the perpetual contract.
 * The liquidator must invoke trade() on perpetual to liquidate a position
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract IsolatedLiquidation is ITrader, FFLYFiOwnableUpgrade, BlockContext {
    using BaseMath for uint128;
    using BaseMath for int256;
    using PositionBalanceMath for Types.PositionBalance;

    //
    // EVENTS
    //

    /// @notice Emitted when insurance pool percentage is updated
    event InsurancePoolPercentageUpdate(uint128 percent);

    /// @notice Emitted when insurance pool address is updated
    event InsurancePoolUpdate(address pool);

    /// @notice Emitted when insurance a liquidation operator status is updated
    event WhiteListedLiquidator(address liquidator, bool status);

    /// @notice Emitted when liquidation premium is transferred to insurance pool
    event LiquidationPremiumTransferred(address account, uint128 amount);

    //
    // STRUCTS
    //

    /// @dev Trade data expected by trade method of this contract
    struct TradeData {
        // quantity of trade
        uint128 quantity;
        // leverage for taker
        uint128 leverage;
        // from liquidator's perspective (taker)
        bool isBuy;
        // if true, will only liquidate quantity, else revert
        bool allOrNothing;
    }

    /// @dev trade variables computed and updated during trade
    struct TradeVariables {
        TradeData tradeData;
        Types.PositionBalance updatedMakerBalance;
        Types.PositionBalance makerBalance;
        Types.PositionBalance takerBalance;
        uint128 quantity;
        uint128 insurancePoolPortion;
        int256 liquidatorsPortion;
        int256 liquidationPremium;
        uint128 bankruptcy;
        int256 makerFundsFlow;
    }

    /// @dev response returned by _applyIM method
    struct IMResponse {
        Types.PositionBalance updatedBalance;
        int256 fundsFlow;
        int256 pnl;
    }

    // intermediate variables computed during isolated margin application
    // used to prevent stack too deep issue
    struct IMVariables {
        uint128 oldQPos;
        uint128 pPos;
        uint128 marginPerUnit;
        int256 equityPerUnit;
        int256 pnlPerUnit;
        int256 fundsFlow;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    /// @dev Trder flag 1 for this contract
    bytes32 internal constant TRADER_ID = bytes32(uint256(2));

    /// @notice address of the perpetual contract
    address public perpetual;

    /// @notice address of the margin bank contract
    address public marginBank;

    /// @notice address of evaluator contract
    address public evaluator;

    /// @notice address of the insurance pool
    address public insurancePool;

    /// @notice percentage of liquidation premimum that goes to liquidator
    uint128 public insurancePoolPercentage;

    /// @notice mapping for whitelisted liquidators, that can not be liquidated
    mapping(address => bool) public whitelistedLiquidators;

    uint256[50] private __gap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    /**
     * @dev initialize constructor to make the contract upgradable.
     * @param _perpetual address of perpetual contract
     * @param _marginBank address of margin bank contract
     * @param _evaluator address of evaluator contract
     * @param _pool address of insurance pool
     * @param _percent the percent of premium that goes to insurance pool
     */
    function initialize(
        address _perpetual,
        address _marginBank,
        address _evaluator,
        address _pool,
        uint128 _percent
    ) public initializer {
        require(
            _pool != address(0),
            "Liquidation: pool address can not be zero"
        );
        require(
            _percent <= BaseMath.baseUInt(),
            "Liquidation: insurance pool percentage can not be > 100%"
        );

        // TODO implement EIP165
        perpetual = _perpetual;

        // TODO implement EIP165
        marginBank = _marginBank;

        // TODO implement EIP165
        evaluator = _evaluator;

        insurancePool = _pool;
        insurancePoolPercentage = _percent;

        __Ownable_init();
        __ReentrancyGuard_init();

        emit InsurancePoolUpdate(_pool);
        emit InsurancePoolPercentageUpdate(_percent);
    }

    /**
     * @notice Liquidation trade can be invoked by liquidators for positions below the MMR.
     * The liquidator takes over the liquidated position partially or fully.
     * @param  maker   Liquidatee
     * @param  taker   Liquidator
     * @param  price   Current oracle price of asset
     * @param  data    Liquidation trade data struct (of type TradeData)
     * @return         TradeResult indicating the result of a liquidation and quantity liquidated
     */
    function trade(
        address maker,
        address taker,
        uint128 price,
        bytes calldata data
    ) external override nonReentrant returns (Types.TradeResult memory) {
        require(
            _msgSender() == perpetual,
            "Liquidation: msg sender must be Perpetual"
        );

        require(
            !whitelistedLiquidators[maker],
            "Liquidation: Whitelisted liquidator address can not be liquidated"
        );

        TradeVariables memory vars;

        vars.tradeData = abi.decode(data, (TradeData));

        vars.makerBalance = IPerpetual(perpetual).getAccountBalance(maker);

        vars.takerBalance = IPerpetual(perpetual).getAccountBalance(taker);

        // round oracle price to conform to tick size
        price = _roundPrice(price);

        // Pre trade checks
        IEvaluator(evaluator).verifyMinMaxPriceChecks(price, maker);
        IEvaluator(evaluator).verifyQuantityChecks(
            vars.tradeData.quantity,
            maker
        );

        // check if liquidation is possible
        _verifyTrade(
            vars.tradeData,
            vars.makerBalance,
            vars.takerBalance,
            price
        );

        // compute bankruptcy price
        // @dev oiOpen will always be  > margin else liquidation is not possible
        // bankruptcy = debt / qPos
        vars.bankruptcy = vars.makerBalance.isPosPositive
            ? (vars.makerBalance.oiOpen - vars.makerBalance.margin).baseDiv(
                vars.makerBalance.qPos
            )
            : (vars.makerBalance.oiOpen + vars.makerBalance.margin).baseDiv(
                vars.makerBalance.qPos
            );

        // Bound the execution quantity by the size of the maker position.
        vars.quantity = BaseMath.min(
            vars.tradeData.quantity,
            vars.makerBalance.qPos
        );

        IMResponse memory makerResponse = _applyIM(
            maker,
            price,
            vars.bankruptcy,
            vars.quantity,
            vars.makerBalance.mro,
            !vars.tradeData.isBuy, // if maker is long, he wants to sell
            true,
            false
        );

        IMResponse memory takerResponse = _applyIM(
            taker,
            price,
            vars.bankruptcy,
            vars.quantity,
            BaseMath.baseUInt().baseDiv(vars.tradeData.leverage),
            vars.tradeData.isBuy, // if maker is long, the liquidator is going long
            false,
            true
        );

        if (vars.makerBalance.isPosPositive) {
            vars.liquidationPremium = (int256(uint256(price)) -
                int256(uint256(vars.bankruptcy))).baseMul(
                    int256(uint256(vars.quantity))
                );

            if (price >= vars.bankruptcy) {
                vars.insurancePoolPortion = uint128(
                    uint256(vars.liquidationPremium)
                ).baseMul(insurancePoolPercentage);
                vars.liquidatorsPortion = int256(
                    uint256(
                        (BaseMath.baseUInt() - insurancePoolPercentage).baseMul(
                            vars.liquidationPremium
                        )
                    )
                );
            } else {
                vars.liquidatorsPortion = vars.liquidationPremium; // keep liquidatorsPortion negative
            }
        } else {
            vars.liquidationPremium = (int256(uint256(vars.bankruptcy)) -
                int256(uint256(price))).baseMul(int256(uint256(vars.quantity)));

            if (price <= vars.bankruptcy) {
                vars.insurancePoolPortion = uint128(
                    uint256(vars.liquidationPremium)
                ).baseMul(insurancePoolPercentage);
                vars.liquidatorsPortion = int256(
                    uint256(
                        (BaseMath.baseUInt() - insurancePoolPercentage).baseMul(
                            vars.liquidationPremium
                        )
                    )
                );
            } else {
                vars.liquidatorsPortion = vars.liquidationPremium; // keep liquidatorsPortion negative
            }
        }

        // if liquidator's portion is positive
        if (vars.liquidatorsPortion > 0) {
            // transfer percentage of premium to liquidator
            IMarginBank(marginBank).transferMarginToAccount(
                perpetual,
                taker,
                vars.liquidatorsPortion.absolute()
            );
        }
        // if negative, implies under water/bankrupt liquidation
        else if (vars.liquidatorsPortion < 0) {
            // transfer negative liquidation premium from liquidator to perpetual
            IMarginBank(marginBank).transferMarginToAccount(
                taker,
                perpetual,
                vars.liquidatorsPortion.absolute()
            );
        }

        if (vars.insurancePoolPortion > 0) {
            // transfer percentage of premium to insurance pool
            IMarginBank(marginBank).transferMarginToAccount(
                perpetual,
                insurancePool,
                vars.insurancePoolPortion
            );
        }

        takerResponse.pnl = vars.liquidatorsPortion + takerResponse.pnl;

        return
            Types.TradeResult({
                makerHash: "",
                takerHash: "",
                makerBalance: makerResponse.updatedBalance,
                takerBalance: takerResponse.updatedBalance,
                makerFundsFlow: makerResponse.fundsFlow,
                takerFundsFlow: takerResponse.fundsFlow,
                makerFee: 0, // there is no fee on liquidation trade
                takerFee: 0,
                makerPnl: makerResponse.pnl,
                takerPnl: takerResponse.pnl,
                tradeQuantity: vars.quantity,
                price: price,
                isBuy: vars.tradeData.isBuy, // from taker's perspective
                traderFlags: TRADER_ID
            });
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    /**
     * @notice allows contract owner to whitelist a liquidator address
     * @dev a whitelisted liquidator address can not be liquidated
     * @param _liquidator address of account to be whitelisted
     * @param _status true if to be whitelisted, false if to be removed
     * from whitelisted set of liquidators
     */
    function setWhitelistedLiquidator(address _liquidator, bool _status)
        public
        onlyOwner
        nonReentrant
    {
        require(
            _liquidator != address(0),
            "Liquidation: liquidator address can not be zero"
        );
        whitelistedLiquidators[_liquidator] = _status;
        emit WhiteListedLiquidator(_liquidator, _status);
    }

    /**
     * @notice allows contract owner to set insurance pool address
     * @dev insurance pool can not be 0 address as USDC are transferred to this address
     * @param _pool address of the new pool
     */
    function setInsurancePoolAddress(address _pool)
        public
        onlyOwner
        nonReentrant
    {
        require(
            _pool != address(0),
            "Liquidation: pool address can not be zero"
        );
        insurancePool = _pool;
        emit InsurancePoolUpdate(_pool);
    }

    /**
     * @notice allows contract owner to set percentage of liquidaiton
     * premium that goes to liquidator
     * @param _percent percentage of liquidation premium that goes to liquidator
     */
    function setInsurancePoolPercentage(uint128 _percent)
        public
        onlyOwner
        nonReentrant
    {
        require(
            _percent <= BaseMath.baseUInt(),
            "Liquidation: insurance pool percentage can not be > 100%"
        );
        insurancePoolPercentage = _percent;
        emit InsurancePoolPercentageUpdate(_percent);
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

    //===========================================================//
    //                     INTERNAL METHODS
    //===========================================================//

    /**
     * @dev verifies if the liquidation is possible or not
     * @param  tradeData   the data passed to trade method
     * @param  makerBalance   position balance of account to be liquidated
     * @param  takerBalance   positon balance of liquidator
     * @param  price   Current oracle price of asset
     */
    function _verifyTrade(
        TradeData memory tradeData,
        Types.PositionBalance memory makerBalance,
        Types.PositionBalance memory takerBalance,
        uint128 price
    ) internal {
        require(
            makerBalance.qPos > 0,
            "Liquidation: Maker has no position to liquidate"
        );

        require(
            _isUndercollateralized(makerBalance, price),
            "Liquidation: Cannot liquidate since maker is not undercollateralized"
        );

        require(
            !tradeData.allOrNothing || makerBalance.qPos >= tradeData.quantity,
            "Liquidation: allOrNothing is true and liquidation quantity < specified quantity"
        );

        require(
            tradeData.isBuy == makerBalance.isPosPositive,
            "Liquidation: Cannot add to maker's position quantity"
        );

        require(
            takerBalance.mro == 0 ||
                BaseMath.baseUInt().baseDiv(tradeData.leverage) ==
                takerBalance.mro,
            "Liquidation: Liquidator leverage is invalid"
        );
    }

    /**
     * @dev returns true if account (balance) is undercollateralized
     * @param balance position balance of account to be liquidated
     * @param price oracle price
     */
    function _isUndercollateralized(
        Types.PositionBalance memory balance,
        uint128 price
    ) internal returns (bool) {
        int256 maintenanceMargin = IPerpetual(perpetual)
            .maintenanceMarginRequired();
        int256 marginRatio = balance.getMarginRatio(price);
        return marginRatio < maintenanceMargin;
    }

    /**
     * @dev applies isolated margin to the account placing the order
     * @param account address of the account to which IM is to be applied
     * @param price oracle price at the time of liquidation
     * @param bankruptcy bankruptcy price for liquidatee
     * @param quantity of the trade
     * @param mro margin ratio at open
     * @param isBuy long/short from account's position
     * @param isReduceOnly is reduce only trade? for maker of trade always true
     * @param isLiquidator is IM being applied to liquidator
     */
    function _applyIM(
        address account,
        uint128 price,
        uint128 bankruptcy,
        uint128 quantity,
        uint128 mro,
        bool isBuy,
        bool isReduceOnly,
        bool isLiquidator
    ) internal returns (IMResponse memory) {
        IMVariables memory vars;

        Types.PositionBalance memory balance = IPerpetual(perpetual)
            .getAccountBalance(account);

        balance.mro = mro;

        vars.pPos = balance.oiOpen == 0
            ? 0
            : balance.oiOpen.baseDiv(balance.qPos);

        // case 1: Opening position or adding to position size
        if (balance.qPos == 0 || isBuy == balance.isPosPositive) {
            balance.oiOpen = balance.oiOpen + quantity.baseMul(price);
            balance.qPos = balance.qPos + quantity;
            vars.marginPerUnit = price.baseMul(balance.mro);
            vars.fundsFlow = int256(
                uint256(quantity.baseMul(vars.marginPerUnit))
            );
            balance.margin =
                balance.margin +
                quantity.baseMul(price).baseMul(balance.mro);
            balance.isPosPositive = isBuy;

            // whitelisted liquidators can take oi open > max allowed oi open
            if (!whitelistedLiquidators[account]) {
                IEvaluator(evaluator).verifyOIOpenForAccount(account, balance);
            }
        }
        // case 2: Reduce only order
        else if (
            isReduceOnly ||
            (isBuy != balance.isPosPositive && quantity <= balance.qPos)
        ) {
            vars.oldQPos = balance.qPos;
            balance.qPos = balance.qPos - quantity;

            balance.oiOpen = (balance.oiOpen.baseMul(balance.qPos)).baseDiv(
                vars.oldQPos
            );
            vars.marginPerUnit = balance.margin.baseDiv(vars.oldQPos);

            // only compute funds flow for liquidator, for maker its always zero
            if (isLiquidator) {
                vars.pnlPerUnit = balance.isPosPositive
                    ? int256(uint256(price)) - int256(uint256(vars.pPos))
                    : int256(uint256(vars.pPos)) - int256(uint256(price));

                vars.equityPerUnit =
                    int256(uint256(vars.marginPerUnit)) +
                    vars.pnlPerUnit;

                Require.that(
                    vars.equityPerUnit >= 0,
                    "Cannot trade when loss exceeds margin. Please add margin",
                    account
                );

                vars.fundsFlow =
                    quantity.baseMul(-1 * vars.pnlPerUnit) -
                    int256(
                        uint256(
                            balance.margin.baseMul(quantity).baseDiv(
                                vars.oldQPos
                            )
                        )
                    );

                vars.fundsFlow = vars.fundsFlow > int256(0)
                    ? int256(0)
                    : vars.fundsFlow;
            }
            // for maker/liquidatee
            else {
                vars.pnlPerUnit = balance.isPosPositive
                    ? int256(uint256(bankruptcy)) - int256(uint256(vars.pPos))
                    : int256(uint256(vars.pPos)) - int256(uint256(bankruptcy));
            }

            balance.margin = (balance.margin.baseMul(balance.qPos)).baseDiv(
                vars.oldQPos
            );

            // even if position size is zero we are setting isPosPositive to false
            // this is what default value for isPosPositive is
            balance.isPosPositive = balance.qPos > 0
                ? balance.isPosPositive
                : false;

            vars.pnlPerUnit = vars.pnlPerUnit.baseMul(
                int256(uint256(quantity))
            );
        }
        // case 3: flipping position side
        else {
            uint128 oldQPos = balance.qPos;
            balance.qPos = quantity - balance.qPos;
            balance.oiOpen = balance.qPos.baseMul(price);
            vars.marginPerUnit = balance.margin.baseDiv(oldQPos);

            vars.pnlPerUnit = balance.isPosPositive
                ? int256(uint256(price)) - int256(uint256(vars.pPos))
                : int256(uint256(vars.pPos)) - int256(uint256(price));

            vars.equityPerUnit =
                int256(uint256(vars.marginPerUnit)) +
                vars.pnlPerUnit;

            // only liquidator can be in case 3, ensure its not more loss than margin
            Require.that(
                vars.equityPerUnit >= 0,
                "Cannot trade when loss exceeds margin. Please add margin",
                account
            );

            vars.fundsFlow =
                oldQPos.baseMul(-1 * vars.pnlPerUnit) -
                int256(uint256(balance.margin)) +
                int256(
                    uint256(balance.qPos.baseMul(price.baseMul(balance.mro)))
                );

            balance.isPosPositive = !balance.isPosPositive;
            balance.margin = balance.oiOpen.baseMul(balance.mro);

            // whitelisted liquidators can take oi open > max allowed oi open
            if (!whitelistedLiquidators[account]) {
                IEvaluator(evaluator).verifyOIOpenForAccount(account, balance);
            }

            vars.pnlPerUnit = vars.pnlPerUnit.baseMul(int256(uint256(oldQPos)));
        }

        //  if position is closed due to reducing trade or liquidaiton,
        // reset mro to zero
        if (balance.qPos == 0) {
            balance.mro = 0;
        }

        return
            IMResponse({
                updatedBalance: balance,
                fundsFlow: vars.fundsFlow,
                pnl: vars.pnlPerUnit
            });
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
