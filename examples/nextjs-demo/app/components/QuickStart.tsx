"use client";

import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";

const codeTabs = [
  {
    id: "install",
    label: "1. Install",
    code: `npm install midnight-wallet-kit`,
    language: "bash"
  },
  {
    id: "setup",
    label: "2. Setup",
    code: `import { WalletManager, InjectedWalletAdapter } from 'midnight-wallet-kit';
import { WalletProvider } from 'midnight-wallet-kit/react';

const manager = new WalletManager();
manager
  .register(new InjectedWalletAdapter({ name: 'Lace', providerKey: 'lace' }))
  .register(new InjectedWalletAdapter({ name: '1AM', providerKey: 'midnight' }));

function App({ children }) {
  return (
    <WalletProvider manager={manager} autoRestore={true}>
      {children}
    </WalletProvider>
  );
}`,
    language: "tsx"
  },
  {
    id: "use",
    label: "3. Use",
    code: `import { useWallet, useConnect, useIntent, useBalance } 
  from 'midnight-wallet-kit/react';

export function WalletProfile() {
  const { address, isConnected } = useWallet();
  const { connect, disconnect } = useConnect();
  const { balance } = useBalance();
  const { signMessage } = useIntent();

  if (!isConnected) 
    return <button onClick={() => connect('1AM')}>Connect</button>;

  return (
    <div>
      <p>{address}</p>
      <p>{balance?.tDUST.toString()} tDUST</p>
      <button onClick={() => signMessage('Login to Midnight DApp')}>
        Sign Message
      </button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}`,
    language: "tsx"
  }
];

export function QuickStart() {
  const [activeTab, setActiveTab] = useState(codeTabs[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="quick-start" className="mx-auto max-w-7xl px-6 py-32 lg:px-8">
      <div className="flex flex-col items-center">
        <span className="section-label">QUICK START</span>
        <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Integrate in minutes.</h2>
        <p className="mt-4 text-text-secondary text-center max-w-2xl">
          Everything you need to get up and running with the Midnight Network. 
          Simply install, configure, and start using our first-class React hooks.
        </p>
      </div>

      <div className="mt-16 flex flex-col items-center">
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 p-1 mb-10">
          {codeTabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => {
                setActiveTab(tab);
                setCopied(false);
              }}
              className={`rounded-full px-6 py-2 text-xs font-bold uppercase transition-all ${
                activeTab.id === tab.id ? "bg-brand-violet text-white shadow-lg" : "text-text-secondary hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/5 bg-[#0d0d1a] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 opacity-40">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <span className="font-mono text-xs text-text-secondary">midnight-wallet-kit-demo.{activeTab.language}</span>
            </div>
            
            <button 
              onClick={handleCopy}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                copied ? "text-green-400" : "text-brand-violet hover:bg-brand-violet/10"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "COPIED" : "COPY CODE"}
            </button>
          </div>
          
          <div className="p-8 overflow-auto max-h-[500px]">
            <pre className="font-mono text-sm leading-relaxed text-blue-300">
              <code className="text-white">
                <span className="text-brand-violet font-bold opacity-30 select-none mr-4">1</span>
                {activeTab.code.split('\n').map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-white/20 font-mono text-[10px] w-6 mr-6 select-none border-r border-white/5">{i+1}</span>
                    <span className={i === 0 && activeTab.id === 'install' ? 'text-green-400' : ''}>{line}</span>
                  </div>
                ))}
                {activeTab.id === 'install' && <span className="typing-cursor" />}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
