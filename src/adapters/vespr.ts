import { InjectedWalletAdapter } from './injected.js';
import type { InjectedWalletAdapterOptions } from './injected.js';

/**
 * VESPR wallet adapter.
 * Injects at: window.cardano.vespr (CIP-30)
 *
 * VESPR is a wallet management app for full control over Cardano private keys,
 * with dApp interaction support and Midnight Network integration.
 * https://midnight.network/ecosystem-catalog
 */
export class VesprWalletAdapter extends InjectedWalletAdapter {
  constructor(options?: InjectedWalletAdapterOptions) {
    super({
      ...options,
      providerKey: 'vespr',
      name: 'VESPR',
      maxRetries: options?.maxRetries ?? 50,
      retryDelayMs: options?.retryDelayMs ?? 100,
    });
  }
}
