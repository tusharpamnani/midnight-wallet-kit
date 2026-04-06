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
} from '../validation/schemas.js';

/** Shape of the wallet API returned after .enable() */
interface MidnightApi {
  state?(): Promise<{ address: string }>;
  getUnshieldedAddress?(): Promise<string>;
  balanceUnsealedTransaction(tx: UnsealedTransaction): Promise<SealedTransaction>;
  submitTransaction(tx: SealedTransaction): Promise<SubmitTransactionResult>;
  // For legacy/custom providers
  request?(args: { method: string; params?: unknown }): Promise<unknown>;
}

/** Shape of the injected entry point (e.g. window.midnight) */
interface InjectedWallet {
  enable(network?: string): Promise<MidnightApi>;
  connect?(network?: string): Promise<MidnightApi>;
}

export interface InjectedWalletAdapterOptions {
  /** Maximum retry attempts when waiting for the provider to appear (default: 5) */
  maxRetries?: number;
  /** Milliseconds between retries (default: 400) */
  retryDelayMs?: number;
  /** Hard timeout for the entire connect() call in ms (default: 10_000) */
  connectTimeoutMs?: number;
  /** Primary property path on `window` to read the wallet from (default: 'midnight') */
  providerKey?: string;
  /** Fallback property path on `window` (default: 'cardano.lace') */
  fallbackKey?: string;
}

const DEFAULTS: Required<InjectedWalletAdapterOptions> = {
  maxRetries: 10,
  retryDelayMs: 200,
  connectTimeoutMs: 15_000,
  providerKey: 'midnight',
  fallbackKey: 'cardano.lace',
};

/**
 * InjectedWalletAdapter
 *
 * Interacts with browser-extension-injected wallets like Lace.
 * Follows the Midnight-specific .enable() and .balance/submit workflow.
 */
export class InjectedWalletAdapter extends BaseWalletAdapter {
  public readonly name = 'Injected' as const;

  private readonly opts: Required<InjectedWalletAdapterOptions>;
  private api: MidnightApi | null = null;

  constructor(options?: InjectedWalletAdapterOptions) {
    super();
    this.opts = { ...DEFAULTS, ...options };
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  private async waitForWallet(): Promise<InjectedWallet> {
    if (typeof globalThis.window === 'undefined') {
      throw new ProviderNotFoundError('window (not a browser environment)');
    }

    const win = globalThis.window as any;

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      // 1. Try primary (window.midnight)
      let candidate = this.getNestedProperty(win, this.opts.providerKey);
      
      // 2. Try fallback (window.cardano.lace)
      if (!candidate) {
        candidate = this.getNestedProperty(win, this.opts.fallbackKey);
      }

      if (candidate && (candidate.enable || candidate.connect)) {
        return candidate as InjectedWallet;
      }

      if (attempt < this.opts.maxRetries) {
        console.debug(`[Injected] Waiting for wallet, attempt ${attempt + 1}/${this.opts.maxRetries}...`);
        await new Promise((r) => setTimeout(r, this.opts.retryDelayMs));
      }
    }

    throw new ProviderNotFoundError(
      `Wallet not found at window.${this.opts.providerKey} or window.${this.opts.fallbackKey}`,
      this.opts.maxRetries,
    );
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.opts.connectTimeoutMs);

    try {
      const wallet = await Promise.race([
        this.waitForWallet(),
        new Promise<never>((_, reject) => {
          timeoutController.signal.addEventListener('abort', () =>
            reject(new ConnectionTimeoutError(this.opts.connectTimeoutMs)),
          );
        }),
      ]);

      // Connect via enable() or connect() fallback
      const connector = wallet.enable || wallet.connect;
      if (!connector) throw new ConnectionRejectedError('Wallet has no enable/connect method.');

      try {
        // As per guide, try connecting to 'preprod' network specifically
        this.api = await connector.call(wallet, 'preprod');
      } catch {
        // Fallback to simple connect if preprod argument is rejected
        this.api = await connector.call(wallet);
      }

      if (!this.api) {
        throw new ConnectionRejectedError('Wallet connection returned null API.');
      }

      // Resolve address: check .state() then fallback to .getUnshieldedAddress()
      let address = '';

      if (this.api.state) {
        const state = await this.api.state();
        address = state.address;
      } else if (this.api.getUnshieldedAddress) {
        address = await this.api.getUnshieldedAddress();
      }

      if (!address) {
        throw new ConnectionRejectedError('Could not retrieve address from connected wallet state.');
      }

      this.setAddress(address);
    } catch (err) {
      this.api = null;
      throw wrapError(err, 'Failed to connect to injected wallet.');
    } finally {
      clearTimeout(timeout);
    }
  }

  protected override async onDisconnect(): Promise<void> {
    this.api = null;
  }

  // ── Wallet Interface Implementations ───────────────────────────────────────

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.isConnected() || !this.api) {
      throw new SigningError('Wallet not connected.');
    }

    // Try request-based signing if available, or fallback to any signing method
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
      
      // If the provider doesn't support signIntent directly, it's a protocol mismatch
      throw new SigningError('Wallet does not support intent signing.');
    } catch (err) {
      throw wrapError(err, 'Intent signing failed.');
    }
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    if (!this.isConnected() || !this.api) {
      throw new Error('Wallet not connected.');
    }

    try {
      return await this.api.balanceUnsealedTransaction(unsealed);
    } catch (err) {
      throw wrapError(err, 'Transaction balancing failed.');
    }
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    if (!this.isConnected() || !this.api) {
      throw new Error('Wallet not connected.');
    }

    try {
      const result = await this.api.submitTransaction(sealed) as any;
      // Extract hash/id as per guide
      return result.txId || result.hash || result;
    } catch (err) {
      throw wrapError(err, 'Transaction submission failed.');
    }
  }
}
