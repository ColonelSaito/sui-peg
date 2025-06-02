"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ConnectButtonWrapper from "./connect-button-wrapper";

export default function SharedHeader() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/suipeg-no-text.png"
              alt="Suipeg Logo"
              width={56}
              height={56}
              className="w-14 h-14"
            />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link 
              href="/hedge" 
              className={`transition-colors ${
                isActive('/hedge') 
                  ? 'text-white border-b-2 border-purple-500 pb-1' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Hedge
            </Link>
            <Link 
              href="/underwrite" 
              className={`transition-colors ${
                isActive('/underwrite') 
                  ? 'text-white border-b-2 border-blue-500 pb-1' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Underwrite
            </Link>
            <Link 
              href="/p2p" 
              className={`transition-colors ${
                isActive('/p2p') 
                  ? 'text-white border-b-2 border-cyan-500 pb-1' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              P2P Trade
            </Link>
            <Link 
              href="https://x.com/sui_peg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
            <ConnectButtonWrapper />
          </div>
        </div>
      </div>
    </nav>
  );
} 