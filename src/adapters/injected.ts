import { BaseWalletAdapter } from './base.js';
import {
  ProviderNotFoundError,
  ConnectionRejectedError,
  ConnectionTimeoutError,
  SigningError,
  wrapError,
} from '../errors/wallet-errors.js';
import type { MidnightIntent, SignedIntent } from '../validation/schemas.js';

/** Shape of the injected provider we expect at `window.midnight` */
interface InjectedProvider {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

export interface InjectedWalletAdapterOptions {
  /** Maximum retry attempts when waiting for the provider to appear (default: 5) */
  maxRetries?: number;
  /** Milliseconds between retries (default: 400) */
  retryDelayMs?: number;
  /** Hard timeout for the entire connect() call in ms (default: 10_000) */
  connectTimeoutMs?: number;
  /** Property path on `window` to read the provider from (default: 'midnight') */
  providerKey?: string;
}

const DEFAULTS: Required<InjectedWalletAdapterOptions> = {
  maxRetries: 5,
  retryDelayMs: 400,
  connectTimeoutMs: 10_000,
  providerKey: 'midnight',
};

/**
 * InjectedWalletAdapter
 *
 * Safely interacts with browser-extension-injected providers.
 *
 * Defenses:
 * - Guards against `window` not existing (SSR / Node)
 * - Retries with exponential back-off when the extension loads slowly
 * - Hard timeout to prevent hanging connections
 * - Wraps every thrown value into typed errors
 */
export class InjectedWalletAdapter extends BaseWalletAdapter {
  public readonly name = 'Injected' as const;

  private readonly opts: Required<InjectedWalletAdapterOptions>;
  private provider: InjectedProvider | null = null;

  constructor(options?: InjectedWalletAdapterOptions) {
    super();
    this.opts = { ...DEFAULTS, ...options };
  }

  // ── Provider discovery ─────────────────────────────────────────────────────

  /**
   * Waits for the provider to appear on `window`, retrying with backoff.
   * Returns the provider or throws ProviderNotFoundError.
   */
  private async waitForProvider(): Promise<InjectedProvider> {
    if (typeof globalThis.window === 'undefined') {
      throw new ProviderNotFoundError('window (not a browser environment)');
    }

    const win = globalThis.window as unknown as Record<string, unknown>;

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      const candidate = win[this.opts.providerKey];

      if (candidate && typeof candidate === 'object' && 'request' in candidate) {
        return candidate as InjectedProvider;
      }

      if (attempt < this.opts.maxRetries) {
        const delay = this.opts.retryDelayMs * Math.pow(1.5, attempt); // mild backoff
        console.debug(
          `[Injected] Provider "${this.opts.providerKey}" not found, retry ${attempt + 1}/${this.opts.maxRetries} in ${Math.round(delay)}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new ProviderNotFoundError(
      `window.${this.opts.providerKey}`,
      this.opts.maxRetries,
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  protected async onConnect(): Promise<void> {
    // Race the discovery against a hard timeout
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(),
      this.opts.connectTimeoutMs,
    );

    try {
      // Wait for the provider to appear
      this.provider = await Promise.race([
        this.waitForProvider(),
        new Promise<never>((_, reject) => {
          timeoutController.signal.addEventListener('abort', () =>
            reject(new ConnectionTimeoutError(this.opts.connectTimeoutMs)),
          );
        }),
      ]);

      // Ask the provider to connect
      const response = await this.provider.request({ method: 'midnight_connect' });

      if (
        !response
        || typeof response !== 'object'
        || !('address' in response)
        || typeof (response as Record<string, unknown>).address !== 'string'
      ) {
        throw new ConnectionRejectedError(
          'Provider returned an invalid response (missing address).',
        );
      }

      const address = (response as { address: string }).address;

      if (address.length === 0) {
        throw new ConnectionRejectedError('Provider returned an empty address.');
      }

      this.setAddress(address);
    } catch (err) {
      this.provider = null;
      throw wrapError(err, 'Failed to connect to injected wallet.');
    } finally {
      clearTimeout(timeout);
    }
  }

  protected override async onDisconnect(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.request({ method: 'midnight_disconnect' });
      } catch {
        // Best effort — provider may already be gone
      }
      this.provider = null;
    }
  }

  // ── Signing ────────────────────────────────────────────────────────────────

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.isConnected() || !this.provider) {
      throw new SigningError('Cannot sign: wallet is not connected.');
    }

    try {
      const result = await this.provider.request({
        method: 'midnight_signIntent',
        params: { intent },
      });

      if (
        !result
        || typeof result !== 'object'
        || !('signature' in result)
        || !('publicKey' in result)
      ) {
        throw new SigningError(
          'Provider returned an invalid signing response (missing signature or publicKey).',
        );
      }

      const { signature, publicKey } = result as { signature: string; publicKey: string };

      return {
        intent,
        signature,
        publicKey,
        timestamp: Date.now(),
      };
    } catch (err) {
      throw err instanceof SigningError
        ? err
        : new SigningError('Injected provider signing failed.', err);
    }
  }
}
