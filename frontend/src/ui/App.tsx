import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useSwitchChain } from 'wagmi'
import { createPublicClient, formatEther, http, encodeFunctionData, toHex, getAddress } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { abi } from '../abi'

const truncate = (a?: string) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : ''

export default function App() {
  const { connectors, connect, status: connStatus } = useConnect()
  const { isConnected, address, chainId } = useAccount()
  const [manualAddress, setManualAddress] = useState<string | null>(null)
  const { disconnect } = useDisconnect()
  const { writeContractAsync, status: writeStatus } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
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
      if (onMiniapp && typeof window !== 'undefined' && (window as any).ethereum?.request) {
        const eth = (window as any).ethereum
        // Connect + ensure chain (with add chain fallback)
        try { await eth.request({ method: 'eth_requestAccounts' }) } catch {}
        const hexChain = '0x' + desiredChainId.toString(16)
        try {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain }] })
        } catch (e:any) {
          if (e && (e.code === 4902 || String(e.message||'').includes('Unrecognized chain'))) {
            try {
              await eth.request({ method: 'wallet_addEthereumChain', params: [{
                chainId: hexChain,
                chainName: desiredChainId === base.id ? 'Base' : 'Base Sepolia',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: desiredChainId === base.id ? ['https://basescan.org'] : ['https://sepolia.basescan.org']
              }] })
            } catch {}
          }
        }
        // Determine from
        let from: string | undefined
        try { const accs = await eth.request({ method: 'eth_accounts' }) as string[]; from = accs?.[0] } catch {}
        const data = encodeFunctionData({ abi: abi as any, functionName: 'endAndSettle', args: [] })
        const tx: any = { to: contract, data }
        if (from) tx.from = from
        await eth.request({ method: 'eth_sendTransaction', params: [tx] })
      } else {
        await writeContractAsync({ address: contract, abi: abi as any, functionName: 'endAndSettle', args: [], chainId: desiredChainId } as any)
      }
      await refresh()
    } catch (e:any) {
      setError(e?.shortMessage || e?.message || String(e))
    }
  }

  async function submit() {
    if (!guess || guess < 1 || guess > 1000) { setError('Enter 1..1000'); return }
    try {
      setError(null)
      // If running inside Farcaster miniapp (or any in-app wallet), prefer direct EIP-1193 send
      if (onMiniapp && typeof window !== 'undefined' && (window as any).ethereum?.request) {
        const eth = (window as any).ethereum
        const hexChain = '0x' + desiredChainId.toString(16)
        // Connect + ensure chain (with add chain fallback)
        try { await eth.request({ method: 'eth_requestAccounts' }) } catch {}
        try {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain }] })
        } catch (e:any) {
          if (e && (e.code === 4902 || String(e.message||'').includes('Unrecognized chain'))) {
            try {
              await eth.request({ method: 'wallet_addEthereumChain', params: [{
                chainId: hexChain,
                chainName: desiredChainId === base.id ? 'Base' : 'Base Sepolia',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: desiredChainId === base.id ? ['https://basescan.org'] : ['https://sepolia.basescan.org']
              }] })
            } catch {}
          }
        }
        // Pre-simulate to show gas/success
        try {
          const accs = (await eth.request({ method: 'eth_accounts' })) as string[]
          const from = accs && accs[0] as `0x${string}`
          if (from) {
            const sim: any = await (client as any).simulateContract({
              account: from,
              address: contract,
              abi: abi as any,
              functionName: 'submitGuess',
              args: [guess],
              value: entryFee
            })
            const req: any = sim?.request || {}
            setSimMsg(`Simulation OK • estGas=${req.gas ? String(req.gas) : 'n/a'}`)
          }
        } catch {}
        const data = encodeFunctionData({ abi: abi as any, functionName: 'submitGuess', args: [guess] })
        const accounts = (await eth.request({ method: 'eth_accounts' })) as string[]
        const from = accounts?.[0]
        const tx: any = { to: contract, data, value: toHex(entryFee) }
        if (from) tx.from = from
        const hash = await eth.request({ method: 'eth_sendTransaction', params: [tx] })
        // Optionally wait via public client
        try { await (client as any).waitForTransactionReceipt?.({ hash }) } catch {}
      } else {
        // Fallback to wagmi/viem write
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
          setSimMsg(`Simulation OK • estGas=${req.gas ? String(req.gas) : 'n/a'}`)
        } catch (e:any) {
          setError(e?.message || String(e))
          return
        }
        await writeContractAsync({ address: contract, abi: abi as any, functionName: 'submitGuess', args: [guess as any], value: entryFee, chainId: desiredChainId } as any)
      }
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

  function farcasterProvider(): any {
    try {
      const g: any = (typeof window !== 'undefined' ? (window as any) : {})
      return g.ethereum || g.sdk?.ethereum || g.actions?.ethereum || g.farcaster?.ethereum || null
    } catch {
      return null
    }
  }

  async function connectPreferred() {
    try {
      const eth = farcasterProvider() as any
      if (onMiniapp && eth) {
        try { const accs = await eth.request?.({ method: 'eth_requestAccounts' }) as string[]; if (accs && accs[0]) setManualAddress(accs[0]) } catch {}
      }
      const preferred = connectors.find((c:any) => c.id === 'injected' || /Injected/i.test(c.name)) || connectors[0]
      if (!preferred) throw new Error('No wallet connector available')
      try { await disconnect() } catch {}
      try { await connect({ connector: preferred }) } catch (e:any) { try { await disconnect() } catch {}; await connect({ connector: preferred }) }
      const hex = '0x' + desiredChainId.toString(16)
      try { await switchChainAsync?.({ chainId: desiredChainId }) } catch {}
      if (onMiniapp && eth) {
        try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }) } catch (e:any) { if (e && (e.code === 4902 || String(e.message||'').includes('Unrecognized chain'))) { try { await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: desiredChainId === base.id ? 'Base' : 'Base Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [rpcUrl], blockExplorerUrls: desiredChainId === base.id ? ['https://basescan.org'] : ['https://sepolia.basescan.org'] }] }) } catch {} } }
      }
      setError(null)
    } catch (e:any) { setError(e?.message || String(e)) }
  }











  return (
    <div className="gr-app" style={{ padding: 16 }}>
      <header className="gr-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>BUNE</h2>
        <div className="gr-connect">
          {(isConnected || !!manualAddress) ? (
            <button className="gr-btn gr-btn-ghost" onClick={() => { try { disconnect() } catch {}; setManualAddress(null) }} title={(manualAddress || address) || ''} style={{ padding: '6px 10px' }}>{truncate((manualAddress || address) || '')}</button>
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

      <div style={{ marginTop: 12 }}>
        <button className="gr-btn gr-btn-ghost" onClick={refresh} style={{ padding: '6px 10px' }}>Refresh</button>
      </div>
    </div>
  )
}
