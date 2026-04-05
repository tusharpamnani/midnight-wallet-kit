import { EventEmitter } from 'eventemitter3';
import type { MidnightWallet } from '../validation/schemas.js';
import {
  WalletNotConnectedError,
  WalletNotRegisteredError,
  FallbackExhaustedError,
  wrapError,
} from '../errors/wallet-errors.js';
import type { ConnectionState, WalletAdapterEvents } from './types.js';

/**
 * WalletManager
 *
 * Central orchestrator for wallet adapters. Responsibilities:
 * - Adapter registry (register / unregister / list)
 * - Connection lifecycle with state machine
 * - Priority-based fallback connection
 * - Event system for UI/hook integration
 * - Mutex on connect/disconnect to prevent race conditions
 */
export class WalletManager extends EventEmitter<WalletAdapterEvents> {
  private readonly wallets = new Map<string, MidnightWallet>();
  private activeWallet: MidnightWallet | null = null;
  private state: ConnectionState = 'idle';

  /** Prevents concurrent connect/disconnect from stomping on each other */
  private operationLock: Promise<void> = Promise.resolve();

  // ── Registration ───────────────────────────────────────────────────────────

  register(wallet: MidnightWallet): this {
    const key = wallet.name.toLowerCase();

    if (this.wallets.has(key)) {
      console.warn(`[WalletManager] Replacing existing adapter "${wallet.name}".`);
    }

    this.wallets.set(key, wallet);
    return this; // chainable
  }

  unregister(name: string): boolean {
    const key = name.toLowerCase();

    // If the active wallet is being unregistered, disconnect first
    if (this.activeWallet?.name.toLowerCase() === key) {
      // Fire and forget — disconnect is best-effort here
      void this.disconnect();
    }

    return this.wallets.delete(key);
  }

  getRegisteredWallets(): MidnightWallet[] {
    return Array.from(this.wallets.values());
  }

  getRegisteredNames(): string[] {
    return Array.from(this.wallets.keys());
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  async connect(name: string): Promise<void> {
    // Serialize operations
    const prev = this.operationLock;
    let resolve!: () => void;
    this.operationLock = new Promise<void>((r) => { resolve = r; });

    await prev; // wait for any in-flight operation

    try {
      await this.doConnect(name);
    } finally {
      resolve();
    }
  }

  async disconnect(): Promise<void> {
    const prev = this.operationLock;
    let resolve!: () => void;
    this.operationLock = new Promise<void>((r) => { resolve = r; });

    await prev;

    try {
      await this.doDisconnect();
    } finally {
      resolve();
    }
  }

  /**
   * Attempt to connect adapters in priority order.
   * Stops at the first success. Throws FallbackExhaustedError if all fail.
   *
   * @param priorityList - adapter names in order of preference, e.g. ['injected', 'seed', 'mock']
   */
  async connectWithFallback(priorityList: string[]): Promise<void> {
    const errors: Array<{ name: string; error: string }> = [];

    for (const name of priorityList) {
      try {
        await this.connect(name);
        return; // success
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ name, error: msg });
        console.warn(`[WalletManager] Adapter "${name}" failed: ${msg}`);
      }
    }

    const wrapped = new FallbackExhaustedError(priorityList, errors);
    this.setState('error');
    this.emit('onError', wrapped);
    throw wrapped;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getActiveWallet(): MidnightWallet {
    if (!this.activeWallet) {
      throw new WalletNotConnectedError();
    }
    return this.activeWallet;
  }

  /** Returns null instead of throwing, for conditional UI logic */
  tryGetActiveWallet(): MidnightWallet | null {
    return this.activeWallet;
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.activeWallet !== null;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async doConnect(name: string): Promise<void> {
    const key = name.toLowerCase();
    const wallet = this.wallets.get(key);

    if (!wallet) {
      const available = this.getRegisteredNames();
      const err = new WalletNotRegisteredError(name, available);
      this.setState('error');
      this.emit('onError', err);
      throw err;
    }

    // Disconnect any currently active wallet first
    if (this.activeWallet && this.activeWallet !== wallet) {
      await this.doDisconnect();
    }

    try {
      this.setState('connecting');
      await wallet.connect();
      this.activeWallet = wallet;
      this.setState('connected');
      this.emit('onConnect', wallet);
    } catch (err) {
      this.activeWallet = null;
      this.setState('error');
      const wrapped = wrapError(err, `Failed to connect to "${name}".`);
      this.emit('onError', wrapped);
      throw wrapped;
    }
  }

  private async doDisconnect(): Promise<void> {
    if (!this.activeWallet) return;

    const walletName = this.activeWallet.name;

    try {
      this.setState('disconnecting');
      await this.activeWallet.disconnect();
    } catch (err) {
      console.warn(`[WalletManager] Error during disconnect of "${walletName}":`, err);
      // Continue with cleanup regardless
    } finally {
      this.activeWallet = null;
      this.setState('disconnected');
      this.emit('onDisconnect', walletName);
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return; // no-op for duplicate transitions
    this.state = state;
    this.emit('onStateChange', state);
  }
}
