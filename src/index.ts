// ─── Core ────────────────────────────────────────────────────────────
export { WalletManager, type Middleware, type MiddlewareContext, type WalletManagerOptions } from './core/manager.js';
export type { ConnectionState, WalletAdapterEvents } from './core/types.js';

// ─── Adapters ────────────────────────────────────────────────────────
export { BaseWalletAdapter } from './adapters/base.js';
export { InjectedWalletAdapter, type InjectedWalletAdapterOptions, type WalletMode } from './adapters/injected.js';
export { OneAMWalletAdapter, type OneAMWalletAdapterOptions } from './adapters/1am.js';
export { NuFiWalletAdapter } from './adapters/nufi.js';
export { GeroWalletAdapter } from './adapters/gerowallet.js';
export { VesprWalletAdapter } from './adapters/vespr.js';
export { YoroiWalletAdapter } from './adapters/yoroi.js';
export { CtrlWalletAdapter } from './adapters/ctrl.js';
export { SubWalletAdapter } from './adapters/subwallet.js';
export { NocturneWalletAdapter, type NocturneWalletAdapterOptions } from './adapters/nocturne.js';
export { MockWalletAdapter, createMockAdapter } from './testing/MockWalletAdapter.js';

// ─── Wallet Registry ────────────────────────────────────────
export {
  WALLET_REGISTRY,
  createMidnightWalletManager,
  getWalletInfo,
  getRegisteredWalletIds,
  detectInstalledWallets,
  type WalletInfo,
  type CreateManagerOptions,
} from './wallet-registry.js';

// ─── 1AM Providers ────────────────────────────────────────
export {
  buildOneAMProviders,
  deployContract,
  submitCallTx,
  getOneAMNetworkConfig,
  type OneAMProviders,
} from './providers/1am-providers.js';

// ─── Intent Builder ──────────────────────────────────────────────────
export { IntentBuilder, type IntentParams } from './builder/intent.js';

// ─── Errors ──────────────────────────────────────────────────────────
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

// ─── Validation & Types ─────────────────────────────────────────────
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

// ─── Wallet Types ───────────────────────────────────────────────
export type {
  CIP30Wallet,
  CIP30Api,
  MidnightWalletApi,
  MidnightConnectedApi,
  InjectedMidnightWallet,
  WalletInjectionPoint,
} from './types/wallets.js';

// ─── 1AM Types ─────────────────────────────────────────────────────
export type {
  OneAMNetwork,
  OneAMConnectedAPI,
  OneAMInitialAPI,
  OneAMInjectedWallet,
  ShieldedAddresses,
  UnshieldedAddress,
  DustAddress,
  ShieldedBalances,
  UnshieldedBalances,
  DustBalance,
  OneAMConfiguration,
  OneAMProvingProvider,
  OneAMSignature,
} from './types/1am.js';

// ─── React Hooks & Core Components ──────────────────────────────────
export { WalletProvider, useWallet, useConnect, useIntent } from './hooks/index.js';
export { useBalance } from './hooks/useBalance.js';
export { WalletKitProvider } from './components/WalletKitProvider.js';
export { ConnectButton } from './components/ConnectButton.js';
export { WalletModal } from './components/WalletModal.js';

// ─── Utils ──────────────────────────────────────────────────────────
export { isBrowser } from './utils/env.js';
export { verifyMessage, type SignedMessage } from './utils/verify.js';
