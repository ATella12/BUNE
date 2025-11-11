import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider, http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './ui/App'
import './style.css'

// Prefer Mini App injected EIP-1193 provider if present (Farcaster Wallet)
try {
  const g: any = (globalThis as any)
  if (g && g.sdk && g.sdk.ethereum && !g.ethereum) {
    g.ethereum = g.sdk.ethereum
  } else if (g && g.actions && g.actions.ethereum && !g.ethereum) {
    g.ethereum = g.actions.ethereum
  }
} catch {}

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532)
const chains = [baseSepolia, base] as const satisfies readonly [Chain, ...Chain[]]
const rpcUrl = import.meta.env.VITE_RPC_URL

const config = createConfig({
  chains,
  connectors: [
    injected({ shimDisconnect: true })
  ],
  transports: {
    [base.id]: http(rpcUrl),
    [baseSepolia.id]: http(rpcUrl)
  },
  ssr: false,
  syncConnectedChain: true,
  // Attempt to auto-connect when running inside a miniapp host
  // (wagmi v2 sets this via storage, but we want a gentle default here)
  multiInjectedProviderDiscovery: true
})

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)

// Signal readiness to Farcaster/Base Mini App hosts so splash hides
try {
  if (typeof window !== 'undefined') {
    const msgVariants = [
      { type: 'miniapp.ready' },
      { type: 'miniapp_ready' },
      { type: 'base.miniapp.ready' },
      { type: 'ready' },
      // Farcaster Mini Apps SDK compatibility
      { type: 'sdk.actions.ready' },
      { type: 'actions.ready' }
    ]
    const signal = () => {
      if ((window as any).__miniappReadySignalled) return
      ;(window as any).__miniappReadySignalled = true
      // Post to parent if in iframe, else broadcast to self (some hosts listen on same window)
      try {
        const target: any = (window.parent && window.parent !== window) ? window.parent : window
        msgVariants.forEach((m) => { try { target.postMessage(m, '*') } catch {} })
      } catch {}
      try {
        const g: any = (window as any)
        if (g.sdk && g.sdk.actions && typeof g.sdk.actions.ready === 'function') g.sdk.actions.ready()
        if (g.actions && typeof g.actions.ready === 'function') g.actions.ready()
      } catch {}
    }

  // Initial attempt right after mount
  signal()

  // If SDK not present, inject it per docs and call ready on load
  try {
    const g: any = (window as any)
    const hasSdk = !!(g.sdk && g.sdk.actions && typeof g.sdk.actions.ready === 'function') ||
                   !!(g.actions && typeof g.actions.ready === 'function')
    if (!hasSdk) {
      const existing = document.querySelector('script[data-miniapps-sdk]') as HTMLScriptElement | null
      if (!existing) {
        const s = document.createElement('script')
        s.src = 'https://miniapps.farcaster.xyz/sdk.js'
        s.async = true
        s.crossOrigin = 'anonymous'
        s.setAttribute('data-miniapps-sdk', '1')
        s.onload = () => {
          try {
            const gg: any = (window as any)
            if (gg.sdk?.actions?.ready) gg.sdk.actions.ready()
            if (gg.actions?.ready) gg.actions.ready()
            signal()
          } catch {}
        }
        document.head.appendChild(s)
      }
    }
  } catch {}

  // Reply to potential handshake/ping messages from host
    try {
      window.addEventListener('message', (ev: MessageEvent) => {
        const t = (ev?.data && (ev.data.type || ev.data.event || ev.data.action) || '').toString().toLowerCase()
        if (t.includes('ready') || t.includes('init') || t.includes('ping') || t.includes('load') || t.includes('miniapp')) signal()
      })
    } catch {}

    // Poll for SDK injection for a few seconds and call when available
    let tries = 0
    const iv = setInterval(() => {
      tries += 1
      try {
        const g: any = (window as any)
        if (g.sdk && g.sdk.actions && typeof g.sdk.actions.ready === 'function') {
          g.sdk.actions.ready(); signal(); clearInterval(iv)
        } else if (g.actions && typeof g.actions.ready === 'function') {
          g.actions.ready(); signal(); clearInterval(iv)
        } else {
          // re-signal via postMessage until SDK listens
          try {
            const target: any = (window.parent && window.parent !== window) ? window.parent : window
            msgVariants.forEach((m) => { try { target.postMessage(m, '*') } catch {} })
          } catch {}
        }
      } catch {}
      if (tries > 20) clearInterval(iv)
    }, 250)
  }
} catch {}
