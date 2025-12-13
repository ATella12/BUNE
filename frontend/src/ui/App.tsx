import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSendCalls, useSwitchChain } from 'wagmi'
import { createPublicClient, formatEther, http, encodeFunctionData, toHex, getAddress } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { abi } from '../abi'
import { appendBuilderCodeSuffix, sendCallsCapabilities } from '../lib/builderCode'

const truncate = (a?: string) => a ? `${a.slice(0,6)}ƒ?İ${a.slice(-4)}` : ''

export default function App() {
  const { connectors, connect, status: connStatus } = useConnect()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { sendCallsAsync } = useSendCalls()
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState<any>(null)
  const [roundId, setRoundId] = useState<bigint>(0n)
  const [entryFee, setEntryFee] = useState<bigint>(0n)
  const [guesses, setGuesses] = useState<any[]>([])
  const [guess, setGuess] = useState<number>(0)
  const [winners, setWinners] = useState<any[]>([])
  const [now, setNow] = useState<number>(Math.floor(Date.now()/1000))
  const [simMsg, setSimMsg] = useState<string | null>(null)
  const [owner, setOwner] = useState<string | null>(null)
  const rpcUrl = import.meta.env.VITE_RPC_URL as string
  const contract = getAddress(import.meta.env.VITE_CONTRACT_ADDRESS as string) as `0x${string}`
  const desiredChainId = Number(import.meta.env.VITE_CHAIN_ID || 84532)
  const desiredChain = desiredChainId === base.id ? base : baseSepolia
  const client = useMemo(() => createPublicClient({ chain: desiredChain, transport: http(rpcUrl) }), [rpcUrl, desiredChainId])
  const desiredChainHex = '0x' + desiredChainId.toString(16)

  const sendWithBuilderCode = async (calls: { to: `0x${string}`; data?: `0x${string}`; value?: bigint }[]) => {
    try {
      await (sendCallsAsync as any)({ calls, chainId: desiredChainId, capabilities: sendCallsCapabilities as any })
      return
    } catch (e) {
      const eth = (typeof window !== 'undefined' && (window as any).ethereum)
      if (eth?.request) {
        try { await eth.request({ method: 'eth_requestAccounts' }) } catch {}
        try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: desiredChainHex }] }) } catch {}
        try {
          await eth.request({
            method: 'wallet_sendCalls',
            params: [{
              calls: calls.map((c) => ({
                to: c.to,
                data: c.data,
                value: c.value !== undefined ? toHex(c.value) : undefined
              })),
              capabilities: sendCallsCapabilities
            }]
          })
          return
        } catch (e2) {
          try {
            const first = calls[0]
            if (!first) throw e2
            const txData = appendBuilderCodeSuffix((first.data || '0x') as `0x${string}`)
            await eth.request({
              method: 'eth_sendTransaction',
              params: [{
                to: first.to,
                data: txData,
                value: first.value !== undefined ? toHex(first.value) : undefined
              }]
            })
            return
          } catch {}
        }
      }
      throw e
    }
  }

  async function refresh() {
    try {
      const [rid, fee, r] = await Promise.all([
        (client as any).readContract({ address: contract, abi: abi as any, functionName: 'currentRoundId' }) as Promise<bigint>,
        (client as any).readContract({ address: contract, abi: abi as any, functionName: 'entryFeeWei' }) as Promise<bigint>,
        (client as any).readContract({ address: contract, abi: abi as any, functionName: 'currentRound' })
      ])
      setRoundId(rid)
      setEntryFee(fee)
      setRound(r)
      const gs = await (client as any).readContract({ address: contract, abi: abi as any, functionName: 'getGuesses', args: [rid] }) as any[]
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
      try {
        const o = await (client as any).readContract({ address: contract, abi: abi as any, functionName: 'owner' })
        setOwner(o as string)
      } catch {}
      const count = await (client as any).readContract({ address: contract, abi: abi as any, functionName: 'priorWinnersCount' }) as bigint
      const items: any[] = []
      const start = count > 10n ? count - 10n : 0n
      for (let i = count; i > start; i--) {
        const rec = await (client as any).readContract({ address: contract, abi: abi as any, functionName: 'getWinnerAt', args: [i - 1n] })
        items.push(rec)
      }
      setWinners(items)
    } catch {}
  })() }, [client, contract, now])

  async function endRound() {
    try {
      setError(null)
      if (!address || !owner || address.toLowerCase() !== owner.toLowerCase()) {
        throw new Error('Only owner can end/settle')
      }
      const data = encodeFunctionData({ abi: abi as any, functionName: 'endAndSettle', args: [] })
      await sendWithBuilderCode([{ to: contract, data }])
      await refresh()
    } catch (e:any) {
      setError(e?.shortMessage || e?.message || String(e))
    }
  }

  async function submit() {
    if (!guess || guess < 1 || guess > 1000) { setError('Enter 1..1000'); return }
    try {
      setError(null)
      // Pre-simulate first; if it throws we surface the message and abort
      try {
        const sim: any = await (client as any).simulateContract({
          account: address as any,
          address: contract,
          abi: abi as any,
          functionName: 'submitGuess',
          args: [guess],
          value: entryFee
        })
        const req: any = sim?.request || {}
        setSimMsg(`Simulation OK ƒ?½ estGas=${req.gas ? String(req.gas) : 'n/a'}`)
      } catch (e:any) {
        setError(e?.message || String(e))
        return
      }
      const data = encodeFunctionData({ abi: abi as any, functionName: 'submitGuess', args: [guess] })
      const calls = [{ to: contract, data, value: entryFee }]
      await sendWithBuilderCode(calls)
      await refresh()
    } catch (e: any) { setError(e?.shortMessage || e?.message || String(e)) }
  }

  const endsIn = round ? Math.max(0, Number(round.endTime) - now) : 0

  const onMiniapp = typeof window !== 'undefined' && (
    window.location.pathname === '/miniapp' ||
    /Farcaster|Warpcast/i.test(navigator.userAgent) ||
    !!(window as any).sdk || !!(window as any).actions || !!(window as any).farcaster || (window.parent && window.parent !== window)
  )

  const mismatch = isConnected && typeof chainId === 'number' && chainId !== desiredChainId

  async function switchToDesired() {
    try {
      const hex = '0x' + desiredChainId.toString(16)
      if ((window as any)?.ethereum?.request) {
        await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] })
      } else {
        await switchChainAsync?.({ chainId: desiredChainId })
      }
      setError(null)
    } catch (e:any) {
      setError(e?.message || String(e))
    }
  }

  async function connectPreferred() {
    try {
      const preferred = connectors.find(c => c.name === 'Injected') || connectors[0]
      if (!preferred) throw new Error('No wallet connector available')
      await connect({ connector: preferred })
      try { await switchChainAsync?.({ chainId: desiredChainId }) } catch {}
    } catch (e:any) { setError(e?.message || String(e)) }
  }

  // Auto-connect inside Farcaster miniapp if provider is present
  useEffect(() => {
    try {
      const eth = (typeof window !== 'undefined' && (window as any).ethereum)
      if (onMiniapp && eth && !isConnected && connStatus !== 'pending') {
        // Ask for permission (Farcaster Wallet honors EIP-1193)
        try { (eth as any).request?.({ method: 'eth_requestAccounts' }).catch(() => {}) } catch {}
        connectPreferred()
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMiniapp, isConnected, connStatus])

  return (
    <div className="gr-app" style={{ padding: 16 }}>
      <header className="gr-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="gr-title" style={{ margin: 0 }}>BUNE</h2>
        <div className="gr-connect">
          {isConnected ? (
            <button className="gr-btn gr-btn-ghost" onClick={() => disconnect()} title={address || ''} style={{ padding: '6px 10px' }}>{truncate(address)}</button>
          ) : (
            <button className="gr-btn" onClick={connectPreferred} style={{ padding: '6px 10px', marginLeft: 8 }}>
              {onMiniapp ? 'Farcaster Wallet' : 'Browser Wallet'}
            </button>
          )}
        </div>
      </header>

      {mismatch && (
        <div className="gr-alert" style={{ marginTop: 12 }}>
          The current wallet chain ({chainId}) does not match the app target ({desiredChainId}).
          <div style={{ marginTop: 8 }}>
            <button className="gr-btn" onClick={switchToDesired}>Switch to Base</button>
          </div>
        </div>
      )}

      {error && <div className="gr-alert" style={{ background: '#311', border: '1px solid #633', padding: 8, marginTop: 12 }}>{error}</div>}
      {simMsg && <div className="gr-alert" style={{ background: '#113', border: '1px solid #336', padding: 8, marginTop: 12 }}>{simMsg}</div>}

      {round && (
        <section className="gr-card" style={{ marginTop: 16, border: '1px solid #2c2c2e', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div><div style={{opacity:0.7}}>Round</div><strong>#{String(roundId)}</strong></div>
            <div><div style={{opacity:0.7}}>Active</div><strong>{round.active ? 'Yes' : 'No'}</strong></div>
            <div><div style={{opacity:0.7}}>Ends</div><strong>{new Date(Number(round.endTime)*1000).toLocaleString()}</strong></div>
            <div><div style={{opacity:0.7}}>Pot</div><strong>{formatEther(round.pot)} ETH</strong></div>
            <div><div style={{opacity:0.7}}>Guesses</div><strong>{String(round.guessesCount)}</strong></div>
            <div><div style={{opacity:0.7}}>Entry</div><strong>{formatEther(entryFee)} ETH</strong></div>
          </div>
          <div className="gr-countdown" style={{ marginTop: 12 }}>Countdown: {Math.floor(endsIn/60)}m {endsIn%60}s</div>
          {isConnected && owner && address?.toLowerCase() === owner.toLowerCase() && endsIn === 0 && round.active && (
            <div style={{marginTop:12}}>
              <button className="gr-btn" onClick={endRound}>End + Settle (owner)</button>
            </div>
          )}
          {round.active && endsIn > 0 && (
            <div className="gr-form" style={{ marginTop: 12 }}>
              <input className="gr-input" type="number" min={1} max={1000} value={guess||''} onChange={e=>setGuess(Number(e.target.value))} placeholder="Your guess (1..1000)" />
              <button className="gr-btn" onClick={submit} disabled={!round?.active || endsIn===0} style={{ marginLeft: 8, padding: '8px 12px', opacity: (!round?.active || endsIn===0) ? 0.6 : 1 }}>Submit Guess</button>
            </div>
          )}
          {(endsIn === 0 || !round.active) && (!owner || address?.toLowerCase() !== owner.toLowerCase()) && (
            <div className="gr-alert" style={{ marginTop: 12 }}>
              Round ended. Waiting for owner to settleƒ?İ
            </div>
          )}
        </section>
      )}

      <section className="gr-section" style={{ marginTop: 16 }}>
        <div className="gr-section-head"><h3>Live Activity</h3><button className="gr-btn gr-btn-ghost" onClick={refresh} style={{ padding: '6px 10px' }}>Refresh</button></div>
        <ul className="gr-list">
          {guesses.slice().reverse().slice(0, 20).map((g, i) => (
            <li key={i} className="gr-list-item"><span className="gr-tag">{truncate(g.player)}</span> guessed <strong>{g.number}</strong> at {new Date(Number(g.timestamp)*1000).toLocaleTimeString()}</li>
          ))}
        </ul>
      </section>

      <section className="gr-section" style={{ marginTop: 16 }}>
        <h3>History (latest)</h3>
        {winners.length === 0 ? <p>No winners yet.</p> : (
          <ul className="gr-list">
            {winners.map((w, idx) => (
              <li key={idx} className="gr-list-item">Round #{String(w.roundId)} ƒ?" Winner {truncate(w.winner)} ƒ?" Target {String(w.target)} ƒ?" Prize {formatEther(w.prize)} ETH</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
