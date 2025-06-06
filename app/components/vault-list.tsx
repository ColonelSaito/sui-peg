"use client";

import { useMemo, useState, type ChangeEvent, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ClipLoader } from "react-spinners";
import toast from "react-hot-toast";
import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import {
  TESTNET_VAULT_REGISTRY_ID,
  TESTNET_VAULT_TREASURY_ID,
} from "../src/constants";
import { useNetworkVariable } from "../src/networkConfig";
import type { SuiObjectResponse, CoinStruct } from "@mysten/sui/client";
import { useQueryClient } from "@tanstack/react-query";

function formatBalance(balance: string | number, decimals = 9): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${paddedFractional}`;
}

function parseInputAmount(amount: string, decimals: number): bigint {
  // Remove any commas
  amount = amount.replace(/,/g, "");

  // Split on decimal point
  const parts = amount.split(".");
  const integerPart = parts[0];
  const fractionalPart = parts[1] || "";

  // Pad or truncate fractional part to match decimals
  const normalizedFractional = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);

  // Combine integer and fractional parts
  const fullValue = `${integerPart}${normalizedFractional}`;

  // Convert to BigInt, removing any leading zeros
  return BigInt(fullValue.replace(/^0+/, "") || "0");
}

interface RedeemInput {
  vaultId: string;
  amount: string;
}

// Helper function to truncate long text
function truncateText(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

interface VaultContent {
  dataType: "moveObject";
  fields: {
    pegged_vault: {
      type: string;
      fields?: {
        balance?: string;
      };
    };
    underlying_vault: {
      type: string;
      fields?: {
        balance?: string;
      };
    };
    expiry: string;
    total_ds: string;
  };
}

export default function VaultList() {
  const currentAccount = useCurrentAccount();
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId");
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();
  const suiClient = useSuiClient();

  // Add state for redeem input
  const [redeemInput, setRedeemInput] = useState<RedeemInput>({
    vaultId: "",
    amount: "",
  });

  // Add state for separate loading states
  const [loadingStates, setLoadingStates] = useState<{
    [vaultId: string]: {
      redeemDepegSwap: boolean;
      redeemUnderwriter: boolean;
    };
  }>({});

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
    }
  );

  // Query for user's coins
  const { data: userCoins } = useSuiClientQuery(
    "getAllCoins",
    {
      owner: currentAccount?.address || "",
    },
    {
      enabled: !!currentAccount?.address,
    }
  );

  // Get DS tokens and pegged tokens owned by the user
  const userTokens = useMemo(() => {
    if (!userCoins?.data || !depegSwapPackageId)
      return { dsTokens: [], peggedTokens: [] };

    const dsTokens = userCoins.data.filter(
      (coin: CoinStruct) =>
        coin.coinType === `${depegSwapPackageId}::vault::VAULT`
    );

    const peggedTokens = userCoins.data.filter((coin: CoinStruct) =>
      coin.coinType.includes("::pegged_coin::")
    );

    return { dsTokens, peggedTokens };
  }, [userCoins?.data, depegSwapPackageId]);

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
  });

  // Get vault IDs directly from the registry's vaults vector
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registryContent = registryData?.data?.content as any;
  const vaultIds = registryContent?.fields?.vaults || [];
  const shouldFetchVaults = vaultIds.length > 0;

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
    }
  );

  // The useMemo approach with hooks inside won't work either
  // Let's simplify and just focus on properly invalidating and refetching the specific vault

  // Remove the vaultQueries code I just added and simplify the refreshData function:

  const refreshData = useCallback(
    (vaultId?: string) => {
      // Invalidate and refetch all relevant queries
      if (currentAccount?.address) {
        // Refetch user coins
        queryClient.invalidateQueries({
          queryKey: ["getAllCoins", currentAccount.address],
        });

        // Refetch underwriter caps
        queryClient.invalidateQueries({
          queryKey: ["getOwnedObjects", currentAccount.address],
        });
      }

      // Refetch registry
      queryClient.invalidateQueries({
        queryKey: ["getObject", TESTNET_VAULT_REGISTRY_ID],
      });

      // If a specific vault ID is provided, refetch that vault object directly
      if (vaultId) {
        // Force an immediate refetch of the specific vault
        queryClient.fetchQuery({
          queryKey: ["getObject", vaultId],
          queryFn: () =>
            suiClient.getObject({
              id: vaultId,
              options: {
                showContent: true,
                showType: true,
                showOwner: true,
              },
            }),
        });
      }

      // Refetch all vault objects
      queryClient.invalidateQueries({
        queryKey: ["multiGetObjects"],
      });
      queryClient.refetchQueries({
        queryKey: ["multiGetObjects"],
      });
    },
    [queryClient, currentAccount?.address, suiClient]
  );

  const isLoading = isRegistryPending || (shouldFetchVaults && isVaultsPending);
  const error = registryError || vaultsError;

  const handleRedeemDepegSwap = async (vault: SuiObjectResponse) => {
    const vaultId = vault.data?.objectId;
    if (!vaultId) return;

    // Set loading state for this specific vault's depeg swap action
    setLoadingStates((prev) => ({
      ...prev,
      [vaultId]: { ...prev[vaultId], redeemDepegSwap: true },
    }));

    try {
      if (!currentAccount?.address) {
        toast.error("Please connect your wallet first!");
        return;
      }

      if (!vault.data?.objectId || !vault.data?.content) {
        toast.error("Invalid vault data");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // @ts-expect-error - Complex Sui blockchain type conversion
      const vaultContent = vault.data.content as VaultContent;
      if (!vaultContent?.fields) {
        toast.error("Invalid vault data!");
        return;
      }

      const vaultExpiry = Number(vaultContent.fields.expiry);
      if (vaultExpiry <= Date.now()) {
        toast.error("Vault has expired!");
        return;
      }

      // Check if user has DS tokens
      if (!userTokens.dsTokens.length) {
        toast.error("You don't have any Depeg Swap tokens!");
        return;
      }

      // Check if user has pegged tokens
      if (!userTokens.peggedTokens.length) {
        toast.error("You don't have any pegged tokens!");
        return;
      }

      // Parse the DS amount to redeem with decimals
      const DS_DECIMALS = 9; // Default Sui token decimals
      const PEGGED_DECIMALS = 9; // Default Sui token decimals

      // Convert display amount to on-chain amount
      const dsAmountToRedeem = parseInputAmount(
        redeemInput.amount,
        DS_DECIMALS
      );
      if (dsAmountToRedeem <= 0n) {
        toast.error("Please enter a valid amount of DS tokens to redeem");
        return;
      }

      // Check if amount is divisible by 100 (DS:Pegged ratio)
      if (dsAmountToRedeem % 100n !== 0n) {
        toast.error("DS token amount must be divisible by 100");
        return;
      }

      // Calculate required pegged token amount (with proper decimals)
      const requiredPeggedAmount = dsAmountToRedeem / 100n;

      // Extract pegged and underlying coin types from the vault fields
      const peggedType =
        vaultContent.fields.pegged_vault.type.match(/Coin<(.+)>/)?.[1];
      const underlyingType =
        vaultContent.fields.underlying_vault.type.match(/Coin<(.+)>/)?.[1];

      if (!peggedType || !underlyingType) {
        toast.error("Could not extract coin types from vault!");
        return;
      }

      console.log("userTokens.peggedTokens ", userTokens.peggedTokens);
      console.log("peggedType ", peggedType);
      // Find matching pegged token
      // const matchingPeggedToken = userTokens.peggedTokens.find(
      //   (token) => token.coinType === peggedType
      // );

      // assuming there is only 1 pegged token
      const matchingPeggedToken = userTokens.peggedTokens[0];

      if (!matchingPeggedToken) {
        toast.error(`You don't have the required pegged token: ${peggedType}`);
        return;
      }

      // Check if user has enough pegged tokens (comparing with proper decimals)
      if (BigInt(matchingPeggedToken.balance) < requiredPeggedAmount) {
        toast.error(
          `Insufficient pegged tokens. Need ${formatBalance(
            requiredPeggedAmount.toString(),
            PEGGED_DECIMALS
          )} but you have ${formatBalance(matchingPeggedToken.balance, PEGGED_DECIMALS)}`
        );
        return;
      }

      console.log("userTokens ", userTokens);
      // Get DS token and check balance
      const dsToken = userTokens.dsTokens[0]; // Using first DS token for simplicity
      if (BigInt(dsToken.balance) < dsAmountToRedeem) {
        toast.error(
          `Insufficient DS tokens. Need ${formatBalance(
            dsAmountToRedeem.toString(),
            DS_DECIMALS
          )} but you have ${formatBalance(dsToken.balance, DS_DECIMALS)}`
        );
        return;
      }

      const tx = new Transaction();

      // tx.setGasBudget('')

      // Split DS token to the exact amount needed (with decimals)
      const [splitDsToken] = tx.splitCoins(tx.object(dsToken.coinObjectId), [
        tx.pure.u64(dsAmountToRedeem.toString()),
      ]);

      // Split pegged token to 1/100 of the DS amount (with decimals)
      const [splitPeggedToken] = tx.splitCoins(
        tx.object(matchingPeggedToken.coinObjectId),
        [tx.pure.u64(requiredPeggedAmount.toString())]
      );

      console.log("Transaction input", {
        vaultId: vault.data.objectId,
        treasuryId: TESTNET_VAULT_TREASURY_ID,
        clockId: "0x6",
        splitDsToken,
        splitPeggedToken,
      });

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
      });

      console.log("Transaction output", {
        underlying_coin,
      });

      console.log();
      tx.transferObjects(
        [underlying_coin, splitPeggedToken, splitDsToken],
        currentAccount.address
      );

      console.log("signAndExecute");
      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log("Successfully redeemed Depeg Swap tokens:", result);
            // Clear the input after successful redemption
            setRedeemInput({ vaultId: "", amount: "" });

            // Refresh data by refetching queries
            refreshData(vault.data?.objectId);

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
              }
            );
          },
          onError: (error) => {
            console.error("Failed to redeem Depeg Swap tokens:", error);
            toast.error(
              `Failed to redeem: ${error instanceof Error ? error.message : "Unknown error"}`,
              {
                duration: 5000,
                style: {
                  borderRadius: "10px",
                  background: "#333",
                  color: "#fff",
                },
              }
            );
          },
        }
      );
    } catch (error) {
      console.error("Error executing transaction:", error);
      toast.error(
        `Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          duration: 5000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        }
      );
    } finally {
      // Clear loading state
      setLoadingStates((prev) => ({
        ...prev,
        [vaultId]: { ...prev[vaultId], redeemDepegSwap: false },
      }));
    }
  };

  const handleRedeemUnderlying = async (vault: SuiObjectResponse) => {
    const vaultId = vault.data?.objectId;
    if (!vaultId) return;

    // Set loading state for this specific vault's underwriter action
    setLoadingStates((prev) => ({
      ...prev,
      [vaultId]: { ...prev[vaultId], redeemUnderwriter: true },
    }));

    try {
      if (!underwriterCaps?.data?.[0]?.data?.objectId) {
        toast.error(
          "You don't have the UnderwriterCap required to redeem underlying coins!"
        );
        return;
      }

      if (!currentAccount?.address) {
        toast.error("You don't have an account!");
        return;
      }

      if (!vault.data?.type || !vault.data?.objectId) {
        toast.error("Invalid vault data!");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // @ts-expect-error - Complex Sui blockchain type conversion
      const vaultContent = vault.data?.content as VaultContent;
      if (!vaultContent?.fields) {
        toast.error("Invalid vault data!");
        return;
      }

      // Extract pegged and underlying coin types from the vault fields
      const peggedType =
        vaultContent.fields.pegged_vault.type.match(/Coin<(.+)>/)?.[1];
      const underlyingType =
        vaultContent.fields.underlying_vault.type.match(/Coin<(.+)>/)?.[1];

      if (!peggedType || !underlyingType) {
        toast.error("Could not extract coin types from vault!");
        return;
      }

      console.log("Transaction input", {
        vaultId: vault.data.objectId,
        underwriterCapId: underwriterCaps.data[0].data.objectId,
        clockId: "0x6",
      });

      const tx = new Transaction();

      const [underlyingCoin, peggedCoin] = tx.moveCall({
        target: `${depegSwapPackageId}::vault::redeem_underlying`,
        typeArguments: [peggedType, underlyingType],
        arguments: [
          tx.object(vault.data.objectId),
          tx.object(underwriterCaps.data[0].data.objectId),
          tx.object("0x6"),
        ],
      });

      tx.transferObjects([underlyingCoin, peggedCoin], currentAccount.address);

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log("Successfully redeemed underlying coins:", result);

            // Refresh data by refetching queries
            refreshData(vault.data?.objectId);

            toast.success(
              <div>
                <div>Successfully redeemed underlying coins!</div>
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
              }
            );
          },
          onError: (error) => {
            console.error("Failed to redeem underlying coins:", error);
            toast.error(
              `Failed to redeem underlying coins: ${error instanceof Error ? error.message : "Unknown error"}`,
              {
                duration: 5000,
                style: {
                  borderRadius: "10px",
                  background: "#333",
                  color: "#fff",
                },
              }
            );
          },
        }
      );
    } catch (error) {
      console.error("Error executing transaction:", error);
      toast.error(
        `Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          duration: 5000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        }
      );
    } finally {
      // Clear loading state
      setLoadingStates((prev) => ({
        ...prev,
        [vaultId]: { ...prev[vaultId], redeemUnderwriter: false },
      }));
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-6">
            <p className="text-red-400">
              Error fetching vaults: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ClipLoader size={20} />
          <span>Loading vaults...</span>
        </div>
      </div>
    );
  }

  if (!vaultIds.length) {
    return (
      <div className="space-y-6">
        <p>No vaults found. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xl font-semibold">Created Vaults</h3>

        {registryData && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="space-y-2">
                <p className="text-sm">
                  Registry ID: {TESTNET_VAULT_REGISTRY_ID}
                </p>
                <p className="text-sm">Type: {registryData.data?.type}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {vaultObjectsData && vaultObjectsData.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-lg font-semibold">Vaults</h4>
            {[vaultObjectsData[vaultObjectsData.length - 1]].map(
              (vault: SuiObjectResponse) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                // @ts-expect-error - Complex Sui blockchain type conversion
                const content = vault.data?.content as VaultContent;
                const fields = content?.fields || {};
                const status =
                  Number(fields.expiry) > Date.now() ? "Active" : "Expired";
                const statusColor =
                  status === "Active" ? "text-green-400" : "text-red-400";
                const vaultId = vault.data?.objectId || "";

                // Extract coin balances
                const peggedVault = fields.pegged_vault?.fields;
                const underlyingVault = fields.underlying_vault?.fields;

                // Get coin types from the vault fields
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const peggedType =
                  (peggedVault as any)?.type
                    ?.match(/Coin<(.+)>/)?.[1]
                    ?.split("::")
                    .pop() || "Unknown";
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const underlyingType =
                  (underlyingVault as any)?.type
                    ?.match(/Coin<(.+)>/)?.[1]
                    ?.split("::")
                    .pop() || "Unknown";

                // Check if user has DS tokens for this vault
                const hasRequiredTokens =
                  userTokens.dsTokens.length > 0 &&
                  userTokens.peggedTokens.length > 0;

                // Get loading states for this vault
                const vaultLoadingStates = loadingStates[vaultId] || {
                  redeemDepegSwap: false,
                  redeemUnderwriter: false,
                };

                return (
                  <Card key={vaultId} className="bg-gray-900 border-gray-800">
                    <CardHeader className="p-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-semibold break-all">
                          Vault ID: {truncateText(vaultId, 30)}
                        </CardTitle>
                        <span className={`text-sm ${statusColor}`}>
                          {status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-sm space-y-1">
                        <p className="break-all">
                          Type: {truncateText(vault.data?.type || "", 80)}
                        </p>
                        <p>Total DS: {formatBalance(fields.total_ds)}</p>
                        <p>
                          Expiry:{" "}
                          {new Date(Number(fields.expiry)).toLocaleString()}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-semibold">
                          Vault Contents:
                        </h5>
                        <div className="bg-gray-800/50 p-3 rounded-lg space-y-1 text-sm">
                          <p>
                            Pegged Coin ({peggedType}):{" "}
                            {formatBalance(peggedVault?.balance || "0")}
                          </p>
                          <p>
                            Underlying Coin ({underlyingType}):{" "}
                            {formatBalance(underlyingVault?.balance || "0")}
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
                              value={
                                redeemInput.vaultId === vaultId
                                  ? redeemInput.amount
                                  : ""
                              }
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setRedeemInput({
                                  vaultId: vaultId,
                                  amount: e.target.value,
                                })
                              }
                            />
                            <Button
                              onClick={() => handleRedeemDepegSwap(vault)}
                              disabled={
                                vaultLoadingStates.redeemDepegSwap ||
                                !redeemInput.amount
                              }
                              className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                              {vaultLoadingStates.redeemDepegSwap ? (
                                <div className="flex items-center">
                                  <ClipLoader
                                    size={16}
                                    color="#ffffff"
                                    className="mr-2"
                                  />
                                  Redeeming Depeg Swap...
                                </div>
                              ) : (
                                "Redeem Depeg Swap"
                              )}
                            </Button>
                          </>
                        )}

                        {underwriterCaps?.data &&
                          underwriterCaps.data.length > 0 && (
                            <Button
                              onClick={() => handleRedeemUnderlying(vault)}
                              disabled={vaultLoadingStates.redeemUnderwriter}
                              className="w-full bg-red-600 hover:bg-red-700"
                            >
                              {vaultLoadingStates.redeemUnderwriter ? (
                                <div className="flex items-center">
                                  <ClipLoader
                                    size={16}
                                    color="#ffffff"
                                    className="mr-2"
                                  />
                                  Redeeming as Underwriter...
                                </div>
                              ) : (
                                "Redeem as Underwriter"
                              )}
                            </Button>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
