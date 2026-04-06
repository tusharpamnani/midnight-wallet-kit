"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const BADGES = ["TypeScript", "SSR Safe", "Zod Validated", "MIT Licensed"] as const;

const INSTALL_CMD = "npm install midnight-wallet-kit";

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

export function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pb-32 pt-36 text-center lg:px-8">

      {/* Glow — single ellipse, low opacity, not blurred into oblivion */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[360px] w-[720px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(98,75,255,0.13) 0%, transparent 70%)",
        }}
      />

      {/* Noise overlay */}
      <div aria-hidden className="bg-noise pointer-events-none absolute inset-0 -z-10" />

      {/* Network badge */}
      <div className="badge-accent mb-8 fade-in">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--color-accent)" }}
        />
        Midnight Network
      </div>

      {/* Headline — plain, no gradient */}
      <h1
        className="fade-in max-w-2xl text-[3.25rem] font-[800] leading-[1.05] sm:text-7xl"
        style={{
          letterSpacing: "var(--letter-spacing-display)",
          color: "var(--color-text-primary)",
        }}
      >
        Wallet kit for{" "}
        <span style={{ color: "var(--color-accent)" }}>Midnight</span>{" "}
        Network.
      </h1>

      {/* Subheadline — one sentence, no line break forcing */}
      <p
        className="fade-in mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
        style={{ color: "var(--color-text-muted)" }}
      >
        Resilient signing, ZK-native state management, and SSR-safe React
        hooks. Stop wrestling with injected providers.
      </p>

      {/* CTAs */}
      <div className="fade-in mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <a href="#quick-start" className="btn-primary">
          Get started
        </a>
        <a
          href="https://github.com/tusharpamnani/midnight-wallet-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline flex items-center gap-2"
        >
          <GithubIcon size={15} />
          View on GitHub
        </a>
      </div>

      {/* Install pill */}
      <div className="fade-in mt-10 install-pill">
        <span style={{ color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>
          $
        </span>
        <code
          className="text-sm"
          style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}
        >
          {INSTALL_CMD}
        </code>
        <button
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy install command"}
          className="ml-2 rounded transition-colors"
          style={{ color: copied ? "var(--color-accent)" : "var(--color-text-subtle)" }}
        >
          {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}
        </button>
      </div>

      {/* Stat badges */}
      <div className="fade-in mt-6 flex flex-wrap justify-center gap-2">
        {BADGES.map((label) => (
          <span
            key={label}
            className="rounded-md px-3 py-1 text-[11px] font-medium tracking-wide"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-subtle)",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}