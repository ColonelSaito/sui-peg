"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Wallet,
  CoinsIcon,
  DollarSign,
  Landmark,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface TokenFlowIllustrationProps {
  type: "underwriter" | "hedger" | "maturity";
}

export default function TokenFlowIllustration({
  type,
}: TokenFlowIllustrationProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prevStep) => (prevStep + 1) % 3);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (type === "underwriter") {
    return (
      <div className="relative h-[300px] md:h-[400px] w-full bg-gray-900/30 rounded-xl border border-gray-800">
        {/* Underwriter */}
        <div className="absolute top-6 left-6 flex flex-col items-center">
          <div className="bg-purple-900/50 p-4 rounded-full mb-2 border border-purple-500/30">
            <Wallet className="h-8 w-8 text-purple-300" />
          </div>
          <span className="text-sm font-medium text-purple-300">
            Underwriter
          </span>
        </div>

        {/* Vault */}
        <div className="absolute top-6 right-6 flex flex-col items-center">
          <div className="bg-blue-900/50 p-4 rounded-full mb-2 border border-blue-500/30">
            <Landmark className="h-8 w-8 text-blue-300" />
          </div>
          <span className="text-sm font-medium text-blue-300">Vault</span>
        </div>

        {/* Flow Steps */}
        <div className="absolute inset-x-0 bottom-6 px-6">
          <div className="bg-gray-800/70 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              {/* Step 1: Supply wBTC */}
              <div
                className={`flex flex-col items-center ${step === 0 ? "opacity-100" : "opacity-40"}`}
              >
                <div className="bg-cyan-900/50 p-2 rounded-full mb-1 border border-cyan-500/30">
                  <CoinsIcon className="h-6 w-6 text-cyan-300" />
                </div>
                <span className="text-xs font-medium text-cyan-300">wBTC</span>
              </div>

              <ArrowRight
                className={`h-5 w-5 text-gray-400 ${step === 0 ? "text-cyan-400" : ""}`}
              />

              {/* Step 2: Supply LBTC */}
              <div
                className={`flex flex-col items-center ${step === 1 ? "opacity-100" : "opacity-40"}`}
              >
                <div className="bg-green-900/50 p-2 rounded-full mb-1 border border-green-500/30">
                  <CoinsIcon className="h-6 w-6 text-green-300" />
                </div>
                <span className="text-xs font-medium text-green-300">LBTC</span>
              </div>

              <ArrowRight
                className={`h-5 w-5 text-gray-400 ${step === 1 ? "text-green-400" : ""}`}
              />

              {/* Step 3: Receive Depeg Tokens */}
              <div
                className={`flex flex-col items-center ${step === 2 ? "opacity-100" : "opacity-40"}`}
              >
                <div className="bg-purple-900/50 p-2 rounded-full mb-1 border border-purple-500/30">
                  <Shield className="h-6 w-6 text-purple-300" />
                </div>
                <span className="text-xs font-medium text-purple-300">
                  Depeg Tokens
                </span>
              </div>
            </div>

            <div className="text-center text-sm text-gray-300">
              {step === 0 && "Step 1: Underwriter supplies wBTC to the vault"}
              {step === 1 && "Step 2: Underwriter supplies LBTC to the vault"}
              {step === 2 && "Step 3: Underwriter receives depeg tokens"}
            </div>
          </div>
        </div>

        {/* Main Illustration */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-[200px] h-[100px]">
            {/* wBTC Token Animation */}
            <div
              className={`absolute left-0 top-0 transition-all duration-1000 ease-in-out ${
                step >= 0
                  ? step > 0
                    ? "opacity-0 translate-x-[100px]"
                    : "opacity-100"
                  : ""
              }`}
            >
              <div className="bg-cyan-900/50 p-3 rounded-full border border-cyan-500/30">
                <CoinsIcon className="h-8 w-8 text-cyan-300" />
              </div>
            </div>

            {/* LBTC Token Animation */}
            <div
              className={`absolute left-0 bottom-0 transition-all duration-1000 ease-in-out ${
                step >= 1
                  ? step > 1
                    ? "opacity-0 translate-x-[100px]"
                    : "opacity-100"
                  : "opacity-0"
              }`}
            >
              <div className="bg-green-900/50 p-3 rounded-full border border-green-500/30">
                <CoinsIcon className="h-8 w-8 text-green-300" />
              </div>
            </div>

            {/* Depeg Token Animation */}
            <div
              className={`absolute right-0 top-[25px] transition-all duration-1000 ease-in-out ${
                step >= 2 ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="bg-purple-900/50 p-3 rounded-full border border-purple-500/30">
                <Shield className="h-8 w-8 text-purple-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "hedger") {
    return (
      <div className="relative h-[300px] md:h-[400px] w-full bg-gray-900/30 rounded-xl border border-gray-800">
        {/* Hedger */}
        <div className="absolute top-6 right-6 flex flex-col items-center">
          <div className="bg-blue-900/50 p-4 rounded-full mb-2 border border-blue-500/30">
            <Shield className="h-8 w-8 text-blue-300" />
          </div>
          <span className="text-sm font-medium text-blue-300">Hedger</span>
        </div>

        {/* Vault */}
        <div className="absolute top-6 left-6 flex flex-col items-center">
          <div className="bg-blue-900/50 p-4 rounded-full mb-2 border border-blue-500/30">
            <Landmark className="h-8 w-8 text-blue-300" />
          </div>
          <span className="text-sm font-medium text-blue-300">Vault</span>
        </div>

        {/* Flow Steps */}
        <div className="absolute inset-x-0 bottom-6 px-6">
          <div className="bg-gray-800/70 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              {/* Step 1: Pay USDC */}
              <div
                className={`flex flex-col items-center ${step === 0 ? "opacity-100" : "opacity-40"}`}
              >
                <div className="bg-blue-900/50 p-2 rounded-full mb-1 border border-blue-500/30">
                  <DollarSign className="h-6 w-6 text-blue-300" />
                </div>
                <span className="text-xs font-medium text-blue-300">USDC</span>
              </div>

              <ArrowRight
                className={`h-5 w-5 text-gray-400 ${step === 0 ? "text-blue-400" : ""}`}
              />

              {/* Step 2: Pay LBTC */}
              <div
                className={`flex flex-col items-center ${step === 1 ? "opacity-100" : "opacity-40"}`}
              >
                <div className="bg-green-900/50 p-2 rounded-full mb-1 border border-green-500/30">
                  <CoinsIcon className="h-6 w-6 text-green-300" />
                </div>
                <span className="text-xs font-medium text-green-300">LBTC</span>
              </div>

              <ArrowRight
                className={`h-5 w-5 text-gray-400 ${step === 1 ? "text-green-400" : ""}`}
              />

              {/* Step 3: Receive Depeg Tokens */}
              <div
                className={`flex flex-col items-center ${step === 2 ? "opacity-100" : "opacity-40"}`}
              >
                <div className="bg-purple-900/50 p-2 rounded-full mb-1 border border-purple-500/30">
                  <Shield className="h-6 w-6 text-purple-300" />
                </div>
                <span className="text-xs font-medium text-purple-300">
                  Depeg Tokens
                </span>
              </div>
            </div>

            <div className="text-center text-sm text-gray-300">
              {step === 0 && "Step 1: Hedger pays USDC to the vault"}
              {step === 1 && "Step 2: Hedger pays LBTC to the vault"}
              {step === 2 &&
                "Step 3: Hedger receives depeg tokens for protection"}
            </div>
          </div>
        </div>

        {/* Main Illustration */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-[200px] h-[100px]">
            {/* USDC Token Animation */}
            <div
              className={`absolute right-0 top-0 transition-all duration-1000 ease-in-out ${
                step >= 0
                  ? step > 0
                    ? "opacity-0 translate-x-[-100px]"
                    : "opacity-100"
                  : ""
              }`}
            >
              <div className="bg-blue-900/50 p-3 rounded-full border border-blue-500/30">
                <DollarSign className="h-8 w-8 text-blue-300" />
              </div>
            </div>

            {/* LBTC Token Animation */}
            <div
              className={`absolute right-0 bottom-0 transition-all duration-1000 ease-in-out ${
                step >= 1
                  ? step > 1
                    ? "opacity-0 translate-x-[-100px]"
                    : "opacity-100"
                  : "opacity-0"
              }`}
            >
              <div className="bg-green-900/50 p-3 rounded-full border border-green-500/30">
                <CoinsIcon className="h-8 w-8 text-green-300" />
              </div>
            </div>

            {/* Depeg Token Animation */}
            <div
              className={`absolute left-0 top-[25px] transition-all duration-1000 ease-in-out ${
                step >= 2 ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="bg-purple-900/50 p-3 rounded-full border border-purple-500/30">
                <Shield className="h-8 w-8 text-purple-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Maturity flow
  return (
    <div className="relative h-[300px] md:h-[400px] w-full bg-gray-900/30 rounded-xl border border-gray-800">
      {/* Timeline */}
      <div className="absolute top-16 left-6 right-6 h-4 bg-gray-800 rounded-full">
        <div className="absolute left-1/3 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-900 border-2 border-cyan-500 z-10"></div>
        <div className="absolute left-2/3 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-900 border-2 border-purple-500 z-10"></div>

        {/* Timeline labels */}
        <div className="absolute left-1/3 top-8 transform -translate-x-1/2 text-center">
          <span className="text-xs font-medium text-cyan-300">Depeg Event</span>
        </div>
        <div className="absolute left-2/3 top-8 transform -translate-x-1/2 text-center">
          <span className="text-xs font-medium text-purple-300">Maturity</span>
        </div>
      </div>

      {/* Flow Steps */}
      <div className="absolute inset-x-0 bottom-6 px-6">
        <div className="bg-gray-800/70 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            {/* Before Maturity */}
            <div
              className={`flex flex-col items-center ${step === 0 ? "opacity-100" : "opacity-40"}`}
            >
              <div className="bg-cyan-900/50 p-2 rounded-full mb-1 border border-cyan-500/30">
                <AlertTriangle className="h-6 w-6 text-cyan-300" />
              </div>
              <span className="text-xs font-medium text-cyan-300">
                Depeg Event
              </span>
            </div>

            <ArrowRight
              className={`h-5 w-5 text-gray-400 ${step === 0 ? "text-cyan-400" : ""}`}
            />

            {/* Hedger Claims */}
            <div
              className={`flex flex-col items-center ${step === 1 ? "opacity-100" : "opacity-40"}`}
            >
              <div className="bg-blue-900/50 p-2 rounded-full mb-1 border border-blue-500/30">
                <Shield className="h-6 w-6 text-blue-300" />
              </div>
              <span className="text-xs font-medium text-blue-300">Hedger</span>
            </div>

            <ArrowRight
              className={`h-5 w-5 text-gray-400 ${step === 1 ? "text-blue-400" : ""}`}
            />

            {/* After Maturity */}
            <div
              className={`flex flex-col items-center ${step === 2 ? "opacity-100" : "opacity-40"}`}
            >
              <div className="bg-purple-900/50 p-2 rounded-full mb-1 border border-purple-500/30">
                <Wallet className="h-6 w-6 text-purple-300" />
              </div>
              <span className="text-xs font-medium text-purple-300">
                Underwriter
              </span>
            </div>
          </div>

          <div className="text-center text-sm text-gray-300">
            {step === 0 && "Before Maturity: If a depeg event occurs"}
            {step === 1 && "Hedgers can claim wBTC using their depeg tokens"}
            {step === 2 &&
              "After Maturity: Underwriters claim all remaining tokens"}
          </div>
        </div>
      </div>

      {/* Main Illustration */}
      <div className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-[300px] h-[100px] flex items-center justify-center">
          {/* Depeg Event Illustration */}
          <div
            className={`absolute left-[50px] transition-all duration-1000 ease-in-out ${
              step === 0 ? "opacity-100 scale-110" : "opacity-40 scale-100"
            }`}
          >
            <div className="bg-cyan-900/50 p-3 rounded-full border border-cyan-500/30">
              <AlertTriangle className="h-10 w-10 text-cyan-300" />
            </div>
          </div>

          {/* Hedger Claims Illustration */}
          <div
            className={`absolute transition-all duration-1000 ease-in-out ${
              step === 1 ? "opacity-100 scale-110" : "opacity-40 scale-100"
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="bg-blue-900/50 p-3 rounded-full border border-blue-500/30 mb-2">
                <Shield className="h-10 w-10 text-blue-300" />
              </div>
              <div className="bg-cyan-900/50 p-2 rounded-full border border-cyan-500/30">
                <CoinsIcon className="h-6 w-6 text-cyan-300" />
              </div>
            </div>
          </div>

          {/* Underwriter Claims Illustration */}
          <div
            className={`absolute right-[50px] transition-all duration-1000 ease-in-out ${
              step === 2 ? "opacity-100 scale-110" : "opacity-40 scale-100"
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="bg-purple-900/50 p-3 rounded-full border border-purple-500/30 mb-2">
                <Wallet className="h-10 w-10 text-purple-300" />
              </div>
              <div className="flex">
                <div className="bg-cyan-900/50 p-2 rounded-full border border-cyan-500/30 mr-2">
                  <CoinsIcon className="h-6 w-6 text-cyan-300" />
                </div>
                <div className="bg-green-900/50 p-2 rounded-full border border-green-500/30">
                  <CoinsIcon className="h-6 w-6 text-green-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
