"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
import { ArrowLeft, Info, Send } from "lucide-react";
import { useState, type ChangeEvent, useCallback } from "react";
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
import VaultList from "../components/vault-list";
import CreateVault from "../components/create-vault";
import { ClipLoader } from "react-spinners";
import ConnectButtonWrapper from "../components/connect-button-wrapper";

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

function HedgePage() {
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
    // Invalidate and refetch all relevant queries
    if (currentAccount?.address) {
      // Refetch user coins
      queryClient.invalidateQueries({
        queryKey: ["getAllCoins", currentAccount.address],
      });
    }
  }, [queryClient, currentAccount?.address]);

  // Update the handleVaultCreated function to refresh data
  const handleVaultCreated = (vaultId: string) => {
    console.log("Vault created with ID:", vaultId);
    // Refresh data
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
  const formattedCoins =
    userCoins?.data?.map((coin) => ({
      id: coin.coinObjectId,
      type: coin.coinType,
      balance: formatBalance(coin.balance, 9),
      rawBalance: coin.balance,
    })) || [];
  console.log("userCoins ", userCoins);
  console.log("formattedCoins ", formattedCoins);

  // Find wBTC and LBTC coins
  const suiCoins = formattedCoins.filter((coin) =>
    coin.type.includes("::underlying_coin::")
  );
  console.log("suiCoins", suiCoins);
  const sSuiCoins = formattedCoins.filter((coin) =>
    coin.type.includes("::pegged_coin::")
  );
  console.log("sSuiCoins ", sSuiCoins);
  const dsTokens = formattedCoins.filter(
    (coin) => coin.type === `${depegSwapPackageId}::vault::VAULT`
  );

  // Handle transferring depeg tokens to another address (P2P insurance)
  const handleTransferDepegTokens = async () => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet first!");
      return;
    }

    if (!transferInput.amount || !transferInput.recipient) {
      toast.error("Please enter both amount and recipient address");
      return;
    }

    // Validate recipient address
    if (
      !transferInput.recipient.startsWith("0x") ||
      transferInput.recipient.length !== 66
    ) {
      toast.error("Invalid recipient address format");
      return;
    }

    // Check if user has DS tokens
    if (!dsTokens.length) {
      toast.error("You don't have any Depeg Swap tokens!");
      return;
    }

    // Parse the DS amount to transfer
    const DS_DECIMALS = 9;
    const dsAmountToTransfer = parseInputAmount(
      transferInput.amount,
      DS_DECIMALS
    );

    if (dsAmountToTransfer <= 0n) {
      toast.error("Please enter a valid amount of DS tokens to transfer");
      return;
    }

    // Get DS token and check balance
    const dsToken = dsTokens[0]; // Using first DS token for simplicity
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
      // Split DS token to the exact amount needed (with decimals)
      const [splitDsToken] = tx.splitCoins(tx.object(dsToken.id), [
        tx.pure.u64(dsAmountToTransfer.toString()),
      ]);

      // Transfer the split tokens to the recipient
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
            console.log("Successfully transferred DS tokens:", result);
            // Clear the input after successful transfer
            setTransferInput({ amount: "", recipient: "" });

            // Refresh data
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
            console.error("Failed to transfer DS tokens:", error);
            toast.error(
              `Failed to transfer: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          },
        }
      );
    } catch (error) {
      console.error("Error executing transaction:", error);
      toast.error(
        `Error executing transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" />
      <div className="container px-4 py-8 mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-gray-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>

          <ConnectButtonWrapper />
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">wBTC Depeg Vault</h1>
          <p className="text-gray-400 mb-8">
            Participate as an underwriter or hedger in the wBTC depeg insurance
            market
          </p>

          <Tabs defaultValue="underwrite" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="underwrite">Underwrite</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
              <TabsTrigger value="vaults">Available Vaults</TabsTrigger>
            </TabsList>

            <TabsContent value="underwrite">
              <CreateVault onCreated={handleVaultCreated} />
            </TabsContent>

            <TabsContent value="transfer">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Transfer DS Tokens (P2P Insurance)</CardTitle>
                  <CardDescription>
                    Transfer your Depeg Swap tokens to another address
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        Transfer your Depeg Swap (DS) tokens to another address.
                        This simulates selling insurance in a peer-to-peer
                        manner. The recipient can use these tokens to redeem
                        underlying assets if a depeg event occurs.
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
                          setTransferInput({
                            ...transferInput,
                            amount: e.target.value,
                          })
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
                          setTransferInput({
                            ...transferInput,
                            recipient: e.target.value,
                          })
                        }
                      />
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 mt-4"
                      onClick={handleTransferDepegTokens}
                      disabled={
                        isTransactionPending ||
                        !transferInput.amount ||
                        !transferInput.recipient
                      }
                    >
                      {isTransactionPending ? (
                        <div className="flex items-center">
                          <ClipLoader
                            size={16}
                            color="#ffffff"
                            className="mr-2"
                          />
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
                <div className="text-sm text-gray-400 mb-1">wBTC Balance</div>
                <div className="text-xl font-medium">
                  {suiCoins.length > 0
                    ? suiCoins
                        .reduce(
                          (balance, a): any => balance + parseFloat(a.balance),
                          0
                        )
                        .toPrecision(3)
                    : "0"}
                </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">LBTC Balance</div>
                <div className="text-xl font-medium">
                  {sSuiCoins.length > 0
                    ? sSuiCoins
                        .reduce(
                          (balance, a): any => balance + parseFloat(a.balance),
                          0
                        )
                        .toPrecision(3)
                    : "0"}
                </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">
                  DS Token Balance
                </div>
                <div className="text-xl font-medium">
                  {dsTokens.length > 0 ? dsTokens[0].balance : "0"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
