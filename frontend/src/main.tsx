import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider, http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'viem/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './ui/App'

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532)
const chains = [baseSepolia, base]
const rpcUrl = import.meta.env.VITE_RPC_URL

const config = createConfig({
  chains,
  transports: {
    [base.id]: http(rpcUrl),
    [baseSepolia.id]: http(rpcUrl)
  }
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

