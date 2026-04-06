"use client";

import { 
  Zap, 
  RefreshCcw, 
  ShieldCheck, 
  Layers, 
  GitMerge, 
  AlertCircle 
} from "lucide-react";

const features = [
  {
    icon: <Zap size={24} className="text-brand-violet" />,
    title: "Resilient RPC Probing",
    description: "Exhaustively tries 5+ signing formats across Lace and 1AM. Never fails silently."
  },
  {
    icon: <RefreshCcw size={24} className="text-brand-violet" />,
    title: "Session Persistence",
    description: "autoRestore() reconnects users across refreshes without any extra setup."
  },
  {
    icon: <ShieldCheck size={24} className="text-brand-violet" />,
    title: "Safe Intent Builder",
    description: "Zod-validated, nonce-stamped, and sanitized intents. No malformed payloads."
  },
  {
    icon: <Layers size={24} className="text-brand-violet" />,
    title: "React Hooks",
    description: "useWallet, useConnect, useIntent, useBalance — SSR-safe and hydration-friendly."
  },
  {
    icon: <GitMerge size={24} className="text-brand-violet" />,
    title: "Middleware System",
    description: "Global interceptors for logging, analytics, and transaction guards."
  },
  {
    icon: <AlertCircle size={24} className="text-brand-violet" />,
    title: "Full Error Taxonomy",
    description: "12 typed error classes. Every failure mode named, typed, and catchable."
  }
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-32 lg:px-8">
      <div className="flex flex-col items-center">
        <span className="section-label">WHY MIDNIGHT WALLET KIT</span>
        <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Designed for production.</h2>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, idx) => (
          <div 
            key={idx}
            className="group flex flex-col gap-6 rounded-3xl border border-white/5 bg-[#111827] p-10 transition-all hover:bg-[#151c2e] hover:border-violet-500/20"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 transition-transform group-hover:scale-110">
              {feature.icon}
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight">{feature.title}</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
