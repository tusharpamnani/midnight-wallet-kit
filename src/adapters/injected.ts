import { BaseWalletAdapter } from './base.js';
import {
  ProviderNotFoundError,
  ConnectionRejectedError,
  ConnectionTimeoutError,
  SigningError,
  wrapError,
} from '../errors/wallet-errors.js';
import type {
  MidnightIntent,
  SignedIntent,
  UnsealedTransaction,
  SealedTransaction,
  SubmitTransactionResult,
  ServiceUriConfig,
} from '../validation/schemas.js';

/** Shape of the wallet API returned after .enable() */
interface MidnightApi {
  // Standard API
  state?(): Promise<{ 
    address: string;
    coinPublicKey?: string;
    encryptionPublicKey?: string;
  }>;
  serviceUriConfig?(): Promise<ServiceUriConfig>;
  
  // Alternative/Older API
  getUnshieldedAddress?(): Promise<any>;
  getConfiguration?(): Promise<any>;

  // Common
  balanceUnsealedTransaction(tx: UnsealedTransaction): Promise<SealedTransaction>;
  submitTransaction(tx: SealedTransaction): Promise<SubmitTransactionResult>;
  request?(args: { method: string; params?: unknown }): Promise<unknown>;
  disconnect?(): Promise<void>;
}

/** Shape of the injected entry point */
interface InjectedWallet {
  enable(network?: string): Promise<MidnightApi>;
  connect?(network?: string): Promise<MidnightApi>;
}

export interface InjectedWalletAdapterOptions {
  /** Maximum retry attempts when waiting for the provider to appear (default: 10) */
  maxRetries?: number;
  /** Milliseconds between retries (default: 200) */
  retryDelayMs?: number;
  /** Hard timeout for the entire connect() call in ms (default: 15_000) */
  connectTimeoutMs?: number;
  /** Manual provider key if you want to skip generic discovery */
  providerKey?: string;
  /** Human-readable name (default: 'Injected') */
  name?: string;
}

const DEFAULTS: Required<InjectedWalletAdapterOptions> = {
  maxRetries: 10,
  retryDelayMs: 200,
  connectTimeoutMs: 15_000,
  providerKey: '',
  name: 'Injected',
};

export class InjectedWalletAdapter extends BaseWalletAdapter {
  public readonly name: string;
  private readonly opts: Required<InjectedWalletAdapterOptions>;
  private api: MidnightApi | null = null;

  constructor(options?: InjectedWalletAdapterOptions) {
    super();
    this.opts = { ...DEFAULTS, ...options };
    this.name = this.opts.name;
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  private normalizeAddress(addr: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      return addr.unshieldedAddress || addr.address || addr.bech32 || JSON.stringify(addr);
    }
    return String(addr);
  }

  private detectWallets(): { id: string; wallet: InjectedWallet }[] {
    if (typeof globalThis.window === 'undefined') return [];
    
    const win = globalThis.window as any;
    const wallets: { id: string; wallet: InjectedWallet }[] = [];

    // TRAP: Lace Cardano can shadow Lace Midnight. 
    // We must check window.midnight.* FIRST and exclusively for known Midnight IDs.
    
    // 1. Scan window.midnight.*
    if (win.midnight && typeof win.midnight === 'object') {
      // Direct check for 'lace' in case it's not enumerable
      if (win.midnight.lace && (win.midnight.lace.enable || win.midnight.lace.connect)) {
        if (!wallets.find(w => w.id === 'lace')) {
          console.log(`[InjectedWalletAdapter] Found "lace" directly in window.midnight`);
          wallets.push({ id: 'lace', wallet: win.midnight.lace });
        }
      }

      Object.entries(win.midnight).forEach(([id, wallet]: [string, any]) => {
        if (wallet && (wallet.enable || wallet.connect)) {
          // Standard discovery
          if (!wallets.find(w => w.id === id)) {
            console.log(`[InjectedWalletAdapter] Found Midnight provider in window.midnight: ${id}`);
            wallets.push({ id, wallet });
          }
        }
      });
    }

    // 2. Scan window.cardano.* for .midnight sub-properties
    if (win.cardano && typeof win.cardano === 'object') {
      Object.entries(win.cardano).forEach(([id, entry]: [string, any]) => {
        if (entry?.midnight && (entry.midnight.enable || entry.midnight.connect)) {
          if (!wallets.find(w => w.id === id)) {
            console.log(`[InjectedWalletAdapter] Found Midnight sub-provider for "${id}" in window.cardano.${id}.midnight`);
            wallets.push({ id, wallet: entry.midnight });
          }
        }
      });
    }

    return wallets;
  }

