"use client";

import { ExternalLink, Package, Layout } from "lucide-react";

function GithubIcon({ size = 14, className = "" }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-4.51-2-7-2" />
    </svg>
  );
}

export function Footer() {
  const installCmd = "npm install midnight-wallet-kit";

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
  };

  return (
    <footer className="w-full border-t border-white/5 bg-background text-text-primary px-6 lg:px-8 pt-16 pb-2">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-12 lg:flex-row lg:items-start">
          <div className="flex max-w-sm flex-col gap-8 text-center lg:text-left">
            <h2 className="text-4xl font-extrabold tracking-tight">Ready to build on Midnight?</h2>
            <p className="text-lg text-text-secondary">
              Install midnight-wallet-kit and ship your first ZK DApp today.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
               <button 
                onClick={handleCopy}
                className="group w-full max-w-sm flex items-center justify-between gap-3 overflow-hidden rounded-full border border-white/5 bg-[#0d0d1a] px-6 py-2.5 transition-all hover:border-violet-500/30"
              >
                <code className="text-xs font-mono font-bold tracking-tight text-white/90">{installCmd}</code>
                <Package size={14} className="text-brand-violet" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 lg:justify-start">
              <a 
                href="https://github.com/tusharpamnani/midnight-wallet-kit" 
                target="_blank"
                className="btn-outline px-6 py-2.5 text-xs flex items-center gap-2"
              >
                <GithubIcon size={14} /> GITHUB
              </a>
              <a 
                href="/docs" 
                className="btn-outline px-6 py-2.5 text-xs flex items-center gap-2"
              >
                <Layout size={14} /> DOCS
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20">Resources</h3>
                <a href="/docs" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">Documentation</a>
                <a href="https://github.com/tusharpamnani/midnight-wallet-kit" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">Github</a>
                <a href="https://www.npmjs.com/package/midnight-wallet-kit" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">npm Registry</a>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20">Community</h3>
                <a href="https://discord.gg/jE8A7EUWvh" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">Discord</a>
                <a href="https://x.com/Tushar_Pamnani_" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">Twitter</a>
                <a href="https://forum.midnight.network" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">Forum</a>
              </div>
              <div className="hidden flex-col gap-4 sm:flex">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20">Legal</h3>
                <a href="https://github.com/tusharpamnani/midnight-wallet-kit/blob/main/LICENSE" className="text-sm font-bold text-text-secondary transition-all hover:text-brand-violet">License (MIT)</a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center justify-between border-t border-white/5 pt-12 text-center text-[10px] font-black uppercase tracking-widest text-white/20 sm:flex-row sm:text-left">
          <span>MIT © 2026 Tushar Pamnani</span>
          <div className="mt-4 flex gap-8 sm:mt-0">
             <a href="/docs" className="transition-all hover:text-brand-violet flex items-center gap-1.5">DOCS <ExternalLink size={10} /></a>
             <a href="https://github.com/tusharpamnani/midnight-wallet-kit" className="transition-all hover:text-brand-violet flex items-center gap-1.5">GITHUB <ExternalLink size={10} /></a>
             <a href="https://www.npmjs.com/package/midnight-wallet-kit" className="transition-all hover:text-brand-violet flex items-center gap-1.5">NPM <ExternalLink size={10} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
