"use client"

import { useMemo, useState, type ChangeEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClipLoader } from "react-spinners"
import toast from "react-hot-toast"
import { Transaction } from "@mysten/sui/transactions"
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { TESTNET_VAULT_REGISTRY_ID, TESTNET_VAULT_TREASURY_ID } from "@/app/src/constants"
import { useNetworkVariable } from "@/app/src/networkConfig"
import type { SuiObjectResponse, CoinStruct } from "@mysten/sui/client"

function formatBalance(balance: string | number, decimals = 9): string {
  const value = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const integerPart = value / divisor
  const fractionalPart = value % divisor
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0")
  return `${integerPart}.${paddedFractional}`
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

interface RedeemInput {
  vaultId: string
  amount: string
}

export default function VaultList() {
  const currentAccount = useCurrentAccount()
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId")
  const { mutate: signAndExecute, isPending: isTransactionPending } = useSignAndExecuteTransaction()

  // Add state for redeem input
  const [redeemInput, setRedeemInput] = useState<RedeemInput>({
    vaultId: "",
    amount: "",
  })

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

  // Query for user's coins
  const { data: userCoins } = useSuiClientQuery(
    "getAllCoins",
    {
      owner: currentAccount?.address || "",
    },
    {
      enabled: !!currentAccount?.address,
    },
  )

  // Get DS tokens and pegged tokens owned by the user
  const userTokens = useMemo(() => {
    if (!userCoins?.data || !depegSwapPackageId) return { dsTokens: [], peggedTokens: [] }

    const dsTokens = userCoins.data.filter(
      (coin: CoinStruct) => coin.coinType === `${depegSwapPackageId}::vault::VAULT`,
    )

    const peggedTokens = userCoins.data.filter((coin: CoinStruct) => coin.coinType.includes("::pegged_coin::"))

    return { dsTokens, peggedTokens }
  }, [userCoins?.data, depegSwapPackageId])

  // First, query the registry object to get its content
  const {
    data: registryData,
    isPending: isRegistryPending,
    error: registryError,
  } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_REGISTRY_ID,
    options: {
      showContent: true,
      showType: true,
      showOwner: true,
    },
  })

  // Get vault IDs directly from the registry's vaults vector
  const registryContent = registryData?.data?.content as any
  const vaultIds = registryContent?.fields?.vaults || []
  const shouldFetchVaults = vaultIds.length > 0

  // Query the actual vault objects
  const {
    data: vaultObjectsData,
    isPending: isVaultsPending,
    error: vaultsError,
  } = useSuiClientQuery(
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

  const isLoading = isRegistryPending || (shouldFetchVaults && isVaultsPending)
  const error = registryError || vaultsError

  const handleRedeemDepegSwap = async (vault: SuiObjectResponse) => {
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

    const vaultExpiry = Number(vaultContent.fields.expiry)
    if (vaultExpiry <= Date.now()) {
      toast.error("Vault has expired!")
      return
    }

    // Check if user has DS tokens
    if (!userTokens.dsTokens.length) {
      toast.error("You don't have any Depeg Swap tokens!")
      return
    }

    // Check if user has pegged tokens
    if (!userTokens.peggedTokens.length) {
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
    const matchingPeggedToken = userTokens.peggedTokens.find((token) => token.coinType === peggedType)

    if (!matchingPeggedToken) {
      toast.error(`You don't have the required pegged token: ${peggedType}`)
      return
    }

    // Check if user has enough pegged tokens (comparing with proper decimals)
    if (BigInt(matchingPeggedToken.balance) < requiredPeggedAmount) {
      toast.error(
        `Insufficient pegged tokens. Need ${formatBalance(
          requiredPeggedAmount.toString(),
          PEGGED_DECIMALS,
        )} but you have ${formatBalance(matchingPeggedToken.balance, PEGGED_DECIMALS)}`,
      )
      return
    }

    // Get DS token and check balance
    const dsToken = userTokens.dsTokens[0] // Using first DS token for simplicity
    if (BigInt(dsToken.balance) < dsAmountToRedeem) {
      toast.error(
        `Insufficient DS tokens. Need ${formatBalance(
          dsAmountToRedeem.toString(),
          DS_DECIMALS,
        )} but you have ${formatBalance(dsToken.balance, DS_DECIMALS)}`,
      )
      return
    }

    const tx = new Transaction()

    try {
      // Split DS token to the exact amount needed (with decimals)
      const [splitDsToken] = tx.splitCoins(tx.object(dsToken.coinObjectId), [tx.pure.u64(dsAmountToRedeem.toString())])

      // Split pegged token to 1/100 of the DS amount (with decimals)
      const [splitPeggedToken] = tx.splitCoins(tx.object(matchingPeggedToken.coinObjectId), [
        tx.pure.u64(requiredPeggedAmount.toString()),
      ])

      console.log("Transaction input", {
        vaultId: vault.data.objectId,
        treasuryId: TESTNET_VAULT_TREASURY_ID,
        clockId: "0x6",
        splitDsToken,
        splitPeggedToken,
      })

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

      console.log("Transaction output", {
        underlying_coin,
      })

      tx.transferObjects([underlying_coin, splitPeggedToken, splitDsToken], currentAccount.address)

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
                  href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", textDecoration: "underline" }}
                >
                  View transaction
                </a>
              </div>,
              {
                duration: 5000,
                style: {
                  borderRadius: "10px",
                  background: "#333",
                  color: "#fff",
                },
              },
            )
          },
          onError: (error) => {
            console.error("Failed to redeem Depeg Swap tokens:", error)
            toast.error(`Failed to redeem: ${error instanceof Error ? error.message : "Unknown error"}`, {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            })
          },
        },
      )
    } catch (error) {
      console.error("Error executing transaction:", error)
      toast.error(`Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`, {
        duration: 5000,
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      })
    }
  }

  const handleRedeemUnderlying = async (vault: SuiObjectResponse) => {
    if (!underwriterCaps?.data?.[0]?.data?.objectId) {
      toast.error("You don't have the UnderwriterCap required to redeem underlying coins!")
      return
    }

    if (!currentAccount?.address) {
      toast.error("You don't have an account!")
      return
    }

    if (!vault.data?.type || !vault.data?.objectId) {
      toast.error("Invalid vault data!")
      return
    }

    const vaultContent = vault.data?.content as unknown as {
      dataType: "moveObject"
      fields: {
        pegged_vault: {
          type: string
        }
        underlying_vault: {
          type: string
        }
      }
    }

    if (!vaultContent?.fields) {
      toast.error("Invalid vault data!")
      return
    }

    // Extract pegged and underlying coin types from the vault fields
    const peggedType = vaultContent.fields.pegged_vault.type.match(/Coin<(.+)>/)?.[1]
    const underlyingType = vaultContent.fields.underlying_vault.type.match(/Coin<(.+)>/)?.[1]

    if (!peggedType || !underlyingType) {
      toast.error("Could not extract coin types from vault!")
      return
    }

    console.log("Transaction input", {
      vaultId: vault.data.objectId,
      underwriterCapId: underwriterCaps.data[0].data.objectId,
      clockId: "0x6",
    })

    const tx = new Transaction()

    try {
      const [underlyingCoin, peggedCoin] = tx.moveCall({
        target: `${depegSwapPackageId}::vault::redeem_underlying`,
        typeArguments: [peggedType, underlyingType],
        arguments: [tx.object(vault.data.objectId), tx.object(underwriterCaps.data[0].data.objectId), tx.object("0x6")],
      })

      tx.transferObjects([underlyingCoin, peggedCoin], currentAccount.address)

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
                  href={`https://suivision.xyz/txblock/${result.digest}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", textDecoration: "underline" }}
                >
                  View transaction
                </a>
              </div>,
              {
                duration: 5000,
                style: {
                  borderRadius: "10px",
                  background: "#333",
                  color: "#fff",
                },
              },
            )
          },
          onError: (error) => {
            console.error("Failed to redeem underlying coins:", error)
            toast.error(
              `Failed to redeem underlying coins: ${error instanceof Error ? error.message : "Unknown error"}`,
              {
                duration: 5000,
                style: {
                  borderRadius: "10px",
                  background: "#333",
                  color: "#fff",
                },
              },
            )
          },
        },
      )
    } catch (error) {
      console.error("Error executing transaction:", error)
      toast.error(`Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`, {
        duration: 5000,
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      })
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-6">
            <p className="text-red-400">Error loading vaults: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ClipLoader size={20} />
          <span>Loading vaults...</span>
        </div>
      </div>
    )
  }

  if (!vaultIds.length) {
    return (
      <div className="space-y-6">
        <p>No vaults found. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xl font-semibold">Created Vaults</h3>

        {registryData && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="space-y-2">
                <p className="text-sm">Registry ID: {TESTNET_VAULT_REGISTRY_ID}</p>
                <p className="text-sm">Type: {registryData.data?.type}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {vaultObjectsData && vaultObjectsData.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-lg font-semibold">Vaults</h4>
            {vaultObjectsData.map((vault: SuiObjectResponse) => {
              const content = vault.data?.content as any
              const fields = content?.fields || {}
              const status = Number(fields.expiry) > Date.now() ? "Active" : "Expired"
              const statusColor = status === "Active" ? "text-green-400" : "text-red-400"

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
              const hasRequiredTokens = userTokens.dsTokens.length > 0 && userTokens.peggedTokens.length > 0

              return (
                <Card key={vault.data?.objectId} className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-semibold">Vault ID: {vault.data?.objectId}</CardTitle>
                      <span className={`text-sm ${statusColor}`}>{status}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm space-y-1">
                      <p>Type: {vault.data?.type}</p>
                      <p>Total DS: {formatBalance(fields.total_ds)}</p>
                      <p>Expiry: {new Date(Number(fields.expiry)).toLocaleString()}</p>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold">Vault Contents:</h5>
                      <div className="bg-gray-800/50 p-3 rounded-lg space-y-1 text-sm">
                        <p>
                          Pegged Coin ({peggedType}): {formatBalance(peggedVault?.balance || "0")}
                        </p>
                        <p>
                          Underlying Coin ({underlyingType}): {formatBalance(underlyingVault?.balance || "0")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {status === "Active" && hasRequiredTokens && (
                        <>
                          <Input
                            type="text"
                            placeholder="Amount of DS tokens to redeem (must be divisible by 100)"
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
                            onClick={() => handleRedeemDepegSwap(vault)}
                            disabled={isTransactionPending || !redeemInput.amount}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            {isTransactionPending ? <ClipLoader size={16} /> : "Redeem Depeg Swap"}
                          </Button>
                        </>
                      )}

                      {underwriterCaps?.data && underwriterCaps.data.length > 0 && (
                        <Button
                          onClick={() => handleRedeemUnderlying(vault)}
                          disabled={isTransactionPending}
                          className="w-full bg-red-600 hover:bg-red-700"
                        >
                          {isTransactionPending ? <ClipLoader size={16} /> : "Redeem as Underwriter"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
