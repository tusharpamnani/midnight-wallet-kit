// ─── Core ────────────────────────────────────────────────────────────────────
export { WalletManager } from './core/manager.js';
export type { ConnectionState, WalletAdapterEvents } from './core/types.js';

// ─── Adapters ────────────────────────────────────────────────────────────────
export { BaseWalletAdapter } from './adapters/base.js';
export { InjectedWalletAdapter, type InjectedWalletAdapterOptions } from './adapters/injected.js';
export { SeedWalletAdapter } from './adapters/seed.js';
export { MockWalletAdapter, type MockWalletAdapterOptions } from './adapters/mock.js';

// ─── Intent Builder ──────────────────────────────────────────────────────────
export { IntentBuilder, type IntentParams } from './builder/intent.js';

// ─── Errors ──────────────────────────────────────────────────────────────────
export {
  MidnightWalletError,
  WalletNotConnectedError,
  ProviderNotFoundError,
  ConnectionRejectedError,
  ConnectionTimeoutError,
  InvalidIntentError,
  SigningError,
  WalletAlreadyConnectedError,
  WalletNotRegisteredError,
  FallbackExhaustedError,
  InvalidSeedError,
  wrapError,
} from './errors/wallet-errors.js';

// ─── Validation & Types ─────────────────────────────────────────────────────
export {
  MidnightIntentSchema,
  SignedIntentSchema,
  NetworkSchema,
} from './validation/schemas.js';
export type {
  MidnightIntent,
  SignedIntent,
  MidnightWallet,
  Network,
} from './validation/schemas.js';

// ─── React Hooks ─────────────────────────────────────────────────────────────
export { WalletProvider, useWallet, useConnect, useIntent } from './hooks/index.js';
