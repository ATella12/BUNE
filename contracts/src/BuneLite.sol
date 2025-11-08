// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BuneLite - minimal game without deposits
/// @notice Local-development friendly version of Bune focusing on core flow.
contract BuneLite {
    uint8 public constant MIN_PICK = 1;
    uint8 public constant MAX_PICK = 100;

    struct RoundInfo {
        bool drawn;
        bool finalized;
        uint8 winningNumber; // 1..100
    }

    // round => info
    mapping(uint256 => RoundInfo) public rounds;
    // round => number => participants
    mapping(uint256 => mapping(uint8 => address[])) private picks;

    event Entered(uint256 indexed round, address indexed player, uint8 pick);
    event Drawn(uint256 indexed round, uint8 winningNumber);
    event Finalized(uint256 indexed round, uint8 winningNumber, uint256 winners);

    function dayIndex(uint256 ts) public pure returns (uint256) {
        return ts / 1 days;
    }

    function currentRound() public view returns (uint256) {
        return dayIndex(block.timestamp);
    }

    function enter(uint8 pick) external {
        require(pick >= MIN_PICK && pick <= MAX_PICK, "pick");
        uint256 round = currentRound();
        picks[round][pick].push(msg.sender);
        emit Entered(round, msg.sender, pick);
    }

    // Dev-only random; replace with VRF in production.
    function requestDraw(uint256 round) external {
        require(round < currentRound(), "round not over");
        RoundInfo storage r = rounds[round];
        require(!r.drawn, "drawn");
        uint256 rand = uint256(keccak256(abi.encodePacked(block.prevrandao, blockhash(block.number - 1), round)));
        uint8 winning = uint8(rand % MAX_PICK) + 1; // 1..100
        r.drawn = true;
        r.winningNumber = winning;
        emit Drawn(round, winning);
    }

    function finalize(uint256 round) external {
        RoundInfo storage r = rounds[round];
        require(r.drawn, "not drawn");
        require(!r.finalized, "finalized");
        r.finalized = true;
        uint256 winners = picks[round][r.winningNumber].length;
        emit Finalized(round, r.winningNumber, winners);
    }

    // Views for UI iteration
    function getPicksCount(uint256 round, uint8 number) external view returns (uint256) {
        return picks[round][number].length;
    }

    function getPickAt(uint256 round, uint8 number, uint256 index) external view returns (address) {
        return picks[round][number][index];
    }

    function getWinningNumber(uint256 round) external view returns (uint8) {
        return rounds[round].winningNumber;
    }
}

