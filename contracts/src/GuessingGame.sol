// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuessingGame - Round-based number guessing game with ETH entry fees
/// @notice Designed for deployment on Base. Uses owner-controlled lifecycle and
///         a hook to request randomness for the next round. Replace the
///         pseudo-randomness with a VRF integration for production.
contract GuessingGame {
    // --- Constants / Defaults ---
    uint256 public constant FEE_DENOMINATOR = 10_000; // basis points
    uint256 public constant DEFAULT_DURATION = 2 days;
    uint256 public constant DEFAULT_ENTRY_FEE_WEI = 10_000_000_000_000; // 0.00001 ETH
    uint16 public constant OWNER_PAYOUT_BPS = 1000; // 10%
    uint256 public constant MIN_NUMBER = 1;
    uint256 public constant MAX_NUMBER = 1000;

    // --- Ownership / Admin ---
    address public owner;
    bool public paused; // pause new predictions only

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // --- Round and Guess Data ---
    struct Guess {
        address player;
        uint32 number; // 1..1000
        uint64 timestamp;
    }

    struct RoundInfo {
        uint64 startTime;
        uint64 endTime;
        bool active; // accepting guesses
        bool settled;
        uint32 target; // set when randomness is revealed
        uint256 pot; // total ETH collected for this round
        uint256 guessesCount;
        address winner;
        bytes32 rngCommit; // placeholder: request/commit id for randomness
    }

    // roundId => round
    mapping(uint256 => RoundInfo) public rounds;
    // roundId => guesses array
    mapping(uint256 => Guess[]) private _guesses;
    // history of winners
    struct WinnerRecord { uint256 roundId; address winner; uint32 target; uint256 prize; }
    WinnerRecord[] public winners;

    // --- Configurable Params ---
    uint256 public entryFeeWei = DEFAULT_ENTRY_FEE_WEI;
    uint64 public roundDuration = uint64(DEFAULT_DURATION);

    // --- Round cursor ---
    uint256 public currentRoundId;

    // --- Events ---
    event RoundStarted(uint256 indexed roundId, uint64 startTime, uint64 endTime, bytes32 rngCommit);
    event GuessSubmitted(uint256 indexed roundId, address indexed player, uint32 number, uint64 timestamp, uint256 newPot);
    event RoundEnded(uint256 indexed roundId, uint32 target);
    event Payout(uint256 indexed roundId, address indexed winner, uint256 winnerAmount, uint256 ownerAmount);
    event EntryFeeUpdated(uint256 oldFee, uint256 newFee);
    event RoundDurationUpdated(uint64 oldDur, uint64 newDur);
    event Paused(bool paused);
    event OwnerTransferred(address indexed newOwner);

    constructor() {
        owner = msg.sender;
        emit OwnerTransferred(msg.sender);
        // Initialize first round in paused state; owner must call startNextRound()
    }

    // --- Views ---
    function isActive() external view returns (bool) {
        RoundInfo storage r = rounds[currentRoundId];
        return r.active && block.timestamp < r.endTime;
    }

    function currentRound() external view returns (RoundInfo memory) {
        return rounds[currentRoundId];
    }

    function getGuesses(uint256 roundId) external view returns (Guess[] memory) {
        return _guesses[roundId];
    }

    function priorWinnersCount() external view returns (uint256) {
        return winners.length;
    }

    function getWinnerAt(uint256 index) external view returns (WinnerRecord memory) {
        return winners[index];
    }

    // --- Admin: parameters ---
    function setEntryFeeWei(uint256 newFee) external onlyOwner {
        require(newFee > 0, "fee=0");
        emit EntryFeeUpdated(entryFeeWei, newFee);
        entryFeeWei = newFee;
    }

    function setRoundDuration(uint64 newDuration) external onlyOwner {
        require(newDuration >= 10 minutes && newDuration <= 7 days, "duration bounds");
        emit RoundDurationUpdated(roundDuration, newDuration);
        roundDuration = newDuration;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
        emit OwnerTransferred(newOwner);
    }

    // --- Round lifecycle ---
    /// @notice Owner starts the next round. Must be called after deploy and after each settlement.
    /// @dev For production, replace rngCommit with a real VRF/DRAND/pyth randomness request id and
    ///      set target in its callback before activating guesses. For scaffold simplicity, we commit
    ///      to a pseudo-random seed here and derive target immediately.
    function startNextRound() public onlyOwner {
        require(!rounds[currentRoundId].active || rounds[currentRoundId].settled, "prev active");
        currentRoundId += 1;
        RoundInfo storage r = rounds[currentRoundId];
        r.startTime = uint64(block.timestamp);
        r.endTime = uint64(block.timestamp) + roundDuration;
        // Pseudo-commit: In real VRF, you'd store requestId; here we store a seed commit
        r.rngCommit = keccak256(abi.encodePacked(block.prevrandao, blockhash(block.number - 1), address(this), currentRoundId));
        // For scaffold, set target immediately from commit (replace with async fulfill in prod)
        r.target = _deriveTarget(r.rngCommit);
        r.active = true;
        emit RoundStarted(currentRoundId, r.startTime, r.endTime, r.rngCommit);
    }

    /// @notice Submit a guess for the active round by paying the entry fee.
    function submitGuess(uint32 number) external payable {
        RoundInfo storage r = rounds[currentRoundId];
        require(r.active, "no round");
        require(!paused, "paused");
        require(block.timestamp < r.endTime, "ended");
        require(number >= MIN_NUMBER && number <= MAX_NUMBER, "range");
        require(msg.value == entryFeeWei, "fee");

        r.pot += msg.value;
        r.guessesCount += 1;
        _guesses[currentRoundId].push(Guess({
            player: msg.sender,
            number: number,
            timestamp: uint64(block.timestamp)
        }));
        emit GuessSubmitted(currentRoundId, msg.sender, number, uint64(block.timestamp), r.pot);
    }

    /// @notice End and settle the round. Owner determines winner and pays out.
    /// Rules: closest wins; tie-breaker earliest timestamp; exact-match ties -> earliest wins.
    /// Edge case: only one participant -> refund that participant, no owner cut.
    function endAndSettle() external onlyOwner {
        RoundInfo storage r = rounds[currentRoundId];
        require(r.active, "not active");
        require(block.timestamp >= r.endTime, "not over");
        require(!r.settled, "settled");

        r.active = false;
        emit RoundEnded(currentRoundId, r.target);

        Guess[] storage gs = _guesses[currentRoundId];
        uint256 n = gs.length;

        if (n == 0) {
            // Nothing to pay; carry over pot to next round (or allow owner to withdraw later?)
            // For simplicity, pot remains and can be manually handled in future.
            r.settled = true;
            // Start next round and derive next randomness
            startNextRound();
            return;
        }
        if (n == 1) {
            // Refund only participant fully, no owner cut
            address payable onlyPlayer = payable(gs[0].player);
            uint256 amount = r.pot;
            r.pot = 0;
            (bool ok1,) = onlyPlayer.call{value: amount}("");
            require(ok1, "refund fail");
            r.winner = onlyPlayer;
            winners.push(WinnerRecord({roundId: currentRoundId, winner: onlyPlayer, target: r.target, prize: amount}));
            r.settled = true;
            emit Payout(currentRoundId, onlyPlayer, amount, 0);
            startNextRound();
            return;
        }

        // Find closest
        uint32 target = r.target;
        uint256 bestIndex = 0;
        uint256 bestDelta = _absDiff(gs[0].number, target);
        uint64 bestTs = gs[0].timestamp;
        for (uint256 i = 1; i < n; i++) {
            uint256 d = _absDiff(gs[i].number, target);
            if (d < bestDelta || (d == bestDelta && gs[i].timestamp < bestTs)) {
                bestDelta = d;
                bestTs = gs[i].timestamp;
                bestIndex = i;
            }
        }
        address payable winnerAddr = payable(gs[bestIndex].player);

        uint256 ownerCut = (r.pot * OWNER_PAYOUT_BPS) / FEE_DENOMINATOR; // 10%
        uint256 winnerAmt = r.pot - ownerCut;
        // Pay winner first
        r.pot = 0;
        (bool okW,) = winnerAddr.call{value: winnerAmt}("");
        require(okW, "winner xfer");
        // Pay owner cut
        (bool okO,) = payable(owner).call{value: ownerCut}("");
        require(okO, "owner xfer");

        r.winner = winnerAddr;
        r.settled = true;
        winners.push(WinnerRecord({roundId: currentRoundId, winner: winnerAddr, target: target, prize: winnerAmt}));
        emit Payout(currentRoundId, winnerAddr, winnerAmt, ownerCut);

        // Start next round
        startNextRound();
    }

    // --- Internal utils ---
    function _absDiff(uint32 a, uint32 b) internal pure returns (uint256) {
        return a > b ? uint256(a - b) : uint256(b - a);
    }

    function _deriveTarget(bytes32 commit) internal pure returns (uint32) {
        // 1..1000
        uint256 v = uint256(commit);
        return uint32(v % MAX_NUMBER) + 1;
    }
}

