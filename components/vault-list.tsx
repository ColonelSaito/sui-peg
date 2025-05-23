"use client"

import { useState, type ChangeEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ClipLoader } from "react-spinners"
import toast from "react-hot-toast"
import { Transaction } from "@mysten/sui/transactions"
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit"
import { TESTNET_VAULT_REGISTRY_ID, TESTNET_VAULT_TREASURY_ID } from "@/app/src/constants"
import { useNetworkVariable } from "@/app/src/networkConfig"
import { Clock, AlertTriangle } from "lucide-react"

interface RedeemInput {
  vaultId: string
  amount: string
}

interface ManuallyExpiredVaults {
  [key: string]: boolean
}

export default function VaultList() {
  const currentAccount = useCurrentAccount()
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId")
  const suiClient = useSuiClient()
  const { mutate: signAndExecute, isPending: isTransactionPending } = useSignAndExecuteTransaction()

  // State for redeem input
  const [redeemInput, setRedeemInput] = useState<RedeemInput>({
    vaultId: "",
    amount: "",
  })

  // State to track manually expired vaults (for demo purposes)
  const [manuallyExpiredVaults, setManuallyExpiredVaults] = useState<ManuallyExpiredVaults>({})

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

  // Format coins for dropdown with basic information
  const formattedCoins =
    userCoins?.data?.map((coin) => ({
      id: coin.coinObjectId,
      type: coin.coinType,
      balance: formatBalance(coin.balance, 9),
      rawBalance: coin.balance,
    })) || []

  // Get DS tokens and pegged tokens owned by the user
  const dsTokens = formattedCoins.filter((coin) => coin.type === `${depegSwapPackageId}::vault::VAULT`)

  const peggedTokens = formattedCoins.filter((coin) => coin.type.includes("::pegged_coin::"))

  // Query for the VaultRegistry object
  const { data: registryData, isPending: isRegistryPending } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_REGISTRY_ID,
    options: { showContent: true },
  })

  // Get vault IDs from the registry's vaults vector
  const registryContent = registryData?.data?.content as any
  const vaultIds = registryContent?.fields?.vaults || []
  const shouldFetchVaults = vaultIds.length > 0

  // Query the actual vault objects
  const { data: vaultObjectsData, isPending: isVaultsPending } = useSuiClientQuery(
    "multiGetObjects",
    {
      ids: vaultIds,
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      },
    },
    {
      enabled: shouldFetchVaults,
    },
  )

  // Query for UnderwriterCap objects owned by the current user
  const { data: underwriterCaps } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: currentAccount?.address || "",
      filter: {
        MatchAll: [
          {
            StructType: `${depegSwapPackageId}::vault::UnderwriterCap`,
          },
        ],
      },
      options: {
        showType: true,
        showContent: true,
        showOwner: true,
      },
    },
    {
      enabled: !!currentAccount?.address,
    },
  )

  const isLoading = isRegistryPending || (shouldFetchVaults && isVaultsPending) || isCoinsLoading

  // Toggle vault expiry status (for demo purposes)
  const toggleVaultExpiry = (vaultId: string) => {
    setManuallyExpiredVaults((prev) => ({
      ...prev,
      [vaultId]: !prev[vaultId],
    }))
  }

  // Handle redeeming depeg swap tokens
  const handleRedeemDepegSwap = async (vault: any) => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet first!")
      return
    }

    if (!vault.data?.objectId || !vault.data?.content) {
      toast.error("Invalid vault data!")
      return
    }

    const vaultContent = vault.data.content as any
    if (!vaultContent?.fields) {
      toast.error("Invalid vault data!")
      return
    }

    const vaultId = vault.data.objectId
    const isManuallyExpired = manuallyExpiredVaults[vaultId] || false
    const vaultExpiry = Number(vaultContent.fields.expiry)
    const isActuallyExpired = vaultExpiry <= Date.now()

    // Check if vault is expired (either actually or manually for demo)
    if (isActuallyExpired || isManuallyExpired) {
      toast.error("Vault has expired! Use 'Redeem as Underwriter' instead.")
      return
    }

    // Check if user has DS tokens
    if (!dsTokens.length) {
      toast.error("You don't have any Depeg Swap tokens!")
      return
    }

    // Check if user has pegged tokens
    if (!peggedTokens.length) {
      toast.error("You don't have any pegged tokens!")
      return
    }

    // Parse the DS amount to redeem with decimals
    const DS_DECIMALS = 9 // Default Sui token decimals
    const PEGGED_DECIMALS = 9 // Default Sui token decimals

    // Convert display amount to on-chain amount
    const dsAmountToRedeem = parseInputAmount(redeemInput.amount, DS_DECIMALS)
    if (dsAmountToRedeem <= 0n) {
      toast.error("Please enter a valid amount of DS tokens to redeem")
      return
    }

    // Check if amount is divisible by 100 (DS:Pegged ratio)
    if (dsAmountToRedeem % 100n !== 0n) {
      toast.error("DS token amount must be divisible by 100")
      return
    }

    // Calculate required pegged token amount (with proper decimals)
    const requiredPeggedAmount = dsAmountToRedeem / 100n

    // Extract pegged and underlying coin types from the vault fields
    const peggedType = vaultContent.fields.pegged_vault.type.match(/Coin<(.+)>/)?.[1]
    const underlyingType = vaultContent.fields.underlying_vault.type.match(/Coin<(.+)>/)?.[1]

    if (!peggedType || !underlyingType) {
      toast.error("Could not extract coin types from vault!")
      return
    }

    // Find matching pegged token
    const matchingPeggedToken = peggedTokens.find((token) => token.type === peggedType)

    if (!matchingPeggedToken) {
      toast.error(`You don't have the required pegged token: ${peggedType}`)
      return
    }

    // Check if user has enough pegged tokens (comparing with proper decimals)
    if (BigInt(matchingPeggedToken.rawBalance) < requiredPeggedAmount) {
      toast.error(
        `Insufficient pegged tokens. Need ${formatBalance(
          requiredPeggedAmount.toString(),
          PEGGED_DECIMALS,
        )} but you have ${matchingPeggedToken.balance}`,
      )
      return
    }

    // Get DS token and check balance
    const dsToken = dsTokens[0] // Using first DS token for simplicity
    if (BigInt(dsToken.rawBalance) < dsAmountToRedeem) {
      toast.error(
        `Insufficient DS tokens. Need ${formatBalance(
          dsAmountToRedeem.toString(),
          DS_DECIMALS,
        )} but you have ${dsToken.balance}`,
      )
      return
    }

    const tx = new Transaction()

    try {
      // Split DS token to the exact amount needed (with decimals)
      const [splitDsToken] = tx.splitCoins(tx.object(dsToken.id), [tx.pure.u64(dsAmountToRedeem.toString())])

      // Split pegged token to 1/100 of the DS amount (with decimals)
      const [splitPeggedToken] = tx.splitCoins(tx.object(matchingPeggedToken.id), [
        tx.pure.u64(requiredPeggedAmount.toString()),
      ])

      const [underlying_coin] = tx.moveCall({
        target: `${depegSwapPackageId}::vault::redeem_depeg_swap`,
        typeArguments: [peggedType, underlyingType],
        arguments: [
          tx.object(vault.data.objectId),
          tx.object(TESTNET_VAULT_TREASURY_ID),
          splitDsToken,
          splitPeggedToken,
          tx.object("0x6"),
        ],
      })

      tx.transferObjects([underlying_coin], tx.pure.address(currentAccount.address))

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log("Successfully redeemed Depeg Swap tokens:", result)
            // Clear the input after successful redemption
            setRedeemInput({ vaultId: "", amount: "" })
            toast.success(
              <div>
                <div>Successfully redeemed Depeg Swap tokens!</div>
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
            console.error("Failed to redeem Depeg Swap tokens:", error)
            toast.error(`Failed to redeem: ${error instanceof Error ? error.message : "Unknown error"}`)
          },
        },
      )
    } catch (error) {
      console.error("Error executing transaction:", error)
      toast.error(`Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Handle redeeming underlying tokens
  const handleRedeemUnderlying = async (vault: any) => {
    if (!underwriterCaps?.data?.[0]?.data?.objectId) {
      toast.error("You don't have the UnderwriterCap required to redeem underlying coins!")
      return
    }

    if (!currentAccount?.address) {
      toast.error("Please connect your wallet first!")
      return
    }

    if (!vault.data?.type || !vault.data?.objectId) {
      toast.error("Invalid vault data!")
      return
    }

    const vaultContent = vault.data?.content as any
    if (!vaultContent?.fields) {
      toast.error("Invalid vault data!")
      return
    }

    const vaultId = vault.data.objectId
    const isManuallyExpired = manuallyExpiredVaults[vaultId] || false
    const vaultExpiry = Number(vaultContent.fields.expiry)
    const isActuallyExpired = vaultExpiry <= Date.now()

    // Check if vault is expired (either actually or manually for demo)
    if (!isActuallyExpired && !isManuallyExpired) {
      toast.error("Vault is still active! Wait for expiry or toggle the expiry status for demo.")
      return
    }

    // Extract pegged and underlying coin types from the vault fields
    const peggedType = vaultContent.fields.pegged_vault.type.match(/Coin<(.+)>/)?.[1]
    const underlyingType = vaultContent.fields.underlying_vault.type.match(/Coin<(.+)>/)?.[1]

    if (!peggedType || !underlyingType) {
      toast.error("Could not extract coin types from vault!")
      return
    }

    const tx = new Transaction()

    try {
      const [underlyingCoin, peggedCoin] = tx.moveCall({
        target: `${depegSwapPackageId}::vault::redeem_underlying`,
        typeArguments: [peggedType, underlyingType],
        arguments: [tx.object(vault.data.objectId), tx.object(underwriterCaps.data[0].data.objectId), tx.object("0x6")],
      })

      tx.transferObjects([underlyingCoin, peggedCoin], tx.pure.address(currentAccount.address))

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log("Successfully redeemed underlying coins:", result)
            toast.success(
              <div>
                <div>Successfully redeemed underlying coins!</div>
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
            console.error("Failed to redeem underlying coins:", error)
            toast.error(
              `Failed to redeem underlying coins: ${error instanceof Error ? error.message : "Unknown error"}`,
            )
          },
        },
      )
    } catch (error) {
      console.error("Error executing transaction:", error)
      toast.error(`Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Available Vaults</h3>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <ClipLoader size={30} color="#6366f1" />
          <span className="ml-2">Loading vaults...</span>
        </div>
      ) : vaultIds.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <p>No vaults found. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vaultObjectsData?.map((vault: any, index: number) => {
            const content = vault.data?.content as any
            const fields = content?.fields || {}
            const vaultId = vault.data?.objectId

            // Check if vault is expired (either actually or manually for demo)
            const isManuallyExpired = manuallyExpiredVaults[vaultId] || false
            const vaultExpiry = Number(fields.expiry)
            const isActuallyExpired = vaultExpiry <= Date.now()
            const isExpired = isActuallyExpired || isManuallyExpired

            const status = isExpired ? "Expired" : "Active"
            const statusColor = isExpired ? "text-red-400" : "text-green-400"

            // Extract coin balances
            const peggedVault = fields.pegged_vault?.fields
            const underlyingVault = fields.underlying_vault?.fields

            // Get coin types from the vault fields
            const peggedType =
              peggedVault?.type
                ?.match(/Coin<(.+)>/)?.[1]
                ?.split("::")
                .pop() || "Unknown"
            const underlyingType =
              underlyingVault?.type
                ?.match(/Coin<(.+)>/)?.[1]
                ?.split("::")
                .pop() || "Unknown"

            // Check if user has DS tokens for this vault
            const hasRequiredTokens = dsTokens.length > 0 && peggedTokens.length > 0
            const hasUnderwriterCap = underwriterCaps?.data && underwriterCaps.data.length > 0

            return (
              <Card key={index} className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Vault #{index + 1}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${statusColor}`}>{status}</span>
                      {isManuallyExpired && !isActuallyExpired && (
                        <span className="text-xs text-yellow-400">(Demo)</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-800/70 p-3 rounded-lg">
                      <span className="text-gray-400 block mb-1">Vault ID:</span>
                      <div className="font-medium truncate">{vault.data?.objectId}</div>
                    </div>
                    <div className="bg-gray-800/70 p-3 rounded-lg">
                      <span className="text-gray-400 block mb-1">Expiry:</span>
                      <div className="font-medium">{new Date(Number(fields.expiry)).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-800/70 p-3 rounded-lg">
                      <span className="text-gray-400 block mb-1">Pegged Coin ({peggedType}):</span>
                      <div className="font-medium">{formatBalance(peggedVault?.balance || "0")}</div>
                    </div>
                    <div className="bg-gray-800/70 p-3 rounded-lg">
                      <span className="text-gray-400 block mb-1">Underlying Coin ({underlyingType}):</span>
                      <div className="font-medium">{formatBalance(underlyingVault?.balance || "0")}</div>
                    </div>
                  </div>

                  <div className="bg-gray-800/70 p-3 rounded-lg">
                    <span className="text-gray-400 block mb-1">Total DS Tokens:</span>
                    <div className="font-medium">{formatBalance(fields.total_ds || "0")}</div>
                  </div>

                  {/* Demo toggle for expiry status */}
                  <div className="flex items-center justify-between bg-gray-800/70 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-300">Demo: Toggle Vault Expiry</span>
                    </div>
                    <Switch
                      checked={isManuallyExpired}
                      onCheckedChange={() => toggleVaultExpiry(vaultId)}
                      aria-label="Toggle vault expiry for demo"
                    />
                  </div>

                  {/* Conditional rendering based on vault status */}
                  {!isExpired && hasRequiredTokens && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start space-x-2 text-sm text-yellow-400 mb-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p>Active vault: Redeem DS tokens to get underlying tokens (hedger)</p>
                      </div>
                      <Label htmlFor={`redeem-amount-${index}`}>
                        Amount of DS tokens to redeem (must be divisible by 100)
                      </Label>
                      <Input
                        id={`redeem-amount-${index}`}
                        type="text"
                        placeholder="Enter amount"
                        className="bg-gray-800 border-gray-700"
                        value={redeemInput.vaultId === vault.data?.objectId ? redeemInput.amount : ""}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setRedeemInput({
                            vaultId: vault.data?.objectId || "",
                            amount: e.target.value,
                          })
                        }
                      />
                      <Button
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                        onClick={() => handleRedeemDepegSwap(vault)}
                        disabled={
                          isTransactionPending || !redeemInput.amount || redeemInput.vaultId !== vault.data?.objectId
                        }
                      >
                        {isTransactionPending ? (
                          <div className="flex items-center">
                            <ClipLoader size={16} color="#ffffff" className="mr-2" />
                            Processing...
                          </div>
                        ) : (
                          "Redeem Depeg Swap"
                        )}
                      </Button>
                    </div>
                  )}

                  {isExpired && hasUnderwriterCap && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start space-x-2 text-sm text-yellow-400 mb-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p>Expired vault: Redeem underlying tokens as underwriter</p>
                      </div>
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        onClick={() => handleRedeemUnderlying(vault)}
                        disabled={isTransactionPending}
                      >
                        {isTransactionPending ? (
                          <div className="flex items-center">
                            <ClipLoader size={16} color="#ffffff" className="mr-2" />
                            Processing...
                          </div>
                        ) : (
                          "Redeem as Underwriter"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
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
