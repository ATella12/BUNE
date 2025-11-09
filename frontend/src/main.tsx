import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider, http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './ui/App'
import './style.css'

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
