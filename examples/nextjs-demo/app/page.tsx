import Providers from "./providers";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { LiveDemo } from "./components/LiveDemo";
import { QuickStart } from "./components/QuickStart";
import { ErrorReference } from "./components/ErrorReference";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <Providers>
      <div className="relative flex min-h-screen flex-col overflow-x-hidden">
        <Navbar />
        
        <main className="flex-grow">
          <Hero />
          
          <div className="relative">
            {/* Top divider with glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
            <Features />
          </div>

          <div className="bg-gradient-to-b from-transparent via-surface/30 to-transparent">
            <LiveDemo />
          </div>

          <QuickStart />

          <div className="relative">
             <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/10 to-transparent" />
             <ErrorReference />
          </div>
        </main>

        <Footer />
      </div>
    </Providers>
  );
}
