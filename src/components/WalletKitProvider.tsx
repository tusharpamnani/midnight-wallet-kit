'use client';
import React, { useEffect } from 'react';
import { WalletProvider } from '../hooks/index.js';
import type { WalletManager } from '../core/manager.js';

interface WalletKitProviderProps {
  children: React.ReactNode;
  manager: WalletManager;
  /** Adapters to attempt connection to on mount if nothing is restored */
  autoConnect?: string[];
}

/**
 * A specialized wrapper for the WalletProvider that handles 
 * automatic session restoration and connection fallbacks safely 
 * after the component has mounted on the client.
 * 
 * This follows the canonical Next.js hydration safety pattern:
 * - Never attempts window/localStorage access on the server.
 * - Triggers autoRestore() exactly once after hydration.
 */
export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({
  children,
  manager,
  autoConnect,
}) => {
  return (
    <WalletProvider 
      manager={manager} 
      autoConnect={autoConnect} 
      autoRestore={true}
    >
      {children}
    </WalletProvider>
  );
};
