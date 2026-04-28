/**
 * Common types for Midnight/Cardano wallet injection patterns
 */

// ─── CIP-30 (Cardano Wallet Standard) ─────────────────────────────────

export interface CIP30Wallet {
  name: string;
  icon: string;
  apiVersion: string;
  enable(): Promise<CIP30Api>;
  isEnabled?(): Promise<boolean>;
}

export interface CIP30Api {
  getBalance(): Promise<string>;
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  getRewardAddresses(): Promise<string[]>;
  signTx(tx: string, partial?: boolean): Promise<{ tx: string }>;
  submitTx(tx: string): Promise<string>;
  signData(address: string, payload: string): Promise<{ signature: string }>;
  getCollateral?(): Promise<[{ txHash: string; outputIndex: number }]>;
  
  // Midnight-specific extensions (if available)
  midnight?: MidnightWalletApi;
}

// ─── Midnight DApp Connector API ───────────────────────────────────────

export interface MidnightWalletApi {
  connect(networkId: string): Promise<MidnightConnectedApi>;
  name: string;
  apiVersion: string;
}

export interface MidnightConnectedApi {
  getShieldedBalances?(): Promise<Record<string, bigint>>;
  getUnshieldedBalances?(): Promise<Record<string, bigint>>;
  getDustBalance?(): Promise<{ balance: string; cap: string }>;
  getShieldedAddresses?(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getUnshieldedAddress?(): Promise<{ unshieldedAddress: string }>;
  getConfiguration?(): Promise<{
    networkId: string;
    indexerUri: string;
    indexerWsUri: string;
    proverServerUri: string;
    substrateNodeUri: string;
  }>;
  balanceTransaction(tx: string): Promise<{ tx: string }>;
  submitTransaction(tx: string): Promise<void>;
  signData(data: string, options?: { encoding?: string }): Promise<{ signature: string; publicKey: string }>;
  getProvingProvider?(zkConfigProvider: unknown): Promise<unknown>;
  disconnect?(): Promise<void>;
}

// ─── Injection Patterns ─────────────────────────────────────────────────

export interface InjectedMidnightWallet {
  connect(networkId: string): Promise<MidnightConnectedApi>;
  name: string;
  apiVersion: string;
}

export type WalletInjectionPoint = 
  | { type: 'midnight'; key: string }  // window.midnight[key]
  | { type: 'cardano'; key: string };  // window.cardano[key]
