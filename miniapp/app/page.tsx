"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPublicClient, formatEther, http, parseAbi, readContract } from "viem";
import { useAccount, useConnect, useWriteContract, useChainId, useSwitchChain } from "wagmi";
import { CHAIN } from "../lib/wagmi";

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
  const { address, isConnected } = useAccount();
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect();
  const { writeContractAsync, status: writeStatus, error: writeError } = useWriteContract();
  const activeChainId = useChainId();
  const { switchChain, isPending: switchPending, error: switchError } = useSwitchChain();

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

  async function handleConnect() {
    try {
      const c = connectors?.[0];
      if (!c) throw new Error("No Mini App connector available");
      await connect({ connector: c, chainId: CHAIN.id });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleSubmitGuess() {
    try {
      setError(null);
      if (!isConnected) throw new Error("Connect wallet inside the Mini App first.");
      if (!guess || guess < 1 || guess > 1000) throw new Error("Enter a number from 1 to 1000.");
      await writeContractAsync({
        address: contract,
        abi,
        functionName: "submitGuess",
        args: [guess],
        value: entryFee,
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link
          href="/menu"
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #2c2c2e",
            background: "#1c1c1e",
            color: "#fff",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          Menu
        </Link>
      </div>
      <h1>Number Guessing on Base</h1>
      <p>Guess a number between 1 and 1000. Closest wins.</p>

      {error && <div style={{ color: '#ff6b6b' }}>Error: {error}</div>}
      {loading && <div>Loading…</div>}

      <section style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        {!isConnected ? (
          <button onClick={handleConnect} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #2c2c2e', background: '#1c1c1e', color: '#fff' }}>
            {connectStatus === 'pending' ? 'Connecting…' : 'Connect Wallet'}
          </button>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.8 }}>Connected: {address}</div>
        )}
        {connectError && <div style={{ color: '#ff6b6b', fontSize: 12 }}>{String((connectError as any)?.message || connectError)}</div>}
        {isConnected && activeChainId !== CHAIN.id && (
          <button onClick={() => switchChain({ chainId: CHAIN.id })} disabled={switchPending} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #2c2c2e', background: '#2a1f00', color: '#ffd36a' }}>
            {switchPending ? 'Switching…' : `Switch to ${CHAIN.name}`}
          </button>
        )}
        {switchError && <div style={{ color: '#ff6b6b', fontSize: 12 }}>{String((switchError as any)?.message || switchError)}</div>}
      </section>

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
              Entry Fee: {formatEther(entryFee)} ETH
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={handleSubmitGuess} disabled={!isConnected || writeStatus === 'pending'} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #2c2c2e', background: '#1c1c1e', color: '#fff' }}>
                {writeStatus === 'pending' ? 'Submitting…' : 'Submit Guess'}
              </button>
              {writeError && <div style={{ color: '#ff6b6b', marginTop: 6, fontSize: 12 }}>{String((writeError as any)?.message || writeError)}</div>}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
            This Mini App uses the Farcaster Mini App Wagmi connector. If you see authorization errors, ensure you
            connect your wallet via the button above before submitting a guess.
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <button onClick={refresh} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #2c2c2e', background: '#1c1c1e', color: '#fff' }}>Refresh</button>
      </section>
    </main>
  );
}
