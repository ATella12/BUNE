// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library VRFV2PlusClient {
    struct ExtraArgsV1 { bool nativePayment; }

    function extraArgsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory) {
        return abi.encode(extraArgs);
    }
}

