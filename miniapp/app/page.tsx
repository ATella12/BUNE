"use client";
import { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatEther, http, parseAbi, readContract } from "viem";

const abi = parseAbi([
  "function currentRoundId() view returns (uint256)",
  "function currentRound() view returns ((uint64 startTime,uint64 endTime,bool active,bool settled,uint32 target,uint256 pot,uint256 guessesCount,address winner,bytes32 rngCommit))",
  "function isActive() view returns (bool)",
  "function entryFeeWei() view returns (uint256)",
  "function submitGuess(uint32 number) payable"
]);

export default function Page() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL!;
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
  const client = useMemo(() => createPublicClient({ transport: http(rpcUrl) }), [rpcUrl]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<bigint>(0n);
  const [entryFee, setEntryFee] = useState<bigint>(0n);
  const [round, setRound] = useState<any>(null);
  const [guess, setGuess] = useState<number>(0);

  async function refresh() {
    try {
      setLoading(true);
      const [rid, fee, r] = await Promise.all([
        readContract(client, { address: contract, abi, functionName: "currentRoundId" }),
        readContract(client, { address: contract, abi, functionName: "entryFeeWei" }),
        readContract(client, { address: contract, abi, functionName: "currentRound" })
      ]);
      setRoundId(rid as bigint);
      setEntryFee(fee as bigint);
      setRound(r);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deepLinkData = useMemo(() => {
    if (!guess || guess < 1 || guess > 1000 || !entryFee) return null;
    // encode minimal calldata data for submitGuess(uint32)
    // For users without a connected wallet in miniapp context, provide a base:// deeplink hint
    const selector = "0x" + Buffer.from("submitGuess(uint32)").toString("hex"); // placeholder; present instructions instead
    return { selector, value: entryFee.toString() };
  }, [guess, entryFee]);

  return (
    <main>
      <h1>Number Guessing on Base</h1>
      <p>Guess a number between 1 and 1000. Closest wins.</p>

      {error && <div style={{ color: '#ff6b6b' }}>Error: {error}</div>}
      {loading && <div>Loading…</div>}

      {round && (
        <section style={{ border: '1px solid #2c2c2e', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ opacity: 0.7 }}>Round</div>
              <strong>#{String(roundId)}</strong>
            </div>
            <div>
              <div style={{ opacity: 0.7 }}>Active</div>
              <strong>{round.active ? 'Yes' : 'No'}</strong>
            </div>
            <div>
              <div style={{ opacity: 0.7 }}>Ends</div>
              <strong>{new Date(Number(round.endTime) * 1000).toLocaleString()}</strong>
            </div>
            <div>
              <div style={{ opacity: 0.7 }}>Pot</div>
              <strong>{formatEther(round.pot)} ETH</strong>
            </div>
            <div>
              <div style={{ opacity: 0.7 }}>Guesses</div>
              <strong>{String(round.guessesCount)}</strong>
            </div>
            <div>
              <div style={{ opacity: 0.7 }}>Entry Fee</div>
              <strong>{formatEther(entryFee)} ETH</strong>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label> Your Guess (1..1000): </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={guess || ''}
              onChange={(e) => setGuess(Number(e.target.value))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #3a3a3c', background: '#111', color: '#eee' }}
            />
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
              Submit by sending a transaction to <code>submitGuess(uint32)</code> with value {formatEther(entryFee)} ETH.
              In a Farcaster Miniapp, your client can initiate this via an in-app wallet flow.
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
            Note: This scaffold reads on-chain state via RPC. For sending transactions inside a Farcaster Miniapp,
            wire in your wallet flow (e.g., Base/OnchainKit or WalletConnect). See README for details.
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <button onClick={refresh} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #2c2c2e', background: '#1c1c1e', color: '#fff' }}>Refresh</button>
      </section>
    </main>
  );
}

