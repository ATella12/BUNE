// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface VRFCoordinatorV2_5Interface {
    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs; // abi-encoded extra args (e.g., nativePayment)
    }

    function requestRandomWords(RandomWordsRequest calldata req) external returns (uint256 requestId);

    // v2.5 subscription admin functions (subset used by our scripts)
    function addConsumer(uint256 subId, address consumer) external;
    function getSubscription(uint256 subId) external view returns (
        uint96 balance,
        uint96 nativeBalance,
        address owner,
        address[] memory consumers
    );
}
