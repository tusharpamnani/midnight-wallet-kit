import { InjectedWalletAdapter } from './injected.js';
import type { InjectedWalletAdapterOptions } from './injected.js';

/**
 * Yoroi Wallet adapter.
 * Injects at: window.cardano.yoroi (CIP-30)
 *
 * Yoroi is a community-driven, open-source wallet focused on transparency
 * and security. Supports Midnight Network.
 * https://midnight.network/ecosystem-catalog
 */
export class YoroiWalletAdapter extends InjectedWalletAdapter {
  constructor(options?: InjectedWalletAdapterOptions) {
    super({
      ...options,
      providerKey: 'yoroi',
      name: 'Yoroi',
      maxRetries: options?.maxRetries ?? 50,
      retryDelayMs: options?.retryDelayMs ?? 100,
    });
  }
}
