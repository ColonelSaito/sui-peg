"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Shield, TrendingUp, Coins, DollarSign, Users, Target } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCurrentAccount,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { networkConfig } from "../src/networkConfig";
import { Toaster } from "react-hot-toast";
import CreateVault from "../components/create-vault";
import SharedHeader from "../components/shared-header";

import React from "react";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";

const queryClient = new QueryClient();

export default function UnderwritePageDefault() {
  return (
    <React.StrictMode>
      <Theme appearance="dark">
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
            <WalletProvider autoConnect>
              <UnderwritePage />
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </Theme>
    </React.StrictMode>
  );
}

function UnderwritePage() {
  const currentAccount = useCurrentAccount();
  const queryClient = useQueryClient();

  // Function to refresh data after transactions
  const refreshData = useCallback(() => {
    if (currentAccount?.address) {
      queryClient.invalidateQueries({
        queryKey: ["getAllCoins", currentAccount.address],
      });
    }
  }, [queryClient, currentAccount?.address]);

  const handleVaultCreated = (vaultId: string) => {
    console.log("Vault created with ID:", vaultId);
    refreshData();
  };

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

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      
      {/* Shared Navigation Header */}
      <SharedHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-black z-0" />
        <div className="absolute inset-0 bg-[url('/abstract-digital-grid.png')] bg-cover bg-center opacity-10 z-0" />
        <div className="container relative z-10 px-4 py-16 mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-2 mb-6 text-sm font-medium text-blue-300 bg-blue-900/30 rounded-full">
                Earn Premium Income
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                Become an Underwriter
              </h1>
              <p className="text-lg text-gray-300 mb-8">
                Supply liquidity to earn premiums by providing depeg insurance to hedgers
              </p>
            </div>

            {/* Benefits Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <Card className="bg-blue-500/10 border-blue-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <DollarSign className="h-6 w-6 text-blue-400" />
                    </div>
                    <h3 className="font-semibold">Earn Premiums</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    Collect premiums from hedgers who purchase your depeg insurance tokens
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-purple-500/10 border-purple-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Shield className="h-6 w-6 text-purple-400" />
                    </div>
                    <h3 className="font-semibold">Risk Management</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    Manage your risk exposure by setting vault parameters and expiry times
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-cyan-500/10 border-cyan-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold">Fixed Returns</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    Earn predictable returns if no depeg event occurs during the vault period
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Token Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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
            </div>

            {/* How it Works */}
            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20 backdrop-blur-sm mb-12">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  How Underwriting Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-400 font-bold">1</span>
                    </div>
                    <h4 className="font-semibold mb-2">Supply Tokens</h4>
                    <p className="text-sm text-gray-300">
                      Deposit equal amounts of pegged and underlying tokens into a vault
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-purple-400 font-bold">2</span>
                    </div>
                    <h4 className="font-semibold mb-2">Receive DS Tokens</h4>
                    <p className="text-sm text-gray-300">
                      Get depeg swap tokens that hedgers can purchase for insurance
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-cyan-400 font-bold">3</span>
                    </div>
                    <h4 className="font-semibold mb-2">Earn Returns</h4>
                    <p className="text-sm text-gray-300">
                      Collect premiums and claim remaining tokens after expiry
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create Vault Section */}
            <Card className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 border-blue-500/30 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6">
                  <Shield className="h-8 w-8 text-blue-400" />
                </div>
                <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                  Create Your Vault
                </CardTitle>
                <CardDescription className="text-gray-300 text-lg mt-4 max-w-2xl mx-auto">
                  Set up a new vault to start earning premiums as an underwriter. Supply equal amounts of 
                  pegged and underlying tokens to begin collecting insurance premiums.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-8">
                {/* Feature Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Coins className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-100">Equal Amounts</p>
                      <p className="text-xs text-gray-400">Supply 1:1 ratio tokens</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-100">Earn Premiums</p>
                      <p className="text-xs text-gray-400">Get paid by hedgers</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <DollarSign className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-cyan-100">Fixed Returns</p>
                      <p className="text-xs text-gray-400">Predictable outcomes</p>
                    </div>
                  </div>
                </div>

                {/* Create Vault Form Container */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 rounded-lg blur-xl"></div>
                  <div className="relative bg-gray-900/50 border border-gray-700/50 rounded-lg p-1">
                    <CreateVault onCreated={handleVaultCreated} />
                  </div>
                </div>

                {/* Pro Tips */}
                <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5 text-blue-400" />
                      Pro Tips for Underwriters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-blue-400 text-xs font-bold">1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-100">Choose Expiry Wisely</p>
                          <p className="text-xs text-gray-400">Longer periods = higher premiums but more risk</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-purple-400 text-xs font-bold">2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-purple-100">Monitor Market Conditions</p>
                          <p className="text-xs text-gray-400">Track peg stability before creating vaults</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-cyan-400 text-xs font-bold">3</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-cyan-100">Start Small</p>
                          <p className="text-xs text-gray-400">Test with smaller amounts before scaling up</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-green-400 text-xs font-bold">4</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-100">Diversify Risk</p>
                          <p className="text-xs text-gray-400">Create multiple vaults with different expiries</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Risk Disclaimer */}
            <Card className="bg-yellow-500/5 border-yellow-500/20 backdrop-blur-sm mt-12">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-400 mb-2">Risk Disclaimer</h4>
                    <p className="text-sm text-gray-300">
                      Underwriting involves risk. If a depeg event occurs, hedgers may redeem underlying 
                      tokens from your vault. Only underwrite amounts you can afford to lose. Past 
                      performance does not guarantee future results.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

// Helper function
function formatBalance(balance: string, decimals = 9): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${paddedFractional.substring(0, 4)}`;
} 