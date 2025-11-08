import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useBalance } from 'wagmi'
import { createPublicClient, formatEther, http, getAddress } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { abi } from '../abi'

const truncate = (a?: string) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : ''

export default function App() {
  const { connectors, connect, status: connStatus } = useConnect()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, status: writeStatus } = useWriteContract()
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState<any>(null)
  const [roundId, setRoundId] = useState<bigint>(0n)
  const [entryFee, setEntryFee] = useState<bigint>(0n)
  const [guesses, setGuesses] = useState<any[]>([])
  const [guess, setGuess] = useState<number>(0)
  const [winners, setWinners] = useState<any[]>([])
  const [now, setNow] = useState<number>(Math.floor(Date.now()/1000))
  const rpcUrl = import.meta.env.VITE_RPC_URL as string
  const contract = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`
  const client = useMemo(() => createPublicClient({ chain: chainId===base.id?base:baseSepolia, transport: http(rpcUrl) }), [rpcUrl, chainId])

  async function refresh() {
    try {
      const [rid, fee, r] = await Promise.all([
        client.readContract({ address: contract, abi, functionName: 'currentRoundId' }) as Promise<bigint>,
        client.readContract({ address: contract, abi, functionName: 'entryFeeWei' }) as Promise<bigint>,
        client.readContract({ address: contract, abi, functionName: 'currentRound' })
      ])
      setRoundId(rid)
      setEntryFee(fee)
      setRound(r)
      const gs = await client.readContract({ address: contract, abi, functionName: 'getGuesses', args: [rid] }) as any[]
      setGuesses(gs)
      setError(null)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  useEffect(() => { 
    refresh(); 
    const i = setInterval(() => setNow(Math.floor(Date.now()/1000)), 1000); 
    const p = setInterval(() => refresh(), 5000);
    return () => { clearInterval(i); clearInterval(p) }
  }, [])

  useEffect(() => { (async () => {
    try {
      const count = await client.readContract({ address: contract, abi, functionName: 'priorWinnersCount' }) as bigint
      const items: any[] = []
      const start = count > 10n ? count - 10n : 0n
      for (let i = count; i > start; i--) {
        const rec = await client.readContract({ address: contract, abi, functionName: 'getWinnerAt', args: [i - 1n] })
        items.push(rec)
      }
      setWinners(items)
    } catch {}
  })() }, [client, contract, now])

  async function submit() {
    if (!guess || guess < 1 || guess > 1000) { setError('Enter 1..1000'); return }
    try {
      setError(null)
      await writeContractAsync({ address: contract, abi, functionName: 'submitGuess', args: [guess], value: entryFee })
      await refresh()
    } catch (e: any) { setError(e?.shortMessage || e?.message || String(e)) }
  }

  const endsIn = round ? Math.max(0, Number(round.endTime) - now) : 0

  const onMiniapp = typeof window !== 'undefined' && window.location.pathname === '/miniapp'

  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>GuessRounds</h2>
        <div>
          {isConnected ? (
            <button onClick={() => disconnect()} title={address || ''} style={{ padding: '6px 10px' }}>{truncate(address)}</button>
          ) : (
            connectors.map(c => (
              <button key={c.uid} onClick={() => connect({ connector: c })} disabled={!c.ready} style={{ padding: '6px 10px', marginLeft: 8 }}>{c.name}</button>
            ))
          )}
        </div>
      </header>

      {error && <div style={{ background: '#311', border: '1px solid #633', padding: 8, marginTop: 12 }}>{error}</div>}

      {round && (
        <section style={{ marginTop: 16, border: '1px solid #2c2c2e', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div><div style={{opacity:0.7}}>Round</div><strong>#{String(roundId)}</strong></div>
            <div><div style={{opacity:0.7}}>Active</div><strong>{round.active ? 'Yes' : 'No'}</strong></div>
            <div><div style={{opacity:0.7}}>Ends</div><strong>{new Date(Number(round.endTime)*1000).toLocaleString()}</strong></div>
            <div><div style={{opacity:0.7}}>Pot</div><strong>{formatEther(round.pot)} ETH</strong></div>
            <div><div style={{opacity:0.7}}>Guesses</div><strong>{String(round.guessesCount)}</strong></div>
            <div><div style={{opacity:0.7}}>Entry</div><strong>{formatEther(entryFee)} ETH</strong></div>
          </div>
          <div style={{ marginTop: 12 }}>Countdown: {Math.floor(endsIn/60)}m {endsIn%60}s</div>
          {!onMiniapp && (
            <div style={{ marginTop: 12 }}>
              <input type="number" min={1} max={1000} value={guess||''} onChange={e=>setGuess(Number(e.target.value))} style={{ padding: 8, borderRadius: 8, border: '1px solid #3a3a3c', background: '#111', color: '#eee' }} />
              <button onClick={submit} style={{ marginLeft: 8, padding: '8px 12px' }}>Submit Guess</button>
            </div>
          )}
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <h3>Live Activity</h3>
        <button onClick={refresh} style={{ padding: '6px 10px' }}>Refresh</button>
        <ul>
          {guesses.slice().reverse().slice(0, 20).map((g, i) => (
            <li key={i} style={{ opacity: 0.9 }}>{truncate(g.player)} guessed {g.number} at {new Date(Number(g.timestamp)*1000).toLocaleTimeString()}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>History (latest)</h3>
        {winners.length === 0 ? <p>No winners yet.</p> : (
          <ul>
            {winners.map((w, idx) => (
              <li key={idx}>
                Round #{String(w.roundId)} — Winner {truncate(w.winner)} — Target {String(w.target)} — Prize {formatEther(w.prize)} ETH
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
