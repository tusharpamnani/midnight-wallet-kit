# Midnight Wallet Kit — Next.js Demo

A fully interactive demo showcasing **midnight-wallet-kit** in a Next.js App Router project.

## What's demonstrated

| Feature | Hook / API |
|---|---|
| Wallet connection lifecycle | `useConnect()` |
| Active wallet state | `useWallet()` |
| Intent building & signing | `useIntent()` |
| Real-time event log | `manager.on(…)` |
| Auto-connect on mount | `<WalletProvider autoConnect={…}>` |
| Adapter switching | `useConnect().connect(name)` |
| Error handling | Built-in error surfaces |

## Getting started

```bash
cd examples/nextjs-demo
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project structure

```
app/
├── layout.tsx        # Root layout with fonts & metadata
├── globals.css       # Design system (dark mode, glassmorphism)
├── page.tsx          # Server component entry
├── providers.tsx     # WalletManager setup + WalletProvider
├── dashboard.tsx     # Interactive client component
└── page.module.css   # Scoped component styles
```

## Adapters used

This demo registers two adapters that work without a browser wallet:

- **MockWalletAdapter** — deterministic, instant (800ms simulated delay)
- **SeedWalletAdapter** — derives keys from a mnemonic phrase

In a real app, you'd also register `InjectedWalletAdapter` for browser extension wallets.

## Learn more

- [midnight-wallet-kit on npm](https://www.npmjs.com/package/midnight-wallet-kit)
- [Next.js Documentation](https://nextjs.org/docs)
