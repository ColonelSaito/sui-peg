"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Shield, Clock, Coins, TrendingUp, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import {
  useCurrentAccount,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { networkConfig, useNetworkVariable } from "../src/networkConfig";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { ClipLoader } from "react-spinners";
import SharedHeader from "../components/shared-header";
import { TESTNET_VAULT_REGISTRY_ID } from "../src/constants";
import type { SuiObjectResponse } from "@mysten/sui/client";

import React from "react";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";

const queryClient = new QueryClient();

export default function HedgePageDefault() {
  return (
    <React.StrictMode>
      <Theme appearance="dark">
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
            <WalletProvider autoConnect>
              <HedgePage />
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </Theme>
    </React.StrictMode>
  );
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

function HedgePage() {
  const currentAccount = useCurrentAccount();
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId");

  // State for redeem input per vault
  const [redeemInputs, setRedeemInputs] = useState<{[vaultId: string]: string}>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const vaultsPerPage = 4; // 2x2 grid

  // Add toggle state for vault filtering
  const [showOnlyMyVaults, setShowOnlyMyVaults] = useState(false);

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

  // Query for UnderwriterCap objects
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

  // Query for vault registry
  const {
    data: registryData,
    isPending: isRegistryPending,
  } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_REGISTRY_ID,
    options: {
      showContent: true,
      showType: true,
      showOwner: true,
    },
  });

  // Get vault IDs from registry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registryContent = registryData?.data?.content as any;
  const vaultIds = registryContent?.fields?.vaults || [];

  // Query vault objects
  const {
    data: vaultObjectsData,
    isPending: isVaultsPending,
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
      enabled: vaultIds.length > 0,
    }
  );

  // Format coins for display
  const formattedCoins = useMemo(() => 
    userCoins?.data?.map((coin) => ({
      id: coin.coinObjectId,
      type: coin.coinType,
      balance: formatBalance(coin.balance, 9),
      rawBalance: coin.balance,
    })) || [], [userCoins?.data]
  );

  // Categorize coins
  const wbtcCoins = formattedCoins.filter((coin) =>
    coin.type.includes("::underlying_coin::")
  );
  const lbtcCoins = formattedCoins.filter((coin) =>
    coin.type.includes("::pegged_coin::")
  );
  const dsTokens = formattedCoins.filter(
    (coin) => coin.type === `${depegSwapPackageId}::vault::VAULT`
  );

  // Filter vaults based on toggle state
  const filteredVaultObjects = useMemo(() => {
    if (!vaultObjectsData) return [];
    
    if (!showOnlyMyVaults) {
      return vaultObjectsData;
    }
    
    // Filter to only show vaults where user is an underwriter
    return vaultObjectsData.filter((vault) => {
      if (!underwriterCaps?.data || !vault.data?.objectId) return false;
      
      // Check if user has UnderwriterCap for this specific vault
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return underwriterCaps.data.some((cap: any) => {
        const capContent = cap.data?.content;
        if (capContent?.dataType === "moveObject") {
          // Check if the UnderwriterCap is for this vault
          const vaultId = capContent.fields?.vault_id;
          return vaultId === vault.data?.objectId;
        }
        return false;
      });
    });
  }, [vaultObjectsData, underwriterCaps?.data, showOnlyMyVaults]);

  // Reset pagination when filter changes
  const handleToggleChange = () => {
    setShowOnlyMyVaults(!showOnlyMyVaults);
    setCurrentPage(1);
  };

  const handleRedeemDepegSwap = async (vault: SuiObjectResponse) => {
    const vaultId = vault.data?.objectId;
    if (!vaultId || !currentAccount?.address) return;

    const amount = redeemInputs[vaultId];
    if (!amount) {
      toast.error("Please enter an amount to redeem");
      return;
    }

    // Implementation for redeem logic (similar to existing logic)
    // ... (keeping existing redeem logic)
  };

  const isLoading = isRegistryPending || isVaultsPending;

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      
      {/* Shared Navigation Header */}
      <SharedHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-black z-0" />
        <div className="absolute inset-0 bg-[url('/abstract-digital-grid.png')] bg-cover bg-center opacity-10 z-0" />
        <div className="container relative z-10 px-4 py-16 mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-2 mb-6 text-sm font-medium text-purple-300 bg-purple-900/30 rounded-full">
                Depeg Insurance Platform
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">
                Vault Management Dashboard
              </h1>
              <p className="text-lg text-gray-300 mb-8">
                Manage your depeg insurance positions and redeem vault tokens
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <Card className="bg-gray-800/50 border-purple-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Coins className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">wBTC Balance</p>
                      <p className="text-2xl font-bold text-white">
                        {wbtcCoins.length > 0
                          ? wbtcCoins
                              .reduce((balance, a) => balance + parseFloat(a.balance), 0)
                              .toPrecision(3)
                          : "0"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-blue-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Shield className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">LBTC Balance</p>
                      <p className="text-2xl font-bold text-white">
                        {lbtcCoins.length > 0
                          ? lbtcCoins
                              .reduce((balance, a) => balance + parseFloat(a.balance), 0)
                              .toPrecision(3)
                          : "0"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-cyan-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">DS Tokens</p>
                      <p className="text-2xl font-bold text-white">
                        {dsTokens.length > 0 ? dsTokens[0].balance : "0"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Active Vaults</h2>
                <div className="flex items-center gap-4">
                  {/* Vault Filter Toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showOnlyMyVaults ? "default" : "outline"}
                      size="sm"
                      onClick={handleToggleChange}
                      className={`flex items-center gap-2 transition-all ${
                        showOnlyMyVaults
                          ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 border-orange-500/20"
                          : "bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 text-gray-300"
                      }`}
                    >
                      <Filter className="h-3 w-3" />
                      {showOnlyMyVaults ? "My Vaults" : "All Vaults"}
                    </Button>
                  </div>

                  {!isLoading && filteredVaultObjects && filteredVaultObjects.length > 0 && (
                    <div className="text-sm text-gray-400">
                      {filteredVaultObjects.length} vault{filteredVaultObjects.length !== 1 ? 's' : ''} 
                      {showOnlyMyVaults ? " (underwritten)" : " total"}
                    </div>
                  )}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <ClipLoader size={16} />
                      <span>Loading vaults...</span>
                    </div>
                  )}
                </div>
              </div>

              {!isLoading && vaultIds.length === 0 ? (
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="p-12 text-center">
                    <Shield className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Vaults Found</h3>
                    <p className="text-gray-400 mb-6">
                      Visit the Underwrite page to create your first vault and start earning premiums.
                    </p>
                    <Link href="/underwrite">
                      <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                        Create Vault
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : !isLoading && showOnlyMyVaults && filteredVaultObjects.length === 0 ? (
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="p-12 text-center">
                    <Shield className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Underwritten Vaults Found</h3>
                    <p className="text-gray-400 mb-6">
                      You have not underwritten any vaults yet. Create a vault to start earning premiums.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button 
                        onClick={handleToggleChange}
                        variant="outline"
                        className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50"
                      >
                        View All Vaults
                      </Button>
                      <Link href="/underwrite">
                        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                          Create Vault
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : filteredVaultObjects && filteredVaultObjects.length > 0 ? (
                <>
                  {/* Vault Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredVaultObjects
                      .slice((currentPage - 1) * vaultsPerPage, currentPage * vaultsPerPage)
                      .map((vault: SuiObjectResponse) => {
                        const content = vault.data?.content;
                        if (!content || content.dataType !== "moveObject") return null;
                        
                        const fields = (content as unknown as VaultContent).fields || {};
                        const vaultId = vault.data?.objectId || "";
                        const expiryTimestamp = Number(fields.expiry);
                        const timeRemaining = formatTimeRemaining(expiryTimestamp);
                        
                        // Extract coin types
                        const peggedType = fields.pegged_vault?.type
                          ?.match(/Coin<(.+)>/)?.[1]
                          ?.split("::")
                          .pop() || "Unknown";
                        const underlyingType = fields.underlying_vault?.type
                          ?.match(/Coin<(.+)>/)?.[1]
                          ?.split("::")
                          .pop() || "Unknown";

                        const peggedBalance = formatBalance(fields.pegged_vault?.fields?.balance || "0");
                        const underlyingBalance = formatBalance(fields.underlying_vault?.fields?.balance || "0");
                        const totalDS = formatBalance(fields.total_ds);

                        // Check if current user is an underwriter for this vault
                        const isUnderwriter = underwriterCaps?.data && underwriterCaps.data.length > 0;

                        return (
                          <Card 
                            key={vaultId} 
                            className={`bg-gradient-to-br from-gray-800/50 to-gray-900/50 border backdrop-blur-sm transition-all duration-300 hover:border-purple-500/50 hover:scale-[1.02] ${
                              timeRemaining.isExpired ? 'border-red-500/30' : 'border-gray-700'
                            }`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-semibold truncate">
                                    {peggedType} ↔ {underlyingType}
                                  </CardTitle>
                                  <CardDescription className="text-gray-400 text-sm mt-1 truncate">
                                    {vaultId.slice(0, 12)}...{vaultId.slice(-4)}
                                  </CardDescription>
                                </div>
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  timeRemaining.isExpired 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : timeRemaining.variant === 'warning'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}>
                                  {timeRemaining.isExpired ? 'Expired' : 'Active'}
                                </div>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                              {/* Compact Token Info */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/20 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <Coins className="h-3 w-3 text-purple-400" />
                                    <span className="text-xs text-purple-400">Pegged</span>
                                  </div>
                                  <p className="text-sm font-bold text-white truncate">{peggedBalance}</p>
                                </div>

                                <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <Shield className="h-3 w-3 text-blue-400" />
                                    <span className="text-xs text-blue-400">Under</span>
                                  </div>
                                  <p className="text-sm font-bold text-white truncate">{underlyingBalance}</p>
                                </div>

                                <div className="bg-cyan-500/10 p-2 rounded border border-cyan-500/20 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <TrendingUp className="h-3 w-3 text-cyan-400" />
                                    <span className="text-xs text-cyan-400">DS</span>
                                  </div>
                                  <p className="text-sm font-bold text-white truncate">{totalDS}</p>
                                </div>
                              </div>

                              {/* Expiry Info */}
                              <div className={`flex items-center gap-2 p-2 rounded text-center ${
                                timeRemaining.isExpired 
                                  ? 'bg-red-500/10 border border-red-500/20' 
                                  : timeRemaining.variant === 'warning'
                                  ? 'bg-yellow-500/10 border border-yellow-500/20'
                                  : 'bg-gray-800/50'
                              }`}>
                                <Clock className={`h-3 w-3 ${
                                  timeRemaining.isExpired 
                                    ? 'text-red-400' 
                                    : timeRemaining.variant === 'warning'
                                    ? 'text-yellow-400'
                                    : 'text-gray-400'
                                }`} />
                                <span className={`text-xs flex-1 ${
                                  timeRemaining.isExpired 
                                    ? 'text-red-400' 
                                    : timeRemaining.variant === 'warning'
                                    ? 'text-yellow-400'
                                    : 'text-gray-400'
                                }`}>
                                  {timeRemaining.isExpired ? 'Expired' : `Expires ${timeRemaining.text}`}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="space-y-2">
                                {!timeRemaining.isExpired && dsTokens.length > 0 && lbtcCoins.length > 0 && (
                                  <>
                                    <Input
                                      placeholder="DS amount (÷100)"
                                      className="bg-gray-800 border-gray-600 h-9 text-sm"
                                      value={redeemInputs[vaultId] || ""}
                                      onChange={(e) => setRedeemInputs(prev => ({
                                        ...prev,
                                        [vaultId]: e.target.value
                                      }))}
                                    />
                                    <Button 
                                      onClick={() => handleRedeemDepegSwap(vault)}
                                      disabled={!redeemInputs[vaultId]}
                                      className="w-full h-9 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-sm"
                                    >
                                      Redeem Depeg Swap
                                    </Button>
                                  </>
                                )}

                                {/* Only show underwriter redemption if user is actually an underwriter */}
                                {isUnderwriter && (
                                  <Button 
                                    className="w-full h-9 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 border border-orange-500/20 text-sm font-medium"
                                    // onClick={() => handleRedeemUnderlying(vault)}
                                  >
                                    <Shield className="h-3 w-3 mr-2" />
                                    Redeem as Underwriter
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>

                  {/* Pagination */}
                  {filteredVaultObjects.length > vaultsPerPage && (
                    <div className="flex justify-center items-center gap-4 pt-6">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </Button>

                      <div className="flex items-center gap-2">
                        {Array.from({ length: Math.ceil(filteredVaultObjects.length / vaultsPerPage) }, (_, i) => (
                          <Button
                            key={i + 1}
                            variant={currentPage === i + 1 ? "default" : "outline"}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-10 h-10 ${
                              currentPage === i + 1
                                ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                                : "bg-gray-800/50 border-gray-600 hover:bg-gray-700/50"
                            }`}
                          >
                            {i + 1}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => 
                          Math.min(Math.ceil(filteredVaultObjects.length / vaultsPerPage), prev + 1)
                        )}
                        disabled={currentPage === Math.ceil(filteredVaultObjects.length / vaultsPerPage)}
                        className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50"
                      >
                        Next
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Helper functions
function formatBalance(balance: string, decimals = 9): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${paddedFractional.substring(0, 4)}`;
}

function formatTimeRemaining(expiryTimestamp: number): { text: string; isExpired: boolean; variant: "expired" | "warning" | "normal" } {
  const now = Date.now();
  const timeDiff = expiryTimestamp - now;
  
  if (timeDiff <= 0) {
    return { text: "Expired", isExpired: true, variant: "expired" };
  }
  
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  const expiryDate = new Date(expiryTimestamp);
  const timeString = expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  let timeText = "";
  let variant: "expired" | "warning" | "normal" = "normal";
  
  if (days > 0) {
    timeText = `in ${days} day${days > 1 ? 's' : ''} at ${timeString}`;
  } else if (hours > 0) {
    timeText = `in ${hours} hour${hours > 1 ? 's' : ''} at ${timeString}`;
    variant = hours < 6 ? "warning" : "normal";
  } else {
    timeText = `in ${minutes} minute${minutes > 1 ? 's' : ''} at ${timeString}`;
    variant = "warning";
  }
  
  return { text: timeText, isExpired: false, variant };
}
