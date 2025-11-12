"use client";
import { ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { wagmiConfig } from "../lib/wagmi";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Signal to the host that the app is ready per Mini Apps guide.
    (async () => {
      try {
        await sdk.actions.ready();
      } catch (e) {
        // Non-fatal: still render app even if ready() fails.
        console.warn("sdk.actions.ready() failed:", e);
      }
    })();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

