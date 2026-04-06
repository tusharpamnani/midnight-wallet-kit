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

type ConnectedWallet =
  | { id: string; api: any; type: 'standard' }
  | { id: string; api: any; type: 'alternative' };

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

  // 🔍 Detect wallets
  const detectWallets = useCallback(() => {
    if (typeof window === 'undefined') return [];
    const midnight = (window as any).midnight;
    const wallets: { id: string; wallet: any }[] = [];

    if (midnight && typeof midnight === 'object') {
      Object.entries(midnight).forEach(([id, wallet]) => {
        if (
          wallet &&
          typeof wallet === 'object' &&
          (typeof (wallet as any).enable === 'function' ||
            typeof (wallet as any).connect === 'function')
        ) {
          wallets.push({ id, wallet });
        }
      });
    }

    // Fallback for Lace in standard cardano namespace
    const cardano = (window as any).cardano;
    if (cardano?.lace && !wallets.find(w => w.id === 'lace')) {
      wallets.push({ id: 'lace', wallet: cardano.lace });
    }

    return wallets;
  }, []);

  const waitForWallets = useCallback(async (timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const wallets = detectWallets();
      if (wallets.length > 0) return wallets;
      await new Promise((r) => setTimeout(r, 200));
    }
    return [];
  }, [detectWallets]);

  const safeEnable = async (wallet: any, timeout = 30000) => {
    const connector = wallet.enable || wallet.connect;
    if (!connector) throw new Error('No connection method');
    try {
      return await Promise.race([
        connector.call(wallet, 'preprod'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Wallet timeout')), timeout)
        ),
      ]);
    } catch {
      return await connector.call(wallet);
    }
  };

  const normalizeAddress = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      return addr.unshieldedAddress || addr.address || addr.bech32 || JSON.stringify(addr);
    }
    return String(addr);
  };

  const connectWallet = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const wallets = await waitForWallets();
      if (wallets.length === 0) throw new Error('No Midnight wallet detected.');

      let connected: ConnectedWallet | null = null;
      for (const { id, wallet } of wallets) {
        try {
          const api = await safeEnable(wallet);
          if (!api) continue;

          if (typeof api.state === 'function' && typeof api.serviceUriConfig === 'function') {
            connected = { id, api, type: 'standard' };
            break;
          }
          if (typeof api.getUnshieldedAddress === 'function' && typeof api.getConfiguration === 'function') {
            connected = { id, api, type: 'alternative' };
            break;
          }
        } catch (err) {
          console.warn(`Wallet ${id} failed`, err);
        }
      }

      if (!connected) throw new Error('No compatible Midnight wallet found.');

      apiRef.current = connected.api;

      let address: string | null = null;
      let coinPublicKey: string | null = null;
      let encryptionPublicKey: string | null = null;
      let serviceUris: any = null;

      if (connected.type === 'standard') {
        const [walletState, uris] = await Promise.all([
          connected.api.state(),
          connected.api.serviceUriConfig(),
        ]);
        address = walletState.address;
        coinPublicKey = walletState.coinPublicKey;
        encryptionPublicKey = walletState.encryptionPublicKey;
        serviceUris = uris;
      } else {
        const rawAddress = await connected.api.getUnshieldedAddress();
        const config = await connected.api.getConfiguration();
        address = normalizeAddress(rawAddress);
        serviceUris = {
          indexerUri: config.indexerUri,
          indexerWsUri: config.indexerWsUri,
          proverServerUri: config.proverServerUri,
          substrateNodeUri: config.substrateNodeUri,
          networkId: config.networkId,
        };
      }

      setState({
        isConnected: true,
        isLoading: false,
        error: null,
        address,
        coinPublicKey,
        encryptionPublicKey,
        serviceUris,
      });
    } catch (err: any) {
      console.error('Connection failed:', err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Connection failed',
      }));
    } finally {
      isConnectingRef.current = false;
    }
  }, [waitForWallets]);

  const disconnectWallet = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      if (apiRef.current?.disconnect) await apiRef.current.disconnect();
    } catch (err) {
      console.warn('Disconnect error:', err);
    } finally {
      apiRef.current = null;
      setState(INITIAL_STATE);
    }
  }, []);

  return (
    <MidnightWalletContext.Provider
      value={{
        ...state,
        connectWallet,
        disconnectWallet,
        api: state.isConnected ? apiRef.current : null,
      }}
    >
      {children}
    </MidnightWalletContext.Provider>
  );
}

export function useMidnightWallet() {
  const context = useContext(MidnightWalletContext);
  if (context === undefined) {
    throw new Error('useMidnightWallet must be used within a MidnightWalletProvider');
  }
  return context;
}
