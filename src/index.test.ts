import { describe, it, expect, beforeEach } from 'vitest';
import {
  WalletManager,
  IntentBuilder,
  WalletNotConnectedError,
  WalletNotRegisteredError,
  FallbackExhaustedError,
  InvalidIntentError,
  BaseWalletAdapter,
} from './index.js';
import type { 
  MidnightIntent, 
  SignedIntent, 
  UnsealedTransaction, 
  SealedTransaction, 
  SubmitTransactionResult,
  ConnectionState 
} from './index.js';

// ── Test Adapter Implementation ──────────────────────────────────────────────

class TestWalletAdapter extends BaseWalletAdapter {
  constructor(public readonly name: string, private shouldFail = false) {
    super();
  }

  protected async onConnect(): Promise<void> {
    if (this.shouldFail) throw new Error('Connect failed');
    this.setAddress('0xtest');
  }

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    return {
      intent,
      signature: 'sig',
      publicKey: 'pub',
      timestamp: Date.now(),
    };
  }

  async balanceTransaction(unsealed: UnsealedTransaction): Promise<SealedTransaction> {
    return unsealed;
  }

  async submitTransaction(sealed: SealedTransaction): Promise<SubmitTransactionResult> {
    return '0xhash';
  }
}

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
  });

  it('generates monotonically increasing nonces', () => {
    const a = IntentBuilder.create({ contract: 'x', action: 'a' });
    const b = IntentBuilder.create({ contract: 'x', action: 'b' });
    expect(b.nonce).toBeGreaterThan(a.nonce);
  });

  it('throws InvalidIntentError for empty contract', () => {
    expect(() =>
      IntentBuilder.create({ contract: '', action: 'mint' }),
    ).toThrow(InvalidIntentError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WalletManager
// ═════════════════════════════════════════════════════════════════════════════

describe('WalletManager', () => {
  let manager: WalletManager;

  beforeEach(() => {
    manager = new WalletManager();
    manager.register(new TestWalletAdapter('lace'));
    manager.register(new TestWalletAdapter('midnight'));
  });

  it('registers and lists wallets', () => {
    const names = manager.getRegisteredNames();
    expect(names).toContain('lace');
    expect(names).toContain('midnight');
  });

  it('connects to a registered wallet', async () => {
    await manager.connect('lace');
    expect(manager.isConnected()).toBe(true);
    expect(manager.getActiveWallet().name).toBe('lace');
  });

  it('throws WalletNotRegisteredError for unknown wallet', async () => {
    await expect(manager.connect('nonexistent')).rejects.toThrow(WalletNotRegisteredError);
  });

  it('emits onConnect and onDisconnect events', async () => {
    const events: string[] = [];
    manager.on('onConnect', (w) => events.push(`connect:${w.name}`));
    manager.on('onDisconnect', (n) => events.push(`disconnect:${n}`));

    await manager.connect('lace');
    await manager.disconnect();

    expect(events).toEqual(['connect:lace', 'disconnect:lace']);
  });

  it('connectWithFallback selects first successful adapter', async () => {
    const fresh = new WalletManager();
    fresh.register(new TestWalletAdapter('fail', true));
    fresh.register(new TestWalletAdapter('success'));

    await fresh.connectWithFallback(['fail', 'success']);
    expect(fresh.getActiveWallet().name).toBe('success');
  });

  it('connectWithFallback throws FallbackExhaustedError when all fail', async () => {
    const fresh = new WalletManager();
    fresh.register(new TestWalletAdapter('fail', true));

    await expect(fresh.connectWithFallback(['fail'])).rejects.toThrow(
      FallbackExhaustedError,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error classes
// ═════════════════════════════════════════════════════════════════════════════

describe('Error system', () => {
  it('WalletNotConnectedError has correct code', () => {
    const err = new WalletNotConnectedError();
    expect(err.code).toBe('WALLET_NOT_CONNECTED');
  });

  it('toJSON returns structured error data', () => {
    const err = new InvalidIntentError('bad field', [{ path: ['x'], message: 'required' }]);
    const json = err.toJSON();
    expect(json.code).toBe('INVALID_INTENT');
    expect(json.data).toEqual([{ path: ['x'], message: 'required' }]);
  });
});
