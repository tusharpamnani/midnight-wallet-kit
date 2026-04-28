import { describe, it, expect } from 'vitest';
import {
  createMidnightWalletManager,
  WALLET_REGISTRY,
  getWalletInfo,
  getRegisteredWalletIds,
  detectInstalledWallets,
} from './index.js';
import type { WalletInfo } from './index.js';

describe('Wallet Registry', () => {
  it('has all 8 wallets in the registry', () => {
    expect(WALLET_REGISTRY).toHaveLength(8);
  });

  it('has correct wallet IDs', () => {
    const ids = WALLET_REGISTRY.map(w => w.id);
    expect(ids).toContain('1AM');
    expect(ids).toContain('nocturne');
    expect(ids).toContain('nufi');
    expect(ids).toContain('gerowallet');
    expect(ids).toContain('vespr');
    expect(ids).toContain('yoroi');
    expect(ids).toContain('ctrl');
    expect(ids).toContain('subwallet');
  });

  it('classifies wallets correctly', () => {
    const midnightNative = WALLET_REGISTRY.filter(w => w.type === 'midnight-native');
    expect(midnightNative).toHaveLength(2);
    expect(midnightNative.map(w => w.id)).toEqual(['1AM', 'nocturne']);

    const cip30 = WALLET_REGISTRY.filter(w => w.type === 'cip30');
    expect(cip30).toHaveLength(6);
  });

  it('1AM has dust-free feature', () => {
    const oneAM = WALLET_REGISTRY.find(w => w.id === '1AM');
    expect(oneAM?.features).toContain('dust-free');
  });

  it('createMidnightWalletManager registers all wallets by default', () => {
    const manager = createMidnightWalletManager();
    const names = manager.getRegisteredNames();
    expect(names).toHaveLength(8);
    expect(names).toContain('1am');
    expect(names).toContain('nocturne');
    expect(names).toContain('nufi');
  });

  it('createMidnightWalletManager respects "only" filter', () => {
    const manager = createMidnightWalletManager({
      only: ['1AM', 'NuFi', 'Nocturne'],
    });
    const names = manager.getRegisteredNames();
    expect(names).toHaveLength(3);
  });

  it('createMidnightWalletManager respects "skip" filter', () => {
    const manager = createMidnightWalletManager({
      skip: ['NuFi', 'GeroWallet', 'VESPR'],
    });
    const names = manager.getRegisteredNames();
    expect(names).toHaveLength(5);
    expect(names).not.toContain('nufi');
    expect(names).not.toContain('gerowallet');
    expect(names).not.toContain('vespr');
  });

  it('getWalletInfo returns correct info', () => {
    const info = getWalletInfo('1AM') as WalletInfo;
    expect(info).toBeDefined();
    expect(info.name).toBe('1AM Wallet');
    expect(info.type).toBe('midnight-native');
  });

  it('getRegisteredWalletIds returns all IDs', () => {
    const ids = getRegisteredWalletIds();
    expect(ids).toHaveLength(8);
  });

  it('detectInstalledWallets returns empty array on server', () => {
    const installed = detectInstalledWallets();
    expect(installed).toEqual([]);
  });
});
