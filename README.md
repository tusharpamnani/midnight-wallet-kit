# midnight-wallet-kit

Production-grade wallet adapter system for the **Midnight Network**.

Built to eliminate the developer pain of fragile injected providers, undefined crashes, and inconsistent signing flows.

## Install

```bash
npm install midnight-wallet-kit
```

## Quick Start

```ts
import {
  WalletManager,
  InjectedWalletAdapter,
  SeedWalletAdapter,
  MockWalletAdapter,
  IntentBuilder,
} from 'midnight-wallet-kit';

const manager = new WalletManager();

// Register adapters in order of preference
manager
  .register(new InjectedWalletAdapter())
  .register(new SeedWalletAdapter('correct horse battery staple banana planet'))
  .register(new MockWalletAdapter());

// Connect with automatic fallback (Injected → Seed → Mock)
await manager.connectWithFallback(['injected', 'seed', 'mock']);

const wallet = manager.getActiveWallet();
console.log(wallet.getAddress()); // 0x...

// Build a safe, validated intent
const intent = IntentBuilder.create({
  contract: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD',
  action: 'mint',
  params: { tokenId: 42, recipient: wallet.getAddress() },
});

// Sign it
const signed = await wallet.signIntent(intent);
```

## Architecture

```
midnight-wallet-kit/
├── src/
│   ├── adapters/
│   │   ├── base.ts          # Abstract base adapter (state machine, race-condition mutex)
│   │   ├── injected.ts      # Browser extension adapter (retry, timeout, SSR-safe)
│   │   ├── seed.ts          # Local seed phrase adapter (deterministic key derivation)
│   │   └── mock.ts          # Test adapter (configurable delays & failures)
│   ├── builder/
│   │   └── intent.ts        # Safe intent builder (deep sanitization, Zod validation)
│   ├── core/
│   │   ├── manager.ts       # WalletManager (registry, fallback, events, mutex)
│   │   └── types.ts         # Shared types
│   ├── errors/
│   │   └── wallet-errors.ts # Complete error hierarchy (10 typed errors)
│   ├── hooks/
│   │   └── index.tsx         # React hooks (useWallet, useConnect, useIntent)
│   ├── validation/
│   │   └── schemas.ts       # Zod schemas + MidnightWallet interface
│   └── index.ts             # Public API
├── examples/
│   └── basic-usage.ts       # Runnable demo
└── src/index.test.ts        # 39 tests
```

## Wallet Adapters

### `InjectedWalletAdapter`

Connects to browser extensions that inject a provider at `window.midnight`.

```ts
new InjectedWalletAdapter({
  maxRetries: 5,         // retry count while waiting for injection
  retryDelayMs: 400,     // base delay (uses 1.5x backoff)
  connectTimeoutMs: 10000, // hard timeout for the entire flow
  providerKey: 'midnight', // window property name
});
```

**Defenses**: SSR guard, exponential backoff, AbortController timeout, provider shape validation.

### `SeedWalletAdapter`

Derives a deterministic keypair from a seed phrase. The seed never leaves the process.

```ts
const seed = new SeedWalletAdapter('your twelve word phrase here ...');
await seed.connect(); // derives keys locally
```

**Defenses**: Seed validation (min 3 words), deterministic signing (same intent → same signature), keys zeroed on disconnect.

### `MockWalletAdapter`

For tests and development. Configurable delays and failure simulation.

```ts
const mock = new MockWalletAdapter({
  connectDelayMs: 100,       // simulate slow connection
  shouldFailConnect: false,  // toggle connection failure
  shouldFailSign: false,     // toggle signing failure
  address: '0xcustom',       // custom address
});
```

Tracks all signed intents in `mock.signedIntents` for assertions.

### Building Your Own Adapter

Extend `BaseWalletAdapter` and implement three methods:

```ts
class MyAdapter extends BaseWalletAdapter {
  readonly name = 'MyWallet';

  protected async onConnect(): Promise<void> {
    // Your connection logic...
    this.setAddress('0x...');  // MUST call this
  }

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    // Your signing logic...
    return { intent, signature: '...', publicKey: '...', timestamp: Date.now() };
  }
}
```

The base class handles: connection state machine, race-condition mutex, address validation, idempotent disconnect.

## IntentBuilder

The safety layer between your code and the blockchain.

```ts
const intent = IntentBuilder.create({
  contract: '0xabc',
  action: 'transfer',
  params: {
    amount: 100,
    metadata: { nested: undefined }, // → sanitized to null
  },
});
```

**Guarantees**:
- Deep sanitization (undefined → null, NaN → null, circular refs → `[circular]`)
- Zod schema validation with detailed field-level error messages
- Monotonically increasing nonces (no duplicates even in the same ms)
- No `.toString()` of undefined — ever

## WalletManager

Central orchestrator with event system:

```ts
const manager = new WalletManager();

manager.on('onConnect', (wallet) => console.log(wallet.name));
manager.on('onDisconnect', (name) => console.log(name));
manager.on('onError', (error) => console.error(error));
manager.on('onStateChange', (state) => console.log(state));

// State machine: idle → connecting → connected → disconnecting → disconnected
```

**Defenses**: Operation mutex (no concurrent connect/disconnect races), auto-disconnect previous wallet, `FallbackExhaustedError` with per-adapter error details.

## React Integration

```tsx
import { WalletProvider, useWallet, useConnect, useIntent } from 'midnight-wallet-kit';

function App() {
  return (
    <WalletProvider
      manager={manager}
      autoConnect={['injected', 'seed']}  // auto-connect on mount
    >
      <WalletUI />
    </WalletProvider>
  );
}

function WalletUI() {
  const { address, isConnected } = useWallet();
  const { connect, disconnect, isLoading, error } = useConnect();
  const { buildAndSign } = useIntent();

  if (isLoading) return <p>Connecting...</p>;
  if (error) return <p>Error: {error.message}</p>;

  if (!isConnected) {
    return <button onClick={() => connect('injected')}>Connect</button>;
  }

  return (
    <div>
      <p>Connected: {address}</p>
      <button onClick={async () => {
        const signed = await buildAndSign({
          contract: '0x...',
          action: 'mint',
          params: { tokenId: 1 },
        });
        console.log(signed);
      }}>
        Mint NFT
      </button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

## Error Handling

Every error is a typed `MidnightWalletError` with a machine-readable `code`:

| Error Class | Code | When |
|---|---|---|
| `WalletNotConnectedError` | `WALLET_NOT_CONNECTED` | Calling methods before `connect()` |
| `ProviderNotFoundError` | `PROVIDER_NOT_FOUND` | Browser extension not installed |
| `ConnectionRejectedError` | `CONNECTION_REJECTED` | User rejected the connection |
| `ConnectionTimeoutError` | `CONNECTION_TIMEOUT` | Connect timed out |
| `InvalidIntentError` | `INVALID_INTENT` | IntentBuilder validation failed |
| `SigningError` | `SIGNING_FAILED` | Signing operation failed |
| `WalletAlreadyConnectedError` | `WALLET_ALREADY_CONNECTED` | Calling `connect()` twice |
| `WalletNotRegisteredError` | `WALLET_NOT_REGISTERED` | Unknown adapter name |
| `FallbackExhaustedError` | `FALLBACK_EXHAUSTED` | All fallback adapters failed |
| `InvalidSeedError` | `INVALID_SEED` | Bad seed phrase |

All errors implement `toJSON()` for structured logging and carry an `Error.cause` chain.

## Testing

```bash
npm test        # run once
npm run test:watch  # watch mode
```

## License

MIT
