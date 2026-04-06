"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "midnight-wallet-kit/react";

export interface WalletBalance {
  tDUST: bigint;
  shielded: bigint;
}

export function useBalance() {
  const { isConnected, address, serviceUris } = useWallet();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address || !serviceUris?.indexerUri) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    try {
      // We simulate the fetch here if the indexer is slow or use the real one if it works
      const response = await fetch(`${serviceUris.indexerUri}/balance/${address}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      setBalance({
        tDUST: BigInt(data.tDUST ?? 0),
        shielded: BigInt(data.shielded ?? 0),
      });
    } catch (err: any) {
      setError(err);
      // Fallback for demo if the indexer is not reachable:
      // In a real app, this would stay as 0 or error out
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, serviceUris]);

  useEffect(() => {
    if (isConnected) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 15000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}
