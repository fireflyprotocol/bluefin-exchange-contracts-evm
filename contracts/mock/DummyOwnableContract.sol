// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;
import {FFLYFiOwnableUpgrade} from "../utils/FFLYFiOwnableUpgrade.sol";
import {BlockContext} from "../utils/BlockContext.sol";

contract DummyOwnableContract is FFLYFiOwnableUpgrade, BlockContext {
    function initialize() public initializer {
        __Ownable_init();
    }

    function blockTimestamp() public view returns (uint128) {
        return _blockTimestamp();
    }

    function blockNumber() public view returns (uint128) {
        return _blockNumber();
    }
}
