import { BaseWalletAdapter } from '../adapters/base.js';
import type { MidnightIntent, SignedIntent, ServiceUriConfig } from '../validation/schemas.js';
import { ConnectionRejectedError, SigningError } from '../errors/wallet-errors.js';

export interface MockWalletAdapterOptions {
  /** Simulated wallet address */
  address?: string;
  /** Simulated public key for coins */
  coinPublicKey?: string;
  /** Simulated public key for encryption */
  encryptionPublicKey?: string;
  /** Simulated service URIs */
  serviceUris?: ServiceUriConfig;
  /** Delay in milliseconds for the signing operation (default: 0) */
  signDelay?: number;
  /** If true, connection will fail with CONNECTION_REJECTED */
  shouldRejectConnect?: boolean;
  /** If true, signing will fail with SIGNING_FAILED */
  shouldRejectSign?: boolean;
  /** Custom signature string to return */
  signatureOverride?: string;
}

/**
 * A testing adapter that simulates various wallet behaviors without 
 * requiring an actual browser extension.
 * 
 * Part of the @midnight-wallet-kit/testing sub-package.
 */
export class MockWalletAdapter extends BaseWalletAdapter {
  public readonly name = 'mock';
  private readonly opts: MockWalletAdapterOptions;

  constructor(options: MockWalletAdapterOptions = {}) {
    super();
    this.opts = options;
  }

  protected async onConnect(): Promise<void> {
    if (this.opts.shouldRejectConnect) {
      throw new ConnectionRejectedError('Mock connection rejected by configuration.');
    }

    this.setWalletDetails({
      address: this.opts.address || '0xmockaddress0000000000000000000000000',
      coinPublicKey: this.opts.coinPublicKey || '0xmockcoinpublickey0000000000000000',
      encryptionPublicKey: this.opts.encryptionPublicKey || '0xmockencryptionpublickey00000000',
      serviceUris: this.opts.serviceUris || {
        indexerUri: 'http://localhost:8080/indexer',
        proofServerUri: 'http://localhost:8081/prover',
        nodeUri: 'http://localhost:8082/node',
        networkId: 'mock-network',
      },
    });
  }

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    if (!this.isConnected()) throw new SigningError('Not connected.');

    if (this.opts.signDelay && this.opts.signDelay > 0) {
      await new Promise((r) => setTimeout(r, this.opts.signDelay));
    }

    if (this.opts.shouldRejectSign) {
      throw new SigningError('Mock signing operation failed by configuration.');
    }

    return {
      intent,
      signature: this.opts.signatureOverride || '0xmocksignature000000000000000000000000000000',
      publicKey: this.opts.coinPublicKey || '0xmockcoinpublickey0000000000000000',
      timestamp: Date.now(),
    };
  }

  // Transaction mocks
  async balanceTransaction(unsealed: any): Promise<any> { return {} as any; }
  async submitTransaction(sealed: any): Promise<string> { return '0xmocktxid'; }
}

/** 
 * Factory function for creating a mock adapter instance quickly.
 */
export function createMockAdapter(overrides?: MockWalletAdapterOptions): MockWalletAdapter {
  return new MockWalletAdapter(overrides);
}
