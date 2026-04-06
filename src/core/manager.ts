import { EventEmitter } from 'eventemitter3';
import type { MidnightWallet, MidnightIntent, SignedIntent, ServiceUriConfig } from '../validation/schemas.js';
import {
  WalletNotConnectedError,
  WalletNotRegisteredError,
  FallbackExhaustedError,
  MessageSigningError,
  NetworkMismatchError,
  wrapError,
} from '../errors/wallet-errors.js';
import type { ConnectionState, WalletAdapterEvents } from './types.js';
import { isBrowser } from '../utils/env.js';
import type { SignedMessage } from '../utils/verify.js';

const STORAGE_KEY = 'mwk:lastWallet';

export type MiddlewareContext = {
  operation: 'connect' | 'disconnect' | 'signIntent' | 'signMessage';
  adapterName?: string;
  intent?: MidnightIntent;
  message?: string;
  result?: SignedIntent | SignedMessage;
  error?: Error;
};

export type Middleware = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

export interface WalletManagerOptions {
  /** If true, allows signing even if the network changed since connection */
  allowNetworkSwitch?: boolean;
  /** Polling interval for network change detection in ms. Default: 30000 */
  networkPollMs?: number;
}

/**
 * WalletManager
 *
 * Central orchestrator for the Midnight Wallet Kit.
 */
export class WalletManager extends EventEmitter<WalletAdapterEvents> {
  private readonly wallets = new Map<string, MidnightWallet>();
  private activeWallet: MidnightWallet | null = null;
  private state: ConnectionState = 'idle';
  private middlewares: Middleware[] = [];
  
  private lastServiceUris: ServiceUriConfig | null = null;
  private networkInterval: ReturnType<typeof setInterval> | null = null;

  /** Prevents concurrent connect/disconnect from stomping on each other */
  private operationLock: Promise<void> = Promise.resolve();

  constructor(private readonly opts: WalletManagerOptions = {}) {
    super();
  }

