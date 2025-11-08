export const abi = [
  {
    "type": "function",
    "name": "currentRoundId",
    "inputs": [],
    "outputs": [{"name":"","type":"uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentRound",
    "inputs": [],
    "outputs": [
      {"type":"tuple","components":[
        {"name":"startTime","type":"uint64"},
        {"name":"endTime","type":"uint64"},
        {"name":"active","type":"bool"},
        {"name":"settled","type":"bool"},
        {"name":"target","type":"uint32"},
        {"name":"pot","type":"uint256"},
        {"name":"guessesCount","type":"uint256"},
        {"name":"winner","type":"address"},
        {"name":"requestId","type":"uint256"}
      ]}
    ],
    "stateMutability": "view"
  },
  { "type":"function", "name":"entryFeeWei", "inputs": [], "outputs":[{"type":"uint256"}], "stateMutability":"view" },
  { "type":"function", "name":"getGuesses", "inputs": [{"name":"roundId","type":"uint256"}], "outputs":[{"type":"tuple[]","components":[{"name":"player","type":"address"},{"name":"number","type":"uint32"},{"name":"timestamp","type":"uint64"}]}], "stateMutability":"view" },
  { "type":"function", "name":"submitGuess", "inputs": [{"name":"number","type":"uint32"}], "outputs": [], "stateMutability":"payable" },
  { "type":"event", "name":"GuessSubmitted", "inputs": [
    {"name":"roundId","type":"uint256","indexed":true},
    {"name":"player","type":"address","indexed":true},
    {"name":"number","type":"uint32","indexed":false},
    {"name":"timestamp","type":"uint64","indexed":false},
    {"name":"newPot","type":"uint256","indexed":false}
  ] }
];

