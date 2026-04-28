import type { OneAMWalletAdapter } from '../adapters/1am.js';
import type { ServiceUriConfig } from '../validation/schemas.js';

// ─── Provider Types ─────────────────────────────────────────────────────────

export interface OneAMProviders {
  publicDataProvider: {
    query: <T = unknown>(query: string, variables?: Record<string, unknown>) => Promise<T>;
    subscribe?: (query: string, variables?: Record<string, unknown>) => {
      subscribe: (callbacks: { next: (data: unknown) => void; error?: (err: Error) => void }) => void;
      unsubscribe: () => void;
    };
  };
  zkConfigProvider: {
    fetchZkConfig: (circuitId: string) => Promise<{
      prover: ArrayBuffer | null;
      verifier: string | null;
      zkir: string | null;
    }>;
  };
  proofProvider: {
    proveTx: (unprovenTx: unknown) => Promise<unknown>;
  };
  walletProvider: {
    getCoinPublicKey: () => string | undefined;
    getEncryptionPublicKey: () => string | undefined;
    balanceTx: (tx: unknown) => Promise<unknown>;
  };
  midnightProvider: {
    submitTx: (tx: unknown) => Promise<string>;
  };
}

// ─── Build Providers ──────────────────────────────────────────────────────

/**
 * Build all providers for 1AM contract deployment and calls.
 * Mirrors the pattern from https://1am.xyz/developers
 *
 * @param adapter - Connected OneAMWalletAdapter instance
 * @param options - Configuration for ZK config and indexer
 */
export async function buildOneAMProviders(
  adapter: OneAMWalletAdapter,
  options?: {
    zkConfigBaseUrl?: string;
    contractName?: string;
  },
): Promise<OneAMProviders> {
  const config = await adapter.getConfiguration();
  if (!config) throw new Error('No network configuration available. Ensure wallet is connected.');

  const api = (adapter as any).api;
  if (!api) throw new Error('Wallet API not available.');

  // ZK Config Provider (fetches prover/verifier keys from CDN)
  const zkConfigBaseUrl = options?.zkConfigBaseUrl || '';
  const zkConfigProvider = {
    fetchZkConfig: async (circuitId: string) => {
      if (!zkConfigBaseUrl) return { prover: null, verifier: null, zkir: null };
      const base = zkConfigBaseUrl.endsWith('/') ? zkConfigBaseUrl : zkConfigBaseUrl + '/';
      const [prover, verifier, zkir] = await Promise.all([
        fetch(`${base}keys/${circuitId}.prover`).then(r => r.ok ? r.arrayBuffer() : null),
        fetch(`${base}keys/${circuitId}.verifier`).then(r => r.ok ? r.text() : null),
        fetch(`${base}zkir/${circuitId}.bzkir`).then(r => r.ok ? r.text() : null),
      ]);
      return { prover, verifier, zkir };
    },
  };

  // Public Data Provider (indexer)
  const publicDataProvider = {
    async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
      const response = await fetch(config.indexerUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const json = await response.json();
      return json as T;
    },
    subscribe(query: string, variables?: Record<string, unknown>) {
      const wsUrl = config.indexerWsUri || config.indexerUri.replace('https://', 'wss://');
      const ws = new WebSocket(wsUrl);
      let resolved = false;
      return {
        subscribe: (callbacks: { next: (data: unknown) => void; error?: (err: Error) => void }) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'connection_init' }));
            ws.send(JSON.stringify({ type: 'start', payload: { query, variables } }));
          };
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data as string);
              if (data.type === 'data' && !resolved) {
                resolved = true;
                callbacks.next(data.payload);
              }
            } catch { }
          };
          ws.onerror = (err) => callbacks.error?.(new Error(String(err)));
        },
        unsubscribe: () => ws.close(),
      };
    },
  };

  // Proving Provider (delegates to 1AM wallet → ProofStation)
  const provingProvider = await api.getProvingProvider(zkConfigProvider);
  const proofProvider = {
    async proveTx(unprovenTx: unknown): Promise<unknown> {
      // Dynamic import - requires @midnight-ntwrk/ledger-v8 to be installed by the consumer
      const ledger = await new Function('return import("@midnight-ntwrk/ledger-v8")')() as any;
      return (provingProvider as any).prove(unprovenTx, ledger.CostModel.initialCostModel());
    },
  };

  // Wallet Provider (balanceTx → ProofStation adds dust fees)
  const shielded = await api.getShieldedAddresses();
  const walletProvider = {
    getCoinPublicKey: () => shielded?.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shielded?.shieldedEncryptionPublicKey,
    async balanceTx(tx: unknown): Promise<unknown> {
      // Dynamic import - requires @midnight-ntwrk/ledger-v8 to be installed by the consumer
      const ledger = await new Function('return import("@midnight-ntwrk/ledger-v8")')() as any;
      const Transaction = ledger.Transaction;
      const serialized = tx && typeof tx === 'object' && 'serialize' in tx ? (tx as any).serialize() : tx;
      const bytes = serialized instanceof Uint8Array ? serialized : new Uint8Array(Buffer.from(JSON.stringify(serialized)));
      const hex = Array.from(bytes as Uint8Array)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('');
      const result = await api.balanceUnsealedTransaction(hex);
      const txBytes = new Uint8Array(
        (result as any).tx.match(/.{2}/g).map((b: string) => parseInt(b, 16)),
      );
      return Transaction.deserialize('signature', 'proof', 'binding', txBytes);
    },
  };

  // Midnight Provider (submitTx → broadcasts to chain)
  const midnightProvider = {
    async submitTx(tx: unknown): Promise<string> {
      const serialized = tx && typeof tx === 'object' && 'serialize' in tx ? (tx as any).serialize() : tx;
      const bytes = serialized instanceof Uint8Array ? serialized : new Uint8Array(Buffer.from(JSON.stringify(serialized)));
      const hex = Array.from(bytes as Uint8Array)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('');
      await api.submitTransaction(hex);
      return tx && typeof tx === 'object' && 'identifiers' in tx ? (tx as any).identifiers()[0] : hex;
    },
  };

  return { publicDataProvider, zkConfigProvider, proofProvider, walletProvider, midnightProvider };
}

