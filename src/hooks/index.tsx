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
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface WalletProviderProps {
  children: React.ReactNode;
  manager: WalletManager;
  /** If provided, auto-connect with fallback on mount */
  autoConnect?: string[];
}

export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
  manager,
  autoConnect,
}) => {
  const [wallet, setWallet] = useState<MidnightWallet | null>(manager.tryGetActiveWallet());
  const [connectionState, setConnectionState] = useState<ConnectionState>(manager.getConnectionState());
  const [error, setError] = useState<Error | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [coinPublicKey, setCoinPublicKey] = useState<string | null>(null);
  const [encryptionPublicKey, setEncryptionPublicKey] = useState<string | null>(null);
  const [serviceUris, setServiceUris] = useState<ServiceUriConfig | null>(null);

  // Stable ref for the manager so event handlers don't re-register
  const managerRef = useRef(manager);
  managerRef.current = manager;

  // Sync state with manager events
  useEffect(() => {
    const mgr = managerRef.current;

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
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    mgr.on('onConnect', handleConnect);
    mgr.on('onDisconnect', handleDisconnect);
    mgr.on('onStateChange', handleStateChange);
    mgr.on('onError', handleError);

    return () => {
      mgr.off('onConnect', handleConnect);
      mgr.off('onDisconnect', handleDisconnect);
      mgr.off('onStateChange', handleStateChange);
      mgr.off('onError', handleError);
    };
  }, [manager]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && autoConnect.length > 0 && !managerRef.current.isConnected()) {
      void managerRef.current.connectWithFallback(autoConnect).catch((err) => {
        console.warn('[WalletProvider] Auto-connect failed:', err);
      });
    }
  }, [autoConnect]);

  const connect = useCallback(async (name: string) => {
    setError(null);
    await managerRef.current.connect(name);
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    await managerRef.current.disconnect();
  }, []);

  const signIntent = useCallback(async (intent: MidnightIntent): Promise<SignedIntent> => {
    const w = managerRef.current.getActiveWallet();
    return w.signIntent(intent);
  }, []);

  const value = useMemo<WalletContextValue>(() => ({
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
  }), [manager, wallet, address, coinPublicKey, encryptionPublicKey, serviceUris, connectionState, error, connect, disconnect, signIntent]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error(
      'useWallet/useConnect/useIntent must be used inside a <WalletProvider>. '
      + 'Wrap your component tree with <WalletProvider manager={...}>.',
    );
  }
  return ctx;
}

/**
 * Primary hook — returns everything about the current wallet state.
 */
export function useWallet() {
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
  };
}

/**
 * Connection-focused hook with loading and error state.
 */
export function useConnect() {
  const ctx = useWalletContext();
  const [isLoading, setIsLoading] = useState(false);
  const [connectError, setConnectError] = useState<Error | null>(null);

  const connect = useCallback(async (name: string) => {
    setIsLoading(true);
    setConnectError(null);
    try {
      await ctx.connect(name);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setConnectError(error);
      throw error; // re-throw so caller can handle too
    } finally {
      setIsLoading(false);
    }
  }, [ctx]);

  const disconnect = useCallback(async () => {
    setIsLoading(true);
    setConnectError(null);
    try {
      await ctx.disconnect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setConnectError(error);
    } finally {
      setIsLoading(false);
    }
  }, [ctx]);

  return {
    connect,
    disconnect,
    isLoading,
    error: connectError,
    connectionState: ctx.connectionState,
    wallet: ctx.wallet,
    adapters: ctx.manager.getRegisteredWallets(),
  };
}

/**
 * Intent hook — build + sign in one call, or build and sign separately.
 */
export function useIntent() {
  const ctx = useWalletContext();
  const [isLoading, setIsLoading] = useState(false);
  const [intentError, setIntentError] = useState<Error | null>(null);

  /**
   * Build from IntentParams and sign in one shot.
   */
  const buildAndSign = useCallback(async (params: IntentParams): Promise<SignedIntent> => {
    setIsLoading(true);
    setIntentError(null);
    try {
      const intent = IntentBuilder.create(params);
      const signed = await ctx.signIntent(intent);
      return signed;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setIntentError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [ctx]);

  /**
   * Sign a pre-built MidnightIntent.
   */
  const sign = useCallback(async (intent: MidnightIntent): Promise<SignedIntent> => {
    setIsLoading(true);
    setIntentError(null);
    try {
      const signed = await ctx.signIntent(intent);
      return signed;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setIntentError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [ctx]);

  return {
    buildAndSign,
    sign,
    build: IntentBuilder.create,
    isLoading,
    error: intentError,
    isConnected: ctx.wallet !== null,
  };
}
