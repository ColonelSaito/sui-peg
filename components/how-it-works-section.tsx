import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import TokenFlowIllustration from "@/components/token-flow-illustration";

export default function HowItWorksSection() {
  return (
    <section className="py-20 bg-black">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-[50px]">
            Supported Tokens
          </h2>
          <p className="flex justify-center space-x-[200px]">
            <div className="flex items-center">
              <img
                width={220}
                height={220}
                style={{ borderRadius: 150 }}
                src="/wBtc.svg"
              />
              <img
                width={220}
                height={220}
                style={{ borderRadius: 150 }}
                src="/LBTC.svg"
              />
            </div>
            <div className="flex items-center">
              <img
                width={220}
                height={220}
                style={{ borderRadius: 150 }}
                src="/sui.png"
              />
              <img
                width={220}
                height={220}
                style={{ borderRadius: 150 }}
                src="/sSui.png"
              />
            </div>
          </p>
        </div>

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Our platform connects underwriters and hedgers to create a market
            for depeg insurance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <TokenFlowIllustration type="underwriter" />
          </div>
          <div>
            <div className="inline-block px-3 py-1 mb-4 text-sm font-medium text-purple-300 bg-purple-900/30 rounded-full">
              For Underwriters
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Supply Tokens, Earn Premiums
            </h3>
            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                As an underwriter, you supply both pegged tokens (LBTC) and
                underlying tokens (wBTC) to the vault.
              </p>
              <p className="text-gray-300">
                For example, by supplying 1 wBTC and 1 LBTC, you receive 100
                wBTC depeg tokens that you can sell to hedgers.
              </p>
              <p className="text-gray-300">
                After maturity, you can claim all remaining pegged tokens and
                underlying tokens, earning a profit from the premiums paid by
                hedgers.
              </p>
            </div>
            <Link href="/hedge">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                Become an Underwriter <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div className="order-2 lg:order-1">
            <div className="inline-block px-3 py-1 mb-4 text-sm font-medium text-blue-300 bg-blue-900/30 rounded-full">
              For Hedgers
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Protect Your Assets from Depeg
            </h3>
            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                As a hedger, you can protect your LBTC position from depeg
                events by purchasing wBTC depeg tokens.
              </p>
              <p className="text-gray-300">
                For example, you can buy 1 wBTC depeg token with 0.01 LBTC and 1
                USDC, providing insurance for your position.
              </p>
              <p className="text-gray-300">
                Before maturity, if a depeg event occurs, you can redeem wBTC by
                using your wBTC depeg tokens. For instance, claim 0.01 wBTC with
                1 wBTC depeg token.
              </p>
            </div>
            <Link href="/hedge">
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                Start Hedging <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="order-1 lg:order-2">
            <TokenFlowIllustration type="hedger" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <TokenFlowIllustration type="maturity" />
          </div>
          <div>
            <div className="inline-block px-3 py-1 mb-4 text-sm font-medium text-cyan-300 bg-cyan-900/30 rounded-full">
              Maturity & Redemption
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Clear Timeline and Outcomes
            </h3>
            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                Before maturity, hedgers can redeem underlying tokens in the
                event of a depeg, protecting their position.
              </p>
              <p className="text-gray-300">
                After maturity, underwriters claim all remaining pegged tokens
                and underlying tokens from the vault.
              </p>
              <p className="text-gray-300">
                This creates a balanced system where underwriters earn premiums
                for taking on risk, while hedgers gain protection against market
                volatility.
              </p>
            </div>
            <Link href="/hedge">
              <Button className="bg-gradient-to-r from-cyan-600 to-green-600 hover:from-cyan-700 hover:to-green-700 text-white">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
