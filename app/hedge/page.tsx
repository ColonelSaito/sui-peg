"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Info } from "lucide-react";

import React from "react";
import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import { networkConfig } from "../src/networkConfig";

const queryClient = new QueryClient();

export default function HedgePageMain() {
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
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container px-4 py-8 mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-gray-400 hover:text-white mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">SUI Depeg Vault</h1>
          <p className="text-gray-400 mb-8">
            Participate as an underwriter or hedger in the SUI depeg insurance
            market
          </p>

          <Tabs defaultValue="underwriter" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="underwriter">Underwriter</TabsTrigger>
              <TabsTrigger value="hedger">Hedger</TabsTrigger>
            </TabsList>

            <TabsContent value="underwriter">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Become an Underwriter</CardTitle>
                  <CardDescription>
                    Supply tokens to the vault and earn premiums from hedgers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-6">
                    <div className="flex items-start gap-2 mb-4">
                      <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        As an underwriter, you supply both SUI and sSUI tokens
                        to the vault. In return, you'll receive depeg tokens
                        that you can sell to hedgers. After maturity, you can
                        claim all remaining tokens in the vault.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <span className="text-gray-400">Maturity Date:</span>
                        <div className="font-medium">June 30, 2025</div>
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ssui-amount">sSUI Amount</Label>
                        <Input
                          id="ssui-amount"
                          type="number"
                          placeholder="0.0"
                          className="bg-gray-800 border-gray-700"
                        />
                      </div>
                    </div>

                    <div className="pt-4 pb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">You will receive:</span>
                        <span className="font-medium">0 SUI Depeg Tokens</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Potential profit:</span>
                        <span className="font-medium text-green-400">
                          0 USDC
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    Supply Tokens
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="hedger">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Hedge Your Position</CardTitle>
                  <CardDescription>
                    Protect your sSUI holdings from depeg events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-6">
                    <div className="flex items-start gap-2 mb-4">
                      <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        As a hedger, you purchase SUI depeg tokens to protect
                        your sSUI position. If a depeg event occurs before
                        maturity, you can redeem your depeg tokens for the
                        underlying SUI, protecting your position from losses.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <span className="text-gray-400">Maturity Date:</span>
                        <div className="font-medium">June 30, 2025</div>
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
                        <span className="text-gray-400">Insurance Rate:</span>
                        <div className="font-medium">0.01 SUI per token</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="depeg-tokens">
                          SUI Depeg Tokens to Buy
                        </Label>
                        <Input
                          id="depeg-tokens"
                          type="number"
                          placeholder="0"
                          className="bg-gray-800 border-gray-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="usdc-amount">USDC Amount</Label>
                        <Input
                          id="usdc-amount"
                          type="number"
                          placeholder="0.0"
                          className="bg-gray-800 border-gray-700"
                          disabled
                        />
                      </div>
                    </div>

                    <div className="pt-4 pb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">sSUI Required:</span>
                        <span className="font-medium">0 sSUI</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          Protection Amount:
                        </span>
                        <span className="font-medium text-green-400">
                          0 SUI
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                    Buy Insurance
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-12 bg-gray-800/30 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Current Vault Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">Total SUI</div>
                <div className="text-xl font-medium">1,250.00</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">Total sSUI</div>
                <div className="text-xl font-medium">1,250.00</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">
                  Depeg Tokens Issued
                </div>
                <div className="text-xl font-medium">125,000</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">
                  Insurance Premium
                </div>
                <div className="text-xl font-medium">0.01 USDC</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
