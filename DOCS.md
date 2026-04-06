# 📖 Technical Documentation

Detailed documentation for the **Midnight Wallet Kit** architecture, API, and best practices.

---

## 1. 🏗️ Core Architecture

Midnight Wallet Kit follows a clean, event-driven architecture that separates wallet-specific communication from application-level state management.

### 🛡️ Layer 1: Adapters
Adapters handle physical or injected provider communication. Every adapter implements the `MidnightWallet` interface, ensuring a consistent contract.

**Modes:**
- `intent-signing`: Supports the `signIntent()` flow (standard for DApps).
- `tx-only`: Direct transaction balancing and submission only.
- `unknown`: Handled defensively as a fallback.

### 🛂 Layer 2: WalletManager
The central orchestrator that manages:
- **Registry & Lifecycle**: Connection status transitions: `idle`, `connecting`, `restoring`, `connected`, `error`, `disconnecting`, `disconnected`.
- **Case-Insensitive Naming**: All adapter names are normalized to lowercase during registration and lookup.
- **Fallback Chains**: Automated retry sequence for multiple registered adapters.
- **Middleware**: A global interception system for logging, analytics, or transaction modification.
- **Session Persistence**: Automatic restoration of the last-connected wallet across page refreshes.

---

## 2. 🔌 WalletManager API Reference

### `register(wallet: MidnightWallet): this`
Registers a new adapter. Names are case-insensitive.

### `async connect(name: string): Promise<void>`
Connects to the specified adapter. Automatically disconnects the current active wallet first.

### `async connectWithFallback(priorityList: string[]): Promise<void>`
Attempts connection to adapters in the specified order. Throws `FallbackExhaustedError` if all fail.

### `async autoRestore(): Promise<void>`
Attempts to re-establish the session with the last-active wallet stored in `localStorage`.

### `use(middleware: Middleware): this`
Adds a global interceptor. Note: **Disconnect** is fully interceptable. Context includes:
- `operation`: `'connect'`, `'disconnect'`, `'signIntent'`, or `'signMessage'`.
- `adapterName`: string
- `intent`: MidnightIntent (if applicable)
- `result`: Outcome value (if applicable)
- `error`: Thrown Error (if applicable)

---

## ⚛️ React Library Reference

### `WalletProvider` Props
| Prop | Type | Description |
|---|---|---|
| `manager` | `WalletManager` | The core manager instance. |
| `autoConnect` | `string[]` | Optional. Triggers `connectWithFallback()` on client mount. |
| `autoRestore` | `boolean` | Default `true`. Triggers `autoRestore()` on client mount. |

### `useWallet()`
Returns the complete state of the currently active wallet.
- `address`: string | null
- `coinPublicKey`: string | null
- `encryptionPublicKey`: string | null
- `isConnected`: boolean
- `connectionState`: `idle` | `connecting` | `restoring` | `connected` | `error` | `disconnecting` | `disconnected`
- `error`: Last thrown error instance or `null`

### `useConnect()`
Methods to manage the connection lifecycle.
- `connect(name: string)`: Asynchronous connection handler.
- `disconnect()`: Cleanly shuts down the active wallet. Interceptable via middleware.
- `isLoading`: Track connection progress.
- `adapters`: List of all registered adapters names.

### `useIntent()`
High-level contract intent and message signing.
- `buildAndSign(params: IntentParams)`: Validates, sanitizes, and signs a contract intent.
- `signMessage(message: string)`: Signs an arbitrary string. The kit automatically handles timestamping and normalization.

### `useBalance()`
Hook for fetching and tracking the balance of the connected wallet.
- `balance`: `{ tDUST: bigint; shielded: bigint } | null`
- `isLoading`: Track fetching or polling progress.
- `error`: `BalanceFetchError` if the indexer query fails.
- `refetch()`: Manually trigger a balance update.
*Note: Automatically polls every 15 seconds when connected.*

---

## 🧪 Testing Utilities (`MockWalletAdapter`)

Built-in support for zero-dependency testing.

**Options:**
- `address`: string
- `coinPublicKey` / `encryptionPublicKey`: string
- `signDelay`: number (Default: `0`) - simulate latency.
- `shouldRejectConnect`: boolean - force connection failure.
- `shouldRejectSign`: boolean - force signing failure.
- `signatureOverride`: string - return a fixed dummy signature.

---

## 🏗️ Error Codes Reference

Every error from the kit is an instance of a typed error class inheriting from `MidnightWalletError`.

| Error Code | Class | Cause |
|---|---|---|
| `WALLET_NOT_CONNECTED` | `WalletNotConnectedError` | Operation attempted without an active connection. |
| `WALLET_ALREADY_CONNECTED` | `WalletAlreadyConnectedError` | Redundant connection request for an active wallet. |
| `PROVIDER_NOT_FOUND` | `ProviderNotFoundError` | Extension not found in the browser window. |
| `CONNECTION_REJECTED` | `ConnectionRejectedError` | User cancelled the connection request. |
| `SIGNING_FAILED` | `SigningError` | Internal failure or user rejection during signing. |
| `INVALID_INTENT` | `InvalidIntentError` | Parameters failed schema validation. |
| `FALLBACK_EXHAUSTED` | `FallbackExhaustedError` | All adapters in a fallback list failed. |
| `SESSION_EXPIRED` | `SessionExpiredError` | Session was revoked or timed out during use. |
| `UNSUPPORTED_METHOD` | `UnsupportedMethodError` | Wallet mode does not support the requested method. |
| `BALANCE_FETCH_FAILED` | `BalanceFetchError` | Indexer failed to return balance data. |
| `MESSAGE_SIGNING_FAILED` | `MessageSigningError` | Failure during arbitrary message signing. |
| `NETWORK_MISMATCH` | `NetworkMismatchError` | Wallet switched networks during an active session. |

---
MIT © 2026 Midnight Network
