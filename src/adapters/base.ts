import type {
  MidnightWallet,
  MidnightIntent,
  SignedIntent,
  UnsealedTransaction,
  SealedTransaction,
  SubmitTransactionResult,
  ServiceUriConfig,
} from '../validation/schemas.js';
import { WalletNotConnectedError, WalletAlreadyConnectedError } from '../errors/wallet-errors.js';

/**
 * Base class for all Midnight wallet adapters.
 *
 * Handles the common state machine (connected / address tracking)
 * and enforces the contract: getAddress() MUST throw when disconnected,
 * connect() MUST throw when already connected, etc.
 *
 * Subclasses override `onConnect`, `onDisconnect`, and `onSignIntent`.
 */
export abstract class BaseWalletAdapter implements MidnightWallet {
  abstract readonly name: string;

  private _address: string | null = null;
  private _coinPublicKey: string | null = null;
  private _encryptionPublicKey: string | null = null;
  private _serviceUris: ServiceUriConfig | null = null;
  private _connected = false;
  /** Guard against concurrent connect() race conditions */
  private _connectPromise: Promise<void> | null = null;

  // ── Public contract ────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this._connected) {
      throw new WalletAlreadyConnectedError(this.name);
    }

    // If a connection attempt is already in flight, piggy-back on it.
    if (this._connectPromise) {
      return this._connectPromise;
    }

    this._connectPromise = this.performConnect();

    try {
      await this._connectPromise;
    } finally {
      this._connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return; // idempotent — safe to call multiple times

    try {
      await this.onDisconnect();
    } finally {
      this._address = null;
      this._coinPublicKey = null;
      this._encryptionPublicKey = null;
      this._serviceUris = null;
      this._connected = false;
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  getAddress(): string {
    if (!this._connected || this._address === null) {
      throw new WalletNotConnectedError(this.name);
    }
    return this._address;
  }

  getCoinPublicKey(): string | null {
    return this._coinPublicKey;
  }

  getEncryptionPublicKey(): string | null {
    return this._encryptionPublicKey;
  }

  getServiceUris(): ServiceUriConfig | null {
    return this._serviceUris;
  }

  abstract signIntent(intent: MidnightIntent): Promise<SignedIntent>;

  abstract balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction>;

  abstract submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult>;

  // ── Protected API for subclasses ───────────────────────────────────────────

  /**
   * Called by subclass `onConnect()` to set the resolved address.
   * Validates that address is a non-empty string.
   */
  protected setAddress(address: string): void {
    if (typeof address !== 'string' || address.length === 0) {
      throw new Error(`[${this.name}] setAddress received invalid value: ${JSON.stringify(address)}`);
    }
    this._address = address;
  }

  /**
   * Bulk update wallet details. Useful for setting keys and URIs during connection.
   */
  protected setWalletDetails(details: {
    address: string;
    coinPublicKey?: string | null;
    encryptionPublicKey?: string | null;
    serviceUris?: ServiceUriConfig | null;
  }): void {
    this.setAddress(details.address);
    this._coinPublicKey = details.coinPublicKey ?? null;
    this._encryptionPublicKey = details.encryptionPublicKey ?? null;
    this._serviceUris = details.serviceUris ?? null;
  }

  /**
   * Subclasses implement this to perform the actual connection logic
   * (read from window, derive from seed, etc.).
   * MUST call `this.setAddress(...)` before returning.
   */
  protected abstract onConnect(): Promise<void>;

  /**
   * Subclasses implement this for teardown logic.
   * The base class handles resetting address/connected state afterwards.
   */
  protected async onDisconnect(): Promise<void> {
    // default: no-op, subclasses override if needed
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async performConnect(): Promise<void> {
    await this.onConnect();

    // Validate that subclass actually set an address
    if (this._address === null) {
      throw new Error(
        `[${this.name}] Bug: onConnect() resolved without calling setAddress(). `
        + 'Every adapter must set an address during connection.',
      );
    }

    this._connected = true;
  }
}
