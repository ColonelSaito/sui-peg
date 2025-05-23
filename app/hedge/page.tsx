"use client"

import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Info, Send } from "lucide-react"
import { useState, useEffect, type ChangeEvent } from "react"

import {
  ConnectButton,
  SuiClientProvider,
  WalletProvider,
  useCurrentAccount,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Theme } from "@radix-ui/themes"
import { networkConfig } from "../src/networkConfig"
import { TESTNET_VAULT_REGISTRY_ID, TESTNET_VAULT_TREASURY_ID } from "../src/constants"
import { Transaction } from "@mysten/sui/transactions"
import { useNetworkVariable } from "../src/networkConfig"
import { Toaster } from "react-hot-toast"
import toast from "react-hot-toast"
import VaultList from "@/components/vault-list"
import { ClipLoader } from "react-spinners"

const queryClient = new QueryClient()

export default function HedgePageMain() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <Theme appearance="dark">
            <Toaster position="top-right" />
            <HedgePage />
          </Theme>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}

function HedgePage() {
  const currentAccount = useCurrentAccount()
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId")
  const suiClient = useSuiClient()
  const { mutate: signAndExecute, isPending: isTransactionPending } = useSignAndExecuteTransaction()

  // State for form inputs
  const [suiAmount, setSuiAmount] = useState("")
  const [sSuiAmount, setSSuiAmount] = useState("")

  // State for transfer input
  const [transferInput, setTransferInput] = useState({
    amount: "",
    recipient: "",
  })

  // Query for user's coins
  const { data: userCoins, isPending: isCoinsLoading } = useSuiClientQuery(
    "getAllCoins",
    {
      owner: currentAccount?.address || "",
    },
    {
      enabled: !!currentAccount?.address,
    },
  )

  // Format coins for display
  const formattedCoins =
    userCoins?.data?.map((coin) => ({
      id: coin.coinObjectId,
      type: coin.coinType,
      balance: formatBalance(coin.balance, 9),
      rawBalance: coin.balance,
    })) || []

  // Find SUI and sSUI coins
  const suiCoins = formattedCoins.filter((coin) => coin.type.includes("::underlying_coin::"))
  const sSuiCoins = formattedCoins.filter((coin) => coin.type.includes("::pegged_coin::"))
  const dsTokens = formattedCoins.filter((coin) => coin.type === `${depegSwapPackageId}::vault::VAULT`)

  // Calculate potential profit based on input
  useEffect(() => {
    if (suiAmount) {
      // Simple calculation: 1% of supplied amount
      const amount = Number.parseFloat(suiAmount)
      if (!isNaN(amount)) {
        const profit = (amount * 0.01).toFixed(2)
        document.getElementById("potential-profit")!.textContent = `${profit} USDC`

        // Calculate depeg tokens (100 per SUI)
        const tokens = (amount * 100).toFixed(0)
        document.getElementById("depeg-tokens-receive")!.textContent = `${tokens} SUI Depeg Tokens`
      }
    }
  }, [suiAmount])

  // Handle creating a vault (underwriter)
  const handleCreateVault = async () => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet first!")
      return
    }

    if (!suiAmount || Number.parseFloat(suiAmount) <= 0) {
      toast.error("Please enter a valid amount for SUI and sSUI")
      return
    }

    try {
      // Convert to on-chain amounts
      const suiAmountOnChain = parseInputAmount(suiAmount, 9).toString()
      const sSuiAmountOnChain = parseInputAmount(sSuiAmount, 9).toString()

      // Set expiry to 24 hours from now
      const expiryMs = Date.now() + 24 * 60 * 60 * 1000

      const tx = new Transaction()

      // Split the coins
      const [splitPeggedCoin] = tx.splitCoins(tx.object(sSuiCoins[0].id), [tx.pure.u64(sSuiAmountOnChain)])
      const [splitUnderlyingCoin] = tx.splitCoins(tx.object(suiCoins[0].id), [tx.pure.u64(suiAmountOnChain)])

      // Create vault with split coins
      tx.moveCall({
        target: `${depegSwapPackageId}::registry::create_vault_collection`,
        typeArguments: [sSuiCoins[0].type, suiCoins[0].type],
        arguments: [
          tx.object(TESTNET_VAULT_REGISTRY_ID),
          tx.object(TESTNET_VAULT_TREASURY_ID),
          splitPeggedCoin,
          splitUnderlyingCoin,
          tx.pure.u64(expiryMs.toString()),
          tx.object("0x6"),
        ],
      })

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async ({ digest }) => {
            const { effects } = await suiClient.waitForTransaction({
              digest: digest,
              options: {
                showEffects: true,
              },
            })

            if (effects?.status?.error) {
              toast.error(`Transaction failed: ${effects.status.error}`)
              return
            }

            toast.success(
              <div>
                <div>Successfully created vault!</div>
                <a
                  href={`https://suiexplorer.com/txblock/${digest}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", textDecoration: "underline" }}
                >
                  View transaction
                </a>
              </div>,
            )

            // Reset form
            setSuiAmount("")
            setSSuiAmount("")
          },
          onError: (error) => {
            toast.error(`Transaction error: ${error instanceof Error ? error.message : "Unknown error"}`)
          },
        },
      )
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Handle transferring depeg tokens to another address (P2P insurance)
  const handleTransferDepegTokens = async () => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet first!")
      return
    }

    if (!transferInput.amount || !transferInput.recipient) {
      toast.error("Please enter both amount and recipient address")
      return
    }

    // Validate recipient address
    if (!transferInput.recipient.startsWith("0x") || transferInput.recipient.length !== 66) {
      toast.error("Invalid recipient address format")
      return
    }

    // Check if user has DS tokens
    if (!dsTokens.length) {
      toast.error("You don't have any Depeg Swap tokens!")
      return
    }

    // Parse the DS amount to transfer
    const DS_DECIMALS = 9
    const dsAmountToTransfer = parseInputAmount(transferInput.amount, DS_DECIMALS)

    if (dsAmountToTransfer <= 0n) {
      toast.error("Please enter a valid amount of DS tokens to transfer")
      return
    }

    // Get DS token and check balance
    const dsToken = dsTokens[0]
    if (BigInt(dsToken.rawBalance) < dsAmountToTransfer) {
      toast.error(
        `Insufficient DS tokens. Need ${formatBalance(
          dsAmountToTransfer.toString(),
          DS_DECIMALS,
        )} but you have ${dsToken.balance}`,
      )
      return
    }

    const tx = new Transaction()

    try {
      // Split DS token to the exact amount needed
      const [splitDsToken] = tx.splitCoins(tx.object(dsToken.id), [tx.pure.u64(dsAmountToTransfer.toString())])

      // Transfer the split tokens to the recipient
      tx.transferObjects([splitDsToken], tx.pure.address(transferInput.recipient))

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log("Successfully transferred DS tokens:", result)
            // Clear the input after successful transfer
            setTransferInput({ amount: "", recipient: "" })
            toast.success(
              <div>
                <div>Successfully transferred DS tokens!</div>
                <a
                  href={`https://suiexplorer.com/txblock/${result.digest}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", textDecoration: "underline" }}
                >
                  View transaction
                </a>
              </div>,
            )
          },
          onError: (error) => {
            console.error("Failed to transfer DS tokens:", error)
            toast.error(`Failed to transfer: ${error instanceof Error ? error.message : "Unknown error"}`)
          },
        },
      )
    } catch (error) {
      console.error("Error executing transaction:", error)
      toast.error(`Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container px-4 py-8 mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>

          <ConnectButton />
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">SUI Depeg Vault</h1>
          <p className="text-gray-400 mb-8">
            Participate as an underwriter or hedger in the SUI depeg insurance market
          </p>

          <Tabs defaultValue="underwrite" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="underwrite">Underwrite</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
              <TabsTrigger value="vaults">Available Vaults</TabsTrigger>
            </TabsList>

            <TabsContent value="underwrite">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Become an Underwriter</CardTitle>
                  <CardDescription>Supply tokens to the vault and earn premiums from hedgers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-6">
                    <div className="flex items-start gap-2 mb-4">
                      <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        As an underwriter, you supply both SUI and sSUI tokens to the vault. In return, you'll receive
                        depeg tokens that you can sell to hedgers. After maturity, you can claim all remaining tokens in
                        the vault.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <span className="text-gray-400">Maturity Date:</span>
                        <div className="font-medium">24 hours from creation</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <span className="text-gray-400">Depeg Threshold:</span>
                        <div className="font-medium">0.95 SUI</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <span className="text-gray-400">Current Ratio:</span>
                        <div className="font-medium">1:1</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <span className="text-gray-400">Depeg Token Rate:</span>
                        <div className="font-medium">100 per SUI</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="sui-amount">SUI Amount</Label>
                        <Input
                          id="sui-amount"
                          type="number"
                          placeholder="0.0"
                          className="bg-gray-800 border-gray-700"
                          value={suiAmount}
                          onChange={(e) => {
                            const value = e.target.value
                            setSuiAmount(value)
                            setSSuiAmount(value)
                          }}
                        />
                        {suiCoins.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">Available: {suiCoins[0]?.balance || "0"} SUI</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ssui-amount">sSUI Amount</Label>
                        <Input
                          id="ssui-amount"
                          type="number"
                          placeholder="0.0"
                          className="bg-gray-800 border-gray-700"
                          value={sSuiAmount}
                          onChange={(e) => {
                            const value = e.target.value
                            setSSuiAmount(value)
                            setSuiAmount(value)
                          }}
                        />
                        {sSuiCoins.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            Available: {sSuiCoins[0]?.balance || "0"} sSUI
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 pb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">You will receive:</span>
                        <span className="font-medium" id="depeg-tokens-receive">
                          0 SUI Depeg Tokens
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Potential profit:</span>
                        <span className="font-medium text-green-400" id="potential-profit">
                          0 USDC
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={handleCreateVault}
                    disabled={isTransactionPending || !currentAccount}
                  >
                    {isTransactionPending ? (
                      <div className="flex items-center">
                        <ClipLoader size={16} color="#ffffff" className="mr-2" />
                        Processing...
                      </div>
                    ) : (
                      "Supply Tokens"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="transfer">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Transfer DS Tokens (P2P Insurance)</CardTitle>
                  <CardDescription>Transfer your Depeg Swap tokens to another address</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        Transfer your Depeg Swap (DS) tokens to another address. This simulates selling insurance in a
                        peer-to-peer manner. The recipient can use these tokens to redeem underlying assets if a depeg
                        event occurs.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ds-amount">DS Token Amount</Label>
                      <Input
                        id="ds-amount"
                        type="text"
                        placeholder="Enter amount"
                        className="bg-gray-800 border-gray-700"
                        value={transferInput.amount}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setTransferInput({ ...transferInput, amount: e.target.value })
                        }
                      />
                      {dsTokens.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Available: {dsTokens[0]?.balance || "0"} DS Tokens
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recipient">Recipient Address</Label>
                      <Input
                        id="recipient"
                        type="text"
                        placeholder="0x..."
                        className="bg-gray-800 border-gray-700"
                        value={transferInput.recipient}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setTransferInput({ ...transferInput, recipient: e.target.value })
                        }
                      />
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 mt-4"
                      onClick={handleTransferDepegTokens}
                      disabled={isTransactionPending || !transferInput.amount || !transferInput.recipient}
                    >
                      {isTransactionPending ? (
                        <div className="flex items-center">
                          <ClipLoader size={16} color="#ffffff" className="mr-2" />
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Send className="mr-2 h-4 w-4" />
                          Transfer DS Tokens
                        </div>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vaults">
              <VaultList />
            </TabsContent>
          </Tabs>

          <div className="mt-12 bg-gray-800/30 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Your Token Balances</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">SUI Balance</div>
                <div className="text-xl font-medium">{suiCoins.length > 0 ? suiCoins[0].balance : "0"}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">sSUI Balance</div>
                <div className="text-xl font-medium">{sSuiCoins.length > 0 ? sSuiCoins[0].balance : "0"}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">DS Token Balance</div>
                <div className="text-xl font-medium">{dsTokens.length > 0 ? dsTokens[0].balance : "0"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function formatBalance(balance: string, decimals = 9): string {
  const value = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const integerPart = value / divisor
  const fractionalPart = value % divisor
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0")
  return `${integerPart}.${paddedFractional.substring(0, 4)}`
}

function parseInputAmount(amount: string, decimals: number): bigint {
  // Remove any commas
  amount = amount.replace(/,/g, "")

  // Split on decimal point
  const parts = amount.split(".")
  const integerPart = parts[0]
  const fractionalPart = parts[1] || ""

  // Pad or truncate fractional part to match decimals
  const normalizedFractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals)

  // Combine integer and fractional parts
  const fullValue = `${integerPart}${normalizedFractional}`

  // Convert to BigInt, removing any leading zeros
  return BigInt(fullValue.replace(/^0+/, "") || "0")
}
