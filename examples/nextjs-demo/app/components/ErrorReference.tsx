"use client";

import { useState } from "react";
import { Search, AlertTriangle, ChevronRight, ExternalLink } from "lucide-react";

const GITHUB_BASE = "https://github.com/tusharpamnani/midnight-wallet-kit/blob/main/src/errors/wallet-errors.ts";

export const errors = [
  { code: "WALLET_NOT_CONNECTED", class: "WalletNotConnectedError", message: "User attempted an action requiring a connected wallet.", line: 38 },
  { code: "WALLET_ALREADY_CONNECTED", class: "WalletAlreadyConnectedError", message: "Wallet connection requested while already active.", line: 101 },
  { code: "PROVIDER_NOT_FOUND", class: "ProviderNotFoundError", message: "Specified browser provider (Lace, 1AM) was not found.", line: 50 },
  { code: "CONNECTION_REJECTED", class: "ConnectionRejectedError", message: "User explicitly rejected the extension connection prompt.", line: 62 },
  { code: "SIGNING_FAILED", class: "SigningError", message: "A low-level provider error occurred during the signing phase.", line: 94 },
  { code: "INVALID_INTENT", class: "InvalidIntentError", message: "Request payload failed Zod or business logic validation.", line: 83 },
  { code: "FALLBACK_EXHAUSTED", class: "FallbackExhaustedError", message: "All high-level signing formats (Lace, 1AM) returned failures.", line: 123 },
  { code: "SESSION_EXPIRED", class: "SessionExpiredError", message: "Stored session tokens have expired or are no longer valid.", line: 144 },
  { code: "UNSUPPORTED_METHOD", class: "UnsupportedMethodError", message: "The chosen wallet adapter doesn't support the requested RPC method.", line: 155 },
  { code: "BALANCE_FETCH_FAILED", class: "BalanceFetchError", message: "Failed to retrieve coin balance from the indexer node.", line: 166 },
  { code: "MESSAGE_SIGNING_FAILED", class: "MessageSigningError", message: "Signing message signature returned null or undefined.", line: 178 },
  { code: "NETWORK_MISMATCH", class: "NetworkMismatchError", message: "The connected wallet is on a different network (e.g. mainnet vs testnet).", line: 190 }
];

export function ErrorReference() {
  const [filter, setFilter] = useState("");

  const filteredErrors = errors.filter(e => 
    e.code.toLowerCase().includes(filter.toLowerCase()) || 
    e.class.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <section id="errors" className="mx-auto max-w-7xl px-6 py-32 lg:px-8">
      <div className="flex flex-col items-center">
        <span className="section-label">ERROR REFERENCE</span>
        <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl text-center">Every failure named and typed.</h2>
        <p className="mt-4 text-text-secondary text-center max-w-2xl">
          Comprehensive error taxonomy ensures your application can handle every failure gracefully 
          and provide real-time feedback to users.
        </p>
      </div>

      <div className="mt-16 flex flex-col">
        {/* Filter Input */}
        <div className="relative mx-auto w-full max-w-md group mb-12">
          <Search className="absolute left-6 top-3.5 text-white/40 transition-colors group-focus-within:text-brand-violet" size={18} />
          <input 
            type="text" 
            placeholder="Filter by code or class..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-full border border-white/5 bg-[#0d0d1a] px-14 py-3.5 focus:border-violet-500/40 focus:outline-none focus:ring-0 font-medium text-sm transition-all"
          />
        </div>

        {/* Errors Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredErrors.length > 0 ? (
            filteredErrors.map((err, i) => (
              <div 
                key={i}
                className="group flex flex-col p-8 rounded-3xl border border-white/5 bg-[#111827] transition-all hover:bg-[#151c2e] hover:border-violet-500/20"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="rounded-lg bg-orange-500/10 p-2 text-orange-500">
                    <AlertTriangle size={18} />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-white/30 group-hover:text-brand-violet transition-colors">
                    {err.class}
                  </span>
                </div>
                
                <h3 className="text-sm font-black tracking-widest text-brand-violet uppercase mb-4">
                  {err.code}
                </h3>
                
                <p className="text-text-secondary text-sm leading-relaxed mb-6 flex-grow">
                  {err.message}
                </p>
                
                <a
                  href={`${GITHUB_BASE}#L${err.line}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-extrabold text-white/30 uppercase tracking-widest pt-4 border-t border-white/5 transition-colors hover:text-brand-violet"
                >
                  View Source <ExternalLink size={10} />
                </a>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center py-20 opacity-30">
              <span className="text-2xl mb-4">🔍</span>
              <p className="text-sm">No errors match your filter.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
