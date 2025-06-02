"use client"

import type { ReactNode } from "react"
import { WalletProvider as SuiWalletProvider } from "@mysten/dapp-kit"
import { SuiClientProvider } from "@mysten/dapp-kit"
import { networkConfig } from "../src/networkConfig"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"

// Create a client
const queryClient = new QueryClient()

interface WalletProviderProps {
  children: ReactNode
}

export default function WalletProvider({ children }: WalletProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <SuiWalletProvider autoConnect={false} preferredWallets={["Sui Wallet", "Suiet", "Ethos Wallet"]}>
          {children}
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}
