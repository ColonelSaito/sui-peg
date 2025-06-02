"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Info, Send, Shield, Coins, ArrowRight, Users } from "lucide-react";
import { useState, type ChangeEvent, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCurrentAccount,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { networkConfig, useNetworkVariable } from "../src/networkConfig";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { ClipLoader } from "react-spinners";
import SharedHeader from "../components/shared-header";

import React from "react";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";

const queryClient = new QueryClient();

export default function TransferPageDefault() {
  return (
    <React.StrictMode>
      <Theme appearance="dark">
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
            <WalletProvider autoConnect>
              <TransferPage />
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </Theme>
    </React.StrictMode>
  );
}

function TransferPage() {
  const currentAccount = useCurrentAccount();
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId");
  const { mutate: signAndExecute, isPending: isTransactionPending } =
    useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  // State for transfer input
  const [transferInput, setTransferInput] = useState({
    amount: "",
    recipient: "",
  });

  // Function to refresh data after transactions
  const refreshData = useCallback(() => {
    if (currentAccount?.address) {
      queryClient.invalidateQueries({
        queryKey: ["getAllCoins", currentAccount.address],
      });
    }
  }, [queryClient, currentAccount?.address]);

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

  // Get DS tokens
  const dsTokens = formattedCoins.filter(
    (coin) => coin.type === `${depegSwapPackageId}::vault::VAULT`
  );

  const handleTransferDepegTokens = async () => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet first!");
      return;
    }

    if (!transferInput.amount || !transferInput.recipient) {
      toast.error("Please enter both amount and recipient address");
      return;
    }

    if (
      !transferInput.recipient.startsWith("0x") ||
      transferInput.recipient.length !== 66
    ) {
      toast.error("Invalid recipient address format");
      return;
    }

    if (!dsTokens.length) {
      toast.error("You do not have any Depeg Swap tokens!");
      return;
    }

    const DS_DECIMALS = 9;
    const dsAmountToTransfer = parseInputAmount(
      transferInput.amount,
      DS_DECIMALS
    );

    if (dsAmountToTransfer <= 0n) {
      toast.error("Please enter a valid amount of DS tokens to transfer");
      return;
    }

    const dsToken = dsTokens[0];
    if (BigInt(dsToken.rawBalance) < dsAmountToTransfer) {
      toast.error(
        `Insufficient DS tokens. Need ${formatBalance(
          dsAmountToTransfer.toString(),
          DS_DECIMALS
        )} but you have ${dsToken.balance}`
      );
      return;
    }

    const tx = new Transaction();

    try {
      const [splitDsToken] = tx.splitCoins(tx.object(dsToken.id), [
        tx.pure.u64(dsAmountToTransfer.toString()),
      ]);

      tx.transferObjects(
        [splitDsToken],
        tx.pure.address(transferInput.recipient)
      );

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            setTransferInput({ amount: "", recipient: "" });
            refreshData();
            toast.success(
              <div>
                <div>Successfully transferred DS tokens!</div>
                <a
                  href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", textDecoration: "underline" }}
                >
                  View transaction
                </a>
              </div>
            );
          },
          onError: (error) => {
            toast.error(
              `Failed to transfer: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          },
        }
      );
    } catch (error) {
      toast.error(
        `Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      
      {/* Shared Navigation Header */}
      <SharedHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-blue-900/20 to-black z-0" />
        <div className="absolute inset-0 bg-[url('/abstract-digital-grid.png')] bg-cover bg-center opacity-10 z-0" />
        <div className="container relative z-10 px-4 py-16 mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-2 mb-6 text-sm font-medium text-cyan-300 bg-cyan-900/30 rounded-full">
                P2P Insurance Trading
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                P2P Insurance Trading
              </h1>
              <p className="text-lg text-gray-300 mb-8">
                Trade depeg insurance tokens peer-to-peer by transferring DS tokens to other addresses
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <Card className="bg-gray-800/50 border-cyan-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <Coins className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Available DS Tokens</p>
                      <p className="text-2xl font-bold text-white">
                        {dsTokens.length > 0 ? dsTokens[0].balance : "0"}
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
                      <p className="text-sm text-gray-400">Protection Coverage</p>
                      <p className="text-2xl font-bold text-white">Active</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-purple-500/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Users className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">P2P Network</p>
                      <p className="text-2xl font-bold text-white">Ready</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* How It Works Section */}
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-cyan-400" />
                  How P2P Insurance Trading Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-cyan-400 font-bold">1</span>
                    </div>
                    <h3 className="font-semibold mb-2">Transfer DS Tokens</h3>
                    <p className="text-sm text-gray-400">Send your Depeg Swap tokens to another address, effectively selling your insurance position</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-400 font-bold">2</span>
                    </div>
                    <h3 className="font-semibold mb-2">Recipient Gets Protection</h3>
                    <p className="text-sm text-gray-400">The recipient can use these tokens to redeem underlying assets if a depeg event occurs</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-purple-400 font-bold">3</span>
                    </div>
                    <h3 className="font-semibold mb-2">Instant Settlement</h3>
                    <p className="text-sm text-gray-400">Transfers are instant and final on the Sui blockchain with low gas fees</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transfer Form */}
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-cyan-400" />
                  P2P Token Transfer
                </CardTitle>
                <CardDescription>
                  Transfer your Depeg Swap tokens to another address for peer-to-peer insurance trading
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-cyan-100 mb-2">
                        <strong>What you are doing:</strong> You are transferring insurance protection to another user.
                      </p>
                      <p className="text-sm text-cyan-100">
                        The recipient can use these DS tokens to redeem underlying assets if a depeg event occurs in any active vault.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ds-amount" className="text-white">DS Token Amount</Label>
                    <Input
                      id="ds-amount"
                      type="text"
                      placeholder="Enter amount (e.g., 10.0)"
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-500"
                      value={transferInput.amount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setTransferInput({
                          ...transferInput,
                          amount: e.target.value,
                        })
                      }
                    />
                    {dsTokens.length > 0 && (
                      <div className="flex items-center justify-between text-xs mt-2">
                        <span className="text-gray-400">
                          Available: {dsTokens[0]?.balance || "0"} DS Tokens
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTransferInput({
                            ...transferInput,
                            amount: dsTokens[0]?.balance || "0"
                          })}
                          className="h-6 px-2 text-xs bg-gray-800 border-gray-600 hover:bg-gray-700"
                        >
                          Max
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipient" className="text-white">Recipient Address</Label>
                    <Input
                      id="recipient"
                      type="text"
                      placeholder="0x..."
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-500"
                      value={transferInput.recipient}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setTransferInput({
                          ...transferInput,
                          recipient: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-gray-400">
                      Enter the complete Sui address (66 characters starting with 0x)
                    </p>
                  </div>

                  {/* Transfer Preview */}
                  {transferInput.amount && transferInput.recipient && (
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-600">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-cyan-400" />
                        Transfer Preview
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount:</span>
                          <span className="text-white">{transferInput.amount} DS Tokens</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">To:</span>
                          <span className="text-white font-mono text-xs">
                            {transferInput.recipient.slice(0, 8)}...{transferInput.recipient.slice(-6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Network:</span>
                          <span className="text-white">Sui Testnet</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 mt-6"
                    onClick={handleTransferDepegTokens}
                    disabled={
                      isTransactionPending ||
                      !transferInput.amount ||
                      !transferInput.recipient ||
                      !currentAccount?.address
                    }
                  >
                    {isTransactionPending ? (
                      <div className="flex items-center">
                        <ClipLoader
                          size={16}
                          color="#ffffff"
                          className="mr-2"
                        />
                        Processing Transfer...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Send className="mr-2 h-4 w-4" />
                        Transfer DS Tokens
                      </div>
                    )}
                  </Button>

                  {!currentAccount?.address && (
                    <div className="text-center py-4">
                      <p className="text-gray-400 mb-4">Connect your wallet to transfer tokens</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Risk Warning */}
            <Card className="bg-red-900/20 border-red-500/30 backdrop-blur-sm mt-8">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
                    <Shield className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-400 mb-2">Important Notice</h3>
                    <ul className="text-sm text-red-100 space-y-1">
                      <li>• Once transferred, you lose the right to redeem these DS tokens</li>
                      <li>• The recipient gains the ability to claim underlying assets if depeg occurs</li>
                      <li>• Transfers are irreversible - double-check the recipient address</li>
                      <li>• This simulates selling insurance protection in a P2P manner</li>
                    </ul>
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

// Helper functions
function formatBalance(balance: string, decimals = 9): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${paddedFractional.substring(0, 4)}`;
}

function parseInputAmount(amount: string, decimals: number): bigint {
  amount = amount.replace(/,/g, "");
  const parts = amount.split(".");
  const integerPart = parts[0];
  const fractionalPart = parts[1] || "";
  const normalizedFractional = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);
  const fullValue = `${integerPart}${normalizedFractional}`;
  return BigInt(fullValue.replace(/^0+/, "") || "0");
} 