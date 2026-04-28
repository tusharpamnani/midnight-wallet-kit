import { BaseWalletAdapter } from './base.js';
import type {
  MidnightIntent,
  SignedIntent,
  UnsealedTransaction,
  SealedTransaction,
  SubmitTransactionResult,
  ServiceUriConfig,
} from '../validation/schemas.js';
import type {
  MidnightConnectedApi,
  InjectedMidnightWallet,
} from '../types/wallets.js';
import { isBrowser } from '../utils/env.js';
import { ConnectionRejectedError, SigningError, wrapError } from '../errors/wallet-errors.js';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface NocturneWalletAdapterOptions {
  network?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  connectTimeoutMs?: number;
}

const DEFAULTS: Required<NocturneWalletAdapterOptions> = {
  network: 'preprod',
  maxRetries: 50,
  retryDelayMs: 100,
  connectTimeoutMs: 30_000,
};

/**
 * Nocturne wallet adapter.
 * Injects at: window.midnight.nocturne (Midnight DApp Connector API)
 *
 * Nocturne is a self-custodial Chrome extension wallet specifically
 * built for Midnight Network with:
 * - Shielded/unshielded balances
 * - DUST registration
 * - Multi-network support
 * - dApp connector
 *
 * https://github.com/midnightntwrk/midnight-awesome-dapps
 */
export class NocturneWalletAdapter extends BaseWalletAdapter {
  public readonly name = 'Nocturne';
  private readonly opts: Required<NocturneWalletAdapterOptions>;
  private api: MidnightConnectedApi | null = null;
  private network: string = 'preprod';

  // Nocturne-specific state
  private shieldedAddress = '';
  private unshieldedAddress = '';
  private config: any = null;

  constructor(options?: NocturneWalletAdapterOptions) {
    super();
    this.opts = { ...DEFAULTS, ...options };
    this.network = this.opts.network;
  }

  // ── Detection ──────────────────────────────────────────────────────────────

  private detectWallet(): Promise<InjectedMidnightWallet | null> {
    return new Promise((resolve) => {
      if (!isBrowser) { resolve(null); return; }

      const win = globalThis.window as any;
      const wallet = win?.midnight?.nocturne;
      if (wallet) { resolve(wallet as InjectedMidnightWallet); return; }

      let attempts = 0;
      const interval = setInterval(() => {
        const w = (globalThis.window as any)?.midnight?.nocturne;
        if (w) {
          clearInterval(interval);
          resolve(w as InjectedMidnightWallet);
        } else if (++attempts > this.opts.maxRetries) {
          clearInterval(interval);
          resolve(null);
        }
      }, this.opts.retryDelayMs);
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    if (!isBrowser) throw new Error('NocturneWalletAdapter cannot connect on the server.');

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), this.opts.connectTimeoutMs),
    );

    try {
      const wallet = await Promise.race([this.detectWallet(), timeout]);
      if (!wallet) throw new ConnectionRejectedError('Nocturne wallet not found. Install from https://github.com/midnightntwrk/midnight-awesome-dapps');

      this.api = await wallet.connect(this.network);

      if (!this.api) throw new ConnectionRejectedError('Nocturne wallet returned no API.');

      // Fetch addresses and config
      const [shielded, unshielded, config] = await Promise.all([
        this.api.getShieldedAddresses?.().catch(() => null),
        this.api.getUnshieldedAddress?.().catch(() => null),
        this.api.getConfiguration?.().catch(() => null),
      ]);

      if (shielded) {
        this.shieldedAddress = shielded.shieldedAddress || '';
      }

      if (unshielded) {
        this.unshieldedAddress = unshielded.unshieldedAddress || '';
      }

      this.config = config;

      const address = this.unshieldedAddress || this.shieldedAddress || '';
      if (!address) throw new ConnectionRejectedError('Nocturne wallet returned no address.');

      const serviceUris: ServiceUriConfig | null = this.config
        ? {
            proofServerUri: this.config.proverServerUri || '',
            indexerUri: this.config.indexerUri || '',
            indexerWsUri: this.config.indexerWsUri || '',
            nodeUri: this.config.substrateNodeUri || '',
            networkId: this.config.networkId || '',
          }
        : null;

      this.setWalletDetails({
        address,
        coinPublicKey: shielded?.shieldedCoinPublicKey || null,
        encryptionPublicKey: shielded?.shieldedEncryptionPublicKey || null,
        serviceUris,
      });
    } catch (err) {
      this.api = null;
      throw wrapError(err, 'Failed to connect to Nocturne wallet.');
    }
  }

  protected override async onDisconnect(): Promise<void> {
    if (this.api?.disconnect) await this.api.disconnect().catch(() => {});
    this.api = null;
    this.shieldedAddress = '';
    this.unshieldedAddress = '';
    this.config = null;
  }

  // ── Base methods ──────────────────────────────────────────────────────────

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.api) throw new SigningError('Not connected to Nocturne wallet.');

    try {
      const stringified = typeof intent === 'string' ? intent : JSON.stringify(intent);
      const result = await this.api.signData(stringified, { encoding: 'text' });

      if (!result?.signature) throw new SigningError('Invalid signing result from Nocturne wallet.');

      return {
        intent,
        signature: result.signature,
        publicKey: result.publicKey || '',
        timestamp: Date.now(),
      };
    } catch (err) {
      throw wrapError(err, 'Failed to sign intent with Nocturne wallet.');
    }
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    if (!this.api) throw new Error('Not connected to Nocturne wallet.');
    return await this.api.balanceTransaction(unsealed as string);
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    if (!this.api) throw new Error('Not connected to Nocturne wallet.');
    await this.api.submitTransaction(sealed as string);
    return typeof sealed === 'string' ? sealed : JSON.stringify(sealed);
  }

  // ── Nocturne-specific methods ──────────────────────────────────────────

  async getShieldedBalances(): Promise<Record<string, bigint> | null> {
    if (!this.api) return null;
    return await this.api.getShieldedBalances?.() || null;
  }

  async getUnshieldedBalances(): Promise<Record<string, bigint> | null> {
    if (!this.api) return null;
    return await this.api.getUnshieldedBalances?.() || null;
  }

  async getDustBalance(): Promise<{ balance: string; cap: string } | null> {
    if (!this.api) return null;
    return await this.api.getDustBalance?.() || null;
  }

  async getConfiguration(): Promise<any | null> {
    return this.config;
  }

  getNetwork(): string {
    return this.network;
  }
}
