"use client";

import { useMemo } from "react";
import {
  WalletManager,
  InjectedWalletAdapter,
} from "midnight-wallet-kit";
import { WalletProvider } from "midnight-wallet-kit/react";

/**
 * Providers
 *
 * Exclusively registers Lace and 1AM wallet adapters.
 * InjectedWalletAdapter handles the Midnight-specific .enable() and balancing flow.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const manager = useMemo(() => {
    const mgr = new WalletManager();
    
    mgr
      .register(
        new InjectedWalletAdapter({
          name: "1AM Wallet",
          providerKey: "1am", // Confirmed from terminal logs
        })
      )
      .register(
        new InjectedWalletAdapter({
          name: "Lace Wallet",
          providerKey: "lace", // Reverting to 'lace', discovery will handle GUID matching if needed
        })
      );

    return mgr;
  }, []);

  const autoConnect = useMemo(() => ["lace wallet", "1am wallet"], []);

  return (
    <WalletProvider manager={manager} autoConnect={autoConnect}>
      {children}
    </WalletProvider>
  );
}