// ─── Contract Helpers ─────────────────────────────────────────────────────

/**
 * Deploy a contract using 1AM wallet (dust-free via ProofStation)
 * Requires @midnight-ntwrk/midnight-js-contracts to be installed by the consumer
 */
export async function deployContract(
  providers: OneAMProviders,
  params: {
    compiledContract: unknown;
  },
): Promise<{ contractAddress: string; deployTxData: unknown }> {
  // Dynamic import - requires @midnight-ntwrk/midnight-js-contracts to be installed by the consumer
  const contracts = await new Function('return import("@midnight-ntwrk/midnight-js-contracts")')() as any;
  return contracts.deployContract(providers, params);
}

/**
 * Call a circuit on a deployed contract (dust-free via ProofStation)
 * Requires @midnight-ntwrk/midnight-js-contracts to be installed by the consumer
 */
export async function submitCallTx(
  providers: OneAMProviders,
  params: {
    compiledContract: unknown;
    contractAddress: string;
    circuitId: string;
    args: unknown[];
  },
): Promise<{ public: { txHash: string; contractAddress: string } }> {
  // Dynamic import - requires @midnight-ntwrk/midnight-js-contracts to be installed by the consumer
  const contracts = await new Function('return import("@midnight-ntwrk/midnight-js-contracts")')() as any;
  return contracts.submitCallTx(providers, params);
}

/**
 * Get the network config from a connected 1AM adapter
 */
export async function getOneAMNetworkConfig(
  adapter: OneAMWalletAdapter,
): Promise<ServiceUriConfig | null> {
  return adapter.getServiceUris();
}
