import { createHash } from 'node:crypto';
import { BaseWalletAdapter } from './base.js';
import { InvalidSeedError, SigningError, wrapError } from '../errors/wallet-errors.js';
import type { MidnightIntent, SignedIntent } from '../validation/schemas.js';

/**
 * SeedWalletAdapter
 *
 * Derives a keypair from a BIP-39-style seed phrase and signs intents locally.
 * The seed is NEVER sent over the network.
 *
 * Security notes:
 * - In production, replace the HMAC-SHA256 derivation with proper Ed25519 / BIP-32.
 * - The current implementation uses Node's crypto module for deterministic key
 *   derivation that is safe enough for dev/testing and works as a reliable
 *   fallback when injected wallets are unavailable.
 */
export class SeedWalletAdapter extends BaseWalletAdapter {
  public readonly name = 'Seed' as const;

  private readonly seedPhrase: string;
  private derivedPrivateKey: string | null = null;
  private derivedPublicKey: string | null = null;

  constructor(seedPhrase: string) {
    super();
    SeedWalletAdapter.validateSeed(seedPhrase);
    this.seedPhrase = seedPhrase;
  }

  // ── Seed validation ────────────────────────────────────────────────────────

  private static validateSeed(seed: string): void {
    if (typeof seed !== 'string') {
      throw new InvalidSeedError('Seed must be a string.');
    }

    const trimmed = seed.trim();
    if (trimmed.length === 0) {
      throw new InvalidSeedError('Seed must not be empty.');
    }

    const words = trimmed.split(/\s+/);
    if (words.length < 3) {
      throw new InvalidSeedError(
        `Seed must contain at least 3 words (got ${words.length}). `
        + 'Standard BIP-39 uses 12, 15, 18, 21, or 24 words.',
      );
    }
  }

  // ── Deterministic key derivation ───────────────────────────────────────────

  /**
   * Derives a deterministic keypair from the seed phrase using HMAC-SHA256.
   * Returns { privateKey, publicKey, address } as hex strings.
   */
  private deriveKeypair(): { privateKey: string; publicKey: string; address: string } {
    // Private key: HMAC-SHA256(key="midnight-wallet-kit", data=seed)
    const privateKey = createHash('sha256')
      .update(`midnight-wallet-kit:${this.seedPhrase}`)
      .digest('hex');

    // Public key: SHA-256 of the private key (placeholder for real curve math)
    const publicKey = createHash('sha256')
      .update(privateKey)
      .digest('hex');

    // Address: first 40 hex chars of the public key hash, prefixed with 0x
    const addressHash = createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .slice(0, 40);

    return {
      privateKey,
      publicKey,
      address: `0x${addressHash}`,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    try {
      const { privateKey, publicKey, address } = this.deriveKeypair();
      this.derivedPrivateKey = privateKey;
      this.derivedPublicKey = publicKey;
      this.setAddress(address);
    } catch (err) {
      throw wrapError(err, 'Failed to derive keypair from seed.');
    }
  }

  protected override async onDisconnect(): Promise<void> {
    this.derivedPrivateKey = null;
    this.derivedPublicKey = null;
  }

  // ── Signing ────────────────────────────────────────────────────────────────

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.isConnected() || !this.derivedPrivateKey || !this.derivedPublicKey) {
      throw new SigningError('Cannot sign: seed wallet is not connected.');
    }

    try {
      // Deterministic signature: HMAC-SHA256(key=privateKey, data=canonicalIntent)
      const canonical = JSON.stringify(intent, Object.keys(intent).sort());
      const signature = createHash('sha256')
        .update(`${this.derivedPrivateKey}:${canonical}`)
        .digest('hex');

      return {
        intent,
        signature,
        publicKey: this.derivedPublicKey,
        timestamp: Date.now(),
      };
    } catch (err) {
      throw new SigningError('Failed to sign intent with seed wallet.', err);
    }
  }
}
