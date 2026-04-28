/**
 * Midnight Wallet Kit - Complete Example
 *
 * Shows how to use all supported wallets in the Midnight ecosystem.
 * This is like WalletConnect or RainbowKit, but for Midnight Network.
 */

import { WalletManager } from '../src/index.js';
import { InjectedWalletAdapter, type InjectedWalletAdapterOptions } from '../src/index.js';

// ── 1AM Wallet (Dust-Free, Native Midnight) ───────────────────────
import { OneAMWalletAdapter } from '../src/index.js';
import { buildOneAMProviders, deployContract, submitCallTx } from '../src/index.js';

// ── CIP-30 Cardano Wallets (with Midnight Support) ─────────────────
import { NuFiWalletAdapter } from '../src/index.js';
import { GeroWalletAdapter } from '../src/index.js';
import { VesprWalletAdapter } from '../src/index.js';
import { YoroiWalletAdapter } from '../src/index.js';
import { CtrlWalletAdapter } from '../src/index.js';
import { SubWalletAdapter } from '../src/index.js';

// ── Midnight-Native Wallets ──────────────────────────────────────────
import { NocturneWalletAdapter } from '../src/index.js';

// ── Mock (for testing) ──────────────────────────────────────────────
import { MockWalletAdapter } from '../src/index.js';

// ═══════════════════════════════════════════════════════════════════
// Setup WalletManager with ALL supported wallets
// ═══════════════════════════════════════════════════════════════════

const manager = new WalletManager({
  allowNetworkSwitch: false,
  networkPollMs: 30_000,
});

// Register ALL wallet adapters
// Midnight-native wallets (window.midnight.*)
manager
  .register(new OneAMWalletAdapter({ network: 'preview' }))
  .register(new NocturneWalletAdapter({ network: 'preview' }));

// CIP-30 Cardano wallets with Midnight support (window.cardano.*)
manager
  .register(new NuFiWalletAdapter())
  .register(new GeroWalletAdapter())
  .register(new VesprWalletAdapter())
  .register(new YoroiWalletAdapter())
  .register(new CtrlWalletAdapter())
  .register(new SubWalletAdapter());

// Mock wallet for testing
manager.register(new MockWalletAdapter());

// ═══════════════════════════════════════════════════════════════════
// Auto-detect and connect to first available wallet
// ═══════════════════════════════════════════════════════════════════

async function autoConnect() {
  const priorityList = [
    '1AM',        // Dust-free, best UX
    'Nocturne',   // Midnight-native
    'NuFi',       // Popular multi-chain
    'GeroWallet',  // ADA cashback + staking
    'VESPR',       // Private key control
    'Yoroi',      // Open-source, community
    'Ctrl',        // 2500+ chains
    'SubWallet',   // Polkadot + 150+ networks
  ];

  try {
    await manager.connectWithFallback(priorityList);
    console.log('Connected to:', manager.getActiveWallet().name);
  } catch (err) {
    console.error('No wallet found. Please install one:');
    console.error('- 1AM: https://1am.xyz');
    console.error('- NuFi: https://nufi.app');
    console.error('- Nocturne: https://github.com/midnightntwrk/midnight-awesome-dapps');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Connect to a specific wallet
// ═══════════════════════════════════════════════════════════════════

async function connectToWallet(walletName: string) {
  try {
    await manager.connect(walletName);
    console.log(`Connected to ${walletName}`);
  } catch (err) {
    console.error(`Failed to connect to ${walletName}:`, err);
  }
}

// Example: Connect to 1AM specifically
// connectToWallet('1AM');

// ═══════════════════════════════════════════════════════════════════
// Get wallet info
// ═══════════════════════════════════════════════════════════════════

function getWalletInfo() {
  const wallet = manager.tryGetActiveWallet();
  if (!wallet) return null;

  return {
    name: wallet.name,
    address: wallet.getAddress(),
    coinPublicKey: wallet.getCoinPublicKey(),
    encryptionPublicKey: wallet.getEncryptionPublicKey(),
    serviceUris: wallet.getServiceUris(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 1AM-Specific: Dust-Free Contract Deployment
// ═══════════════════════════════════════════════════════════════════

async function deployWith1AM() {
  // Connect to 1AM
  await manager.connect('1AM');
  const adapter = manager.getActiveWallet() as any; // OneAMWalletAdapter

  // Build providers (dust-free execution via ProofStation)
  const providers = await buildOneAMProviders(adapter, {
    zkConfigBaseUrl: 'https://your-app.com/contract/compiled/your-contract',
  });

  // Deploy contract (zero dust needed!)
  const deployed = await deployContract(providers, {
    compiledContract: {}, // Your compiled Compact contract
  });

  console.log('Contract deployed:', deployed.contractAddress);
}

// ═══════════════════════════════════════════════════════════════════
// Sign a transaction/intent (works with ALL wallets)
// ═══════════════════════════════════════════════════════════════════

async function signIntent() {
  await autoConnect();

  const intent = {
    contract: '0xabc123',
    action: 'transfer',
    params: { to: '0xdef456', amount: 100 },
    nonce: Date.now(),
    network: 'preview' as const,
  };

  const signed = await manager.signIntent(intent);
  console.log('Signed intent:', signed);
}

// ═══════════════════════════════════════════════════════════════════
// Event handling
// ═══════════════════════════════════════════════════════════════════

manager.on('onConnect', (wallet) => {
  console.log('Wallet connected:', wallet.name);
});

manager.on('onDisconnect', (walletName) => {
  console.log('Wallet disconnected:', walletName);
});

manager.on('onError', (error) => {
  console.error('Wallet error:', error);
});

manager.on('onStateChange', (state) => {
  console.log('Connection state:', state);
});

// ═══════════════════════════════════════════════════════════════════
// React Hook Usage Example
// ═══════════════════════════════════════════════════════════════════

/*
import { WalletProvider, useWallet, useConnect } from 'midnight-wallet-kit';

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourApp />
    </WalletProvider>
  );
}

function YourApp() {
  const { wallet, connected, address } = useWallet();
  const { connect, disconnect } = useConnect();

  return (
    <div>
      {connected ? (
        <>
          <p>Connected to {wallet?.name}</p>
          <p>Address: {address}</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </>
      ) : (
        <button onClick={() => connect('1AM')}>Connect 1AM</button>
      )}
    </div>
  );
}
*/

// ═══════════════════════════════════════════════════════════════════
// List all registered wallets
// ═══════════════════════════════════════════════════════════════════

console.log('Registered wallets:', manager.getRegisteredNames());
// Output: ['1am', 'nocturne', 'nufi', 'gerowallet', 'vespr', 'yoroi', 'ctrl', 'subwallet', 'mock']
