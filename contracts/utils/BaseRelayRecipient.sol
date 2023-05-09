// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../interfaces/IRelayRecipient.sol";

/**
 * A base contract to be inherited by any contract that want to receive relayed transactions
 * A subclass must use "msgSender()" instead of "msg.sender"
 */
abstract contract BaseRelayRecipient {
    /*
     * Forwarder singleton we accept calls from
     */
    address public trustedForwarder;

    /*
     * require a function to be called through GSN only
     */
    modifier trustedForwarderOnly() {
        require(
            msg.sender == address(trustedForwarder),
            "Function can only be called through the trusted Forwarder"
        );
        _;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder;
    }

    function __MetaTransaction_init(address _trustedForwarder) internal {
        trustedForwarder = _trustedForwarder;
    }

    /**
     * return the sender of this call.
     * if the call came through our trusted forwarder, return the original sender.
     * otherwise, return `msg.sender`.
     * should be used in the contract anywhere instead of msg.sender
     */
    function msgSender() public view returns (address payable ret) {
        if (msg.data.length >= 24 && isTrustedForwarder(msg.sender)) {
            // At this point we know that the sender is a trusted forwarder,
            // so we trust that the last bytes of msg.data are the verified sender address.
            // extract sender address from the end of msg.data
            assembly {
                ret := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return payable(msg.sender);
        }
    }
}
