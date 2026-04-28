import { WalletManager } from './core/manager.js';
import { InjectedWalletAdapter } from './adapters/injected.js';
import { OneAMWalletAdapter } from './adapters/1am.js';
import { NuFiWalletAdapter } from './adapters/nufi.js';
import { GeroWalletAdapter } from './adapters/gerowallet.js';
import { VesprWalletAdapter } from './adapters/vespr.js';
import { YoroiWalletAdapter } from './adapters/yoroi.js';
import { CtrlWalletAdapter } from './adapters/ctrl.js';
import { SubWalletAdapter } from './adapters/subwallet.js';
import { NocturneWalletAdapter } from './adapters/nocturne.js';
import type { InjectedWalletAdapterOptions } from './adapters/injected.js';
import type { OneAMWalletAdapterOptions } from './adapters/1am.js';
import type { NocturneWalletAdapterOptions } from './adapters/nocturne.js';

// ─── Wallet Info ────────────────────────────────────────────────────────

export interface WalletInfo {
  id: string;
  name: string;
  description: string;
  injectionPoint: string;
  type: 'midnight-native' | 'cip30' | 'mock';
  networks: string[];
  features: string[];
  website?: string;
  installUrl?: string;
}

export const WALLET_REGISTRY: WalletInfo[] = [
  {
    id: '1AM',
    name: '1AM Wallet',
    description: 'Dust-free wallet for Midnight Network. Zero fees via ProofStation sponsorship.',
    injectionPoint: 'window.midnight["1am"]',
    type: 'midnight-native',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['dust-free', 'shielded-balances', 'unshielded-balances', 'zk-proofs', 'proving-provider'],
    website: 'https://1am.xyz',
    installUrl: 'https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp',
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    description: 'Self-custodial Chrome extension wallet built specifically for Midnight.',
    injectionPoint: 'window.midnight.nocturne',
    type: 'midnight-native',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['shielded-balances', 'unshielded-balances', 'dust-registration', 'multi-network'],
    website: 'https://github.com/midnightntwrk/midnight-awesome-dapps',
  },
  {
    id: 'nufi',
    name: 'NuFi',
    description: 'Non-custodial wallet for storing, managing, and staking cryptocurrencies.',
    injectionPoint: 'window.cardano.nufi',
    type: 'cip30',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['staking', 'cardano-support', 'midnight-support'],
    website: 'https://nufi.app',
    installUrl: 'https://chromewebstore.google.com/detail/nufi/',
  },
  {
    id: 'gerowallet',
    name: 'GeroWallet',
    description: 'Combines Web2 and Web3 with ADA cashback, governance, staking, and swapping.',
    injectionPoint: 'window.cardano.gerowallet',
    type: 'cip30',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['cashback', 'governance', 'staking', 'swapping'],
    website: 'https://gerowallet.io',
  },
  {
    id: 'vespr',
    name: 'VESPR',
    description: 'Wallet management app for full control over Cardano private keys with dApp interaction.',
    injectionPoint: 'window.cardano.vespr',
    type: 'cip30',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['private-key-control', 'dapp-interaction', 'cardano-support'],
    website: 'https://vespr.io',
  },
  {
    id: 'yoroi',
    name: 'Yoroi Wallet',
    description: 'Community-driven, open-source wallet focused on transparency and security.',
    injectionPoint: 'window.cardano.yoroi',
    type: 'cip30',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['open-source', 'transparency', 'security'],
    website: 'https://yoroi-wallet.com',
  },
  {
    id: 'ctrl',
    name: 'Ctrl Wallet',
    description: 'Supports 2,500+ blockchains with Midnight ecosystem integration.',
    injectionPoint: 'window.cardano.ctrl',
    type: 'cip30',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['multi-chain', '2500-plus-chains', 'midnight-support'],
    website: 'https://ctrl.xyz',
  },
  {
    id: 'subwallet',
    name: 'SubWallet',
    description: 'Web3 extension wallet supporting Polkadot and 150+ other networks.',
    injectionPoint: 'window.cardano.subwallet',
    type: 'cip30',
    networks: ['preprod', 'preview', 'mainnet'],
    features: ['polkadot', '150-plus-networks', 'web3'],
    website: 'https://subwallet.app',
  },
];

