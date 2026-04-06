import { BaseWalletAdapter } from './base.js';
import {
  ProviderNotFoundError,
  ConnectionRejectedError,
  ConnectionTimeoutError,
  SigningError,
  SessionExpiredError,
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
import { isBrowser } from '../utils/env.js';

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

/** Specific classification of wallet's functional capabilities */
export type WalletMode = 'intent-signing' | 'tx-only' | 'unknown';

/** Shape of the injected entry point in window.midnight */
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

/**
 * Production-grade adapter for injected Midnight wallets (Lace, 1AM, etc.).
 * Implements capability detection and resilient signing logic.
 * SSR-safe: returns empty discovery on server.
 */
export class InjectedWalletAdapter extends BaseWalletAdapter {
  public readonly name: string;
  private readonly opts: Required<InjectedWalletAdapterOptions>;
  private api: MidnightApi | null = null;
  private mode: WalletMode = 'unknown';

  constructor(options?: InjectedWalletAdapterOptions) {
    super();
    this.opts = { ...DEFAULTS, ...options };
    this.name = this.opts.name;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalizeAddress(addr: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      return addr.unshieldedAddress || addr.address || addr.bech32 || JSON.stringify(addr);
    }
    return String(addr);
  }

  private async safeRequest(method: string, params: any): Promise<any | null> {
    if (!this.api?.request) return null;

    try {
      return await this.api.request({ method, params });
    } catch (err: any) {
      const msg = (err?.message || String(err)).toLowerCase();
      if (msg.includes('not implemented')) return null;
      throw err;
    }
  }

  private detectWallets(): { id: string; wallet: InjectedWallet }[] {
    if (!isBrowser) return [];

    const win = globalThis.window as any;
    const wallets: { id: string; wallet: InjectedWallet }[] = [];

    if (win.midnight && typeof win.midnight === 'object') {
      if (win.midnight.lace && (win.midnight.lace.enable || win.midnight.lace.connect)) {
        wallets.push({ id: 'lace', wallet: win.midnight.lace });
      }
      Object.entries(win.midnight).forEach(([id, wallet]: [string, any]) => {
        if (wallet && (wallet.enable || wallet.connect) && !wallets.find(w => w.id === id)) {
          wallets.push({ id, wallet });
        }
      });
    }

    if (win.cardano && typeof win.cardano === 'object') {
      Object.entries(win.cardano).forEach(([id, entry]: [string, any]) => {
        if (entry?.midnight && (entry.midnight.enable || entry.midnight.connect) && !wallets.find(w => w.id === id)) {
          wallets.push({ id, wallet: entry.midnight });
        }
      });
    }

    return wallets;
  }

  private async waitForFoundWallet(): Promise<{ id: string; wallet: InjectedWallet }> {
    const targetId = this.opts.providerKey?.toLowerCase() || '';
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      const wallets = this.detectWallets();
      const found = targetId
        ? wallets.find(w => w.id.toLowerCase() === targetId || w.id.toLowerCase().includes(targetId))
        : wallets[0];

      if (found) return found;
      if (attempt < this.opts.maxRetries) await new Promise((r) => setTimeout(r, this.opts.retryDelayMs));
    }
    throw new ProviderNotFoundError(targetId || 'Any Midnight wallet', this.opts.maxRetries);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    if (!isBrowser) throw new Error('InjectedWalletAdapter cannot connect on the server.');

    const timeout = setTimeout(() => { }, this.opts.connectTimeoutMs);
    try {
      const { id, wallet } = await this.waitForFoundWallet();
      const connector = wallet.enable || wallet.connect;
      if (!connector) throw new ConnectionRejectedError(`Wallet "${id}" has no connection method.`);

      try {
        this.api = await connector.call(wallet, 'preprod');
      } catch (err: any) {
        // Feature: Detect if the session was revoked/expired during a reconnect attempt
        const msg = (err?.message || String(err)).toLowerCase();
        if (msg.includes('revoked') || msg.includes('expired') || msg.includes('unauthorized')) {
          throw new SessionExpiredError(id);
        }
        this.api = await connector.call(wallet);
      }

      if (!this.api) throw new ConnectionRejectedError(`Wallet "${id}" returned no API.`);

      this.detectCapabilities();

      let address = '';
      let coinPublicKey: string | null = null;
      let encryptionPublicKey: string | null = null;
      let serviceUris: ServiceUriConfig | null = null;

      if (typeof this.api.state === 'function') {
        const state = await this.api.state();
        address = state.address;
        coinPublicKey = state.coinPublicKey ?? null;
        encryptionPublicKey = state.encryptionPublicKey ?? null;
        if (typeof this.api.serviceUriConfig === 'function') {
          serviceUris = await this.api.serviceUriConfig();
        }
      } else if (typeof (this.api as any).getUnshieldedAddress === 'function') {
        const rawAddr = await (this.api as any).getUnshieldedAddress();
        address = this.normalizeAddress(rawAddr);
        if (typeof (this.api as any).getConfiguration === 'function') {
          const config = await (this.api as any).getConfiguration();
          serviceUris = {
            proofServerUri: config.proofServerUri || config.proverServerUri || '',
            indexerUri: config.indexerUri || config.indexServerUri || '',
            nodeUri: config.nodeUri || config.nodeServerUri || '',
            networkId: config.networkId || '',
          };
        }
      }

      this.setWalletDetails({ address, coinPublicKey, encryptionPublicKey, serviceUris });
    } catch (err) {
      this.api = null;
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  protected override async onDisconnect(): Promise<void> {
    if (this.api?.disconnect) await this.api.disconnect().catch(() => { });
    this.api = null;
    this.mode = 'unknown';
  }

  // ── Capabilities ──────────────────────────────────────────────────────────

  private detectCapabilities(): void {
    if (!this.api) return;
    const hasRpc = typeof this.api.request === 'function';
    const hasDirectSign = ['signIntent', 'signData'].some(m => typeof (this.api as any)[m] === 'function');
    const hasTxFlow = typeof this.api.balanceUnsealedTransaction === 'function';

    if (hasRpc || hasDirectSign) this.mode = 'intent-signing';
    else if (hasTxFlow) this.mode = 'tx-only';
    else this.mode = 'unknown';
  }

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.api) throw new SigningError('Not connected.');
    if (this.mode === 'tx-only') throw new SigningError('Wallet only supports direct transaction flows.');

    const jsonIntent = JSON.parse(JSON.stringify(intent));
    let result: any = null;

    const stringified = JSON.stringify(jsonIntent);
    const paramsOptions = [
      [stringified, { encoding: 'text' }],
      { data: stringified, encoding: 'text' },
      [{ data: stringified, encoding: 'text' }],
      [jsonIntent],
      jsonIntent,
      { intent: jsonIntent }
    ];

    if (this.api.request) {
      const methods = ['midnight_signIntent', 'midnight_signData', 'signIntent', 'signData'];
      for (const method of methods) {
        for (const params of paramsOptions) {
          result = await this.safeRequest(method, params);
          if (result) break;
        }
        if (result) break;
      }
    }

    if (!result) {
      const direct = ['signIntent', 'signData'];
      for (const m of direct) {
        const fn = (this.api as any)[m];
        if (typeof fn === 'function') {
          for (const params of paramsOptions) {
            try {
              // Handle positional vs object for .call()
              result = Array.isArray(params)
                ? await fn.apply(this.api, params)
                : await fn.call(this.api, params);
              if (result) break;
            } catch { }
          }
        }
        if (result) break;
      }
    }

    if (!result) throw new SigningError('No compatible signing method found.');

    // Normalization
    let signature = result.signature || result.sig || (typeof result === 'string' ? result : undefined);
    let publicKey = result.publicKey || result.pk || result.verifyingKey || this.getCoinPublicKey();

    if (!signature || !publicKey) throw new SigningError('Invalid signing result shape.');

    return { intent, signature, publicKey, timestamp: result.timestamp || Date.now() };
  }

  async executeTransactionFlow(unsealed: UnsealedTransaction): Promise<SubmitTransactionResult> {
    const sealed = await this.balanceTransaction(unsealed);
    return await this.submitTransaction(sealed);
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    if (!this.api) throw new Error('Not connected.');
    return await this.api.balanceUnsealedTransaction(unsealed);
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    if (!this.api) throw new Error('Not connected.');
    const res = await this.api.submitTransaction(sealed) as any;
    return res.txId || res.hash || res;
  }

  getCapabilities() {
    return { mode: this.mode, canSignIntent: this.mode === 'intent-signing', canSubmitTx: true };
  }
}
