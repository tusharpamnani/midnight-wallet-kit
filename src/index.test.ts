import { describe, it, expect, beforeEach } from 'vitest';
import {
  WalletManager,
  MockWalletAdapter,
  SeedWalletAdapter,
  IntentBuilder,
  WalletNotConnectedError,
  WalletNotRegisteredError,
  FallbackExhaustedError,
  InvalidIntentError,
  InvalidSeedError,
  WalletAlreadyConnectedError,
} from './index.js';
import type { MidnightWallet, ConnectionState } from './index.js';

// ═════════════════════════════════════════════════════════════════════════════
// IntentBuilder
// ═════════════════════════════════════════════════════════════════════════════

describe('IntentBuilder', () => {
  it('creates a valid intent from correct params', () => {
    const intent = IntentBuilder.create({
      contract: '0xabc123',
      action: 'mint',
      params: { tokenId: 1 },
    });

    expect(intent.contract).toBe('0xabc123');
    expect(intent.action).toBe('mint');
    expect(intent.params).toEqual({ tokenId: 1 });
    expect(intent.network).toBe('preprod');
    expect(typeof intent.nonce).toBe('number');
    expect(intent.nonce).toBeGreaterThan(0);
  });

  it('generates monotonically increasing nonces', () => {
    const a = IntentBuilder.create({ contract: 'x', action: 'a' });
    const b = IntentBuilder.create({ contract: 'x', action: 'b' });
    const c = IntentBuilder.create({ contract: 'x', action: 'c' });
    expect(b.nonce).toBeGreaterThan(a.nonce);
    expect(c.nonce).toBeGreaterThan(b.nonce);
  });

  it('sanitizes undefined values to null', () => {
    const intent = IntentBuilder.create({
      contract: '0xabc123',
      action: 'test',
      params: {
        a: undefined,
        b: { nested: undefined },
        c: [1, undefined, 3],
      },
    });

    expect(intent.params.a).toBeNull();
    expect((intent.params.b as any).nested).toBeNull();
    expect(intent.params.c).toEqual([1, null, 3]);
  });

  it('handles circular references', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular; // creates a cycle

    const intent = IntentBuilder.create({
      contract: '0xabc',
      action: 'test',
      params: circular,
    });

    expect(intent.params.self).toBe('[circular]');
  });

  it('sanitizes NaN and Infinity', () => {
    const intent = IntentBuilder.create({
      contract: '0x1',
      action: 'test',
      params: { nan: NaN, inf: Infinity, negInf: -Infinity },
    });

    expect(intent.params.nan).toBeNull();
    expect(intent.params.inf).toBeNull();
    expect(intent.params.negInf).toBeNull();
  });

  it('throws InvalidIntentError for empty contract', () => {
    expect(() =>
      IntentBuilder.create({ contract: '', action: 'mint' }),
    ).toThrow(InvalidIntentError);
  });

  it('throws InvalidIntentError for empty action', () => {
    expect(() =>
      IntentBuilder.create({ contract: 'x', action: '' }),
    ).toThrow(InvalidIntentError);
  });

  it('accepts a custom nonce', () => {
    const intent = IntentBuilder.create({
      contract: '0x1',
      action: 'test',
      nonce: 42,
    });
    expect(intent.nonce).toBe(42);
  });

  it('accepts a custom network', () => {
    const intent = IntentBuilder.create({
      contract: '0x1',
      action: 'test',
      network: 'mainnet',
    });
    expect(intent.network).toBe('mainnet');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MockWalletAdapter
// ═════════════════════════════════════════════════════════════════════════════

describe('MockWalletAdapter', () => {
  it('connects and produces an address', async () => {
    const mock = new MockWalletAdapter();
    expect(mock.isConnected()).toBe(false);

    await mock.connect();
    expect(mock.isConnected()).toBe(true);
    expect(mock.getAddress()).toContain('0xmock');
  });

  it('throws when getting address while disconnected', () => {
    const mock = new MockWalletAdapter();
    expect(() => mock.getAddress()).toThrow(WalletNotConnectedError);
  });

  it('signs an intent and records it', async () => {
    const mock = new MockWalletAdapter();
    await mock.connect();

    const intent = IntentBuilder.create({ contract: '0x1', action: 'test' });
    const signed = await mock.signIntent(intent);

    expect(signed.signature).toContain('mock_sig_test');
    expect(signed.publicKey).toContain('mock_pubkey');
    expect(signed.intent).toBe(intent);
    expect(mock.signedIntents).toHaveLength(1);
  });

  it('disconnect is idempotent', async () => {
    const mock = new MockWalletAdapter();
    await mock.connect();
    await mock.disconnect();
    await mock.disconnect(); // no-op, no throw
    expect(mock.isConnected()).toBe(false);
  });

  it('throws WalletAlreadyConnectedError on double connect', async () => {
    const mock = new MockWalletAdapter();
    await mock.connect();
    await expect(mock.connect()).rejects.toThrow(WalletAlreadyConnectedError);
  });

  it('can configure a custom address', async () => {
    const mock = new MockWalletAdapter({ address: '0xcustom' });
    await mock.connect();
    expect(mock.getAddress()).toBe('0xcustom');
  });

  it('can simulate connect failure', async () => {
    const mock = new MockWalletAdapter({ shouldFailConnect: true });
    await expect(mock.connect()).rejects.toThrow();
  });

  it('can simulate sign failure', async () => {
    const mock = new MockWalletAdapter({ shouldFailSign: true });
    await mock.connect();
    const intent = IntentBuilder.create({ contract: '0x1', action: 'x' });
    await expect(mock.signIntent(intent)).rejects.toThrow();
  });

  it('balances a transaction', async () => {
    const mock = new MockWalletAdapter({ balanceDelayMs: 10 });
    await mock.connect();
    const unsealed = { data: 'unsealed' };
    const sealed = await mock.balanceTransaction(unsealed);
    expect(sealed).toHaveProperty('balanced', true);
    expect(sealed).toHaveProperty('unsealed', unsealed);
  });

  it('submits a transaction', async () => {
    const mock = new MockWalletAdapter({ submitDelayMs: 10 });
    await mock.connect();
    const sealed = { data: 'sealed' };
    const txHash = await mock.submitTransaction(sealed);
    expect(txHash).toMatch(/^mock_tx_hash_/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SeedWalletAdapter
// ═════════════════════════════════════════════════════════════════════════════

describe('SeedWalletAdapter', () => {
  it('connects and derives a deterministic address', async () => {
    const seed = new SeedWalletAdapter('alpha bravo charlie delta echo foxtrot');
    await seed.connect();

    expect(seed.isConnected()).toBe(true);
    expect(seed.getAddress()).toMatch(/^0x[a-f0-9]{40}$/);
  });

  it('derives the same address from the same seed', async () => {
    const phrase = 'one two three four five six';
    const a = new SeedWalletAdapter(phrase);
    const b = new SeedWalletAdapter(phrase);
    await a.connect();
    await b.connect();

    expect(a.getAddress()).toBe(b.getAddress());
  });

  it('derives different addresses from different seeds', async () => {
    const a = new SeedWalletAdapter('alpha bravo charlie delta echo foxtrot');
    const b = new SeedWalletAdapter('golf hotel india juliet kilo lima');
    await a.connect();
    await b.connect();

    expect(a.getAddress()).not.toBe(b.getAddress());
  });

  it('produces deterministic signatures', async () => {
    const seed = new SeedWalletAdapter('alpha bravo charlie delta echo foxtrot');
    await seed.connect();

    const intent = IntentBuilder.create({ contract: '0x1', action: 'test', nonce: 100 });
    const sig1 = await seed.signIntent(intent);
    const sig2 = await seed.signIntent(intent);

    expect(sig1.signature).toBe(sig2.signature);
    expect(sig1.publicKey).toBe(sig2.publicKey);
  });

  it('rejects empty seed', () => {
    expect(() => new SeedWalletAdapter('')).toThrow(InvalidSeedError);
  });

  it('rejects seed with fewer than 3 words', () => {
    expect(() => new SeedWalletAdapter('one two')).toThrow(InvalidSeedError);
  });

  it('clears keys on disconnect', async () => {
    const seed = new SeedWalletAdapter('alpha bravo charlie delta echo foxtrot');
    await seed.connect();
    await seed.disconnect();
    expect(seed.isConnected()).toBe(false);
    expect(() => seed.getAddress()).toThrow(WalletNotConnectedError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WalletManager
// ═════════════════════════════════════════════════════════════════════════════

describe('WalletManager', () => {
  let manager: WalletManager;

  beforeEach(() => {
    manager = new WalletManager();
    manager.register(new MockWalletAdapter());
    manager.register(new SeedWalletAdapter('the quick brown fox jumps over'));
  });

  it('registers and lists wallets', () => {
    const names = manager.getRegisteredNames();
    expect(names).toContain('mock');
    expect(names).toContain('seed');
  });

  it('connects to a registered wallet', async () => {
    await manager.connect('mock');
    expect(manager.isConnected()).toBe(true);
    expect(manager.getActiveWallet().name).toBe('Mock');
    expect(manager.getConnectionState()).toBe('connected');
  });

  it('throws WalletNotRegisteredError for unknown wallet', async () => {
    await expect(manager.connect('nonexistent')).rejects.toThrow(WalletNotRegisteredError);
  });

  it('throws WalletNotConnectedError when no active wallet', () => {
    expect(() => manager.getActiveWallet()).toThrow(WalletNotConnectedError);
  });

  it('tryGetActiveWallet returns null when disconnected', () => {
    expect(manager.tryGetActiveWallet()).toBeNull();
  });

  it('disconnect is safe when not connected', async () => {
    await manager.disconnect(); // no throw
    expect(manager.getConnectionState()).toBe('idle');
  });

  it('emits onConnect and onDisconnect events', async () => {
    const events: string[] = [];
    manager.on('onConnect', (w) => events.push(`connect:${w.name}`));
    manager.on('onDisconnect', (n) => events.push(`disconnect:${n}`));

    await manager.connect('mock');
    await manager.disconnect();

    expect(events).toEqual(['connect:Mock', 'disconnect:Mock']);
  });

  it('emits onStateChange through lifecycle', async () => {
    const states: ConnectionState[] = [];
    manager.on('onStateChange', (s) => states.push(s));

    await manager.connect('mock');
    await manager.disconnect();

    expect(states).toEqual(['connecting', 'connected', 'disconnecting', 'disconnected']);
  });

  it('automatically disconnects previous wallet on new connect', async () => {
    const events: string[] = [];
    manager.on('onDisconnect', (n) => events.push(`disconnect:${n}`));

    await manager.connect('mock');
    await manager.connect('seed');

    expect(events).toContain('disconnect:Mock');
    expect(manager.getActiveWallet().name).toBe('Seed');
  });

  it('connectWithFallback selects first successful adapter', async () => {
    // Register a failing mock before seed
    manager.register(new MockWalletAdapter({ shouldFailConnect: true }));

    const fresh = new WalletManager();
    fresh.register(new MockWalletAdapter({ shouldFailConnect: true }));
    fresh.register(new SeedWalletAdapter('alpha bravo charlie delta echo foxtrot'));

    await fresh.connectWithFallback(['mock', 'seed']);
    expect(fresh.getActiveWallet().name).toBe('Seed');
  });

  it('connectWithFallback throws FallbackExhaustedError when all fail', async () => {
    const fresh = new WalletManager();
    fresh.register(new MockWalletAdapter({ shouldFailConnect: true }));

    await expect(fresh.connectWithFallback(['mock'])).rejects.toThrow(
      FallbackExhaustedError,
    );
  });

  it('handles concurrent connect calls safely', async () => {
    // Both should succeed without throwing, and only one should be active
    const p1 = manager.connect('mock');
    const p2 = manager.connect('seed');

    await Promise.all([p1, p2]);
    expect(manager.isConnected()).toBe(true);
    // The second call should win (or both succeed sequentially)
    expect(['Mock', 'Seed']).toContain(manager.getActiveWallet().name);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error classes
// ═════════════════════════════════════════════════════════════════════════════

describe('Error system', () => {
  it('WalletNotConnectedError has correct code', () => {
    const err = new WalletNotConnectedError();
    expect(err.code).toBe('WALLET_NOT_CONNECTED');
    expect(err.name).toBe('WalletNotConnectedError');
    expect(err instanceof Error).toBe(true);
  });

  it('FallbackExhaustedError carries attempt data', () => {
    const err = new FallbackExhaustedError(
      ['a', 'b'],
      [{ name: 'a', error: 'fail' }, { name: 'b', error: 'fail' }],
    );
    expect(err.code).toBe('FALLBACK_EXHAUSTED');
    expect(err.data).toEqual({
      attempted: ['a', 'b'],
      errors: [{ name: 'a', error: 'fail' }, { name: 'b', error: 'fail' }],
    });
  });

  it('toJSON returns structured error data', () => {
    const err = new InvalidIntentError('bad field', [{ path: ['x'], message: 'required' }]);
    const json = err.toJSON();
    expect(json.code).toBe('INVALID_INTENT');
    expect(json.name).toBe('InvalidIntentError');
    expect(json.data).toEqual([{ path: ['x'], message: 'required' }]);
  });
});
