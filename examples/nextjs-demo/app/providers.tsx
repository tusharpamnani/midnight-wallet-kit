"use client";

import { useMemo } from "react";
import {
  WalletManager,
  MockWalletAdapter,
  SeedWalletAdapter,
} from "midnight-wallet-kit";
import { WalletProvider } from "midnight-wallet-kit/react";

/**
 * Sets up the WalletManager with demo adapters and wraps children
 * in the WalletProvider context.
 *
 * In a real app you'd register InjectedWalletAdapter for browser wallets.
 * Here we use Mock + Seed so the demo works everywhere.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const manager = useMemo(() => {
    const mgr = new WalletManager();
    mgr
      .register(
        new MockWalletAdapter({
          address: "0xb3a4…7f2e91d8c05aef",
          connectDelayMs: 800,
          signDelayMs: 400,
        })
      )
      .register(
        new SeedWalletAdapter("correct horse battery staple banana planet")
      );
    return mgr;
  }, []);

  return (
    <WalletProvider manager={manager} autoConnect={["mock", "seed"]}>
      {children}
    </WalletProvider>
  );
}
