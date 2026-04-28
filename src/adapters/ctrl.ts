import { InjectedWalletAdapter } from './injected.js';
import type { InjectedWalletAdapterOptions } from './injected.js';

/**
 * Ctrl Wallet adapter (formerly XDEFI).
 * Injects at: window.cardano.ctrl (CIP-30)
 * Also supports: window.xfi.cardano (multi-chain)
 *
 * Ctrl Wallet supports 2,500+ blockchains and is integrating with
 * the Midnight ecosystem.
 * https://midnight.network/ecosystem-catalog
 */
export class CtrlWalletAdapter extends InjectedWalletAdapter {
  constructor(options?: InjectedWalletAdapterOptions) {
    super({
      ...options,
      providerKey: 'ctrl',
      name: 'Ctrl',
      maxRetries: options?.maxRetries ?? 50,
      retryDelayMs: options?.retryDelayMs ?? 100,
    });
  }
}
