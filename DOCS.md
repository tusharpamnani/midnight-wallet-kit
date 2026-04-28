# 📖 Technical Documentation

Detailed documentation for the **Midnight Wallet Kit** architecture, API, and best practices.

> **Midnight Wallet Kit is the WalletConnect / RainbowKit for Midnight Network** — supporting all 8 wallets in the ecosystem with a unified, type-safe API.

---

## Table of Contents

1. [Core Architecture](#1-core-architecture)
2. [Supported Wallets](#2-supported-wallets)
3. [Wallet Registry](#3-wallet-registry)
4. [WalletManager API](#4-walletmanager-api)
5. [Adapter Reference](#5-adapter-reference)
6. [React Hooks & Components](#6-react-hooks--components)
7. [1AM-Specific: Dust-Free Execution](#7-1am-specific-dust-free-execution)
8. [Testing Utilities](#8-testing-utilities)
9. [Error Codes Reference](#9-error-codes-reference)
10. [Migration Guide](#10-migration-guide)

---

## 1. 🏗️ Core Architecture

Midnight Wallet Kit follows a clean, event-driven architecture that separates wallet-specific communication from application-level state management.

### 🛡️ Layer 1: Adapters

Adapters handle physical or injected provider communication. Every adapter implements the `MidnightWallet` interface, ensuring a consistent contract.

**Modes:**
- `intent-signing`: Supports the `signIntent()` flow (standard for DApps)
- `tx-only`: Direct transaction balancing and submission only
- `unknown`: Handled defensively as a fallback

### 🎛️ Layer 2: WalletManager

The central orchestrator that manages:
- **Registry & Lifecycle**: Connection status transitions: `idle`, `connecting`, `restoring`, `connected`, `error`, `disconnecting`, `disconnected`
- **Case-Insensitive Naming**: All adapter names are normalized to lowercase during registration and lookup
- **Fallback Chains**: Automated retry sequence for multiple registered adapters
- **Middleware**: A global interception system for logging, analytics, or transaction modification
- **Session Persistence**: Automatic restoration of the last-connected wallet across page refreshes

### 🧩 Layer 3: React Integration

Hooks and components for seamless React integration:
- `WalletProvider` / `WalletKitProvider` - Context providers
- `useWallet`, `useConnect`, `useIntent`, `useBalance` - Hooks
- `ConnectButton`, `WalletModal` - UI components

---

## 2. 🎒 Supported Wallets

| Wallet | Type | Dust-Free | Shielded Balances | Install |
|--------|------|-----------|-------------------|--------|
| **1AM** | Midnight-Native | ✅ | ✅ | [Chrome](https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp) |
| **Nocturne** | Midnight-Native | ❌ | ✅ | [GitHub](https://github.com/midnightntwrk/midnight-awesome-dapps) |
| **NuFi** | CIP-30 | ❌ | ❌ | [Website](https://nufi.app) |
| **GeroWallet** | CIP-30 | ❌ | ❌ | [Website](https://gerowallet.io) |
| **VESPR** | CIP-30 | ❌ | ❌ | [Website](https://vespr.io) |
| **Yoroi** | CIP-30 | ❌ | ❌ | [Website](https://yoroi-wallet.com) |
| **Ctrl** | CIP-30 | ❌ | ❌ | [Website](https://ctrl.xyz) |
| **SubWallet** | CIP-30 | ❌ | ❌ | [Website](https://subwallet.app) |

### Wallet Types

**Midnight-Native** (`window.midnight.*`):
- 1AM: `window.midnight['1am']` - Dust-free via ProofStation
- Nocturne: `window.midnight.nocturne` - Built specifically for Midnight

**CIP-30 Cardano** (`window.cardano.*`):
- NuFi: `window.cardano.nufi`
- GeroWallet: `window.cardano.gerowallet`
- VESPR: `window.cardano.vespr`
- Yoroi: `window.cardano.yoroi`
- Ctrl: `window.cardano.ctrl`
- SubWallet: `window.cardano.subwallet`

---

## 3. 🎒 Wallet Registry

### `createMidnightWalletManager(options?)`

The easiest way to get started — creates a `WalletManager` with ALL 8 wallets pre-registered.

```typescript
import { createMidnightWalletManager } from 'midnight-wallet-kit';

// All 8 wallets registered automatically
const manager = createMidnightWalletManager({
  network: 'preprod',           // Default network for Midnight-native wallets
  only: ['1AM', 'NuFi'],     // Only register specific wallets
  skip: ['SubWallet'],         // Skip specific wallets
});
```

### `WALLET_REGISTRY`

Access the full wallet registry for building custom UIs:

```typescript
import { WALLET_REGISTRY, getWalletInfo, detectInstalledWallets } from 'midnight-wallet-kit';

// Get all wallet info
WALLET_REGISTRY.forEach(wallet => {
  console.log(wallet.name, wallet.injectionPoint, wallet.website);
});

// Get info for a specific wallet
const oneAM = getWalletInfo('1AM');

// Detect which wallets are installed in the browser
const installed = detectInstalledWallets();
console.log(installed.map(w => w.name));
```

---

## 4. 🔌 WalletManager API Reference

### `register(wallet: MidnightWallet): this`
Registers a new adapter. Names are case-insensitive.

### `async connect(name: string): Promise<void>`
Connects to the specified adapter. Automatically disconnects the current active wallet first.

### `async connectWithFallback(priorityList: string[]): Promise<void>`
Attempts connection to adapters in the specified order. Throws `FallbackExhaustedError` if all fail.

```typescript
// 1AM (dust-free) → Nocturne → NuFi → ...
await manager.connectWithFallback([
  '1AM',        // Best UX, zero fees
  'Nocturne',   // Midnight-native
  'NuFi',       // Popular multi-chain
]);
```

### `async autoRestore(): Promise<void>`
Attempts to re-establish the session with the last-active wallet stored in `localStorage`.

### `async disconnect(): Promise<void>`
Cleanly shuts down the active wallet. Interceptable via middleware.

### `use(middleware: Middleware): this`
Adds a global interceptor. **Disconnect** is fully interceptable. Context includes:
- `operation`: `'connect'`, `'disconnect'`, `'signIntent'`, or `'signMessage'`
- `adapterName`: string
- `intent`: MidnightIntent (if applicable)
- `result`: Outcome value (if applicable)
- `error`: Thrown Error (if applicable)

```typescript
manager.use(async (ctx, next) => {
  console.log(`Starting ${ctx.operation} on ${ctx.adapterName}`);
  await next();
  if (ctx.error) console.error('Operation Failed:', ctx.error);
});
```

---

## 5. 🔌 Adapter Reference

### OneAMWalletAdapter

Dust-free wallet with ProofStation sponsorship.

```typescript
import { OneAMWalletAdapter } from 'midnight-wallet-kit';

const oneAM = new OneAMWalletAdapter({
  network: 'preprod',        // 'preview' | 'preprod' | 'mainnet'
  maxRetries: 50,           // Retry attempts for wallet detection
  retryDelayMs: 100,         // Delay between retries
  connectTimeoutMs: 30000,   // Connection timeout
});

// 1AM-specific methods
await oneAM.connect();
const shielded = await oneAM.getShieldedBalances();
const unshielded = await oneAM.getUnshieldedBalances();
const dust = await oneAM.getDustBalance();
const config = await oneAM.getConfiguration();
```

### NocturneWalletAdapter

Midnight-native wallet with shielded balance support.

```typescript
import { NocturneWalletAdapter } from 'midnight-wallet-kit';

const nocturne = new NocturneWalletAdapter({
  network: 'preprod',
  maxRetries: 50,
  retryDelayMs: 100,
});
```

### CIP-30 Adapters (NuFi, GeroWallet, VESPR, Yoroi, Ctrl, SubWallet)

All use the same `InjectedWalletAdapter` under the hood:

```typescript
import { NuFiWalletAdapter, GeroWalletAdapter } from 'midnight-wallet-kit';

const nufi = new NuFiWalletAdapter({
  maxRetries: 50,
  retryDelayMs: 100,
});
```

---

## 6. ⚛️ React Hooks & Components

### `WalletProvider` Props

| Prop | Type | Description |
|---|---|---|
| `manager` | `WalletManager` | The core manager instance |
| `autoConnect` | `string[]` | Optional. Triggers `connectWithFallback()` on client mount |
| `autoRestore` | `boolean` | Default `true`. Triggers `autoRestore()` on client mount |

```tsx
import { WalletProvider } from 'midnight-wallet-kit';

function App({ children }) {
  return (
    <WalletProvider 
      manager={manager}
      autoConnect={['1AM', 'Nocturne']}
      autoRestore={true}
    >
      {children}
    </WalletProvider>
  );
}
```

### `useWallet()`

Returns the complete state of the currently active wallet.

- `address`: string | null
- `coinPublicKey`: string | null
- `encryptionPublicKey`: string | null
- `isConnected`: boolean
- `connectionState`: `'idle'` | `'connecting'` | `'restoring'` | `'connected'` | `'error'` | `'disconnecting'` | `'disconnected'`
- `error`: Last thrown error instance or `null`

### `useConnect()`

Methods to manage the connection lifecycle.

- `connect(name: string)`: Asynchronous connection handler
- `disconnect()`: Cleanly shuts down the active wallet. Interceptable via middleware
- `isLoading`: Track connection progress
- `adapters`: List of all registered adapter names

### `useIntent()`

High-level contract intent and message signing.

- `buildAndSign(params: IntentParams)`: Validates, sanitizes, and signs a contract intent
- `signMessage(message: string)`: Signs an arbitrary string. The kit automatically handles timestamping and normalization

### `useBalance()`

Hook for fetching and tracking the balance of the connected wallet.

- `balance`: `{ tDUST: bigint; shielded: bigint } | null`
- `isLoading`: Track fetching or polling progress
- `error`: `BalanceFetchError` if the indexer query fails
- `refetch()`: Manually trigger a balance update

*Note: Automatically polls every 15 seconds when connected.*

### UI Components

```tsx
import { ConnectButton, WalletModal } from 'midnight-wallet-kit';

// ConnectButton - Simple connect/disconnect button
<ConnectButton />

// WalletModal - Full wallet selection modal
<WalletModal isOpen={open} onClose={() => setOpen(false)} />
```

---

## 7. 🌅 1AM-Specific: Dust-Free Execution

1AM Wallet + ProofStation handles all transaction fees server-side. Users never need dust or NIGHT tokens.

### Build Providers

```typescript
import { buildOneAMProviders, deployContract, submitCallTx } from 'midnight-wallet-kit';

await manager.connect('1AM');
const adapter = manager.getActiveWallet() as OneAMWalletAdapter;

// Build providers (dust-free execution via ProofStation)
const providers = await buildOneAMProviders(adapter, {
  zkConfigBaseUrl: 'https://your-app.com/contract/compiled/your-contract',
});

// Deploy contract (zero dust needed!)
const deployed = await deployContract(providers, {
  compiledContract: yourCompiledContract,
});
console.log('Contract deployed:', deployed.contractAddress);

// Call a circuit
const result = await submitCallTx(providers, {
  compiledContract: yourCompiledContract,
  contractAddress: deployed.contractAddress,
  circuitId: 'transfer',
  args: [recipientHash, amount],
});
```

### Transaction Flow (Dust-Free)

```
Your DApp → 1AM Wallet → ProofStation
                      ↓
              1. Proves ZK circuits (~2-5s)
              2. Adds dust fees (server wallet pool)
              3. Returns finalized transaction
                      ↓
              1AM Wallet submits to Midnight chain

Total user cost: 0 NIGHT, 0 dust.
```

---

## 8. 🧪 Testing Utilities (`MockWalletAdapter`)

Built-in support for zero-dependency testing.

**Options:**
- `name`: string (default: `'Mock'`)
- `address`: string
- `coinPublicKey` / `encryptionPublicKey`: string
- `shouldFailConnect`: boolean - force connection failure
- `shouldFailSign`: boolean - force signing failure
- `signatureOverride`: string - return a fixed dummy signature
- `delay`: number (Default: `0`) - simulate latency

```typescript
import { MockWalletAdapter } from 'midnight-wallet-kit';

const mockAdapter = new MockWalletAdapter({
  name: 'TestWallet',
  address: 'mn_addr1...',
  signatureOverride: '0xmocksignature...',
  shouldFailSign: false,
});

manager.register(mockAdapter);
```

---

## 9. 🏗️ Error Codes Reference

Every error from the kit is an instance of a typed error class inheriting from `MidnightWalletError`.

| Error Code | Class | Cause |
|---|---|---|
| `WALLET_NOT_CONNECTED` | `WalletNotConnectedError` | Operation attempted without an active connection |
| `WALLET_ALREADY_CONNECTED` | `WalletAlreadyConnectedError` | Redundant connection request for an active wallet |
| `PROVIDER_NOT_FOUND` | `ProviderNotFoundError` | Extension not found in the browser window |
| `CONNECTION_REJECTED` | `ConnectionRejectedError` | User cancelled the connection request |
| `SIGNING_FAILED` | `SigningError` | Internal failure or user rejection during signing |
| `INVALID_INTENT` | `InvalidIntentError` | Parameters failed schema validation |
| `FALLBACK_EXHAUSTED` | `FallbackExhaustedError` | All adapters in a fallback list failed |
| `SESSION_EXPIRED` | `SessionExpiredError` | Session was revoked or timed out during use |
| `UNSUPPORTED_METHOD` | `UnsupportedMethodError` | Wallet mode does not support the requested method |
| `BALANCE_FETCH_FAILED` | `BalanceFetchError` | Indexer failed to return balance data |
| `MESSAGE_SIGNING_FAILED` | `MessageSigningError` | Failure during arbitrary message signing |
| `NETWORK_MISMATCH` | `NetworkMismatchError` | Wallet switched networks during an active session |

---

## 10. 🚀 Migration Guide

### From Manual Adapter Registration

**Before:**
```typescript
const manager = new WalletManager();
manager.register(new InjectedWalletAdapter({ name: 'Lace', providerKey: 'lace' }));
manager.register(new InjectedWalletAdapter({ name: '1AM', providerKey: '1am' }));
```

**After (Recommended):**
```typescript
const manager = createMidnightWalletManager();
// All 8 wallets registered automatically!
```

### Adding Wallet Detection UI

```typescript
import { detectInstalledWallets, WALLET_REGISTRY } from 'midnight-wallet-kit';

function WalletList() {
  const installed = detectInstalledWallets();
  
  return (
    <div>
      {installed.map(wallet => (
        <button key={wallet.id} onClick={() => manager.connect(wallet.id)}>
          Connect to {wallet.name}
        </button>
      ))}
    </div>
  );
}
```

---

MIT © 2026 Tushar Pamnani
