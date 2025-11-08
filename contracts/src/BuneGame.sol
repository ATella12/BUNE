// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";

contract BuneGame {
    // --- Config ---
    IERC20 public immutable paymentToken;
    uint256 public immutable entryAmount; // in smallest units of token

    address public owner;
    address public treasury;
    uint16 public feeBps; // e.g. 2000 = 20%

    uint8 public constant MIN_PICK = 1;
    uint8 public constant MAX_PICK = 100;

    struct RoundInfo {
        bool drawn;
        bool finalized;
        uint8 winningNumber; // 1..100
        uint256 pot; // total collected for the round
        uint256 fee; // protocol fee taken at finalize
    }

    // round => info
    mapping(uint256 => RoundInfo) public rounds;
    // round => number => participants
    mapping(uint256 => mapping(uint8 => address[])) private picks;
    // round => user => claimable amount
    mapping(uint256 => mapping(address => uint256)) public claimable;

    // --- Events ---
    event Entered(uint256 indexed round, address indexed player, uint8 pick);
    event Drawn(uint256 indexed round, uint8 winningNumber);
    event Finalized(uint256 indexed round, uint8 winningNumber, uint256 pot, uint256 fee, uint256 winners);
    event Claimed(uint256 indexed round, address indexed player, uint256 amount);
    event TreasuryUpdated(address indexed treasury);
    event FeeUpdated(uint16 feeBps);
    event OwnerTransferred(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _token, uint256 _entryAmount, uint16 _feeBps, address _treasury) {
        require(_token != address(0), "token");
        require(_treasury != address(0), "treasury");
        require(_feeBps <= 10000, "fee");
        paymentToken = IERC20(_token);
        entryAmount = _entryAmount;
        feeBps = _feeBps;
        treasury = _treasury;
        owner = msg.sender;
        emit OwnerTransferred(msg.sender);
    }

    // --- Rounds ---
    function dayIndex(uint256 ts) public pure returns (uint256) {
        return ts / 1 days;
    }

    function currentRound() public view returns (uint256) {
        return dayIndex(block.timestamp);
    }

    function getPot(uint256 round) external view returns (uint256) {
        return rounds[round].pot;
    }

    function getPicksCount(uint256 round, uint8 number) external view returns (uint256) {
        return picks[round][number].length;
    }

    function getWinningNumber(uint256 round) external view returns (uint8) {
        return rounds[round].winningNumber;
    }

    // --- Game actions ---
    function enter(uint8 pick) external {
        require(pick >= MIN_PICK && pick <= MAX_PICK, "pick");
        uint256 round = currentRound();
        require(paymentToken.transferFrom(msg.sender, address(this), entryAmount), "pay");
        picks[round][pick].push(msg.sender);
        rounds[round].pot += entryAmount;
        emit Entered(round, msg.sender, pick);
    }

    // Local randomness for dev only. In production, replace with VRF.
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
        uint256 pot = r.pot;
        uint256 fee = (pot * feeBps) / 10000;
        r.fee = fee;
        uint256 reward = pot - fee;

        address[] storage winners = picks[round][r.winningNumber];
        uint256 n = winners.length;
        if (n > 0 && reward > 0) {
            uint256 share = reward / n;
            for (uint256 i = 0; i < n; i++) {
                claimable[round][winners[i]] += share;
            }
        }
        r.finalized = true;
        if (fee > 0) {
            require(paymentToken.transfer(treasury, fee), "fee xfer");
        }
        emit Finalized(round, r.winningNumber, pot, fee, n);
    }

    function claim(uint256 round) external {
        uint256 amt = claimable[round][msg.sender];
        require(amt > 0, "none");
        claimable[round][msg.sender] = 0;
        require(paymentToken.transfer(msg.sender, amt), "xfer");
        emit Claimed(round, msg.sender, amt);
    }

    // --- Admin ---
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "addr");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 10000, "fee");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "addr");
        owner = newOwner;
        emit OwnerTransferred(newOwner);
    }
}

