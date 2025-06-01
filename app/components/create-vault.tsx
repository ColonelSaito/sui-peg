"use client";

import React, { useState, useMemo, type ChangeEvent, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
import type { CoinStruct } from "@mysten/sui/client";
import { useQueryClient } from "@tanstack/react-query";

interface CoinOption {
  id: string;
  balance: string;
  type: string;
  decimals: number;
  symbol: string;
  isPegged: boolean;
}

function formatDisplayBalance(balance: string, decimals: number): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  // Convert to number for better formatting
  const fullNumber = Number(integerPart) + Number(fractionalPart) / (10 ** decimals);
  
  // For zero values
  if (fullNumber === 0) {
    return "0";
  }
  
  // For very small amounts, show up to 6 decimal places
  if (fullNumber < 0.001) {
    return fullNumber.toFixed(6).replace(/\.?0+$/, '') || "< 0.000001";
  }
  // For small amounts, show up to 4 decimal places
  else if (fullNumber < 1) {
    return fullNumber.toFixed(4).replace(/\.?0+$/, '');
  }
  // For medium amounts, show up to 3 decimal places
  else if (fullNumber < 1000) {
    return fullNumber.toFixed(3).replace(/\.?0+$/, '');
  }
  // For large amounts, show with thousand separators and up to 2 decimal places
  else {
    return fullNumber.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
  }
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

export default function CreateVault({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId");
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const {
    mutate: signAndExecute,
    isPending: isTransactionPending,
  } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  const [selectedPeggedCoin, setSelectedPeggedCoin] =
    useState<CoinOption | null>(null);
  const [selectedUnderlyingCoin, setSelectedUnderlyingCoin] =
    useState<CoinOption | null>(null);
  const [expiryHours, setExpiryHours] = useState("24"); // Default 24 hours
  const [peggedAmount, setPeggedAmount] = useState("");
  const [underlyingAmount, setUnderlyingAmount] = useState("");

  // Function to refresh data after transactions
  const refreshData = useCallback(() => {
    // Invalidate and refetch all relevant queries
    if (currentAccount?.address) {
      // Refetch user coins
      queryClient.invalidateQueries({
        queryKey: ["getAllCoins", currentAccount.address],
      });
    }

    // Refetch registry and vaults
    queryClient.invalidateQueries({
      queryKey: ["getObject", TESTNET_VAULT_REGISTRY_ID],
    });

    // Refetch vault objects
    queryClient.invalidateQueries({
      queryKey: ["multiGetObjects"],
    });
  }, [queryClient, currentAccount?.address]);

  // Query for user's coins
  const {
    data: userCoins,
    isPending: isCoinsLoading,
    error: coinsError,
  } = useSuiClientQuery(
    "getAllCoins",
    {
      owner: currentAccount?.address || "",
    },
    {
      enabled: !!currentAccount?.address,
    }
  );

  // Format coins for dropdown with basic information
  const coinOptions: CoinOption[] = useMemo(() => {
    if (!userCoins?.data) return [];

    return userCoins.data.map((coin: CoinStruct) => {
      const rawSymbol = coin.coinType.split("::").pop() || "UNKNOWN";
      const isPegged = coin.coinType.includes("::pegged_coin::");
      
      // Clean up the symbol display
      let cleanSymbol = rawSymbol;
      if (isPegged) {
        // Extract just the numeric part and format as LBTC
        if (rawSymbol.startsWith("PEGGED_COIN")) {
          const value = rawSymbol.replace("PEGGED_COIN", "");
          const numericValue = parseFloat(value);
          if (!isNaN(numericValue)) {
            cleanSymbol = `LBTC (${numericValue.toFixed(2)})`;
          } else {
            cleanSymbol = "LBTC";
          }
        }
      } else if (coin.coinType.includes("::underlying_coin::")) {
        // Clean up underlying coin display
        if (rawSymbol.startsWith("UNDERLYING_COIN")) {
          const value = rawSymbol.replace("UNDERLYING_COIN", "");
          const numericValue = parseFloat(value);
          if (!isNaN(numericValue)) {
            cleanSymbol = `wBTC (${numericValue.toFixed(2)})`;
          } else {
            cleanSymbol = "wBTC";
          }
        }
      }
      
      return {
        id: coin.coinObjectId,
        balance: coin.balance,
        type: coin.coinType,
        decimals: 9, // Default to 9 decimals for Sui coins
        symbol: cleanSymbol,
        isPegged,
      };
    });
  }, [userCoins?.data]);

  // Separate pegged and underlying coins
  const peggedCoins = useMemo(
    () => coinOptions.filter((coin) => coin.type.includes("::pegged_coin::")),
    [coinOptions]
  );

  const underlyingCoins = useMemo(
    () =>
      coinOptions.filter((coin) => coin.type.includes("::underlying_coin::")),
    [coinOptions]
  );

  // Query for the VaultRegistry object directly
  const {
    data: registryData,
    isPending: isRegistryPending,
    error: registryError,
  } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_REGISTRY_ID,
    options: { showContent: true },
  });

  // Query for the VaultTreasury object directly
  const {
    data: treasuryData,
    isPending: isTreasuryPending,
    error: treasuryError,
  } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_TREASURY_ID,
    options: { showContent: true },
  });

  async function createVault() {
    if (!currentAccount?.address) {
      console.error("No wallet connected");
      toast.error("Please connect your wallet first!");
      return;
    }

    if (
      !TESTNET_VAULT_REGISTRY_ID ||
      !TESTNET_VAULT_TREASURY_ID ||
      !selectedPeggedCoin ||
      !selectedUnderlyingCoin
    ) {
      console.error("Missing required object IDs or coin selections");
      toast.error("Missing required object IDs or coin selections");
      return;
    }

    // Debug: Log object details
    try {
      const [registry, treasury] = await suiClient.multiGetObjects({
        ids: [TESTNET_VAULT_REGISTRY_ID, TESTNET_VAULT_TREASURY_ID],
        options: { showOwner: true, showContent: true, showType: true },
      });

      console.log("Detailed Object Info:", {
        registry: {
          id: registry.data?.objectId,
          owner: registry.data?.owner,
          type: registry.data?.type,
          version: registry.data?.version,
          digest: registry.data?.digest,
        },
        treasury: {
          id: treasury.data?.objectId,
          owner: treasury.data?.owner,
          type: treasury.data?.type,
          version: treasury.data?.version,
          digest: treasury.data?.digest,
        },
        currentAddress: currentAccount.address,
      });

      // Verify registry and treasury are shared
      const registryOwner = registry.data?.owner as {
        Shared?: { initial_shared_version: number };
      };
      const treasuryOwner = treasury.data?.owner as {
        Shared?: { initial_shared_version: number };
      };

      if (!registryOwner?.Shared) {
        console.error("Registry is not a shared object:", registry.data?.owner);
        toast.error("Registry is not a shared object");
        return;
      }

      if (!treasuryOwner?.Shared) {
        console.error("Treasury is not a shared object:", treasury.data?.owner);
        toast.error("Treasury is not a shared object");
        return;
      }

      // Verify object types
      if (!registry.data?.type?.includes("::registry::VaultRegistry")) {
        console.error("Invalid Registry type:", registry.data?.type);
        toast.error("Invalid Registry type");
        return;
      }

      if (!treasury.data?.type?.includes("::vault::VaultTreasury")) {
        console.error("Invalid Treasury type:", treasury.data?.type);
        toast.error("Invalid Treasury type");
        return;
      }
    } catch (error) {
      console.error("Error fetching object details:", error);
      toast.error(
        `Error fetching object details: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return;
    }

    // Convert hours to milliseconds for expiry
    const expiryMs = Date.now() + Number.parseInt(expiryHours) * 60 * 60 * 1000;

    // Convert display amounts to on-chain amounts using decimals
    const peggedAmountOnChain = parseInputAmount(
      peggedAmount,
      selectedPeggedCoin.decimals
    );
    const underlyingAmountOnChain = parseInputAmount(
      underlyingAmount,
      selectedUnderlyingCoin.decimals
    );

    // Verify coin amounts and balances
    if (peggedAmountOnChain !== underlyingAmountOnChain) {
      console.error(`Coin amounts must be equal:
        Pegged: ${peggedAmountOnChain.toString()}
        Underlying: ${underlyingAmountOnChain.toString()}
      `);
      toast.error("Pegged and underlying coin amounts must be equal");
      return;
    }

    const peggedBalance = BigInt(selectedPeggedCoin.balance);
    const underlyingBalance = BigInt(selectedUnderlyingCoin.balance);

    if (peggedAmountOnChain > peggedBalance) {
      console.error(`Insufficient pegged coin balance:
        Required: ${peggedAmountOnChain.toString()}
        Available: ${peggedBalance.toString()}
      `);
      toast.error("Insufficient pegged coin balance");
      return;
    }

    if (underlyingAmountOnChain > underlyingBalance) {
      console.error(`Insufficient underlying coin balance:
        Required: ${underlyingAmountOnChain.toString()}
        Available: ${underlyingBalance.toString()}
      `);
      toast.error("Insufficient underlying coin balance");
      return;
    }

    // Debug: Log transaction details
    console.log("Transaction Details:", {
      packageId: depegSwapPackageId,
      registryId: TESTNET_VAULT_REGISTRY_ID,
      treasuryId: TESTNET_VAULT_TREASURY_ID,
      peggedCoin: {
        id: selectedPeggedCoin.id,
        type: selectedPeggedCoin.type,
        amount: peggedAmountOnChain.toString(),
        balance: peggedBalance.toString(),
      },
      underlyingCoin: {
        id: selectedUnderlyingCoin.id,
        type: selectedUnderlyingCoin.type,
        amount: underlyingAmountOnChain.toString(),
        balance: underlyingBalance.toString(),
      },
      expiryMs: expiryMs.toString(),
      currentTime: Date.now().toString(),
    });

    const tx = new Transaction();

    // Convert amounts to u64 strings
    const amount = peggedAmountOnChain.toString();

    // Split the pegged coin first
    const [splitPeggedCoin] = tx.splitCoins(tx.object(selectedPeggedCoin.id), [
      tx.pure.u64(amount),
    ]);

    // Split the underlying coin with the exact same amount
    const [splitUnderlyingCoin] = tx.splitCoins(
      tx.object(selectedUnderlyingCoin.id),
      [tx.pure.u64(amount)]
    );

    console.log([selectedPeggedCoin.type, selectedUnderlyingCoin.type]);

    // Create vault with split coins
    tx.moveCall({
      target: `${depegSwapPackageId}::registry::create_vault_collection`,
      typeArguments: [selectedPeggedCoin.type, selectedUnderlyingCoin.type],
      arguments: [
        tx.object(TESTNET_VAULT_REGISTRY_ID),
        tx.object(TESTNET_VAULT_TREASURY_ID),
        splitPeggedCoin,
        splitUnderlyingCoin,
        tx.pure.u64(expiryMs.toString()),
        tx.object("0x6"),
      ],
    });

    // Add debug logging for the transaction
    console.log("Transaction Structure:", {
      amount,
      peggedCoin: {
        id: selectedPeggedCoin.id,
        type: selectedPeggedCoin.type,
        split: splitPeggedCoin,
      },
      underlyingCoin: {
        id: selectedUnderlyingCoin.id,
        type: selectedUnderlyingCoin.type,
        split: splitUnderlyingCoin,
      },
      expiry: expiryMs.toString(),
    });

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async ({ digest }) => {
          console.log("Transaction success:", { digest });
          const { effects } = await suiClient.waitForTransaction({
            digest: digest,
            options: {
              showEffects: true,
            },
          });

          if (effects?.status?.error) {
            console.error("Transaction failed:", effects.status.error);
            toast.error(`Transaction failed: ${effects.status.error}`, {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            });
            return;
          }

          // The first created object should be our vault
          const vaultId = effects?.created?.[0]?.reference?.objectId;
          if (!vaultId) {
            console.error("No vault created in transaction");
            toast.error("No vault created in transaction", {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            });
            return;
          }

          // Refresh data
          refreshData();

          toast.success(
            <div>
              <div>Successfully created vault!</div>
              <a
                href={`https://suiscan.xyz/testnet/tx/${digest}`}
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

          // Reset form
          setPeggedAmount("");
          setUnderlyingAmount("");
          setSelectedPeggedCoin(null);
          setSelectedUnderlyingCoin(null);

          // Call the onCreated callback
          onCreated(vaultId);
        },
        onError: (error) => {
          console.error("Transaction error:", error);
          toast.error(
            `Transaction error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  }

  const isLoading = isRegistryPending || isTreasuryPending || isCoinsLoading;
  const errors = [coinsError, registryError, treasuryError].filter(Boolean);
  const isReady =
    registryData && treasuryData && userCoins && coinOptions.length > 0;

  if (errors.length > 0) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="p-6">
          <p className="text-red-400">
            Error loading data: {errors.map((e) => e?.message).join(", ")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Section */}
      {isLoading ? (
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <ClipLoader size={24} color="#60a5fa" />
              <p className="text-blue-100 font-medium">Loading vault requirements...</p>
            </div>
          </CardContent>
        </Card>
      ) : !isReady ? (
        <Card className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-500/30">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-red-100 font-semibold mb-2">Setup Required</h3>
              <p className="text-red-200/80 text-sm mb-4">Missing required vault objects:</p>
              <ul className="text-red-200/60 text-sm space-y-1">
                {!registryData && <li>• VaultRegistry object not found</li>}
                {!treasuryData && <li>• VaultTreasury object not found</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-100 text-sm font-medium">Vault infrastructure ready</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Form */}
      <Card className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border-gray-700/50 backdrop-blur-sm">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-6 0H3m2-7h16M5 10h16" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-xl text-white">Create New Vault</CardTitle>
              <p className="text-gray-400 text-sm mt-1">Set up your underwriting vault parameters</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Token Selection Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                <span className="text-blue-400 text-sm font-bold">1</span>
              </div>
              <h3 className="text-lg font-semibold text-blue-100">Select Token Pair</h3>
            </div>

            {/* Pegged Coin Selection */}
            <div className="space-y-3">
              <Label htmlFor="pegged-coin" className="text-purple-100 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                Pegged Coin (LBTC)
              </Label>
              <Select
                value={selectedPeggedCoin?.id || ""}
                onValueChange={(value) => {
                  const coin = peggedCoins.find((c) => c.id === value);
                  setSelectedPeggedCoin(coin || null);
                }}
              >
                <SelectTrigger className="bg-gray-800/50 border-purple-500/30 hover:border-purple-500/50 transition-colors h-12">
                  <SelectValue placeholder="Choose pegged coin" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-60 overflow-y-auto">
                  {peggedCoins.length === 0 ? (
                    <SelectItem value="no-coins" className="text-gray-400" disabled>
                      No pegged coins available
                    </SelectItem>
                  ) : (
                    peggedCoins.map((coin) => (
                      <SelectItem key={coin.id} value={coin.id} className="text-gray-100 hover:bg-gray-700 focus:bg-gray-700">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col">
                            <span className="font-medium text-purple-100">{coin.symbol}</span>
                            <span className="text-xs text-gray-400 truncate">
                              {coin.id.slice(0, 8)}...{coin.id.slice(-4)}
                            </span>
                          </div>
                          <div className="text-right ml-4">
                            <span className="text-purple-300 font-medium text-sm">
                              {formatDisplayBalance(coin.balance, coin.decimals)}
                            </span>
                            <div className="text-xs text-gray-400">Available</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPeggedCoin && (
                <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-purple-100 text-sm">
                    Available: <span className="font-medium">{formatDisplayBalance(selectedPeggedCoin.balance, selectedPeggedCoin.decimals)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Underlying Coin Selection */}
            <div className="space-y-3">
              <Label htmlFor="underlying-coin" className="text-blue-100 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                Underlying Coin (wBTC)
              </Label>
              <Select
                value={selectedUnderlyingCoin?.id || ""}
                onValueChange={(value) => {
                  const coin = underlyingCoins.find((c) => c.id === value);
                  setSelectedUnderlyingCoin(coin || null);
                }}
              >
                <SelectTrigger className="bg-gray-800/50 border-blue-500/30 hover:border-blue-500/50 transition-colors h-12">
                  <SelectValue placeholder="Choose underlying coin" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-60 overflow-y-auto">
                  {underlyingCoins.length === 0 ? (
                    <SelectItem value="no-coins" className="text-gray-400" disabled>
                      No underlying coins available
                    </SelectItem>
                  ) : (
                    underlyingCoins.map((coin) => (
                      <SelectItem key={coin.id} value={coin.id} className="text-gray-100 hover:bg-gray-700 focus:bg-gray-700">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col">
                            <span className="font-medium text-blue-100">{coin.symbol}</span>
                            <span className="text-xs text-gray-400 truncate">
                              {coin.id.slice(0, 8)}...{coin.id.slice(-4)}
                            </span>
                          </div>
                          <div className="text-right ml-4">
                            <span className="text-blue-300 font-medium text-sm">
                              {formatDisplayBalance(coin.balance, coin.decimals)}
                            </span>
                            <div className="text-xs text-gray-400">Available</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedUnderlyingCoin && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-blue-100 text-sm">
                    Available: <span className="font-medium">{formatDisplayBalance(selectedUnderlyingCoin.balance, selectedUnderlyingCoin.decimals)}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Amount Configuration Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                <span className="text-purple-400 text-sm font-bold">2</span>
              </div>
              <h3 className="text-lg font-semibold text-purple-100">Configure Amounts</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pegged Amount */}
              <div className="space-y-3">
                <Label htmlFor="pegged-amount" className="text-purple-100 font-medium">
                  Pegged Amount
                </Label>
                <div className="relative">
                  <Input
                    id="pegged-amount"
                    type="text"
                    placeholder="0.00"
                    value={peggedAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPeggedAmount(e.target.value)
                    }
                    className="bg-gray-800/50 border-purple-500/30 hover:border-purple-500/50 focus:border-purple-500 transition-colors h-12 pl-4 pr-16"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-purple-400 text-sm font-medium">
                      {selectedPeggedCoin?.symbol || "LBTC"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Underlying Amount */}
              <div className="space-y-3">
                <Label htmlFor="underlying-amount" className="text-blue-100 font-medium">
                  Underlying Amount
                </Label>
                <div className="relative">
                  <Input
                    id="underlying-amount"
                    type="text"
                    placeholder="0.00"
                    value={underlyingAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setUnderlyingAmount(e.target.value)
                    }
                    className="bg-gray-800/50 border-blue-500/30 hover:border-blue-500/50 focus:border-blue-500 transition-colors h-12 pl-4 pr-16"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-blue-400 text-sm font-medium">
                      {selectedUnderlyingCoin?.symbol || "wBTC"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Equal Amounts Note */}
            <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-cyan-100 text-sm">
                Both amounts must be equal for vault creation
              </p>
            </div>
          </div>

          {/* Expiry Configuration Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center">
                <span className="text-cyan-400 text-sm font-bold">3</span>
              </div>
              <h3 className="text-lg font-semibold text-cyan-100">Set Expiry Time</h3>
            </div>

            <div className="space-y-3">
              <Label htmlFor="expiry-hours" className="text-cyan-100 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Expiry Hours
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[24, 48, 72, 168].map((hours) => (
                  <Button
                    key={hours}
                    type="button"
                    variant={expiryHours === hours.toString() ? "default" : "outline"}
                    onClick={() => setExpiryHours(hours.toString())}
                    className={`h-10 ${
                      expiryHours === hours.toString()
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                        : "border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10"
                    }`}
                  >
                    {hours}h
                  </Button>
                ))}
              </div>
              <Input
                id="expiry-hours"
                type="number"
                placeholder="Custom hours"
                value={expiryHours}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setExpiryHours(e.target.value)
                }
                className="bg-gray-800/50 border-cyan-500/30 hover:border-cyan-500/50 focus:border-cyan-500 transition-colors h-12"
              />
              {expiryHours && (
                <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-cyan-100 text-sm">
                    Expires: <span className="font-medium">
                      {new Date(Date.now() + Number.parseInt(expiryHours) * 60 * 60 * 1000).toLocaleString()}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-6">
          <Button
            onClick={createVault}
            disabled={
              !isReady ||
              isTransactionPending ||
              !selectedPeggedCoin ||
              !selectedUnderlyingCoin ||
              !peggedAmount ||
              !underlyingAmount
            }
            className="w-full h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 hover:from-blue-700 hover:via-purple-700 hover:to-cyan-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isTransactionPending ? (
              <div className="flex items-center gap-2">
                <ClipLoader size={20} color="#ffffff" />
                <span>Creating Vault...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Vault
              </div>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