// ─── Create Manager with All Wallets ─────────────────────────────────

export interface CreateManagerOptions {
  network?: string;
  only?: string[];
  skip?: string[];
  injectedOptions?: InjectedWalletAdapterOptions;
  oneAMOptions?: OneAMWalletAdapterOptions;
  nocturneOptions?: NocturneWalletAdapterOptions;
}

/**
 * Create a WalletManager pre-configured with ALL supported Midnight wallets.
 * This is the easiest way to get started - like WalletConnect or RainbowKit
 * but for Midnight Network.
 *
 * @example
 * const manager = createMidnightWalletManager();
 * // Now manager has all 8 wallets registered
 * await manager.connectWithFallback(['1AM', 'NuFi', 'Nocturne']);
 */
export function createMidnightWalletManager(options?: CreateManagerOptions): WalletManager {
  const {
    network = 'preprod',
    only,
    skip = [],
    injectedOptions = {},
    oneAMOptions = {},
    nocturneOptions = {},
  } = options || {};

  const manager = new WalletManager();

  const shouldRegister = (id: string) => {
    if (only && !only.map(s => s.toLowerCase()).includes(id.toLowerCase())) return false;
    if (skip.map(s => s.toLowerCase()).includes(id.toLowerCase())) return false;
    return true;
  };

  // Midnight-native wallets (window.midnight.*)
  if (shouldRegister('1AM')) {
    manager.register(new OneAMWalletAdapter({ ...oneAMOptions, network: (oneAMOptions as any).network || network }));
  }

  if (shouldRegister('nocturne')) {
    manager.register(new NocturneWalletAdapter({ ...nocturneOptions, network: (nocturneOptions as any).network || network }));
  }

  // CIP-30 Cardano wallets with Midnight support (window.cardano.*)
  if (shouldRegister('nufi')) {
    manager.register(new NuFiWalletAdapter(injectedOptions));
  }

  if (shouldRegister('gerowallet')) {
    manager.register(new GeroWalletAdapter(injectedOptions));
  }

  if (shouldRegister('vespr')) {
    manager.register(new VesprWalletAdapter(injectedOptions));
  }

  if (shouldRegister('yoroi')) {
    manager.register(new YoroiWalletAdapter(injectedOptions));
  }

  if (shouldRegister('ctrl')) {
    manager.register(new CtrlWalletAdapter(injectedOptions));
  }

  if (shouldRegister('subwallet')) {
    manager.register(new SubWalletAdapter(injectedOptions));
  }

  return manager;
}

/**
 * Get wallet info by ID
 */
export function getWalletInfo(id: string): WalletInfo | undefined {
  return WALLET_REGISTRY.find(w => w.id.toLowerCase() === id.toLowerCase());
}

/**
 * Get all registered wallet IDs
 */
export function getRegisteredWalletIds(): string[] {
  return WALLET_REGISTRY.map(w => w.id);
}

/**
 * Check which wallets are installed (available in window)
 */
export function detectInstalledWallets(): WalletInfo[] {
  if (typeof window === 'undefined') return [];

  const installed: WalletInfo[] = [];

  for (const wallet of WALLET_REGISTRY) {
    let isInstalled = false;

    if (wallet.injectionPoint.startsWith('window.midnight')) {
      const key = wallet.id === '1AM' ? '1am' : wallet.id;
      isInstalled = !!(window as any).midnight?.[key];
    } else if (wallet.injectionPoint.startsWith('window.cardano')) {
      const key = wallet.id === 'nufi' ? 'nufi' :
                  wallet.id === 'gerowallet' ? 'gerowallet' :
                  wallet.id === 'vespr' ? 'vespr' :
                  wallet.id === 'yoroi' ? 'yoroi' :
                  wallet.id === 'ctrl' ? 'ctrl' :
                  wallet.id === 'subwallet' ? 'subwallet' : wallet.id;
      isInstalled = !!(window as any).cardano?.[key];
    }

    if (isInstalled) {
      installed.push(wallet);
    }
  }

  return installed;
}
