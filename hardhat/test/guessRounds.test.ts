import { expect } from "chai";
import { ethers } from "hardhat";

describe("GuessRounds", function () {
  async function deployFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    // Deploy VRFCoordinatorV2Mock
    const BASE_FEE = 0; // not used in mock path, keep 0
    const GAS_PRICE_LINK = 0;
    const COORDFactory = await ethers.getContractFactory("ChainlinkVRFCoordinatorV2Mock");
    const coord = await COORDFactory.deploy(BASE_FEE, GAS_PRICE_LINK);
    await coord.waitForDeployment();
    const coordAddr = await coord.getAddress();

    // Create/fund subscription
    const txSub = await coord.createSubscription();
    const rcSub = await txSub.wait();
    const subId = rcSub!.logs[0].args?.subId || 1n;
    await coord.fundSubscription(subId, ethers.parseEther("100"));

    // Deploy contract
    const keyHash = ethers.keccak256(ethers.toUtf8Bytes("gasLane"));
    const callbackGasLimit = 250000;
    const requestConfirmations = 3;
    const entryFee = ethers.parseEther("0.00001");
    const roundDuration = 3600;

    const GuessRounds = await ethers.getContractFactory("GuessRounds");
    const game = await GuessRounds.deploy(
      coordAddr, keyHash, Number(subId), callbackGasLimit, requestConfirmations, entryFee, roundDuration
    );
    await game.waitForDeployment();
    const gameAddr = await game.getAddress();
    // Add consumer
    await coord.addConsumer(subId, gameAddr);

    return { owner, alice, bob, carol, game, coord, subId, keyHash };
  }

  async function fulfillNextRoundRandomness(coord: any, game: any, subId: bigint, keyHash: string, seed: bigint) {
    // Request RNG for next round
    await (await game.requestNextRoundRandomness()).wait();
    // Read requestId from storage via public getter for next round (round 1)
    const reqId = (await game.rounds(1)).requestId;
    // fulfill
    await (await coord.fulfillRandomWordsWithOverride(reqId, await game.getAddress(), [seed])).wait();
  }

  it("starts round on VRF fulfill and accepts guesses", async () => {
    const { alice, game, coord, subId, keyHash } = await deployFixture();
    await fulfillNextRoundRandomness(coord, game, subId, keyHash, 777n);
    const r = await game.currentRound();
    expect(r.active).to.eq(true);
    await (await game.connect(alice).submitGuess(500, { value: await game.entryFeeWei() })).wait();
    const after = await game.currentRound();
    expect(after.guessesCount).to.eq(1n);
  });

  it("winner selection and tie-breaker earliest timestamp", async () => {
    const { owner, alice, bob, game, coord, subId, keyHash } = await deployFixture();
    // seed -> target = (seed % 1000) + 1
    const seed = 100n; // target = 101
    await fulfillNextRoundRandomness(coord, game, subId, keyHash, seed);
    const fee = await game.entryFeeWei();
    await (await game.connect(alice).submitGuess(200, { value: fee })).wait(); // delta 99
    await (await game.connect(bob).submitGuess(2, { value: fee })).wait();     // delta 99 but later timestamp

    // fast-forward beyond end
    const r = await game.currentRound();
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(r.endTime) + 1]);
    await ethers.provider.send("evm_mine", []);
    const potBefore = (await game.currentRound()).pot;

    await (await game.connect(owner).endAndSettle()).wait();
    // Since tie on delta, earliest (alice) should win
    const lastWinner = await game.priorWinnersCount();
    const rec = await game.getWinnerAt(lastWinner - 1n);
    expect(rec.winner).to.eq(await alice.getAddress());
    // 90/10 split
    expect(rec.prize).to.eq((potBefore * 9000n) / 10000n);
  });

  it("single participant gets full refund, no owner cut", async () => {
    const { owner, alice, game, coord, subId, keyHash } = await deployFixture();
    await fulfillNextRoundRandomness(coord, game, subId, keyHash, 50n);
    const fee = await game.entryFeeWei();
    await (await game.connect(alice).submitGuess(10, { value: fee })).wait();

    const r = await game.currentRound();
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(r.endTime) + 1]);
    await ethers.provider.send("evm_mine", []);
    await (await game.connect(owner).endAndSettle()).wait();

    const last = await game.priorWinnersCount();
    const rec = await game.getWinnerAt(last - 1n);
    expect(rec.winner).to.eq(await alice.getAddress());
    expect(rec.prize).to.eq(fee);
  });

  it("pause/resume blocks new guesses only", async () => {
    const { owner, alice, game, coord, subId, keyHash } = await deployFixture();
    await fulfillNextRoundRandomness(coord, game, subId, keyHash, 5n);
    await (await game.connect(owner).setPaused(true)).wait();
    await expect(game.connect(alice).submitGuess(10, { value: await game.entryFeeWei() })).to.be.revertedWith("paused");
    await (await game.connect(owner).setPaused(false)).wait();
    await expect(game.connect(alice).submitGuess(10, { value: await game.entryFeeWei() })).to.not.be.reverted;
  });

  it("admin updates entry fee and duration", async () => {
    const { owner, game, coord, subId, keyHash } = await deployFixture();
    await fulfillNextRoundRandomness(coord, game, subId, keyHash, 9n);
    await (await game.connect(owner).setEntryFeeWei(123n)).wait();
    expect(await game.entryFeeWei()).to.eq(123n);
    await (await game.connect(owner).setRoundDuration(10 * 60)).wait();
    expect(await game.roundDuration()).to.eq(10 * 60);
  });
});
