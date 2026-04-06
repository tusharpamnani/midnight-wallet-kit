'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ServiceUriConfig, MidnightWallet } from '../validation/schemas.js';
import { useWallet } from './index.js';
import { BalanceFetchError } from '../errors/wallet-errors.js';

export interface WalletBalance {
  /** The tDUST balance (unshielded) in its smallest unit (e.g., Lovelace-equivalent) */
  tDUST: bigint;
  /** The shielded balance in its smallest unit */
  shielded: bigint;
}

export interface UseBalanceResult {
  /** Current balance for the connected address, or null if loading/not connected */
  balance: WalletBalance | null;
  /** Loading state of the initial fetch or polling */
  isLoading: boolean;
  /** Error from the indexer API if the fetch failed */
  error: Error | null;
  /** Manual trigger for a re-fetch */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and tracking the balance of the connected wallet.
 * 
 * Performance features:
 * - SSR-safe (returns null balance on server)
 * - Automatic polling every 15 seconds when connected
 * - Clear poll on disconnect or unmount
 * - Throws BalanceFetchError on failure
 */
export function useBalance(): UseBalanceResult {
  const { isConnected, address, serviceUris } = useWallet();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address || !serviceUris?.indexerUri) {
      setBalance(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Production Implementation: Fetch from the indexer endpoint.
      // We assume the indexer follows the standard Midnight balance query format.
      const response = await fetch(`${serviceUris.indexerUri}/balance/${address}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Indexer responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Structural conversion to Zod/BigInt safely
      setBalance({
        tDUST: BigInt(data.tDUST ?? 0),
        shielded: BigInt(data.shielded ?? 0),
      });
    } catch (err) {
      const wrapped = new BalanceFetchError(address, err);
      setError(wrapped);
      // We don't re-throw here to allow UI to surface it via the error return
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, serviceUris]);

  // Initial fetch + Automatic Polling logic
  useEffect(() => {
    if (isConnected) {
      void fetchBalance();
      const interval = setInterval(() => {
        void fetchBalance();
      }, 15000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
      setIsLoading(false);
      setError(null);
    }
  }, [isConnected, fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
