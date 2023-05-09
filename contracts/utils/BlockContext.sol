// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

// wrap block.xxx functions
// only support timestamp and number so far
abstract contract BlockContext {
    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    function _blockTimestamp() internal view virtual returns (uint128) {
        return uint128(block.timestamp);
    }

    function _blockNumber() internal view virtual returns (uint128) {
        return uint128(block.number);
    }
}
