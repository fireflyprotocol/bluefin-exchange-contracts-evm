// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {AggregatorV2V3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV2V3Interface.sol";
import {FFLYFiOwnableUpgrade} from "../utils/FFLYFiOwnableUpgrade.sol";

/**
 * @notice Chainlink MockV3Proxy
 * @dev this contract is used to test
 * other contract's ability to read data from an
 * proxy contract, but how the proxy got
 * its answer is unimportant
 */
contract DummyPriceOracle is AggregatorV2V3Interface, FFLYFiOwnableUpgrade {
    uint256 public constant override version = 0;

    uint8 public override decimals;
    int256 public override latestAnswer;
    uint256 public override latestTimestamp;
    uint256 public override latestRound;

    mapping(uint256 => int256) public override getAnswer;
    mapping(uint256 => uint256) public override getTimestamp;
    mapping(uint256 => uint256) private getStartedAt;

    function initialize(int256 _answer) public initializer {
        setPrice(_answer);
    }

    function setPrice(int256 _answer) public {
        latestAnswer = _answer / 1e10; // chainlink stores price in 1e^8 , while our tests will provide 1e^18
        latestTimestamp = block.timestamp;
        latestRound++;
        getAnswer[latestRound] = _answer / 1e10; // chainlink stores price in 1e^8 , while our tests will provide 1e^18
        getTimestamp[latestRound] = block.timestamp;
        getStartedAt[latestRound] = block.timestamp;
    }

    function updateRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _timestamp,
        uint256 _startedAt
    ) public {
        latestRound = _roundId;
        latestAnswer = _answer;
        latestTimestamp = _timestamp;
        getAnswer[latestRound] = _answer;
        getTimestamp[latestRound] = _timestamp;
        getStartedAt[latestRound] = _startedAt;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            getAnswer[_roundId],
            getStartedAt[_roundId],
            getTimestamp[_roundId],
            _roundId
        );
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(latestRound),
            getAnswer[latestRound],
            getStartedAt[latestRound],
            getTimestamp[latestRound],
            uint80(latestRound)
        );
    }

    function description() external pure override returns (string memory) {
        return "v0.8/tests/MockV3Aggregator.sol";
    }
}
