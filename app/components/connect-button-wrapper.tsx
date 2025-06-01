"use client"

import { ConnectButton as SuiConnectButton } from "@mysten/dapp-kit"
import { useState, useEffect } from "react"

interface ConnectButtonWrapperProps {
  className?: string
}

export default function ConnectButtonWrapper({ className }: ConnectButtonWrapperProps) {
  const [mounted, setMounted] = useState(false)

  // This ensures the component only renders on the client side
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a placeholder with the same dimensions to prevent layout shift
    return (
      <div
        className={`inline-flex items-center justify-center ${className || "bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg"}`}
      >
        Connect Wallet
      </div>
    )
  }

  return (
    <SuiConnectButton
      className={
        className ||
        "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg"
      }
      connectText="Connect Wallet"
    />
  )
}
