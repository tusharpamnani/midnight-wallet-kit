'use client';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import type { WalletManager } from '../core/manager.js';
import type {
  MidnightWallet,
  MidnightIntent,
  SignedIntent,
  ServiceUriConfig,
} from '../validation/schemas.js';
import { IntentBuilder, type IntentParams } from '../builder/intent.js';
import type { ConnectionState } from '../core/types.js';
import type { SignedMessage } from '../utils/verify.js';
import { isBrowser } from '../utils/env.js';

/**
 * State of the currently active wallet.
 */
export interface WalletState {
  /** Map of registered adapters */
  adapters: { name: string }[];
  /** The currently connected wallet instance (if any) */
  wallet: MidnightWallet | null;
  /** Resolved address of the connected wallet */
  address: string | null;
  /** Public key for coins/UTXOs */
  coinPublicKey: string | null;
  /** Public key for payload encryption */
  encryptionPublicKey: string | null;
  /** Service URLs for interacting with the network */
  serviceUris: ServiceUriConfig | null;
  /** Current connection lifecycle state */
  connectionState: ConnectionState;
  /** True if a wallet is fully connected and ready */
  isConnected: boolean;
  /** Last connection or logic error */
  error: Error | null;
  /** Reference to the manager instance */
  manager: WalletManager;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface WalletContextValue {
  manager: WalletManager;
  wallet: MidnightWallet | null;
  address: string | null;
  coinPublicKey: string | null;
  encryptionPublicKey: string | null;
  serviceUris: ServiceUriConfig | null;
  connectionState: ConnectionState;
  error: Error | null;
  connect: (name: string) => Promise<void>;
  disconnect: () => Promise<void>;
  signIntent: (intent: MidnightIntent) => Promise<SignedIntent>;
  signMessage: (message: string) => Promise<SignedMessage>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface WalletProviderProps {
  children: React.ReactNode;
  manager: WalletManager;
  /** If provided, auto-connect with fallback on mount */
  autoConnect?: string[];
  /** If true, invokes autoRestore from localStorage once on client mount */
  autoRestore?: boolean;
}

/** 
 * WalletProvider — Global context for Midnight wallet integration. 
 * SSR-safe: returns empty/not-connected defaults on the server.
 */
export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
  manager,
  autoConnect,
  autoRestore = true,
}) => {
  // 1. Initial State: Always start as 'idle'/'null' for hydration safety
  const [wallet, setWallet] = useState<MidnightWallet | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [coinPublicKey, setCoinPublicKey] = useState<string | null>(null);
  const [encryptionPublicKey, setEncryptionPublicKey] = useState<string | null>(null);
  const [serviceUris, setServiceUris] = useState<ServiceUriConfig | null>(null);

  // Persistence management
  const [hasRestored, setHasRestored] = useState(false);

  // Sync state with manager events
  useEffect(() => {
    // Sync initial state once on client mount to match manager's internal state
    setWallet(manager.tryGetActiveWallet());
    setConnectionState(manager.getConnectionState());

    const handleConnect = (w: MidnightWallet) => {
      setWallet(w);
      setError(null);
      try {
        setAddress(w.getAddress());
        setCoinPublicKey(w.getCoinPublicKey());
        setEncryptionPublicKey(w.getEncryptionPublicKey());
        setServiceUris(w.getServiceUris());
      } catch {
        setAddress(null);
        setCoinPublicKey(null);
        setEncryptionPublicKey(null);
        setServiceUris(null);
      }
    };

    const handleDisconnect = () => {
      setWallet(null);
      setAddress(null);
      setCoinPublicKey(null);
      setEncryptionPublicKey(null);
      setServiceUris(null);
    };

    const handleStateChange = (state: ConnectionState) => {
      setConnectionState(state);
      if (state === 'connecting' || state === 'restoring' || state === 'connected') {
        setError(null);
      }
    };
    const handleError = (err: Error) => setError(err);

    manager.on('onConnect', handleConnect);
    manager.on('onDisconnect', handleDisconnect);
    manager.on('onStateChange', handleStateChange);
    manager.on('onError', handleError);

    return () => {
      manager.off('onConnect', handleConnect);
      manager.off('onDisconnect', handleDisconnect);
      manager.off('onStateChange', handleStateChange);
      manager.off('onError', handleError);
    };
  }, [manager]);

  // Client-only initialization logic
  useEffect(() => {
    const init = async () => {
      if (autoRestore && !hasRestored && !manager.isConnected()) {
        setHasRestored(true);
        await manager.autoRestore();
      }
      
      if (!manager.isConnected() && autoConnect && autoConnect.length > 0) {
        void manager.connectWithFallback(autoConnect).catch(() => {});
      }
    };
    init();
  }, [autoConnect, autoRestore, manager, hasRestored]);

  const connect = useCallback((name: string) => manager.connect(name), [manager]);
  const disconnect = useCallback(() => manager.disconnect(), [manager]);
  const signIntent = useCallback((intent: MidnightIntent) => manager.signIntent(intent), [manager]);
  const signMessage = useCallback((message: string) => manager.signMessage(message), [manager]);

  const contextValue = useMemo<WalletContextValue>(() => ({
    manager,
    wallet,
    address,
    coinPublicKey,
    encryptionPublicKey,
    serviceUris,
    connectionState,
    error,
    connect,
    disconnect,
    signIntent,
    signMessage,
  }), [manager, wallet, address, coinPublicKey, encryptionPublicKey, serviceUris, connectionState, error, connect, disconnect, signIntent, signMessage]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet hooks must be used inside a <WalletProvider>.');
  return ctx;
}

export function useWallet(): WalletState {
  const ctx = useWalletContext();
  return {
    wallet: ctx.wallet,
    address: ctx.address,
    coinPublicKey: ctx.coinPublicKey,
    encryptionPublicKey: ctx.encryptionPublicKey,
    serviceUris: ctx.serviceUris,
    connectionState: ctx.connectionState,
    isConnected: ctx.connectionState === 'connected' && ctx.wallet !== null,
    error: ctx.error,
    manager: ctx.manager,
    adapters: ctx.manager.getRegisteredWallets().map(w => ({ name: w.name })),
  };
}

export function useConnect() {
  const ctx = useWalletContext();
  const [isLoading, setIsLoading] = useState(false);
  const [connectError, setConnectError] = useState<Error | null>(null);

  const connect = useCallback(async (name: string) => {
    setIsLoading(true);
    setConnectError(null);
    try { await ctx.connect(name); } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setConnectError(error);
      throw error;
    } finally { setIsLoading(false); }
  }, [ctx]);

  const disconnect = useCallback(async () => {
    setIsLoading(true);
    try { await ctx.disconnect(); } finally { setIsLoading(false); }
  }, [ctx]);

  return {
    connect,
    disconnect,
    isLoading,
    error: connectError,
    adapters: ctx.manager.getRegisteredWallets().map(w => ({ name: w.name })),
    connectionState: ctx.connectionState,
  };
}

export function useIntent() {
  const ctx = useWalletContext();
  const [isLoading, setIsLoading] = useState(false);
  const [intentError, setIntentError] = useState<Error | null>(null);

  const buildAndSign = useCallback(async (params: IntentParams): Promise<SignedIntent> => {
    setIsLoading(true); setIntentError(null);
    try {
      const intent = IntentBuilder.create(params);
      return await ctx.signIntent(intent);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setIntentError(error); throw error;
    } finally { setIsLoading(false); }
  }, [ctx]);

  const signMessage = useCallback(async (message: string): Promise<SignedMessage> => {
    setIsLoading(true); setIntentError(null);
    try {
      return await ctx.signMessage(message);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setIntentError(error); throw error;
    } finally { setIsLoading(false); }
  }, [ctx]);

  return { buildAndSign, signMessage, isLoading, error: intentError };
}
