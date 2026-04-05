import { z } from 'zod';

// ─── Network ─────────────────────────────────────────────────────────────────

export const NetworkSchema = z.enum(['devnet', 'testnet', 'mainnet', 'preprod']);
export type Network = z.infer<typeof NetworkSchema>;

// ─── MidnightIntent ──────────────────────────────────────────────────────────

/**
 * Schema for a contract intent on the Midnight Network.
 * `.strict()` rejects any unknown keys at parse-time.
 */
export const MidnightIntentSchema = z.object({
  /** Deployed contract address / identifier */
  contract: z.string().min(1, 'Contract address must not be empty'),
  /** The contract action to invoke (e.g. "mint", "transfer") */
  action: z.string().min(1, 'Action name must not be empty'),
  /** Arbitrary key-value parameters for the action */
  params: z.record(z.string(), z.unknown()).default({}),
  /** Monotonically increasing nonce to prevent replays */
  nonce: z.number().int().nonnegative(),
  /** Target network */
  network: NetworkSchema.default('preprod'),
}).strict();

export type MidnightIntent = z.infer<typeof MidnightIntentSchema>;

// ─── SignedIntent ────────────────────────────────────────────────────────────

export const SignedIntentSchema = z.object({
  /** The original intent that was signed */
  intent: MidnightIntentSchema,
  /** Hex-encoded signature */
  signature: z.string().min(1, 'Signature must not be empty'),
  /** Hex-encoded public key of the signer */
  publicKey: z.string().min(1, 'Public key must not be empty'),
  /** Unix epoch ms when the signature was produced */
  timestamp: z.number().int().positive(),
}).strict();

export type SignedIntent = z.infer<typeof SignedIntentSchema>;

// ─── MidnightWallet interface ────────────────────────────────────────────────

/**
 * Strict contract that every wallet adapter must implement.
 * No method may return `undefined` — they either succeed with a value
 * or throw a typed MidnightWalletError.
 */
export interface MidnightWallet {
  /** Human-readable adapter name, used as registry key (case-insensitive) */
  readonly name: string;

  /** Open a connection. Throws on failure — never resolves to undefined. */
  connect(): Promise<void>;

  /** Tear down the connection. Safe to call even if not connected. */
  disconnect(): Promise<void>;

  /** Synchronous connection check. */
  isConnected(): boolean;

  /**
   * Returns the wallet address.
   * MUST throw WalletNotConnectedError if not connected.
   */
  getAddress(): string;

  /**
   * Sign a validated MidnightIntent.
   * MUST throw SigningError on failure — never returns undefined.
   */
  signIntent(intent: MidnightIntent): Promise<SignedIntent>;
}
