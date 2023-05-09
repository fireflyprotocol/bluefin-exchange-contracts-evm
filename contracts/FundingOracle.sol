// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// utils
import {FFLYFiOwnableUpgrade} from "./utils/FFLYFiOwnableUpgrade.sol";
import {BlockContext} from "./utils/BlockContext.sol";

// interfaces
import {IFundingOracle} from "./interfaces/IFundingOracle.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";

// maths
import {BaseMath} from "./maths/BaseMath.sol";

// libraries
import {Types} from "./libraries/Types.sol";

/**
 * @title Funding Oracle
 * @author Team Bluefin <engineering@firefly.exchange>
 * @notice Computes on-chain funding payments to be applied to traders for next 1 hour
 * @dev The contract is made upgradable using openzeppelin upgrades-pluging, don't change
 * the order of variables. Read more: https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies
 */
contract FundingOracle is IFundingOracle, FFLYFiOwnableUpgrade, BlockContext {
    using BaseMath for int256;

    //
    // EVENTS
    //

    /// @notice Emitted when funding rate provider is set
    event FRProviderUpdate(address provider);

    /// @notice emitted when maxFunding allowed per hour/window updates
    event MaxAllowedFRUpdate(uint128 maxFunding);

    /// @notice Emitted when funding rate start time is set
    event FundingRateStart(uint128 timestamp);

    /// @notice Emitted when funding rate is stopped
    event FundingRateStop(uint128 timestamp);

    /// @notice Emitted when a trade is recorded
    event FRTradeRecord(
        int256 ratio,
        int256 sum,
        uint128 windowSet,
        uint128 timestamp
    );

    /// @notice Emitted when funding rate is set
    event FundingRateUpdate(
        int256 fundingRate, // per second funding rate
        uint128 window,
        uint128 minApplicationTime, // min timestamp till which funding rate will be applicable
        uint128 timestamp
    );

    //
    // STRUCTS
    //

    struct FundingWindow {
        uint128 tFirst; // timestamp at which first record was updated
        uint128 tLast; // timestamp at which last record was updated
        int256 sum;
        int256 ratio;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    //
    // CONSTANTS & VARIABLES
    //

    /// @notice funding rate window has a fixed 1 hour size
    uint128 public constant FUNDING_RATE_WINDOW = 1 hours;

    /// @notice max funding rate allowed per hour
    /// @dev set to 0.1% upon deployment
    uint128 public maxFunding;

    /// @notice address responsible for providing trades data used to compute funding rate
    /// @dev this will be perpetual contract address
    address public provider;

    /// @notice address of the guardian contract
    address public guardianContract;

    /// @notice timestamp at which funding rate was started
    uint128 public fundingStart;

    /// @notice current window for which funding rate is calculated and is to be applied
    /// @dev idealy this will update every hour, but can fall behind
    uint128 public windowSet;

    /// @notice current funding rate (per second) applicable on all trades
    int256 public currentFundingRate;

    /// @notice funding rate information about current on-going funding window
    FundingWindow public currentFundingWindow;

    /// @notice status of the funding rate as set by the Guardian
    Types.GuardianStatus private fundingRateStatus;

    uint256[50] private __gap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//

    modifier onlyFundingRateProvider() {
        require(
            provider == _msgSender(),
            "FundingOracle: caller is not funding rate provider"
        );
        _;
    }

    /**
     * Throws if called by any account other than the guardian
     */
    modifier onlyGuardianContract() {
        require(
            guardianContract == _msgSender(),
            "FundingOracle: caller is not the guardian contract"
        );
        _;
    }

    /**
     * @notice initializes the contract
     * @param _provider address of funding rate trades provider
     * @param _guardian address of guardian contract
     */
    function initialize(
        address _provider,
        address _guardian,
        uint128 _maxFunding
    ) public initializer {
        provider = _provider;
        guardianContract = _guardian;
        maxFunding = _maxFunding;

        __Ownable_init();
        __ReentrancyGuard_init();

        emit FRProviderUpdate(provider);
        emit MaxAllowedFRUpdate(maxFunding);
    }

    //===========================================================//
    //                         SETTERS
    //===========================================================//

    /**
     * @notice allows funding rate provider to record a new trade
     * @dev if funding rate has been moved to off-chain, the function
     * will return silently
     * @param _tradePrice the execution price of trade
     * @param _oraclePrice current oracle price
     */
    function recordTrade(uint128 _tradePrice, uint128 _oraclePrice)
        public
        override
        onlyFundingRateProvider
    {
        if (!isFundingRateAllowed()) {
            return;
        }

        uint128 currentTimestamp = _blockTimestamp();
        // if funding rate has been started and cur time >= funding rate start time
        if (fundingStart > 0 && currentTimestamp >= fundingStart) {
            currentFundingWindow.sum =
                currentFundingWindow.sum +
                (currentFundingWindow.ratio *
                    int256(
                        uint256(currentTimestamp - currentFundingWindow.tLast)
                    ));

            // update rato{i} = (tradeprice - oraclePrice) / oraclePrice
            currentFundingWindow.ratio = (int256(uint256(_tradePrice)) -
                int256(uint256(_oraclePrice))).baseDiv(
                    int256(uint256(_oraclePrice))
                );

            // update tLast
            currentFundingWindow.tLast = currentTimestamp;

            emit FRTradeRecord(
                currentFundingWindow.ratio,
                currentFundingWindow.sum,
                expectedFundingWindow(),
                currentFundingWindow.tLast
            );
        }
    }

    /**
     * @notice allows caller to set offchain computed funding rate for the on-going window
     * can only be invoked by perpetual contract
     * @dev can only be invoked when guardian has moved funding rate computation to off-chain
     * @param _offchainFundingRate offchain computed funding rate which override the on-chain one
     */
    function setOffChainFundingRate(int256 _offchainFundingRate)
        public
        override
        onlyFundingRateProvider
        nonReentrant
    {
        require(
            !isFundingRateAllowed(),
            "FundingOracle: off-chain funding rate cannot be set while on-chain allowed"
        );

        require(
            _offchainFundingRate.absolute() <= maxFunding,
            "FundingOracle: off-chain funding rate exceeds max funding rate"
        );

        uint128 currentTimestamp = _blockTimestamp();
        uint128 expectedWindow = expectedFundingWindow();
        _validateFundingWindow(expectedWindow);

        // funding rate per second
        currentFundingRate = _offchainFundingRate / 3600;
        windowSet = expectedWindow - 1;

        emit FundingRateUpdate(
            currentFundingRate,
            windowSet,
            (((windowSet + 1) * FUNDING_RATE_WINDOW) + fundingStart) -
                _blockTimestamp(),
            currentTimestamp
        );
    }

    /**
     * @notice allows caller to set funding rate for the current window
     */
    function setFundingRate()
        public
        override
        onlyFundingRateProvider
        nonReentrant
    {
        require(
            isFundingRateAllowed(),
            "FundingOracle: on-chain funding rate cannot be applied at the moment"
        );

        uint128 currentTimestamp = _blockTimestamp();
        uint128 expectedWindow = expectedFundingWindow();
        _validateFundingWindow(expectedWindow);

        // sum = sum + ratio{i} * (current time - last trade record time)
        currentFundingWindow.sum =
            currentFundingWindow.sum +
            (currentFundingWindow.ratio *
                (
                    int256(
                        uint256(currentTimestamp - currentFundingWindow.tLast)
                    )
                ));

        // sum / (timestamp of last trade - timestamp of first trade of window) / 24
        currentFundingRate =
            (currentFundingWindow.sum /
                int256(
                    uint256(currentTimestamp - currentFundingWindow.tFirst)
                )) /
            int256(24);

        currentFundingRate =
            ((currentFundingRate > 0 ? int256(1) : int256(-1)) *
                int256(
                    uint256(
                        BaseMath.min(
                            maxFunding,
                            BaseMath.absolute(currentFundingRate)
                        )
                    )
                )) /
            int256(uint256(FUNDING_RATE_WINDOW));

        currentFundingWindow = FundingWindow({
            tFirst: currentTimestamp,
            tLast: currentTimestamp,
            sum: 0,
            ratio: currentFundingWindow.ratio
        });

        windowSet = expectedWindow - 1;

        emit FundingRateUpdate(
            currentFundingRate,
            windowSet,
            (((windowSet + 1) * FUNDING_RATE_WINDOW) + fundingStart) -
                _blockTimestamp(),
            currentTimestamp
        );
    }

    /**
     * @notice Updates funding rate status of this market
     * @dev Must be called by the Guardian
     * @param _newStatus status of funding rate for this market. If not allowed then on-chain
     * funding rate is neither applied nor calculated
     */
    function setFundingRateStatus(Types.GuardianStatus _newStatus)
        external
        override
        nonReentrant
        onlyGuardianContract
    {
        fundingRateStatus = _newStatus;

        // if moving funding rate back on-chain reset the variables
        if (_newStatus == Types.GuardianStatus.ALLOWED) {
            currentFundingWindow.ratio = 0;
            currentFundingWindow.sum = 0;
            currentFundingWindow.tFirst = _blockTimestamp();
            currentFundingWindow.tLast = _blockTimestamp();
        }
    }

    /**
     * @notice Starts funding oracle's 1st window at specified time
     * @dev can only be invoked by funding rate provided i.e. perpetual
     * when trading is started on perpetual by admin using `startTrading`
     * the funding on funding oracle is started as well
     * @param _timestamp time at which funding will start
     */
    function startFunding(uint128 _timestamp)
        public
        override
        onlyFundingRateProvider
    {
        require(fundingStart == 0, "FundingOracle: Funding is already started");
        require(
            _timestamp > _blockTimestamp(),
            "FundingOracle: Start time must be > current block time"
        );

        fundingStart = _timestamp;

        currentFundingWindow.tFirst = _timestamp;
        currentFundingWindow.tLast = _timestamp;

        emit FundingRateStart(fundingStart);
    }

    /**
     * @notice Stops funding oracle
     * @dev can only be invoked by funding rate provided i.e. perpetual
     * when trading is stopped on perpetual by admin using `stopTrading`
     * the funding on funding oracle is stopped as well
     */
    function stopFunding() public override onlyFundingRateProvider {
        fundingStart = 0;

        // reset current funding rate to 0
        currentFundingRate = 0;

        windowSet = 0;

        // since funding has been stopped, reset current funding window
        currentFundingWindow = FundingWindow({
            tFirst: 0,
            tLast: 0,
            ratio: 0,
            sum: 0
        });

        emit FundingRateStop(_blockTimestamp());
    }

    /**
     * @notice updates address of funding rate provider
     * @param _provider the new provider address
     */
    function setFundingRateProvider(address _provider) public onlyOwner {
        provider = _provider;
        emit FRProviderUpdate(provider);
    }

    /**
     * @notice updates max allowed funding to the one provided
     * @param _maxFunding the new provider address
     */
    function setMaxAllowedFundingRate(uint128 _maxFunding) public onlyOwner {
        maxFunding = _maxFunding;
        emit MaxAllowedFRUpdate(maxFunding);
    }

    //===========================================================//
    //                      GETTERS
    //===========================================================//

    /**
     * @notice returns current funding rate
     */
    function getFundingRate() external view override returns (int256) {
        return (currentFundingRate);
    }

    /**
     * Returns true if on-chain funding rate is recorded and applied, else false
     */
    function isFundingRateAllowed() public view override returns (bool) {
        return fundingRateStatus == Types.GuardianStatus.ALLOWED;
    }

    /**
     * @dev returns expected on-going funding rate window
     * The first window starts at index 1.
     */
    function expectedFundingWindow() public view returns (uint128) {
        return
            fundingStart == 0 || _blockTimestamp() < fundingStart
                ? 0
                : ((_blockTimestamp() - fundingStart) / FUNDING_RATE_WINDOW) +
                    1;
    }

    //===========================================================//
    //                      INTERNAL METHODS
    //===========================================================//

    function _validateFundingWindow(uint128 expectedWindow) internal view {
        require(
            expectedWindow > 1,
            "FundingOracle: funding rate is not settable for 0th window"
        );

        // windowSet is by default 0.
        // windowSet should always be < expectedWindow - 1
        // else funding rate for current window is applied don't do anything
        require(
            windowSet < expectedWindow - 1,
            "FundingOracle: funding rate for current window is already set"
        );
    }
}
