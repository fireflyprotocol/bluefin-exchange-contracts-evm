// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {IFundingOracle} from "../interfaces/IFundingOracle.sol";
import {Types} from "../libraries/Types.sol";

contract DummyFunder is IFundingOracle {
    bool public _FUNDING_IS_POSITIVE_ = true;
    uint128 public _STARTING_TIME_;
    uint128 public _FUNDING_ = 0;
    uint128 public _PRICE_ = 0;

    function getFundingRate() external view override returns (int256) {
        return (int256(int128(_FUNDING_)));
    }

    function setFundingRate() external override {}

    function setOffChainFundingRate(int256 offchainFundingRate)
        external
        override
    {}

    function setFunding(bool isPositive, uint128 newFunding) external {
        _FUNDING_IS_POSITIVE_ = isPositive;
        _FUNDING_ = newFunding;
    }

    function startFunding(uint128 timestamp) public override {
        _STARTING_TIME_ = timestamp;
    }

    function stopFunding() public override {
        _STARTING_TIME_ = 0;
    }

    function recordTrade(uint128 tradePrice, uint128 oraclePrice)
        public
        override
    {
        _PRICE_ = tradePrice;
        _PRICE_ = oraclePrice;
    }

    function isFundingRateAllowed() external pure override returns (bool) {
        return true;
    }

    function setFundingRateStatus(Types.GuardianStatus newStatus)
        external
        override
    {}
}