  private async waitForFoundWallet(): Promise<{ id: string; wallet: InjectedWallet }> {
    const targetId = this.opts.providerKey?.toLowerCase() || '';

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      const wallets = this.detectWallets();
      
      if (targetId) {
        // Try exact match vs normalized ID
        const found = wallets.find(w => w.id.toLowerCase() === targetId);
        if (found) return found;
        
        // Try fuzzy match (e.g. "lace" matches "be54f7ce...lace...") or if the wallet metadata matches
        const fuzzy = wallets.find(w => 
          w.id.toLowerCase().includes(targetId) || 
          (w.wallet as any).name?.toLowerCase().includes(targetId) ||
          (w.wallet as any).id?.toLowerCase().includes(targetId)
        );
        if (fuzzy) return fuzzy;
      } else if (wallets.length > 0) {
        return wallets[0]!;
      }

      if (attempt < this.opts.maxRetries) {
        await new Promise((r) => setTimeout(r, this.opts.retryDelayMs));
      }
    }

    throw new ProviderNotFoundError(
      this.opts.providerKey ? `Wallet "${this.opts.providerKey}"` : 'Any Midnight wallet',
      this.opts.maxRetries,
    );
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => {
      timeoutController.abort();
    }, this.opts.connectTimeoutMs);

    try {
      const walletEntry = await this.waitForFoundWallet();
      const wallet = walletEntry.wallet;
      const actualId = walletEntry.id;

      const connector = wallet.enable || wallet.connect;
      if (!connector) throw new ConnectionRejectedError(`Wallet "${actualId}" has no connection method.`);

      // Try preprod first, then fallback
      try {
        this.api = await connector.call(wallet, 'preprod');
      } catch (err) {
        console.warn(`[InjectedWalletAdapter] Preprod connection failed for "${actualId}", trying default.`, err);
        this.api = await connector.call(wallet);
      }

      if (!this.api) throw new ConnectionRejectedError(`Wallet "${actualId}" returned no API.`);

      console.log(`[InjectedWalletAdapter] Connected to "${actualId}", API keys:`, Object.keys(this.api));

      let address = '';
      let coinPublicKey: string | null = null;
      let encryptionPublicKey: string | null = null;
      let serviceUris: ServiceUriConfig = {
        proofServerUri: '',
        indexerUri: '',
        nodeUri: '',
        networkId: '',
      };

      // 1. Try Standard Standard API (state / serviceUriConfig)
      if (typeof this.api.state === 'function') {
        const [state, uris] = await Promise.all([
          this.api.state(),
          typeof this.api.serviceUriConfig === 'function' ? this.api.serviceUriConfig() : Promise.resolve(undefined),
        ]);
        
        address = state.address;
        coinPublicKey = state.coinPublicKey ?? null;
        encryptionPublicKey = state.encryptionPublicKey ?? null;
        if (uris) serviceUris = uris;
      } 
      // 2. Try Older/Alternative API
      else if (typeof (this.api as any).getUnshieldedAddress === 'function') {
        const [rawAddr, config] = await Promise.all([
          (this.api as any).getUnshieldedAddress(),
          (this.api as any).getConfiguration ? (this.api as any).getConfiguration() : Promise.resolve({}),
        ]);
        
        address = this.normalizeAddress(rawAddr);
        serviceUris = {
          proofServerUri: config.proofServerUri || config.proverServerUri || '',
          indexerUri: config.indexerUri || config.indexServerUri || '',
          nodeUri: config.nodeUri || config.nodeServerUri || '',
          networkId: config.networkId || '',
        };
      } else {
        throw new ConnectionRejectedError(`Wallet "${actualId}" has no recognized state or address methods.`);
      }

      this.setWalletDetails({
        address,
        coinPublicKey,
        encryptionPublicKey,
        serviceUris,
      });

    } catch (err) {
      this.api = null;
      throw wrapError(err, 'Failed to connect injected wallet.');
    } finally {
      clearTimeout(timeout);
    }
  }

  protected override async onDisconnect(): Promise<void> {
    if (this.api?.disconnect) {
      try {
        await this.api.disconnect();
      } catch (err) {
        console.warn(`[InjectedWalletAdapter] Disconnect error:`, err);
      }
    }
    this.api = null;
  }

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.isConnected() || !this.api) throw new SigningError('Not connected.');

    try {
      if (this.api.request) {
        const result = await this.api.request({
          method: 'midnight_signIntent',
          params: { intent },
        }) as { signature: string; publicKey: string };

        return {
          intent,
          signature: result.signature,
          publicKey: result.publicKey,
          timestamp: Date.now(),
        };
      }
      throw new SigningError('Method signIntent not supported by provider.');
    } catch (err) {
      throw wrapError(err, 'Signing failed.');
    }
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    if (!this.isConnected() || !this.api) throw new Error('Not connected.');
    try {
      return await this.api.balanceUnsealedTransaction(unsealed);
    } catch (err) {
      throw wrapError(err, 'Balancing failed.');
    }
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    if (!this.isConnected() || !this.api) throw new Error('Not connected.');
    try {
      const res = await this.api.submitTransaction(sealed) as any;
      return res.txId || res.hash || res;
    } catch (err) {
      throw wrapError(err, 'Submission failed.');
    }
  }
}
