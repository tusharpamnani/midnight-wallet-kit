"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useWallet,
  useConnect,
  useIntent,
} from "midnight-wallet-kit/react";
import type { ConnectionState } from "midnight-wallet-kit";
import styles from "./page.module.css";

/* ── Event types for the log ───────────────────────────────────────── */
type EventKind = "connect" | "disconnect" | "state" | "error" | "sign";

interface LogEntry {
  id: number;
  kind: EventKind;
  message: string;
  time: string;
}

let logId = 0;

function now() {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ── State label map ───────────────────────────────────────────────── */
const STATE_BADGE: Record<ConnectionState, { label: string; cls: string }> = {
  idle: { label: "Idle", cls: "badge-neutral" },
  connecting: { label: "Connecting…", cls: "badge-warning" },
  connected: { label: "Connected", cls: "badge-success" },
  disconnecting: { label: "Disconnecting…", cls: "badge-warning" },
  disconnected: { label: "Disconnected", cls: "badge-neutral" },
  error: { label: "Error", cls: "badge-error" },
  restoring: { label: "Restoring…", cls: "badge-warning" },
};

/* ═══════════════════════════════════════════════════════════════════ */
/*  Dashboard Component                                               */
/* ═══════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const {
    wallet,
    address,
    coinPublicKey,
    encryptionPublicKey,
    serviceUris,
    connectionState,
    isConnected,
    error,
    manager
  } = useWallet();
  const {
    connect,
    disconnect,
    isLoading: connectLoading,
    adapters,
  } = useConnect();
  const {
    buildAndSign,
    isLoading: signLoading,
    error: intentError,
  } = useIntent();

  /* ── Event log ─────────────────────────────────────────────────── */
  const [events, setEvents] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const pushEvent = useCallback((kind: EventKind, message: string) => {
    setEvents((prev) => [
      { id: logId++, kind, message, time: now() },
      ...prev.slice(0, 49), // keep last 50
    ]);
  }, []);

  // Subscribe to manager events
  useEffect(() => {
    const onConnect = (w: { name: string }) =>
      pushEvent("connect", `Wallet "${w.name}" connected`);
    const onDisconnect = (name: string) =>
      pushEvent("disconnect", `Wallet "${name}" disconnected`);
    const onState = (s: ConnectionState) =>
      pushEvent("state", `State → ${s}`);
    const onError = (e: Error) =>
      pushEvent("error", e.message);

    manager.on("onConnect", onConnect);
    manager.on("onDisconnect", onDisconnect);
    manager.on("onStateChange", onState);
    manager.on("onError", onError);

    return () => {
      manager.off("onConnect", onConnect);
      manager.off("onDisconnect", onDisconnect);
      manager.off("onStateChange", onState);
      manager.off("onError", onError);
    };
  }, [manager, pushEvent]);

  /* ── Intent form state ─────────────────────────────────────────── */
  const [contract, setContract] = useState(
    "0xe5ef84eb9e72532120f5530a13257b8d16ed9726333aa1af767dfbf2091e5fb0"
  );
  const [action, setAction] = useState("transfer");
  const [paramKey, setParamKey] = useState("amount");
  const [paramValue, setParamValue] = useState("100");
  const [signatureResult, setSignatureResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  const handleSign = async () => {
    setSignatureResult(null);
    try {
      const signed = await buildAndSign({
        contract,
        action,
        params: { [paramKey]: paramValue },
      });
      setSignatureResult(signed as unknown as Record<string, unknown>);
      pushEvent(
        "sign",
        `Signed "${action}" intent — sig: ${(signed.signature ?? "").slice(0, 24)}…`
      );
    } catch {
      // error is surfaced through intentError
    }
  };

  /* ── Adapter connect handler ───────────────────────────────────── */
  const handleConnect = async (name: string) => {
    try {
      await connect(name);
    } catch {
      // surfaced through useConnect error
    }
  };

  const handleDisconnect = async () => {
    setSignatureResult(null);
    try {
      await disconnect();
    } catch {
      // surfaced through useConnect error
    }
  };

  /* ── Badge state ───────────────────────────────────────────────── */
  const badge = STATE_BADGE[connectionState];

  return (
    <main className={styles.container}>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <header className={styles.hero}>
        <h1>Midnight Wallet Kit</h1>
        <p>
          Official demo for the Midnight Wallet Kit.
          Exclusively demonstrating 1AM and Lace wallet integrations.
        </p>
        <div className={styles.heroMeta}>
          <span className={`badge ${badge.cls}`}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "currentColor",
              }}
            />
            {badge.label}
          </span>
          <span className="badge badge-neutral">Next.js + React</span>
          <span className="badge badge-neutral">TypeScript</span>
        </div>
      </header>

      {/* ── Grid ──────────────────────────────────────────────────── */}
      <div className={`${styles.grid} stagger`}>
        {/* ── Connection Panel ─────────────────────────────────── */}
        <section className={`glass-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>⚡</div>
            <div>
              <div className={styles.panelTitle}>Connection</div>
              <div className={styles.panelSubtitle}>
                Current wallet state
              </div>
            </div>
          </div>

          <div className={styles.walletInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status</span>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Wallet</span>
              <span className={styles.infoValue}>
                {wallet?.name ?? "—"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Address</span>
              <span className={styles.infoValue}>
                {address ? `${address.slice(0, 12)}...${address.slice(-8)}` : "—"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Coin PK</span>
              <span className={styles.infoValue}>
                {coinPublicKey ? `${coinPublicKey.slice(0, 10)}...` : "—"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Encryption PK</span>
              <span className={styles.infoValue}>
                {encryptionPublicKey ? `${encryptionPublicKey.slice(0, 10)}...` : "—"}
              </span>
            </div>

            <div className={styles.connectionActions}>
              {isConnected ? (
                <button
                  className="btn btn-danger"
                  onClick={handleDisconnect}
                  disabled={connectLoading}
                  id="btn-disconnect"
                >
                  {connectLoading && <span className="spinner" />}
                  Disconnect
                </button>
              ) : (
                <div className={styles.connectionActions}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleConnect("1AM Wallet")}
                    disabled={connectLoading}
                  >
                    Connect 1AM
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleConnect("Lace Wallet")}
                    disabled={connectLoading}
                  >
                    Connect Lace
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className={styles.errorBox} style={{ marginTop: 16 }}>
              <span>⚠</span>
              <span>{error.message}</span>
            </div>
          )}
        </section>

        {/* ── Adapters Panel ───────────────────────────────────── */}
        <section className={`glass-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>🔌</div>
            <div>
              <div className={styles.panelTitle}>Registered Adapters</div>
              <div className={styles.panelSubtitle}>
                Available wallet adapters
              </div>
            </div>
          </div>

          <div className={styles.adapterList}>
            {adapters.map((adapter: { name: string }) => {
              const isActive =
                wallet?.name.toLowerCase() === adapter.name.toLowerCase();
              return (
                <div key={adapter.name} className={styles.adapterItem}>
                  <div className={styles.adapterName}>
                    <span
                      className={`${styles.adapterDot} ${isActive ? styles.adapterDotActive : ""
                        }`}
                    />
                    <span style={{ fontWeight: 600 }}>{adapter.name}</span>
                    {isActive && (
                      <span className="badge badge-success">Active</span>
                    )}
                  </div>
                  {!isActive && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleConnect(adapter.name)}
                      disabled={connectLoading}
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Network Services Panel ───────────────────────────── */}
        <section className={`glass-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>🌐</div>
            <div>
              <div className={styles.panelTitle}>Network Services</div>
              <div className={styles.panelSubtitle}>
                Connected node &amp; proof endpoints
              </div>
            </div>
          </div>

          <div className={styles.networkInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Indexer</span>
              <span className={styles.infoValue}>
                {serviceUris?.indexerUri ?? "—"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Prover</span>
              <span className={styles.infoValue}>
                {serviceUris?.proofServerUri ?? "—"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Node</span>
              <span className={styles.infoValue}>
                {serviceUris?.nodeUri ?? "—"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Network ID</span>
              <span className={styles.infoValue}>
                {serviceUris?.networkId ?? "—"}
              </span>
            </div>
          </div>
        </section>

        {/* ── Intent Builder Panel ─────────────────────────────── */}
        <section className={`glass-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>📝</div>
            <div>
              <div className={styles.panelTitle}>Intent Builder</div>
              <div className={styles.panelSubtitle}>
                Build &amp; sign a Midnight intent
              </div>
            </div>
          </div>

          <div className={styles.intentForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="input-contract">
                Contract
              </label>
              <input
                id="input-contract"
                className={styles.formInput}
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                placeholder="0x..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="input-action">
                Action
              </label>
              <input
                id="input-action"
                className={styles.formInput}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g. mint, transfer"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="input-param-key">
                  Param Key
                </label>
                <input
                  id="input-param-key"
                  className={styles.formInput}
                  value={paramKey}
                  onChange={(e) => setParamKey(e.target.value)}
                  placeholder="key"
                />
              </div>
              <div className={styles.formGroup}>
                <label
                  className={styles.formLabel}
                  htmlFor="input-param-value"
                >
                  Param Value
                </label>
                <input
                  id="input-param-value"
                  className={styles.formInput}
                  value={paramValue}
                  onChange={(e) => setParamValue(e.target.value)}
                  placeholder="value"
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSign}
              disabled={!isConnected || signLoading}
              id="btn-sign"
            >
              {signLoading ? (
                <span className="spinner" />
              ) : (
                <span>✍️</span>
              )}
              {signLoading ? "Signing…" : "Build & Sign Intent"}
            </button>

            {intentError && (
              <div className={styles.errorBox}>
                <span>⚠</span>
                <span>{intentError.message}</span>
              </div>
            )}

            {signatureResult && (
              <div className={styles.signatureResult}>
                <div className={styles.signatureHeader}>
                  <span>✅</span> Signed Successfully
                </div>
                <div className={styles.signatureField}>
                  <div className={styles.signatureKey}>Signature</div>
                  <div className={styles.signatureValue}>
                    {String(signatureResult.signature)}
                  </div>
                </div>
                <div className={styles.signatureField}>
                  <div className={styles.signatureKey}>Public Key</div>
                  <div className={styles.signatureValue}>
                    {String(signatureResult.publicKey)}
                  </div>
                </div>
                <div className={styles.signatureField}>
                  <div className={styles.signatureKey}>Timestamp</div>
                  <div className={styles.signatureValue}>
                    {new Date(
                      signatureResult.timestamp as number
                    ).toISOString()}
                  </div>
                </div>
                <div className={styles.signatureField}>
                  <div className={styles.signatureKey}>Intent</div>
                  <div className={styles.signatureValue}>
                    {JSON.stringify(signatureResult.intent, null, 2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Event Log Panel ──────────────────────────────────── */}
        <section className={`glass-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>📡</div>
            <div>
              <div className={styles.panelTitle}>Event Log</div>
              <div className={styles.panelSubtitle}>
                Real-time manager events
              </div>
            </div>
            {events.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => setEvents([])}
                id="btn-clear-log"
              >
                Clear
              </button>
            )}
          </div>

          <div className={styles.eventLog} ref={logRef}>
            {events.length === 0 ? (
              <div className={styles.emptyLog}>
                No events yet. Connect a wallet to see events appear here.
              </div>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className={styles.eventItem}>
                  <span className={styles.eventTime}>{evt.time}</span>
                  <div className={styles.eventContent}>
                    <div
                      className={`${styles.eventType} ${evt.kind === "connect"
                        ? styles.eventTypeConnect
                        : evt.kind === "disconnect"
                          ? styles.eventTypeDisconnect
                          : evt.kind === "state"
                            ? styles.eventTypeState
                            : evt.kind === "error"
                              ? styles.eventTypeError
                              : styles.eventTypeSign
                        }`}
                    >
                      {evt.kind}
                    </div>
                    <div className={styles.eventMessage}>{evt.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Code Snippet Panel ───────────────────────────────── */}
        <section className={`glass-card ${styles.panel} ${styles.fullWidth}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>{"</>"}</div>
            <div>
              <div className={styles.panelTitle}>Quick Start</div>
              <div className={styles.panelSubtitle}>
                Copy this into your Next.js app
              </div>
            </div>
          </div>

          <pre
            style={{
              background: "rgba(0,0,0,0.35)",
              padding: "20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              overflow: "auto",
              fontSize: "0.8125rem",
              lineHeight: 1.65,
              color: "var(--text-secondary)",
            }}
          >
            <code>{`import { WalletManager, InjectedWalletAdapter } from 'midnight-wallet-kit';
import { WalletProvider, useWallet, useConnect, useIntent } from 'midnight-wallet-kit/react';

// 1. Create manager + register adapters
const manager = new WalletManager();
manager.register(new InjectedWalletAdapter({ name: 'Lace', providerKey: 'lace' }));
manager.register(new InjectedWalletAdapter({ name: '1AM', providerKey: 'midnight' }));

// 2. Wrap your app
<WalletProvider manager={manager} autoConnect={['lace', 'midnight']}>
  <App />
</WalletProvider>

// 3. Use hooks in any component
function App() {
  const { wallet, address, isConnected } = useWallet();
  const { connect, disconnect, isLoading } = useConnect();
  const { buildAndSign } = useIntent();

  const handleSign = async () => {
    // buildAndSign combines IntentBuilder.create + signIntent in one step
    const signed = await buildAndSign({
      contract: '0x742d…',
      action: 'transfer',
      params: { amount: 100 }
    });
    console.log('Signed:', signed);
  };

  return (
    <div>
      {isConnected
        ? <button onClick={disconnect}>Disconnect {wallet.name}</button>
        : <button onClick={() => connect('lace')}>Connect</button>
      }
      <p>Address: {address ?? '—'}</p>
      <button onClick={handleSign} disabled={!isConnected}>Sign Intent</button>
    </div>
  );
}`}</code>
          </pre>
        </section>
      </div>
    </main>
  );
}
