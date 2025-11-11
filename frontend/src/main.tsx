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
  syncConnectedChain: true
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
    const msgVariants: any[] = [
      // Object-style messages
      { type: 'sdk.actions.ready' },
      { event: 'sdk.actions.ready' },
      { action: 'sdk.actions.ready' },
      { type: 'actions.ready' },
      { event: 'actions.ready' },
      { type: 'miniapp.ready' },
      { type: 'miniapp_ready' },
      { type: 'base.miniapp.ready' },
      { type: 'ready' },
      { event: 'ready' }
    ]
    const strVariants: any[] = [
      'sdk.actions.ready', 'actions.ready', 'miniapp.ready', 'miniapp_ready', 'base.miniapp.ready', 'ready', 'SDK_READY'
    ]
    const callAllReadyVariants = () => {
      try {
        const g: any = (window as any)
        if (g.sdk?.actions?.ready) g.sdk.actions.ready()
        if (g.actions?.ready) g.actions.ready()
        if (g.farcaster?.actions?.ready) g.farcaster.actions.ready()
        if (typeof g.farcaster?.ready === 'function') g.farcaster.ready()
        if (g.miniapp?.actions?.ready) g.miniapp.actions.ready()
        if (typeof g.miniapp?.ready === 'function') g.miniapp.ready()
      } catch {}
    }

    const signal = () => {
      if ((window as any).__miniappReadySignalled) return
      ;(window as any).__miniappReadySignalled = true
      // Post to parent if in iframe, else broadcast to self (some hosts listen on same window)
      try {
        const target: any = (window.parent && window.parent !== window) ? window.parent : window
        msgVariants.forEach((m) => { try { target.postMessage(m, '*') } catch {} })
        strVariants.forEach((m) => { try { target.postMessage(m, '*') } catch {} })
      } catch {}
      callAllReadyVariants()
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

    // Poll for SDK injection for a few seconds and call when available
    let tries = 0
    const iv = setInterval(() => {
      tries += 1
      try {
        const g: any = (window as any)
        if (
          (g.sdk?.actions?.ready) ||
          (g.actions?.ready) ||
          (g.farcaster?.actions?.ready) ||
          (typeof g.farcaster?.ready === 'function') ||
          (g.miniapp?.actions?.ready) ||
          (typeof g.miniapp?.ready === 'function')
        ) {
          callAllReadyVariants(); signal(); clearInterval(iv)
        } else {
          // re-signal via postMessage until SDK listens
          try {
            const target: any = (window.parent && window.parent !== window) ? window.parent : window
            msgVariants.forEach((m) => { try { target.postMessage(m, '*') } catch {} })
            strVariants.forEach((m) => { try { target.postMessage(m, '*') } catch {} })
          } catch {}
        }
      } catch {}
      if (tries > 20) clearInterval(iv)
    }, 250)

    // Also try on DOM ready and load events
    try { document.addEventListener('DOMContentLoaded', () => { callAllReadyVariants(); signal() }) } catch {}
    try { window.addEventListener('load', () => { callAllReadyVariants(); signal() }) } catch {}
  }
} catch {}


