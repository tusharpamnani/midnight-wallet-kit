// ─── Core ────────────────────────────────────────────────────────────────────
export { WalletManager, type Middleware, type MiddlewareContext, type WalletManagerOptions } from './core/manager.js';
export type { ConnectionState, WalletAdapterEvents } from './core/types.js';

// ─── Adapters ────────────────────────────────────────────────────────────────
export { BaseWalletAdapter } from './adapters/base.js';
export { InjectedWalletAdapter, type InjectedWalletAdapterOptions, type WalletMode } from './adapters/injected.js';
export { MockWalletAdapter, createMockAdapter } from './testing/MockWalletAdapter.js';

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
  SessionExpiredError,
  UnsupportedMethodError,
  BalanceFetchError,
  MessageSigningError,
  NetworkMismatchError,
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
  UnsealedTransaction,
  SealedTransaction,
  SubmitTransactionResult,
  ServiceUriConfig,
} from './validation/schemas.js';

// ─── React Hooks & Core Components ──────────────────────────────────────────
export { WalletProvider, useWallet, useConnect, useIntent } from './hooks/index.js';
export { useBalance } from './hooks/useBalance.js';
export { WalletKitProvider } from './components/WalletKitProvider.js';
export { ConnectButton } from './components/ConnectButton.js';
export { WalletModal } from './components/WalletModal.js';

// ─── Utils ──────────────────────────────────────────────────────────────────
export { isBrowser } from './utils/env.js';
export { verifyMessage, type SignedMessage } from './utils/verify.js';
