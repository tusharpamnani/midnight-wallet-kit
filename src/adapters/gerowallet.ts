import { InjectedWalletAdapter } from './injected.js';
import type { InjectedWalletAdapterOptions } from './injected.js';

/**
 * GeroWallet adapter.
 * Injects at: window.cardano.gerowallet (CIP-30)
 *
 * GeroWallet combines Web2 and Web3 with features like ADA cashback,
 * governance, staking, and swapping. Has Midnight Network support.
 * https://midnight.network/ecosystem-catalog
 */
export class GeroWalletAdapter extends InjectedWalletAdapter {
  constructor(options?: InjectedWalletAdapterOptions) {
    super({
      ...options,
      providerKey: 'gerowallet',
      name: 'GeroWallet',
      maxRetries: options?.maxRetries ?? 50,
      retryDelayMs: options?.retryDelayMs ?? 100,
    });
  }
}
