# Midnight Wallet Integration: Complete implementation Context

This document contains the full, production-ready code used in this project to handle Midnight wallet connections, state management, and transaction lifecycle.

## 1. Type Definitions (`ui/types/midnight-wallet.ts`)

These types define the interface between the browser extension and the React application.

```typescript
export interface ServiceUriConfig {
  proofServerUri: string;
  indexerUri: string;
  nodeUri: string;
}

export interface WalletState {
  address: string;
  coinPublicKey: string;
  encryptionPublicKey: string;
}

export interface WalletAPI {
  state: () => Promise<WalletState>;
  serviceUriConfig: () => Promise<ServiceUriConfig>;
  // Fallback methods for older API versions
  getUnshieldedAddress: () => Promise<string>;
  getConfiguration: () => Promise<any>;
  // Transaction methods
  balanceUnsealedTransaction: (tx: any) => Promise<any>;
  submitTransaction: (tx: any) => Promise<any>;
  makeIntent?: (intent: any) => Promise<any>;
  disconnect?: () => Promise<void>;
}

export interface MidnightLace {
  enable: (network?: string) => Promise<WalletAPI>;
  connect?: (network?: string) => Promise<WalletAPI>;
}

declare global {
  interface Window {
    midnight?: {
      [key: string]: MidnightLace;
    };
    cardano?: {
      lace?: MidnightLace;
    };
  }
}
```

## 2. The Wallet Provider (`ui/providers/MidnightWalletProvider.tsx`)

This context provider manages the persistent connection state and detection logic.

```typescript
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { WalletAPI, ServiceUriConfig } from '../types/midnight-wallet';

interface UseMidnightWalletState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  address: string | null;
  coinPublicKey: string | null;
  encryptionPublicKey: string | null;
  serviceUris: ServiceUriConfig | null;
}

const INITIAL_STATE: UseMidnightWalletState = {
  isConnected: false,
  isLoading: false,
  error: null,
  address: null,
  coinPublicKey: null,
  encryptionPublicKey: null,
  serviceUris: null,
};

interface MidnightWalletContextType extends UseMidnightWalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  api: WalletAPI | null;
}

const MidnightWalletContext = createContext<MidnightWalletContextType | undefined>(undefined);

export function MidnightWalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UseMidnightWalletState>(INITIAL_STATE);
  const apiRef = useRef<WalletAPI | null>(null);
  const isConnectingRef = useRef(false);

  // 1. Detect wallets in the window object
  const detectWallets = useCallback(() => {
    if (typeof window === 'undefined') return [];
    const wallets: { id: string; wallet: any }[] = [];

    // Check window.midnight namespace
    if (window.midnight) {
      Object.entries(window.midnight).forEach(([id, wallet]) => {
        if (wallet && (wallet.enable || wallet.connect)) {
          wallets.push({ id, wallet });
        }
      });
    }

    // Fallback for Lace in standard cardano namespace
    if (window.cardano?.lace && !wallets.find(w => w.id === 'lace')) {
      wallets.push({ id: 'lace', wallet: window.cardano.lace });
    }

    return wallets;
  }, []);

  // 2. Wait for injection (polling)
  const waitForWallets = useCallback(async (timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const wallets = detectWallets();
      if (wallets.length > 0) return wallets;
      await new Promise((r) => setTimeout(r, 200));
    }
    return [];
  }, [detectWallets]);

  // 3. Secure connection method
  const safeEnable = async (wallet: any) => {
    const connector = wallet.enable || wallet.connect;
    try {
      // Try enabling specifically for preprod
      return await connector.call(wallet, 'preprod');
    } catch {
      // General fallback
      return await connector.call(wallet);
    }
  };

  const connectWallet = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const wallets = await waitForWallets();
      if (wallets.length === 0) throw new Error('No Midnight wallet detected.');

      let connectedApi: WalletAPI | null = null;
      for (const { id, wallet } of wallets) {
        try {
          const api = await safeEnable(wallet);
          if (api) {
            connectedApi = api;
            break;
          }
        } catch (err) {
          console.warn(`Wallet ${id} failed`, err);
        }
      }

      if (!connectedApi) throw new Error('No compatible Midnight wallet found.');
      apiRef.current = connectedApi;

      // Determine if it's the standard API or alternative
      if (typeof connectedApi.state === 'function') {
        const [walletState, uris] = await Promise.all([
          connectedApi.state(),
          connectedApi.serviceUriConfig(),
        ]);
        setState({
          isConnected: true,
          isLoading: false,
          error: null,
          address: walletState.address,
          coinPublicKey: walletState.coinPublicKey,
          encryptionPublicKey: walletState.encryptionPublicKey,
          serviceUris: uris,
        });
      } else {
        // Alternative/Legacy API check
        const address = await connectedApi.getUnshieldedAddress();
        const config = await connectedApi.getConfiguration();
        setState({
          isConnected: true,
          isLoading: false,
          error: null,
          address: typeof address === 'string' ? address : (address as any).address,
          coinPublicKey: null,
          encryptionPublicKey: null,
          serviceUris: {
            proofServerUri: config.proverServerUri,
            indexerUri: config.indexerUri,
            nodeUri: config.substrateNodeUri
          },
        });
      }
    } catch (err: any) {
      setState((prev) => ({ ...prev, isLoading: false, error: err.message }));
    } finally {
      isConnectingRef.current = false;
    }
  }, [waitForWallets]);

  const disconnectWallet = useCallback(async () => {
    if (apiRef.current?.disconnect) await apiRef.current.disconnect();
    apiRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return (
    <MidnightWalletContext.Provider value={{ ...state, connectWallet, disconnectWallet, api: state.isConnected ? apiRef.current : null }}>
      {children}
    </MidnightWalletContext.Provider>
  );
}

export const useMidnightWallet = () => {
  const context = useContext(MidnightWalletContext);
  if (!context) throw new Error('useMidnightWallet must be used within MidnightWalletProvider');
  return context;
};
```

## 3. The Transaction Workflow (`ui/hooks/useLaunchpad.ts`)

This illustrates how to use the wallet API to balance and submit transaction built by a proof server.

```typescript
const { api, isConnected } = useMidnightWallet();

/**
 * Takes a serialized UnsealedTransaction (from Midnight.js SDK),
 * sends it to the wallet for coin-balancing, and submits it.
 */
const balanceAndSubmit = async (serializedUnsealedTx: string): Promise<string> => {
  if (!api || !isConnected) throw new Error('Wallet not connected');

  // 1. Prepare payload (SDK handles serialization differently across versions)
  let txPayload: any;
  try {
    txPayload = JSON.parse(serializedUnsealedTx);
  } catch {
    txPayload = serializedUnsealedTx; // fallback to hex string
  }

  // 2. Wallet balances (adds fees/UTXOs)
  const balancedTx = await api.balanceUnsealedTransaction(txPayload);

  // 3. Submit to network
  const result = await api.submitTransaction(balancedTx);

  // 4. Extract TxID/Hash
  return result.txId || result.hash || String(result);
};
```

## 4. Summary of Connection Lifecycle

1.  **Detection**: Polling `window.midnight` for 10 seconds.
2.  **Authorization**: Calling `enable('preprod')` to get user permission.
3.  **Synchronization**: Fetching `state()` and `serviceUriConfig()` to align frontend and wallet.
4.  **Action**: Using `balanceUnsealedTransaction` to sign/balance ZK-proved transactions.
5.  **Submission**: Broadcasting via `submitTransaction`.

**Note on Proof Server**: For local development, ensure your proof server is running on `http://localhost:6300` and is accessible by the browser (CORS enabled).
