"use client";

import { useMemo } from "react";
import { WalletProvider } from "midnight-wallet-kit/react";
import { createMidnightWalletManager } from "midnight-wallet-kit";

/**
 * Providers
 *
 * Uses createMidnightWalletManager() to pre-register ALL 8 supported wallets:
 * 1AM (dust-free), Nocturne, NuFi, GeroWallet, VESPR, Yoroi, Ctrl, SubWallet
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const manager = useMemo(() => {
    // Creates a manager with ALL 8 wallets pre-registered
    return createMidnightWalletManager({
      network: 'preprod', // default network for Midnight-native wallets
      // only: ['1AM', 'Nocturne', 'NuFi'], // optionally filter
      // skip: ['SubWallet'], // optionally skip wallets
    });
  }, []);

  // Priority order for auto-connect
  const autoConnect = useMemo(
    () => [
      '1AM',        // Dust-free, best UX
      'Nocturne',   // Midnight-native
      'NuFi',       // Popular multi-chain
      'GeroWallet',
      'VESPR',
      'Yoroi',
      'Ctrl',
      'SubWallet',
    ],
    [],
  );

  return (
    <WalletProvider
      manager={manager}
      autoConnect={autoConnect}
      autoRestore={true}
    >
      {children as any}
    </WalletProvider>
  );
}
