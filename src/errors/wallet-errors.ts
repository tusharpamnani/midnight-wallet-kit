/**
 * Base error class for all midnight-wallet-kit errors.
 * Every error carries a machine-readable code, optional structured data,
 * and preserves the original cause chain.
 */
export class MidnightWalletError extends Error {
  public readonly code: string;
  public readonly data: unknown;
  public readonly timestamp: number;

  constructor(message: string, code: string, data?: unknown, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'MidnightWalletError';
    this.code = code;
    this.data = data;
    this.timestamp = Date.now();
    // Fix prototype chain for instanceof checks after transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Structured JSON for logging / telemetry */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
      cause: this.cause instanceof Error
        ? { name: this.cause.name, message: this.cause.message }
        : this.cause,
    };
  }
}

// ─── Specific Error Types ────────────────────────────────────────────────────

export class WalletNotConnectedError extends MidnightWalletError {
  constructor(walletName?: string) {
    super(
      walletName
        ? `Wallet "${walletName}" is not connected. Call connect() first.`
        : 'No wallet is connected. Call connect() first.',
      'WALLET_NOT_CONNECTED',
    );
    this.name = 'WalletNotConnectedError';
  }
}

export class ProviderNotFoundError extends MidnightWalletError {
  constructor(providerName: string, retries?: number) {
    super(
      `Provider "${providerName}" was not found.`
        + (retries !== undefined ? ` Exhausted ${retries} retries.` : ''),
      'PROVIDER_NOT_FOUND',
      { providerName, retries },
    );
    this.name = 'ProviderNotFoundError';
  }
}

export class ConnectionRejectedError extends MidnightWalletError {
  constructor(reason?: string) {
    super(
      reason ?? 'The user rejected the wallet connection request.',
      'CONNECTION_REJECTED',
    );
    this.name = 'ConnectionRejectedError';
  }
}

export class ConnectionTimeoutError extends MidnightWalletError {
  constructor(timeoutMs: number) {
    super(
      `Wallet connection timed out after ${timeoutMs}ms.`,
      'CONNECTION_TIMEOUT',
      { timeoutMs },
    );
    this.name = 'ConnectionTimeoutError';
  }
}

export class InvalidIntentError extends MidnightWalletError {
  constructor(details: string, validationErrors?: unknown) {
    super(
      `Invalid intent: ${details}`,
      'INVALID_INTENT',
      validationErrors,
    );
    this.name = 'InvalidIntentError';
  }
}

export class SigningError extends MidnightWalletError {
  constructor(message: string, cause?: unknown) {
    super(message, 'SIGNING_FAILED', undefined, cause);
    this.name = 'SigningError';
  }
}

export class WalletAlreadyConnectedError extends MidnightWalletError {
  constructor(walletName: string) {
    super(
      `Wallet "${walletName}" is already connected. Disconnect first.`,
      'WALLET_ALREADY_CONNECTED',
      { walletName },
    );
    this.name = 'WalletAlreadyConnectedError';
  }
}

export class WalletNotRegisteredError extends MidnightWalletError {
  constructor(name: string, available: string[]) {
    super(
      `Wallet adapter "${name}" is not registered. Available: [${available.join(', ')}]`,
      'WALLET_NOT_REGISTERED',
      { requested: name, available },
    );
    this.name = 'WalletNotRegisteredError';
  }
}

export class FallbackExhaustedError extends MidnightWalletError {
  constructor(attempted: string[], errors: Array<{ name: string; error: string }>) {
    super(
      `All fallback adapters failed: [${attempted.join(' → ')}]`,
      'FALLBACK_EXHAUSTED',
      { attempted, errors },
    );
    this.name = 'FallbackExhaustedError';
  }
}

export class InvalidSeedError extends MidnightWalletError {
  constructor(reason: string) {
    super(
      `Invalid seed phrase: ${reason}`,
      'INVALID_SEED',
    );
    this.name = 'InvalidSeedError';
  }
}

export class SessionExpiredError extends MidnightWalletError {
  constructor(walletName: string) {
    super(
      `Session for wallet "${walletName}" has expired or been revoked.`,
      'SESSION_EXPIRED',
      { walletName },
    );
    this.name = 'SessionExpiredError';
  }
}

export class UnsupportedMethodError extends MidnightWalletError {
  constructor(method: string, mode: string) {
    super(
      `Method "${method}" is not supported in current wallet mode: ${mode}.`,
      'UNSUPPORTED_METHOD',
      { method, mode },
    );
    this.name = 'UnsupportedMethodError';
  }
}

export class BalanceFetchError extends MidnightWalletError {
  constructor(address: string, cause?: unknown) {
    super(
      `Failed to fetch balance for address: ${address}`,
      'BALANCE_FETCH_FAILED',
      { address },
      cause,
    );
    this.name = 'BalanceFetchError';
  }
}

export class MessageSigningError extends MidnightWalletError {
  constructor(message: string, cause?: unknown) {
    super(
      'Failed to sign message.',
      'MESSAGE_SIGNING_FAILED',
      { messageLength: message.length },
      cause,
    );
    this.name = 'MessageSigningError';
  }
}

export class NetworkMismatchError extends MidnightWalletError {
  constructor(current: string, expected: string) {
    super(
      `Network mismatch: Wallet shifted from ${expected} to ${current}.`,
      'NETWORK_MISMATCH',
      { current, expected },
    );
    this.name = 'NetworkMismatchError';
  }
}

/**
 * Wraps an unknown thrown value into a MidnightWalletError,
 * preserving the original cause. Use at adapter/boundary layers
 * to prevent raw "Cannot read properties of undefined" from leaking.
 */
export function wrapError(err: unknown, fallbackMessage: string): MidnightWalletError {
  if (err instanceof MidnightWalletError) return err;
  const cause = err instanceof Error ? err : new Error(String(err));
  return new MidnightWalletError(fallbackMessage, 'UNEXPECTED_ERROR', undefined, cause);
}
