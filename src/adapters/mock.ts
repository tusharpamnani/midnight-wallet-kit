import { BaseWalletAdapter } from './base.js';
import type {
  MidnightIntent,
  SignedIntent,
  UnsealedTransaction,
  SealedTransaction,
  SubmitTransactionResult,
} from '../validation/schemas.js';

export interface MockWalletAdapterOptions {
  /** Custom address to return (default: deterministic mock) */
  address?: string;
  /** Simulate connection latency in ms (default: 0) */
  connectDelayMs?: number;
  /** Simulate signing latency in ms (default: 0) */
  signDelayMs?: number;
  /** If true, connect() will throw to simulate failure */
  shouldFailConnect?: boolean;
  /** If true, signIntent() will throw to simulate failure */
  shouldFailSign?: boolean;
  /** Simulate balancing latency in ms (default: 0) */
  balanceDelayMs?: number;
  /** Simulate submission latency in ms (default: 0) */
  submitDelayMs?: number;
}

/**
 * MockWalletAdapter
 *
 * Deterministic adapter for development and automated testing.
 * Produces reproducible addresses and signatures (no randomness).
 */
export class MockWalletAdapter extends BaseWalletAdapter {
  public readonly name = 'Mock' as const;

  private readonly opts: Required<MockWalletAdapterOptions>;

  /** Track signed intents for test assertions */
  public readonly signedIntents: SignedIntent[] = [];

  constructor(options?: MockWalletAdapterOptions) {
    super();
    this.opts = {
      address: options?.address ?? '0xmock_0000000000000000000000000000000000000001',
      connectDelayMs: options?.connectDelayMs ?? 0,
      signDelayMs: options?.signDelayMs ?? 0,
      shouldFailConnect: options?.shouldFailConnect ?? false,
      shouldFailSign: options?.shouldFailSign ?? false,
      balanceDelayMs: options?.balanceDelayMs ?? 0,
      submitDelayMs: options?.submitDelayMs ?? 0,
    };
  }

  protected async onConnect(): Promise<void> {
    if (this.opts.connectDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.opts.connectDelayMs));
    }

    if (this.opts.shouldFailConnect) {
      throw new Error('[Mock] Simulated connection failure.');
    }

    this.setAddress(this.opts.address);
  }

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.isConnected()) {
      throw new Error('[Mock] Cannot sign: not connected.');
    }

    if (this.opts.signDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.opts.signDelayMs));
    }

    if (this.opts.shouldFailSign) {
      throw new Error('[Mock] Simulated signing failure.');
    }

    const signed: SignedIntent = {
      intent,
      signature: `mock_sig_${intent.action}_${intent.nonce}`,
      publicKey: `mock_pubkey_${this.opts.address.slice(0, 10)}`,
      timestamp: Date.now(),
    };

    this.signedIntents.push(signed);
    return signed;
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    if (!this.isConnected()) throw new Error('[Mock] Wallet not connected.');
    if (this.opts.balanceDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.opts.balanceDelayMs));
    }
    // Return a mock balanced transaction
    return {
      unsealed,
      balanced: true,
      signature: `mock_balance_sig_${Date.now()}`,
    };
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    if (!this.isConnected()) throw new Error('[Mock] Wallet not connected.');
    if (this.opts.submitDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.opts.submitDelayMs));
    }
    // Return a mock tx hash
    return `mock_tx_hash_${Math.random().toString(16).slice(2, 10)}`;
  }
}
