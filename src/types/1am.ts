import type { ServiceUriConfig } from '../validation/schemas.js';

// ─── 1AM Wallet Types ─────────────────────────────────────────────────────────

export type OneAMNetwork = 'preview' | 'preprod' | 'mainnet';

export interface ShieldedAddresses {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

export interface UnshieldedAddress {
  unshieldedAddress: string;
}

export interface DustAddress {
  dustAddress: string;
}

export interface DustBalance {
  balance: string;
  cap: string;
}

export type ShieldedBalances = Record<string, bigint>;

export type UnshieldedBalances = Record<string, bigint>;

export interface OneAMConfiguration extends ServiceUriConfig {
  networkId: string;
  indexerUri: string;
  indexerWsUri: string;
  proverServerUri: string;
  substrateNodeUri: string;
}

export interface OneAMConnectedAPI {
  // Balance methods
  getShieldedBalances(): Promise<ShieldedBalances>;
  getUnshieldedBalances(): Promise<UnshieldedBalances>;
  getDustBalance(): Promise<DustBalance>;

  // Address methods
  getShieldedAddresses(): Promise<ShieldedAddresses>;
  getUnshieldedAddress(): Promise<UnshieldedAddress>;
  getDustAddress(): Promise<DustAddress>;

  // Network config
  getConfiguration(): Promise<OneAMConfiguration>;

  // Transaction methods (hex-based, dust-free)
  balanceUnsealedTransaction(hex: string): Promise<{ tx: string }>;
  submitTransaction(hex: string): Promise<void>;

  // Proving
  getProvingProvider(zkConfigProvider: unknown): Promise<OneAMProvingProvider>;

  // Signing
  signData(data: string, options?: { encoding?: string }): Promise<OneAMSignature>;

  // Disconnect
  disconnect?(): Promise<void>;
}

export interface OneAMInitialAPI {
  name: string;
  apiVersion: string;
  connect(networkId: OneAMNetwork): Promise<OneAMConnectedAPI>;
}

export interface OneAMInjectedWallet {
  name: string;
  apiVersion: string;
  connect(networkId: OneAMNetwork): Promise<OneAMConnectedAPI>;
}

export interface OneAMProvingProvider {
  prove(tx: unknown, costModel: unknown): Promise<unknown>;
}

export interface OneAMSignature {
  signature: string;
  publicKey: string;
}

export interface OneAMInitialAPI {
  name: string;
  apiVersion: string;
  connect(networkId: OneAMNetwork): Promise<OneAMConnectedAPI>;
}

export interface OneAMInjectedWallet {
  name: string;
  apiVersion: string;
  connect(networkId: OneAMNetwork): Promise<OneAMConnectedAPI>;
}
