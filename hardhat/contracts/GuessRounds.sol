// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

/// @title GuessRounds - Round-based number guessing game using Chainlink VRF on Base
contract GuessRounds is VRFConsumerBaseV2 {
    // --- Constants ---
    uint256 public constant FEE_DENOMINATOR = 10_000; // basis points
    uint16 public constant OWNER_PAYOUT_BPS = 1000; // 10%
    uint32 public constant MIN_NUMBER = 1;
    uint32 public constant MAX_NUMBER = 1000;

    // --- Access ---
    address public owner;
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    // --- VRF ---
    VRFCoordinatorV2Interface public immutable COORDINATOR;
    bytes32 public keyHash; // gas lane
    uint64 public subId;
    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;

    // --- Game params ---
    uint256 public entryFeeWei;
    uint64 public roundDuration; // seconds
    bool public paused; // blocks new guesses only

    // --- Storage ---
    struct Guess { address player; uint32 number; uint64 timestamp; }
    struct Round {
        uint64 startTime;
        uint64 endTime;
        bool active;
        bool settled;
        uint32 target; // set via VRF
        uint256 pot;
        uint256 guessesCount;
        address winner;
        uint256 requestId; // VRF request id for next round
    }

    uint256 public currentRoundId;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Guess[]) private _guesses; // roundId => guesses

    struct WinnerRecord { uint256 roundId; address winner; uint32 target; uint256 prize; }
    WinnerRecord[] public winners;

    // --- Events ---
    event RoundStarted(uint256 indexed roundId, uint64 startTime, uint64 endTime, uint256 requestId);
    event GuessSubmitted(uint256 indexed roundId, address indexed player, uint32 number, uint64 timestamp, uint256 newPot);
    event RoundEnded(uint256 indexed roundId, uint32 target);
    event Payout(uint256 indexed roundId, address indexed winner, uint256 winnerAmount, uint256 ownerAmount);
    event EntryFeeUpdated(uint256 oldFee, uint256 newFee);
    event RoundDurationUpdated(uint64 oldDur, uint64 newDur);
    event Paused(bool paused);
    event OwnerTransferred(address indexed newOwner);
    event VrfParamsUpdated(bytes32 keyHash, uint64 subId, uint32 callbackGasLimit, uint16 requestConfirmations);

    constructor(
        address coordinator,
        bytes32 _keyHash,
        uint64 _subId,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        uint256 _entryFeeWei,
        uint64 _roundDuration
    ) VRFConsumerBaseV2(coordinator) {
        owner = msg.sender;
        COORDINATOR = VRFCoordinatorV2Interface(coordinator);
        keyHash = _keyHash;
        subId = _subId;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        entryFeeWei = _entryFeeWei;
        roundDuration = _roundDuration;
        emit OwnerTransferred(msg.sender);
    }

    // --- Views ---
    function isActive() external view returns (bool) {
        Round storage r = rounds[currentRoundId];
        return r.active && block.timestamp < r.endTime;
    }
    function currentRound() external view returns (Round memory) { return rounds[currentRoundId]; }
    function getGuesses(uint256 roundId) external view returns (Guess[] memory) { return _guesses[roundId]; }
    function priorWinnersCount() external view returns (uint256) { return winners.length; }
    function getWinnerAt(uint256 i) external view returns (WinnerRecord memory) { return winners[i]; }

    // --- Admin params ---
    function setEntryFeeWei(uint256 newFee) external onlyOwner { require(newFee > 0, "fee"); emit EntryFeeUpdated(entryFeeWei, newFee); entryFeeWei = newFee; }
    function setRoundDuration(uint64 newDur) external onlyOwner { require(newDur >= 10 minutes && newDur <= 7 days, "dur"); emit RoundDurationUpdated(roundDuration, newDur); roundDuration = newDur; }
    function setPaused(bool p) external onlyOwner { paused = p; emit Paused(p); }
    function transferOwnership(address n) external onlyOwner { require(n != address(0), "zero"); owner = n; emit OwnerTransferred(n); }
    function setVrfParams(bytes32 _keyHash, uint64 _subId, uint32 _callbackGasLimit, uint16 _requestConfirmations) external onlyOwner {
        keyHash = _keyHash; subId = _subId; callbackGasLimit = _callbackGasLimit; requestConfirmations = _requestConfirmations; emit VrfParamsUpdated(_keyHash, _subId, _callbackGasLimit, _requestConfirmations);
    }

    // --- Flow ---
    /// @notice Request randomness to bootstrap the next round (call after deploy or after a round is ended if needed).
    function requestNextRoundRandomness() public onlyOwner returns (uint256 reqId) {
        reqId = COORDINATOR.requestRandomWords(keyHash, subId, requestConfirmations, callbackGasLimit, 1);
        // Temporarily store on the next round index (currentRoundId+1)
        rounds[currentRoundId + 1].requestId = reqId;
    }

    /// @notice Submit a guess for the active round.
    function submitGuess(uint32 number) external payable {
        Round storage r = rounds[currentRoundId];
        require(r.active, "no round");
        require(!paused, "paused");
        require(block.timestamp < r.endTime, "ended");
        require(number >= MIN_NUMBER && number <= MAX_NUMBER, "range");
        require(msg.value == entryFeeWei, "fee");
        r.pot += msg.value; r.guessesCount += 1;
        _guesses[currentRoundId].push(Guess({player: msg.sender, number: number, timestamp: uint64(block.timestamp)}));
        emit GuessSubmitted(currentRoundId, msg.sender, number, uint64(block.timestamp), r.pot);
    }

    /// @notice End and settle the current round. Owner only.
    function endAndSettle() external onlyOwner {
        Round storage r = rounds[currentRoundId];
        require(r.active, "not active");
        require(block.timestamp >= r.endTime, "not over");
        require(!r.settled, "settled");
        r.active = false;
        emit RoundEnded(currentRoundId, r.target);

        Guess[] storage gs = _guesses[currentRoundId];
        uint256 n = gs.length;
        if (n == 0) {
            r.settled = true;
            // No payout; request RNG for next round and return
            requestNextRoundRandomness();
            return;
        }
        if (n == 1) {
            // refund full pot
            address payable onlyP = payable(gs[0].player);
            uint256 amt = r.pot; r.pot = 0; r.winner = onlyP; r.settled = true;
            (bool ok,) = onlyP.call{value: amt}(""); require(ok, "refund");
            winners.push(WinnerRecord({roundId: currentRoundId, winner: onlyP, target: r.target, prize: amt}));
            emit Payout(currentRoundId, onlyP, amt, 0);
            requestNextRoundRandomness();
            return;
        }

        // Find winner by closest number, earliest timestamp tie-breaker
        uint32 target = r.target;
        uint256 bestIdx = 0; uint256 bestDelta = _absDiff(gs[0].number, target); uint64 bestTs = gs[0].timestamp;
        for (uint256 i = 1; i < n; i++) {
            uint256 d = _absDiff(gs[i].number, target);
            if (d < bestDelta || (d == bestDelta && gs[i].timestamp < bestTs)) { bestDelta = d; bestTs = gs[i].timestamp; bestIdx = i; }
        }

        address payable w = payable(gs[bestIdx].player);
        uint256 ownerCut = (r.pot * OWNER_PAYOUT_BPS) / FEE_DENOMINATOR;
        uint256 winAmt = r.pot - ownerCut;
        r.pot = 0; r.winner = w; r.settled = true;
        (bool okW,) = w.call{value: winAmt}(""); require(okW, "winner");
        (bool okO,) = payable(owner).call{value: ownerCut}(""); require(okO, "owner");
        winners.push(WinnerRecord({roundId: currentRoundId, winner: w, target: target, prize: winAmt}));
        emit Payout(currentRoundId, w, winAmt, ownerCut);

        requestNextRoundRandomness();
    }

    /// @dev VRF callback. Sets target for next round and starts it.
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        // Find which next-round entry this request corresponds to
        uint256 nextId = currentRoundId + 1;
        Round storage rNext = rounds[nextId];
        require(rNext.requestId == requestId, "bad reqId");
        uint32 target = uint32(randomWords[0] % MAX_NUMBER) + 1;
        rNext.target = target;
        // Start next round
        currentRoundId = nextId;
        rNext.startTime = uint64(block.timestamp);
        rNext.endTime = uint64(block.timestamp) + roundDuration;
        rNext.active = true;
        emit RoundStarted(nextId, rNext.startTime, rNext.endTime, requestId);
    }

    // --- Utils ---
    function _absDiff(uint32 a, uint32 b) internal pure returns (uint256) { return a > b ? a - b : b - a; }

    // Receive ETH
    receive() external payable {}
}
