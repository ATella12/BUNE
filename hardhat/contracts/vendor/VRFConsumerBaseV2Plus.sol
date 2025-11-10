// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal VRF v2.5 consumer base to gate the callback to the coordinator.
abstract contract VRFConsumerBaseV2Plus {
    address private immutable vrfCoordinator;

    constructor(address _vrfCoordinator) {
        vrfCoordinator = _vrfCoordinator;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal virtual;

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        require(msg.sender == vrfCoordinator, "only coordinator");
        fulfillRandomWords(requestId, randomWords);
    }
}

