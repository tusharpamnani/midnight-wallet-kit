# Midnight Wallet Integration Guide

This document provides complete context on how to connect and interact with a Midnight-compatible wallet (like Lace) in a real-world web application. Since Midnight is a privacy-first blockchain, wallet interaction differs from "standard" Ethereum or Cardano wallets.

## 1. Prerequisites for Users

To use a Midnight application, a user typically needs:
- **Lace Wallet Extension**: Installed in their browser.
- **Midnight Network Enabled**: In Lace settings, the user must enable "Midnight" and select the `Preprod` or `Devnet` network.
- **Testnet Tokens**: (tDUST) to pay for transaction fees and state execution.

## 2. Wallet Detection

Midnight-compatible wallets inject themselves into the global `window` object. They typically appear in:
1.  **`window.midnight`**: The primary namespace for Midnight-specific features.
2.  **`window.cardano.lace`**: Often acts as a fallback for the Lace extension.

### Detection & Injection Delay
Wallet extensions can take a few moments to inject their APIs into the `window` object. It is recommended to use a polling mechanism to wait for the wallet.

```javascript
async function waitForWallets(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const wallets = detectMidnightWallets();
    if (wallets.length > 0) return wallets;
    await new Promise((r) => setTimeout(r, 200));
  }
  return [];
}
```

## 3. Connecting to the Wallet

Connecting involves calling `.enable()` on the detected wallet object. Since network selection is important in Midnight, trying to enable the `preprod` network directly is standard.

```javascript
async function connectToWallet(wallet) {
  const connector = wallet.enable || wallet.connect;
  
  try {
    // Try to enable and specify the network
    return await connector.call(wallet, 'preprod');
  } catch (err) {
    // Fallback: Some versions may not accept arguments or use connect()
    return await connector.call(wallet);
  }
}
```

## 4. The Wallet API

Once connected, the wallet returns an `api` object. The current ecosystem supports two patterns:

### Pattern A: Modern Standard (Recommended)
Used by the latest Midnight-ready Lace versions.
- `api.state()`: Returns the user's addresses and public keys.
- `api.serviceUriConfig()`: Returns the URIs for the proof server, indexer, and node that the wallet is configured to use.

### Pattern B: Alternative/Development
Found in some experimental or development builds.
- `api.getUnshieldedAddress()`: Returns the main address.
- `api.getConfiguration()`: Returns the service URIs under a configuration object.

## 5. Executing Contract Calls (Proving & Balancing)

In Midnight, the wallet extension **does not** execute smart contracts or generate ZK proofs directly. Instead, it "balances" transactions that have been proved elsewhere.

The typical workflow is:
1.  **Off-Chain Proving**: Your web app sends data to a "Proof Server" (usually running on the user's machine or a trusted server). This server generates the ZK proof and returns an **Unsealed Transaction**.
2.  **Wallet Balancing**: Your app sends this Unsealed Transaction to the wallet via `api.balanceUnsealedTransaction(tx)`. The wallet adds coin inputs/outputs for fees and signs the transaction.
3.  **Submission**: Your app sends the resulting **Sealed/Balanced Transaction** to the network via `api.submitTransaction(sealedTx)`.

### Example: Contract Interaction logic
```javascript
async function handleAction(api, unsealedTx) {
  // 1. Let the wallet balance the transaction
  const balancedTx = await api.balanceUnsealedTransaction(unsealedTx);

  // 2. Submit signed transaction to the network
  const result = await api.submitTransaction(balancedTx);

  // result usually contains a txId or hash
  return result.txId || result.hash || result;
}
```

## 6. Common Pitfalls

- **Network Mismatch**: Ensure the UI and the Wallet are both set to `preprod`.
- **Proof Server Connectivity**: The browser must be able to reach the proof server (e.g., `http://localhost:6300`).
- **Permissions**: If a user denies the connection, `enable()` will throw an error. Handle this gracefully.
- **Async Latency**: ZK-proving can take several seconds to a minute. Always provide loading states to the user.
