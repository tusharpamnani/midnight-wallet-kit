"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useWallet,
  useConnect,
  useIntent,
} from "midnight-wallet-kit/react";
import { useBalance } from "../hooks/useBalance";
import { getRegisteredWalletIds } from "midnight-wallet-kit";
import {
  Wallet,
  Unplug,
  Activity,
  PenTool,
  Terminal,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type LogEntry = {
  time: string;
  type: "info" | "state" | "success" | "error";
  message: string;
};

export function LiveDemo() {
  const {
    wallet,
    address,
    connectionState,
    isConnected,
    manager,
  } = useWallet();
  const {
    connect: realConnect,
    disconnect: realDisconnect,
    isLoading: connectLoading,
    adapters,
  } = useConnect();
  const {
    signMessage,
    buildAndSign,
    isLoading: signLoading,
    error: signError,
  } = useIntent();
  const { balance, isLoading: balanceLoading } = useBalance();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [msgInput, setMsgInput] = useState("Login to Midnight DApp");
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev: LogEntry[]) => [...prev, { time, type, message }].slice(-50));
  }, []);

  // Sync logs with real manager events
  useEffect(() => {
    if (!manager) return;

    const onState = (s: string) => addLog(`State: ${s}`, "state");
    const onConnect = (w: any) => addLog(`Wallet: ${w.name} joined`, "success");
    const onDisconnect = (name: string) => addLog(`Wallet: ${name} left`, "info");
    const onError = (e: Error) => addLog(`Error: ${e.message}`, "error");

    manager.on("onStateChange", onState);
    manager.on("onConnect", onConnect);
    manager.on("onDisconnect", onDisconnect);
    manager.on("onError", onError);

    return () => {
      manager.off("onStateChange", onState);
      manager.off("onConnect", onConnect);
      manager.off("onDisconnect", onDisconnect);
      manager.off("onError", onError);
    };
  }, [manager, addLog]);

  useEffect(() => {
    if (!isConnected) {
      setLastResult(null);
    }
  }, [isConnected]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSign = async () => {
    try {
      const res = await signMessage(msgInput);
      setLastResult(res);
      addLog("Message signed successfully", "success");
    } catch (err: any) {
      addLog(`Sign failed: ${err.message}`, "error");
    }
  };

  const handleIntent = async () => {
    try {
      const res = await buildAndSign({
        contract: "0xe5ef84eb9e72532120f5530a13257b8d16ed9726333aa1af767dfbf2091e5fb0",
        action: "transfer",
        params: { amount: 100 },
      });
      setLastResult(res);
      addLog("Intent signed successfully", "success");
    } catch (err: any) {
      addLog(`Intent failed: ${err.message}`, "error");
    }
  };

  // Get all registered wallet names
  const walletIds = manager ? getRegisteredWalletIds() : [];

  return (
    <section id="demo" className="mx-auto max-w-7xl px-6 py-32 lg:px-8">
      <div className="flex flex-col items-center">
        <span className="section-label">LIVE DEMO</span>
        <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Experience our integration kit.
        </h2>
        <p className="mt-4 text-text-secondary">
          Fully functional, production-grade multi-wallet demo using all 8 supported wallets.
        </p>
      </div>

      <div className="mt-20 overflow-hidden rounded-3xl border border-violet-800/20 bg-[#0d0d1a] shadow-2xl transition-all hover:border-violet-500/30">
        <div className="flex flex-col lg:flex-row">

          {/* Left Panel: Wallet State */}
          <div className="flex-1 border-b border-violet-800/20 p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2 text-brand-violet">
                <Wallet size={20} />
              </div>
              <h3 className="text-lg font-bold">Wallet State</h3>
            </div>

            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Status</span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                      connectionState === "connecting" ? "bg-yellow-500" : "bg-white/20"
                  }`} />
                  <span className="text-xs font-bold uppercase">{connectionState}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary px-1">Address</div>
                <div className="rounded-xl bg-white/5 p-4 font-mono text-sm">
                  {address ? `${address.slice(0, 12)}...${address.slice(-8)}` : <span className="opacity-30">mn1_addr...</span>}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary px-1">Balance</div>
                <div className="rounded-xl bg-white/5 p-4 font-mono text-sm font-bold text-white">
                  {isConnected ? (
                    <span className="flex items-center gap-1.5">
                      {balanceLoading ? (
                        <Loader2 size={12} className="animate-spin opacity-40" />
                      ) : (
                        balance?.tDUST?.toString() || "0"
                      )}
                      <span className="text-[10px] text-text-secondary">tDUST</span>
                    </span>
                  ) : (
                    <span className="opacity-30">0.00 tDUST</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                {!isConnected ? (
                  walletIds.map((walletId) => (
                    <button
                      key={walletId}
                      onClick={() => realConnect(walletId)}
                      disabled={connectLoading}
                      className="rounded-xl border border-white/10 bg-white/5 py-3 text-[10px] font-bold uppercase transition-all hover:bg-white/10 disabled:opacity-30"
                    >
                      {connectLoading ? "Connecting..." : `Connect ${walletId}`}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={realDisconnect}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-3 text-xs font-bold uppercase text-red-500 transition-all hover:bg-red-500/20"
                  >
                    <Unplug size={14} />
                    Disconnect {wallet?.name}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="mt-8 rounded-2xl bg-black/40 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-3">
              <Terminal size={12} />
              Connection Log ({walletIds.length} wallets)
            </div>
            <div
              ref={logContainerRef}
              className="h-32 overflow-y-auto font-mono text-[11px] leading-relaxed"
            >
              {logs.length === 0 ? (
                <div className="text-white/20 italic">No events recorded. Connect a wallet to start.</div>
              ) : (
                logs.map((log: LogEntry, i: number) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="opacity-30 whitespace-nowrap">[{log.time}]</span>
                    <span className={
                      log.type === "success" ? "text-green-400" :
                        log.type === "state" ? "text-brand-violet" :
                        "text-white/60"
                    }>
                      {log.type === "success" ? "✓" : log.type === "state" ? "●" : "⟶"} {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Signing Demo */}
        <div className="flex-1 p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2 text-brand-violet">
              <PenTool size={20} />
            </div>
            <h3 className="text-lg font-bold">Signing Demo</h3>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary px-1">Message to Sign</label>
              <textarea
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                className="w-full rounded-2xl border border-white/5 bg-[#0a0a14] p-4 font-mono text-sm focus:border-violet-500/40 focus:outline-none focus:ring-0 resize-none h-24"
              />
            </div>

            <button
              onClick={handleSign}
              disabled={!isConnected || signLoading}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-xs font-bold uppercase transition-all ${
                isConnected && !signLoading ? "bg-brand-violet text-white hover:bg-primary-light" :
                  "bg-white/5 text-white/20 cursor-not-allowed"
              }`}
            >
              {signLoading ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
              {signLoading ? "Signing..." : "Sign Message"}
            </button>

            {lastResult && (
              <div className="fade-in space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Signature Output</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
                    <CheckCircle2 size={10} />
                    VALID PROOF
                  </span>
                </div>
                <div className="rounded-2xl bg-black/40 p-4 overflow-hidden">
                  <pre className="font-mono text-[11px] leading-relaxed text-blue-300 max-h-64 overflow-y-auto">
                    <code className="break-all whitespace-pre-wrap">{JSON.stringify(lastResult, (key, value) =>
                      typeof value === "bigint" ? value.toString() : value,
                    2)}</code>
                  </pre>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
              <h4 className="text-xs font-bold uppercase tracking-wide mb-4">Build & Sign Intent</h4>
              <div className="mb-4 rounded-xl bg-black/40 p-4 font-mono text-[11px] text-brand-violet">
                {"{ contract: \"0xe5ef84...\", action: \"transfer\", amount: 100 }"}
              </div>
              <button
                onClick={handleIntent}
                disabled={!isConnected || signLoading}
                className={`w-full rounded-xl border border-white/10 py-3 text-[10px] font-bold uppercase transition-all ${
                  isConnected ? "bg-violet-500/10 text-brand-violet hover:bg-violet-500/20" : "bg-white/5 text-white/40 cursor-not-allowed"
                }`}
              >
                {signLoading ? "Processing..." : "Sign Intent"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
