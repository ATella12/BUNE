import React from 'react'
import ReactDOM from 'react-dom/client'
import { sdk as farcasterSdk } from '@farcaster/miniapp-sdk'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './ui/App'
import './style.css'
import { wagmiConfig } from './wagmiConfig'

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
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
        // Call the imported SDK's ready first (recommended)
        try { (farcasterSdk as any)?.actions?.ready?.() } catch {}
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
    // Also call imported SDK ready explicitly
    try { (farcasterSdk as any)?.actions?.ready?.() } catch {}

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



