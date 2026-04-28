# Midnight Wallet Kit

Production-grade wallet integration kit for the **Midnight Network**. Supports ALL major wallets in the Midnight ecosystem with a unified, type-safe API.

---

## 🎯 Supported Wallets

| Wallet | Type | Dust-Free | Shielded Balances | Networks | Install |
|--------|------|-----------|-------------------|----------|--------|
| **1AM** | Midnight-Native | ✅ | ✅ | preview, preprod, mainnet | [Chrome](https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp) |
| **Nocturne** | Midnight-Native | ❌ | ✅ | preview, preprod, mainnet | [GitHub](https://github.com/midnightntwrk/midnight-awesome-dapps) |
| **NuFi** | CIP-30 | ❌ | ❌ | preview, preprod, mainnet | [Website](https://nufi.app) |
| **GeroWallet** | CIP-30 | ❌ | ❌ | preview, preprod, mainnet | [Website](https://gerowallet.io) |
| **VESPR** | CIP-30 | ❌ | ❌ | preview, preprod, mainnet | [Website](https://vespr.io) |
| **Yoroi** | CIP-30 | ❌ | ❌ | preview, preprod, mainnet | [Website](https://yoroi-wallet.com) |
| **Ctrl** | CIP-30 | ❌ | ❌ | preview, preprod, mainnet | [Website](https://ctrl.xyz) |
| **SubWallet** | CIP-30 | ❌ | ❌ | preview, preprod, mainnet | [Website](https://subwallet.app) |

---

## 🚀 Key Features

- **🛡️ Resilient Probing**: Exhaustively searches for working RPC methods across different provider standards
- **🔐 Dust-Free Execution**: 1AM wallet + ProofStation sponsors all fees (zero dust needed)
- **🏗️ Safe Intent Builder**: Automatic sanitization and Zod-backed validation
- **⚛️ First-Class React Support**: Hooks (`useWallet`, `useConnect`, `useIntent`, `useBalance`)
- **📋 Wallet Registry**: Pre-configured registry of all 8 supported wallets
- **🧪 Simplified Unit Testing**: Mock adapter included

---

## 📦 Install

```bash
npm install midnight-wallet-kit
```

---

## ⚡ Quick Start (Easiest Way)

```typescript
import { createMidnightWalletManager } from 'midnight-wallet-kit';

// Creates a manager with ALL 8 wallets pre-registered
const manager = createMidnightWalletManager({
  network: 'preprod', // default network for Midnight-native wallets
});

// Connect to the first available wallet (tries 1AM → Nocturne → NuFi → ...)
await manager.connectWithFallback([
  '1AM',        // Dust-free, best UX
  'Nocturne',   // Midnight-native
  'NuFi',       // Popular multi-chain
  'GeroWallet',
  'VESPR',
  'Yoroi',
  'Ctrl',
  'SubWallet',
]);
```

---

## 🔧 Advanced: Select Specific Wallets

```typescript
import { createMidnightWalletManager } from 'midnight-wallet-kit';

// Only register specific wallets
const manager = createMidnightWalletManager({
  only: ['1AM', 'NuFi', 'Nocturne'],
});

// Or skip specific wallets
const manager = createMidnightWalletManager({
  skip: ['SubWallet', 'Ctrl'],
});
```

---

## ⚛️ React Integration

```tsx
import { WalletProvider, useWallet, useConnect, useBalance } from 'midnight-wallet-kit';

function App() {
  return (
    <WalletProvider manager={manager} autoRestore={true}>
      <YourApp />
    </WalletProvider>
  );
}

function YourApp() {
  const { address, isConnected } = useWallet();
  const { connect, disconnect } = useConnect();
  const { balance } = useBalance();

  if (!isConnected) {
    return <button onClick={() => connect('1AM')}>Connect 1AM</button>;
  }

  return (
    <div>
      <p>Address: {address}</p>
      <p>Balance: {balance?.tDUST?.toString() || '0'} tDUST</p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

---

## 🏗️ 1AM-Specific: Dust-Free Contract Deployment

```typescript
import { OneAMWalletAdapter, buildOneAMProviders, deployContract } from 'midnight-wallet-kit';

// Connect to 1AM (dust-free execution)
await manager.connect('1AM');
const adapter = manager.getActiveWallet() as OneAMWalletAdapter;

// Build providers (ProofStation sponsors fees)
const providers = await buildOneAMProviders(adapter, {
  zkConfigBaseUrl: 'https://your-app.com/contract/compiled/your-contract',
});

// Deploy contract (zero dust needed!)
const deployed = await deployContract(providers, {
  compiledContract: yourCompiledContract,
});
console.log('Contract deployed:', deployed.contractAddress);
```

---

## 📝 Available Adapters

```typescript
import {
  OneAMWalletAdapter,      // 1AM - Dust-free
  NocturneWalletAdapter,   // Nocturne - Midnight-native
  NuFiWalletAdapter,        // NuFi
  GeroWalletAdapter,        // GeroWallet
  VesprWalletAdapter,       // VESPR
  YoroiWalletAdapter,       // Yoroi
  CtrlWalletAdapter,        // Ctrl
  SubWalletAdapter,         // SubWallet
  InjectedWalletAdapter,    // Generic CIP-30/Midnight
  MockWalletAdapter,         // Testing
} from 'midnight-wallet-kit';
```

---

## 🧪 Testing

```typescript
import { MockWalletAdapter } from 'midnight-wallet-kit';

const mockAdapter = new MockWalletAdapter({
  name: 'TestWallet',
  shouldFail: false,
});
```

---

## 📚 Full API Reference

For complete documentation, see **[DOCS.md](./DOCS.md)**.

---

MIT © 2026 Tushar Pamnani
