"use client";

import { useState } from "react";
import { 
  Book, 
  Terminal, 
  Cpu, 
  Link2, 
  AlertTriangle, 
  ShieldCheck, 
  Code2, 
  ChevronRight, 
  ExternalLink,
  Layers,
  ArrowRight
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

// Documentation Content Structure
const sections = [
  {
    id: "architecture",
    title: "Core Architecture",
    icon: <Layers size={18} />,
    content: (
      <>
        <p className="text-text-secondary leading-relaxed">
          Midnight Wallet Kit follows a clean, event-driven architecture that separates wallet-specific communication from application-level state management.
        </p>
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
            <h4 className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-violet uppercase mb-4">
              <ShieldCheck size={16} /> Layer 1: Adapters
            </h4>
            <p className="text-sm text-text-secondary">
              Adapters handle physical or injected provider communication. Every adapter implements the <code className="text-blue-300">MidnightWallet</code> interface, ensuring a consistent contract.
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
            <h4 className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-violet uppercase mb-4">
              <Cpu size={16} /> Layer 2: WalletManager
            </h4>
            <p className="text-sm text-text-secondary">
              The central orchestrator that manages Registry lifecycle, Fallback chains, and Session persistence using an internal state machine.
            </p>
          </div>
        </div>
      </>
    )
  },
  {
    id: "manager-api",
    title: "WalletManager API",
    icon: <Terminal size={18} />,
    content: (
      <div className="space-y-8">
        {[
          {
            method: "register(wallet: MidnightWallet)",
            desc: "Register a new adapter. Names are case-insensitive internally.",
            code: "manager.register(new InjectedWalletAdapter())"
          },
          {
            method: "async connect(name: string)",
            desc: "Connects to the specified adapter. Automatically disconnects the previous wallet.",
            code: "await manager.connect('Lace')"
          },
          {
            method: "use(middleware: Middleware)",
            desc: "Adds a global interceptor for logging, analytics, or blocking operations.",
            code: "manager.use(async (ctx, next) => { ... })"
          }
        ].map((item, i) => (
          <div key={i} className="group">
            <h4 className="font-mono text-sm font-bold text-blue-300 mb-2">{item.method}</h4>
            <p className="text-sm text-text-secondary mb-4">{item.desc}</p>
            <div className="rounded-xl bg-black/40 p-4 font-mono text-[11px] text-white/60">
              {item.code}
            </div>
          </div>
        ))}
      </div>
    )
  },
  {
    id: "react-hooks",
    title: "React Hooks",
    icon: <Code2 size={18} />,
    content: (
      <div className="space-y-12">
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-brand-violet">useWallet()</span>
            <span className="text-[10px] font-black uppercase text-white/20 tracking-tighter">— Global State</span>
          </h4>
          <p className="text-sm text-text-secondary">Returns the complete status of the currently active wallet.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["address", "coinPublicKey", "isConnected", "serviceUris"].map(prop => (
              <div key={prop} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-violet shadow-[0_0_8px_#7c3aed]" />
                <span className="font-mono text-[12px] text-blue-300">{prop}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-8 border-t border-white/5">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
             <span className="text-brand-violet">useBalance()</span>
             <span className="text-[10px] font-black uppercase text-white/20 tracking-tighter font-mono">— Live Polling</span>
          </h4>
          <p className="text-sm text-text-secondary">Fetches and tracks user balance with automatic polling every 15 seconds.</p>
          <div className="rounded-xl bg-black/40 p-6 font-mono text-[12px] text-blue-300 leading-relaxed overflow-x-auto">
            {`const { balance, isLoading, refetch } = useBalance();\n\n// balance.tDUST (bigint)\n// balance.shielded (bigint)`}
          </div>
        </div>
      </div>
    )
  },
  {
    id: "testing",
    title: "Mocking for Testing",
    icon: <ShieldCheck size={18} />,
    content: (
      <div className="space-y-6">
        <p className="text-text-secondary leading-relaxed">
          The kit includes <code className="text-blue-300 italic">MockWalletAdapter</code> for zero-dependency local testing.
        </p>
        <div className="rounded-2xl border border-white/5 bg-white/5 p-6 space-y-4">
           <h5 className="font-bold text-sm text-white">Configurable Options:</h5>
           <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px] text-text-secondary font-mono">
             <li className="flex gap-2">
               <ArrowRight size={14} className="text-brand-violet" />
               <span>signDelay: number</span>
             </li>
             <li className="flex gap-2">
               <ArrowRight size={14} className="text-brand-violet" />
               <span>shouldRejectSign: boolean</span>
             </li>
             <li className="flex gap-2">
                <ArrowRight size={14} className="text-brand-violet" />
                <span>addressOverride: string</span>
             </li>
             <li className="flex gap-2">
                <ArrowRight size={14} className="text-brand-violet" />
                <span>signatureOverride: string</span>
             </li>
           </ul>
        </div>
      </div>
    )
  },
  {
    id: "errors",
    title: "Error Taxonomy",
    icon: <AlertTriangle size={18} />,
    content: (
      <div className="space-y-6">
        <p className="text-text-secondary">
          Every error implements <code className="text-blue-300">toJSON()</code> and maintains an <code className="text-blue-300">Error.cause</code> chain for telemetry.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/5">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 font-black uppercase tracking-widest text-text-secondary">Code</th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-text-secondary">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { code: "WALLET_NOT_CONNECTED", desc: "Operation attempted without a session." },
                { code: "INVALID_INTENT", desc: "Zod-validation failed before bridge." },
                { code: "SESSION_EXPIRED", desc: "Persistence key revoked." }
              ].map(error => (
                <tr key={error.code}>
                  <td className="px-6 py-4 font-bold text-blue-300">{error.code}</td>
                  <td className="px-6 py-4 text-text-secondary">{error.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background selection:bg-brand-violet selection:text-white">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 lg:px-8 py-32 lg:py-48 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Sidebar Nav */}
        <aside className="lg:col-span-3 lg:sticky lg:top-48 h-fit space-y-8">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-6">Documentation</h3>
            <ul className="space-y-2">
              {sections.map(section => (
                <li key={section.id}>
                  <button 
                    onClick={() => scrollTo(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                      activeSection === section.id 
                        ? "bg-brand-violet/10 text-brand-violet border border-brand-violet/20" 
                        : "text-text-secondary hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {section.icon}
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 p-6 overflow-hidden relative group">
             <div className="absolute inset-0 bg-gradient-to-br from-brand-violet/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="relative z-10">
               <h4 className="text-xs font-bold text-white mb-2">Need help?</h4>
               <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">Join our discord for developer support.</p>
               <button className="text-[10px] font-black uppercase tracking-widest text-brand-violet flex items-center gap-1.5 hover:gap-2 transition-all">
                 Join Discord <ChevronRight size={10} />
               </button>
             </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-32">
          {sections.map(section => (
            <section key={section.id} id={section.id} className="scroll-mt-48 fade-in">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-brand-violet">
                   {section.icon}
                </div>
                <h2 className="text-3xl font-black italic tracking-tighter">{section.title}</h2>
              </div>
              <div className="pl-0 lg:pl-4 border-l border-white/5 py-4">
                {section.content}
              </div>
            </section>
          ))}

          {/* Footer CTA in Docs */}
          <section className="pt-24 border-t border-white/5">
             <div className="rounded-[40px] bg-gradient-to-br from-brand-violet/20 to-brand-magenta/5 border border-white/5 p-12 text-center overflow-hidden relative">
               <div className="absolute top-0 right-0 w-64 h-64 bg-brand-violet/20 blur-[120px] -z-10" />
               <h3 className="text-3xl font-black italic mb-4">Start Building Privacy.</h3>
               <p className="text-text-secondary text-sm max-w-xl mx-auto mb-8">
                 Ready to deploy? The Midnight Wallet Kit is designed to grow with your application from day one.
               </p>
               <div className="flex flex-wrap justify-center gap-4">
                 <button className="btn-primary flex items-center gap-2">
                   Get the Kit <ChevronRight size={18} />
                 </button>
                 <button className="btn-secondary">
                   GitHub Repository
                 </button>
               </div>
             </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
