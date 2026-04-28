import { InjectedWalletAdapter } from './injected.js';
import type { InjectedWalletAdapterOptions } from './injected.js';

/**
 * SubWallet adapter.
 * Primary injection: window.injectedWeb3['subwallet-js'] (Polkadot ecosystem)
 * Cardano injection: window.cardano.subwallet (if supported)
 *
 * SubWallet is a Web3 extension wallet supporting Polkadot and 150+
 * other networks. Has Cardano transfer support.
 * https://midnight.network/ecosystem-catalog
 */
export class SubWalletAdapter extends InjectedWalletAdapter {
  constructor(options?: InjectedWalletAdapterOptions) {
    super({
      ...options,
      providerKey: 'subwallet',
      name: 'SubWallet',
      maxRetries: options?.maxRetries ?? 50,
      retryDelayMs: options?.retryDelayMs ?? 100,
    });
  }
}
