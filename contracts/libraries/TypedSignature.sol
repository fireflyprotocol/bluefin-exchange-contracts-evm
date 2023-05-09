// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

/**
 * This contract has been largely taken from (https://github.com/dydxprotocol/perpetual/blob/master/contracts/protocol/lib/TypedSignature.sol)
 * The credit belongs to dydx.
 */
library TypedSignature {
    //
    // ENUMS
    //

    // Different RPC providers may implement signing methods differently, so we allow different
    // signature types depending on the string prepended to a hash before it was signed.
    enum SignatureType {
        NoPrepend, // No string was prepended.
        Decimal, // PREPEND_DEC was prepended.
        Hexadecimal, // PREPEND_HEX was prepended.
        Invalid // Not a valid type. Used for bound-checking.
    }

    //
    // STRUCTS
    //

    struct Signature {
        bytes32 r;
        bytes32 s;
        bytes2 vType;
    }

    //
    // CONSTANTS
    //

    bytes32 private constant FILE = "TypedSignature";

    // Prepended message with the length of the signed hash in decimal.
    bytes private constant PREPEND_DEC = "\x19Ethereum Signed Message:\n32";

    // Prepended message with the length of the signed hash in hexadecimal.
    bytes private constant PREPEND_HEX = "\x19Ethereum Signed Message:\n\x20";

    // Number of bytes in a typed signature.
    uint128 private constant NUM_SIGNATURE_BYTES = 66;

    // ============ Functions ============

    /**
     * @dev Gives the address of the signer of a hash. Also allows for the commonly prepended string
     *  of '\x19Ethereum Signed Message:\n' + message.length
     *
     * @param  hash       Hash that was signed (does not include prepended message).
     * @param  signature  Type and ECDSA signature with structure: {32:r}{32:s}{1:v}{1:type}
     * @return            Address of the signer of the hash.
     */
    function recover(bytes32 hash, Signature memory signature)
        internal
        pure
        returns (address)
    {
        SignatureType sigType = SignatureType(
            uint8(bytes1(signature.vType << 8))
        );

        bytes32 signedHash;
        if (sigType == SignatureType.NoPrepend) {
            signedHash = hash;
        } else if (sigType == SignatureType.Decimal) {
            signedHash = keccak256(abi.encodePacked(PREPEND_DEC, hash));
        } else {
            assert(sigType == SignatureType.Hexadecimal);
            signedHash = keccak256(abi.encodePacked(PREPEND_HEX, hash));
        }

        return
            ecrecover(
                signedHash,
                uint8(bytes1(signature.vType)),
                signature.r,
                signature.s
            );
    }
}
