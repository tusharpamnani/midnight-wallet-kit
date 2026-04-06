# 🌌 midnight-wallet-kit

Production-grade wallet integration kit for the **Midnight Network**.

Built to eliminate the friction of fragile injected providers, inconsistent signing flows, and complex ZK-transaction state management. Midnight Wallet Kit provides a resilient, type-safe abstraction for DApp developers to interact with browser extensions (Lace, 1AM) and hardware wallets.

---

## 🚀 Key Features

- **🛡️ Resilient Probing**: Exhaustively searches for working RPC methods across different provider standards with deep payload fallbacks.
- **🔄 Session Persistence**: Built-in `autoRestore` support to keep users connected across page refreshes.
- **🏗️ Safe Intent Builder**: Automatic sanitization and Zod-backed validation for contract intents.
- **⚛️ First-Class React Support**: Intuition-led hooks (`useWallet`, `useConnect`, `useIntent`, `useBalance`) with SSR/Hydration safety.

## 📦 Install

```bash
npm install midnight-wallet-kit
```

## ⚡ Quick Start

### 1. Initialize the Manager

```ts
import { WalletManager, InjectedWalletAdapter } from 'midnight-wallet-kit';

const manager = new WalletManager();

// Register adapters (Registry is case-insensitive internally)
manager
  .register(new InjectedWalletAdapter({ name: 'Lace', providerKey: 'lace' }))
  .register(new InjectedWalletAdapter({ name: '1AM', providerKey: 'midnight' }));
```

### 2. React Provider Setup

```tsx
import { WalletProvider } from 'midnight-wallet-kit/react';

function App({ children }) {
  return (
    <WalletProvider 
      manager={manager} 
      // prioritization order for mount-time connection fallback
      autoConnect={['1AM', 'Lace']} 
      // automatically reconnect the last-used wallet
      autoRestore={true}
    >
      {children}
    </WalletProvider>
  );
}
```

### 3. Basic Usage (Hooks)

```tsx
import { useWallet, useConnect, useIntent, useBalance } from 'midnight-wallet-kit/react';

export function WalletProfile() {
  const { address, isConnected, connectionState } = useWallet();
  const { connect, disconnect } = useConnect();
  const { balance } = useBalance();

  if (!isConnected) {
    return <button onClick={() => connect('1AM')}>Connect 1AM Wallet</button>;
  }

  return (
    <div className="profile">
      <p>Address: <code>{address}</code></p>
      <p>Balance: {balance?.tDUST?.toString() || '0'} tDUST</p>
      <button onClick={disconnect}>Disconnect Account</button>
    </div>
  );
}
```

## 📖 Advanced Usage

### 📝 Resilient Data Signing
The kit provides a high-level `signMessage` hook which automatically handles the complex multi-step probing for data-signing, adds proper prefixes, and generates unique timestamps.

```tsx
const { signMessage } = useIntent();

const handleLogin = async () => {
  // Timestamping and normalization happen automatically in the kit
  const signed = await signMessage("Login to My DApp");
  console.log("Public Key:", signed.publicKey);
  console.log("Verified Signature:", signed.signature);
};
```

### 🔌 Intercepting with Middleware
```ts
manager.use(async (ctx, next) => {
  console.log(`📡 Starting ${ctx.operation} on ${ctx.adapterName}`);
  await next();
  if (ctx.error) console.error('❌ Operation Failed:', ctx.error);
});
```

### 🧪 Simplified Unit Testing
```ts
import { MockWalletAdapter } from 'midnight-wallet-kit/testing';

const adapter = new MockWalletAdapter({ 
  name: 'TestWallet',
  address: 'mn_addr1...',
  signatureOverride: '0xmocksignature...',
  shouldRejectSign: false 
});
```

## 📚 Full API Reference
For a complete breakdown of every interface, error code, and adapter configuration, please see the **[Technical Documentation](./DOCS.md)**.

---
MIT © 2026 Midnight Network
