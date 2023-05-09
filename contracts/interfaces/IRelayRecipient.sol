// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

/**
 * a contract must implement this interface in order to support relayed transaction.
 * It is better to inherit the BaseRelayRecipient as its implementation.
 */
interface IRelayRecipient {
    /**
     * return if the forwarder is trusted to forward relayed transactions to us.
     * the forwarder is required to verify the sender's signature, and verify
     * the call is not a replay.
     */
    function isTrustedForwarder(address forwarder) external view returns (bool);

    /**
     * return the sender of this call.
     * if the call came through our trusted forwarder, then the real sender is appended as the last 20 bytes
     * of the msg.data.
     * otherwise, return `msg.sender`
     * should be used in the contract anywhere instead of msg.sender
     */
    function msgSender() external view returns (address payable);

    function versionRecipient() external view returns (string memory);
}
