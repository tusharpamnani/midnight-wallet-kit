import { InjectedWalletAdapter } from './injected.js';
import type { InjectedWalletAdapterOptions } from './injected.js';

/**
 * NuFi wallet adapter.
 * Injects at: window.cardano.nufi (CIP-30)
 * Also supports: window.cardano.nufiSnap (Metamask Snap), window.cardano.nufiSSO (social login)
 *
 * NuFi is a non-custodial wallet with Midnight Network support.
 * https://midnight.network/ecosystem-catalog
 */
export class NuFiWalletAdapter extends InjectedWalletAdapter {
  constructor(options?: InjectedWalletAdapterOptions) {
    super({
      ...options,
      providerKey: 'nufi',
      name: 'NuFi',
      maxRetries: options?.maxRetries ?? 50,
      retryDelayMs: options?.retryDelayMs ?? 100,
    });
  }
}
