import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OneAMWalletAdapter } from './index.js';
import { WalletManager } from './index.js';
import type { OneAMNetwork } from './index.js';

// ─── Mock 1AM Wallet ──────────────────────────────────────────────────────

function createMockOneAMWallet(network: OneAMNetwork = 'preprod') {
  const mockApi = {
    getShieldedBalances: vi.fn().mockResolvedValue({ tDUST: 1000n, NIGHT: 500n }),
    getUnshieldedBalances: vi.fn().mockResolvedValue({ NIGHT: 200n }),
    getDustBalance: vi.fn().mockResolvedValue({ balance: '1000', cap: '10000' }),
    getShieldedAddresses: vi.fn().mockResolvedValue({
      shieldedAddress: 'shielded_addr_123',
      shieldedCoinPublicKey: 'coin_pk_456',
      shieldedEncryptionPublicKey: 'enc_pk_789',
    }),
    getUnshieldedAddress: vi.fn().mockResolvedValue({
      unshieldedAddress: 'unshielded_addr_abc',
    }),
    getDustAddress: vi.fn().mockResolvedValue({
      dustAddress: 'dust_addr_def',
    }),
    getConfiguration: vi.fn().mockResolvedValue({
      networkId: network,
      indexerUri: `https://indexer.${network}.midnight.network/api/v4/graphql`,
      indexerWsUri: `wss://indexer.${network}.midnight.network/api/v4/graphql/ws`,
      proverServerUri: `https://api-${network === 'preview' ? 'preview' : network === 'preprod' ? 'preprod' : ''}.1am.xyz`,
      substrateNodeUri: `wss://rpc.${network}.midnight.network`,
      proofServerUri: `https://api-${network === 'preview' ? 'preview' : network === 'preprod' ? 'preprod' : ''}.1am.xyz`,
      nodeUri: `wss://rpc.${network}.midnight.network`,
    }),
    balanceUnsealedTransaction: vi.fn().mockResolvedValue({ tx: 'deadbeef' }),
    submitTransaction: vi.fn().mockResolvedValue(undefined),
    getProvingProvider: vi.fn().mockResolvedValue({
      prove: vi.fn().mockResolvedValue({ proof: 'mock_proof' }),
    }),
    signData: vi.fn().mockResolvedValue({
      signature: 'mock_signature',
      publicKey: 'coin_pk_456',
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };

  const mockWallet = {
    name: '1AM',
    apiVersion: '4.0.0',
    connect: vi.fn().mockResolvedValue(mockApi),
  };

  return { mockWallet, mockApi };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('OneAMWalletAdapter', () => {
  let adapter: OneAMWalletAdapter;

  beforeEach(() => {
    // Properly mock browser environment
    (globalThis as any).window = {
      midnight: {},
      document: {},
    };
    adapter = new OneAMWalletAdapter({ maxRetries: 2, retryDelayMs: 10, network: 'preprod' });
  });

  it('has correct name', () => {
    expect(adapter.name).toBe('1AM');
  });

  it('detects and connects to 1AM wallet', async () => {
    const { mockWallet, mockApi } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    await adapter.connect();

    expect(adapter.isConnected()).toBe(true);
    expect(mockWallet.connect).toHaveBeenCalledWith('preprod');
  });

  it('throws if 1AM wallet is not installed', async () => {
    await expect(adapter.connect()).rejects.toThrow();
  });

  it('fetches shielded addresses after connect', async () => {
    const { mockWallet, mockApi } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    await adapter.connect();
    const addresses = await adapter.getShieldedAddresses();

    expect(mockApi.getShieldedAddresses).toHaveBeenCalled();
    expect(addresses?.shieldedAddress).toBe('shielded_addr_123');
  });

  it('fetches balances after connect', async () => {
    const { mockWallet, mockApi } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    await adapter.connect();
    const shielded = await adapter.getShieldedBalances();
    const unshielded = await adapter.getUnshieldedBalances();
    const dust = await adapter.getDustBalance();

    expect(shielded?.['tDUST']).toBe(1000n);
    expect(unshielded?.['NIGHT']).toBe(200n);
    expect(dust?.balance).toBe('1000');
  });

  it('fetches network configuration', async () => {
    const { mockWallet, mockApi } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    await adapter.connect();
    const config = await adapter.getConfiguration();

    expect(config?.networkId).toBe('preprod');
    expect(config?.indexerUri).toContain('preprod');
  });

  it('signs data correctly', async () => {
    const { mockWallet, mockApi } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    await adapter.connect();
    const result = await adapter.signData('test data');

    expect(mockApi.signData).toHaveBeenCalledWith('test data', { encoding: 'text' });
    expect(result.signature).toBe('mock_signature');
  });

  it('disconnects cleanly', async () => {
    const { mockWallet, mockApi } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
    expect(mockApi.disconnect).toHaveBeenCalled();
  });
});

describe('WalletManager with 1AM', () => {
  it('registers and connects to 1AM adapter', async () => {
    const { mockWallet } = createMockOneAMWallet('preprod');
    (globalThis as any).window.midnight['1am'] = mockWallet;

    const manager = new WalletManager();
    const adapter = new OneAMWalletAdapter({ maxRetries: 2, retryDelayMs: 10 });
    manager.register(adapter);

    expect(manager.getRegisteredNames()).toContain('1am');

    await manager.connect('1am');
    expect(manager.isConnected()).toBe(true);
    expect(manager.getActiveWallet().name).toBe('1AM');
  });
});
