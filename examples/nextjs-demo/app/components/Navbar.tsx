"use client";

const NAV_LINKS = [
  { label: "Features",    href: "/#features"     },
  { label: "Demo",        href: "/#demo"          },
  { label: "Quick start", href: "/#quick-start"   },
  { label: "Docs",        href: "/docs"           },
  { label: "Errors",      href: "/#errors"        },
] as const;

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-4.51-2-7-2" />
    </svg>
  );
}

export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(11,11,15,0.85)",
        borderBottom: "1px solid var(--color-border-default)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-8">

        {/* Logo */}
        <a
          href="/"
          className="text-sm font-[650]"
          style={{
            color: "var(--color-text-primary)",
            letterSpacing: "var(--letter-spacing-tight)",
          }}
        >
          midnight-wallet-kit
        </a>

        {/* Links + CTA */}
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-5 md:flex">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-[13px] transition-colors"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-secondary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                {label}
              </a>
            ))}
          </div>

          <a
            href="https://github.com/tusharpamnani/midnight-wallet-kit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--color-border-emphasis)",
              color: "var(--color-text-secondary)",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--color-border-strong)";
              el.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--color-border-emphasis)";
              el.style.color = "var(--color-text-secondary)";
            }}
          >
            <GithubIcon size={14} />
            GitHub
          </a>
        </div>

      </div>
    </nav>
  );
}