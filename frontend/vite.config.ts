import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    sourcemap: false
  },
  resolve: {
    alias: {
      'ox/erc8021': '/src/lib/erc8021.ts'
    }
  },
  optimizeDeps: {
    // We are not using WalletConnect in this build; exclude to avoid esbuild map parsing issues
    exclude: [
      '@walletconnect/sign-client',
      '@walletconnect/utils',
      '@walletconnect/universal-provider'
    ],
    esbuildOptions: {
      sourcemap: false
    }
  }
})
