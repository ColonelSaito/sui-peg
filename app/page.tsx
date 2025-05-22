import Link from "next/link"
import { ArrowRight, Shield, Coins, Clock, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import HowItWorksSection from "@/components/how-it-works-section"
import FaqSection from "@/components/faq-section"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-black z-0" />
        <div className="absolute inset-0 bg-[url('/abstract-digital-grid.png')] bg-cover bg-center opacity-10 z-0" />

        <div className="container relative z-10 px-4 py-24 md:py-32 mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-block px-3 py-1 mb-6 text-sm font-medium text-purple-300 bg-purple-900/30 rounded-full">
              Protect Your SUI Assets
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">
              Insurance Against SUI Depeg Events
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              The first decentralized platform for hedging against sSUI depeg risk. Underwrite to earn premiums or hedge
              to protect your assets.
            </p>
            <Link href="/hedge">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-6 rounded-lg text-lg font-medium">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent"></div>
      </section>

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Benefits of SUI Depeg Swap</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Our platform provides unique advantages for both underwriters and hedgers in the SUI ecosystem
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 hover:border-purple-500 transition-all duration-300">
              <Shield className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Risk Protection</h3>
              <p className="text-gray-400">
                Hedge against sSUI depeg events and protect your assets from market volatility
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-all duration-300">
              <Coins className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Premium Earnings</h3>
              <p className="text-gray-400">Underwriters earn premiums by providing liquidity to the insurance pool</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 hover:border-cyan-500 transition-all duration-300">
              <Clock className="h-12 w-12 text-cyan-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Time-Bound Security</h3>
              <p className="text-gray-400">Clear maturity periods ensure transparent and predictable outcomes</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 hover:border-green-500 transition-all duration-300">
              <BarChart3 className="h-12 w-12 text-green-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Market Efficiency</h3>
              <p className="text-gray-400">Creates a more efficient market by pricing and distributing depeg risk</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FaqSection />

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-black">
        <div className="container px-4 mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Secure Your SUI Position?</h2>
            <p className="text-lg text-gray-300 mb-8">
              Join our platform today to either earn premiums as an underwriter or protect your assets as a hedger.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/hedge">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-6 rounded-lg text-lg font-medium w-full sm:w-auto">
                  Start Hedging
                </Button>
              </Link>
              <Link href="/hedge">
                <Button
                  variant="outline"
                  className="border-purple-500 text-purple-400 hover:bg-purple-900/20 px-8 py-6 rounded-lg text-lg font-medium w-full sm:w-auto"
                >
                  Become an Underwriter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-gray-800">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                SUI Depeg Swap
              </h3>
            </div>
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} SUI Depeg Swap. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
