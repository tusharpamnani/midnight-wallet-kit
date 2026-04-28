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
  OneAMNetwork,
  OneAMConnectedAPI,
  OneAMInitialAPI,
  ShieldedAddresses,
  UnshieldedAddress,
  DustAddress,
  ShieldedBalances,
  UnshieldedBalances,
  DustBalance,
  OneAMConfiguration,
} from '../types/1am.js';
import { isBrowser } from '../utils/env.js';
import { ConnectionRejectedError, SigningError, wrapError } from '../errors/wallet-errors.js';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface OneAMWalletAdapterOptions {
  network?: OneAMNetwork;
  maxRetries?: number;
  retryDelayMs?: number;
  connectTimeoutMs?: number;
}

const DEFAULTS: Required<OneAMWalletAdapterOptions> = {
  network: 'preprod',
  maxRetries: 50,
  retryDelayMs: 100,
  connectTimeoutMs: 30_000,
};

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Dedicated adapter for the 1AM Wallet (https://1am.xyz).
 *
 * Features:
 * - Dust-free execution (ProofStation sponsors all fees)
 * - Shielded & unshielded balance queries
 * - Network configuration retrieval
 * - Proving provider integration
 * - Hex-based transaction flow
 */
export class OneAMWalletAdapter extends BaseWalletAdapter {
  public readonly name = '1AM';
  private readonly opts: Required<OneAMWalletAdapterOptions>;
  private api: OneAMConnectedAPI | null = null;
  private   network: OneAMNetwork = 'preprod';

  // 1AM-specific state
  private shieldedAddress = '';
  private shieldedCoinPublicKey = '';
  private shieldedEncryptionPublicKey = '';
  private unshieldedAddress = '';
  private dustAddress = '';
  private config: OneAMConfiguration | null = null;

  constructor(options?: OneAMWalletAdapterOptions) {
    super();
    this.opts = { ...DEFAULTS, ...options };
    this.network = this.opts.network;
  }

  // ── 1AM Detection ─────────────────────────────────────────────────────────

  private detectWallet(): Promise<OneAMInitialAPI | null> {
    return new Promise((resolve) => {
      if (!isBrowser) { resolve(null); return; }

      const win = globalThis.window as any;
      const wallet = win?.midnight?.['1am'];
      if (wallet) { resolve(wallet as OneAMInitialAPI); return; }

      let attempts = 0;
      const interval = setInterval(() => {
        const w = (globalThis.window as any)?.midnight?.['1am'];
        if (w) {
          clearInterval(interval);
          resolve(w as OneAMInitialAPI);
        } else if (++attempts > this.opts.maxRetries) {
          clearInterval(interval);
          resolve(null);
        }
      }, this.opts.retryDelayMs);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    if (!isBrowser) throw new Error('OneAMWalletAdapter cannot connect on the server.');

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), this.opts.connectTimeoutMs),
    );

    try {
      const wallet = await Promise.race([this.detectWallet(), timeout]);
      if (!wallet) throw new ConnectionRejectedError('1AM wallet not found. Install from https://1am.xyz');

      this.api = await wallet.connect(this.network);

      if (!this.api) throw new ConnectionRejectedError('1AM wallet returned no API.');

      // Fetch all address types and config in parallel
      const [
        shielded,
        unshielded,
        dust,
        config,
      ] = await Promise.all([
        this.api.getShieldedAddresses().catch(() => null),
        this.api.getUnshieldedAddress().catch(() => null),
        this.api.getDustAddress().catch(() => null),
        this.api.getConfiguration().catch(() => null),
      ]);

      if (shielded) {
        this.shieldedAddress = shielded.shieldedAddress || '';
        this.shieldedCoinPublicKey = shielded.shieldedCoinPublicKey || '';
        this.shieldedEncryptionPublicKey = shielded.shieldedEncryptionPublicKey || '';
      }

      if (unshielded) {
        this.unshieldedAddress = unshielded.unshieldedAddress || '';
      }

      if (dust) {
        this.dustAddress = dust.dustAddress || '';
      }

      this.config = config as OneAMConfiguration | null;

      // Set base wallet details using unshielded address as primary
      const primaryAddress = this.unshieldedAddress || this.shieldedAddress || '';
      if (!primaryAddress) throw new ConnectionRejectedError('1AM wallet returned no address.');

      const serviceUris: ServiceUriConfig | null = this.config
        ? {
            proofServerUri: this.config.proverServerUri,
            indexerUri: this.config.indexerUri,
            indexerWsUri: this.config.indexerWsUri,
            nodeUri: this.config.substrateNodeUri,
            networkId: this.config.networkId,
          }
        : null;

      this.setWalletDetails({
        address: primaryAddress,
        coinPublicKey: this.shieldedCoinPublicKey || null,
        encryptionPublicKey: this.shieldedEncryptionPublicKey || null,
        serviceUris,
      });
    } catch (err) {
      this.api = null;
      throw wrapError(err, 'Failed to connect to 1AM wallet.');
    }
  }

  protected override async onDisconnect(): Promise<void> {
    if (this.api?.disconnect) await this.api.disconnect().catch(() => {});
    this.api = null;
    this.shieldedAddress = '';
    this.shieldedCoinPublicKey = '';
    this.shieldedEncryptionPublicKey = '';
    this.unshieldedAddress = '';
    this.dustAddress = '';
    this.config = null;
  }

  // ── Base methods ──────────────────────────────────────────────────────────

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.api) throw new SigningError('Not connected to 1AM wallet.');

    try {
      const stringified = typeof intent === 'string' ? intent : JSON.stringify(intent);
      const result = await this.api.signData(stringified, { encoding: 'text' });

      if (!result?.signature) throw new SigningError('Invalid signing result from 1AM wallet.');

      return {
        intent,
        signature: result.signature,
        publicKey: result.publicKey || this.shieldedCoinPublicKey || '',
        timestamp: Date.now(),
      };
    } catch (err) {
      throw wrapError(err, 'Failed to sign intent with 1AM wallet.');
    }
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    if (!this.api) throw new Error('Not connected to 1AM wallet.');

    // 1AM expects hex string - serialize if needed
    const hex = typeof unsealed === 'string' ? unsealed : this.serializeToHex(unsealed);
    const result = await this.api.balanceUnsealedTransaction(hex);
    return result.tx as SealedTransaction;
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    if (!this.api) throw new Error('Not connected to 1AM wallet.');

    const hex = typeof sealed === 'string' ? sealed : this.serializeToHex(sealed);
    await this.api.submitTransaction(hex);
    return hex;
  }

  // ── 1AM-Specific Public API ─────────────────────────────────────────────

  async getShieldedAddresses(): Promise<ShieldedAddresses | null> {
    if (!this.api) return null;
    return await this.api.getShieldedAddresses();
  }
  async getUnshieldedAddress(): Promise<UnshieldedAddress | null> {
    if (!this.api) return null;
    return await this.api.getUnshieldedAddress();
  }

  async getDustAddress(): Promise<DustAddress | null> {
    if (!this.api) return null;
    return await this.api.getDustAddress();
  }

  async getShieldedBalances(): Promise<ShieldedBalances | null> {
    if (!this.api) return null;
    return await this.api.getShieldedBalances();
  }

  async getUnshieldedBalances(): Promise<UnshieldedBalances | null> {
    if (!this.api) return null;
    return await this.api.getUnshieldedBalances();
  }

  async getDustBalance(): Promise<DustBalance | null> {
    if (!this.api) return null;
    return await this.api.getDustBalance();
  }

  async getConfiguration(): Promise<OneAMConfiguration | null> {
    return this.config;
  }

  async getProvingProvider(zkConfigProvider: unknown): Promise<unknown> {
    if (!this.api) throw new Error('Not connected to 1AM wallet.');
    return await this.api.getProvingProvider(zkConfigProvider);
  }

  async signData(data: string, options?: { encoding?: string }): Promise<{ signature: string; publicKey: string }> {
    if (!this.api) throw new Error('Not connected to 1AM wallet.');
    return await this.api.signData(data, options || { encoding: 'text' });
  }

  getNetwork(): OneAMNetwork {
    return this.network;
  }

  isDustFree(): boolean {
    return this.config !== null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private serializeToHex(obj: unknown): string {
    if (typeof obj === 'string') return obj;
    const serialized = typeof obj === 'object' && obj !== null && 'serialize' in obj
      ? (obj as any).serialize()
      : obj;
    const bytes = serialized instanceof Uint8Array ? serialized : new Uint8Array(Buffer.from(JSON.stringify(serialized)));
    return Array.from(bytes)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