  // ── Middleware ─────────────────────────────────────────────────────────────

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  private async executeMiddleware(ctx: MiddlewareContext, finalOp: () => Promise<void>): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        if (middleware) {
          await middleware(ctx, next);
        } else {
          await next(); // skip if somehow empty
        }
      } else {
        await finalOp();
      }
    };
    await next();
  }

  // ── Registration ───────────────────────────────────────────────────────────

  register(wallet: MidnightWallet): this {
    const key = wallet.name.toLowerCase();
    this.wallets.set(key, wallet);
    return this;
  }

  unregister(name: string): boolean {
    const key = name.toLowerCase();
    if (this.activeWallet?.name.toLowerCase() === key) {
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

  async connect(name: string, { silent = false } = {}): Promise<void> {
    await this.withLock(async () => {
      const ctx: MiddlewareContext = { operation: 'connect', adapterName: name };
      await this.executeMiddleware(ctx, async () => {
        try {
          await this.doConnect(name);
          if (isBrowser) localStorage.setItem(STORAGE_KEY, name);
        } catch (err) {
          if (!silent) {
            this.setState('error');
            const wrapped = err instanceof Error ? err : new Error(String(err));
            this.emit('onError', wrapped);
          }
          ctx.error = err instanceof Error ? err : new Error(String(err));
          throw err;
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    await this.withLock(async () => {
      const ctx: MiddlewareContext = { operation: 'disconnect', adapterName: this.activeWallet?.name };
      await this.executeMiddleware(ctx, async () => {
        try {
          await this.doDisconnect();
          if (isBrowser) localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          this.setState('error');
          const wrapped = err instanceof Error ? err : new Error(String(err));
          ctx.error = wrapped;
          this.emit('onError', wrapped);
          throw wrapped;
        }
      });
    });
  }

  async autoRestore(): Promise<void> {
    if (!isBrowser) return;
    const lastWallet = localStorage.getItem(STORAGE_KEY);
    if (!lastWallet) return;

    this.setState('restoring');
    try {
      await this.connectWithFallback([lastWallet], { silentRestore: true });
    } catch {
      // Internal connectWithFallback might have set error if all failed
      // but autoRestore requirement was silent
      this.setState('idle');
    }
  }

  async connectWithFallback(priorityList: string[], { silentRestore = false } = {}): Promise<void> {
    const errors: Array<{ name: string; error: string }> = [];
    for (const name of priorityList) {
      try {
        await this.connect(name, { silent: true }); // do not fire global events yet
        return;
      } catch (err) {
        errors.push({ name, error: err instanceof Error ? err.message : String(err) });
      }
    }
    const wrapped = new FallbackExhaustedError(priorityList, errors);
    if (!silentRestore) {
      this.setState('error');
      this.emit('onError', wrapped);
    }
    throw wrapped;
  }

  // ── Logic ──────────────────────────────────────────────────────────────────

  async signIntent(intent: MidnightIntent): Promise<SignedIntent> {
    const wallet = this.getActiveWallet();
    this.checkNetworkMatch();

    const ctx: MiddlewareContext = { operation: 'signIntent', intent, adapterName: wallet.name };
    let result: SignedIntent | undefined;

    await this.executeMiddleware(ctx, async () => {
      result = await wallet.signIntent(intent);
      ctx.result = result;
    });

    return result!;
  }

  async signMessage(message: string): Promise<SignedMessage> {
    const wallet = this.getActiveWallet();
    this.checkNetworkMatch();

    const ctx: MiddlewareContext = { operation: 'signMessage', message, adapterName: wallet.name };
    let result: SignedMessage | undefined;

    await this.executeMiddleware(ctx, async () => {
      const timestamp = Date.now();
      const prefixedMessage = `\x19Midnight Signed Message:\n${message.length}${message}`;
      
      // We use the underlying adapter's generic signing capability if available,
      // or try signIntent with a specialized payload. In production, adapters 
      // should ideally expose a direct signData/signMessage method.
      // For now, we reuse the resilient probing pattern inside the adapter.
      try {
        const signed = await wallet.signIntent(prefixedMessage);
        
        result = {
          message,
          signature: signed.signature,
          publicKey: signed.publicKey,
          timestamp,
        };
        ctx.result = result;
      } catch (err) {
        throw new MessageSigningError(message, err);
      }
    });

    return result!;
  }

  // ── Getters & State ────────────────────────────────────────────────────────

  getActiveWallet(): MidnightWallet {
    if (!this.activeWallet || this.state !== 'connected') throw new WalletNotConnectedError();
    return this.activeWallet;
  }

  tryGetActiveWallet(): MidnightWallet | null {
    return this.state === 'connected' ? this.activeWallet : null;
  }

  getConnectionState(): ConnectionState { return this.state; }
  isConnected(): boolean { return this.state === 'connected'; }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async withLock(op: () => Promise<void>): Promise<void> {
    const prev = this.operationLock;
    let resolve!: () => void;
    this.operationLock = new Promise<void>((r) => { resolve = r; });
    await prev;
    try { await op(); } finally { resolve(); }
  }

  private async doConnect(name: string): Promise<void> {
    const key = name.toLowerCase();
    const wallet = this.wallets.get(key);
    if (!wallet) throw new WalletNotRegisteredError(name, this.getRegisteredNames());

    if (this.activeWallet === wallet && this.isConnected()) return;

    if (this.activeWallet && this.activeWallet !== wallet) await this.doDisconnect();

    this.setState('connecting');
    try {
      await wallet.connect();
      this.activeWallet = wallet;
      this.lastServiceUris = wallet.getServiceUris();
      this.startNetworkPolling();
      this.setState('connected');
      this.emit('onConnect', wallet);
    } catch (err) {
      throw wrapError(err, `Failed to connect to "${name}".`);
    }
  }

  private async doDisconnect(): Promise<void> {
    if (!this.activeWallet) return;
    const name = this.activeWallet.name;
    this.stopNetworkPolling();
    try {
      this.setState('disconnecting');
      await this.activeWallet.disconnect();
    } finally {
      this.activeWallet = null;
      this.lastServiceUris = null;
      this.setState('disconnected');
      this.emit('onDisconnect', name);
    }
  }

  private startNetworkPolling(): void {
    this.stopNetworkPolling();
    this.networkInterval = setInterval(() => {
      if (!this.activeWallet) return;
      const current = this.activeWallet.getServiceUris();
      if (this.lastServiceUris && current && JSON.stringify(current) !== JSON.stringify(this.lastServiceUris)) {
        const prev = this.lastServiceUris;
        this.lastServiceUris = current;
        this.emit('onNetworkChange', current, prev);
      }
    }, this.opts.networkPollMs ?? 30000);
  }

  private stopNetworkPolling(): void {
    if (this.networkInterval) {
      clearInterval(this.networkInterval);
      this.networkInterval = null;
    }
  }

  private checkNetworkMatch(): void {
    if (this.opts.allowNetworkSwitch || !this.activeWallet || !this.lastServiceUris) return;
    const current = this.activeWallet.getServiceUris();
    if (current && JSON.stringify(current) !== JSON.stringify(this.lastServiceUris)) {
      throw new NetworkMismatchError(current.nodeUri, this.lastServiceUris.nodeUri);
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit('onStateChange', state);
  }
}
