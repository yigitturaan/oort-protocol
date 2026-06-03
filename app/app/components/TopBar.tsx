"use client";

import LedgerTicker from "./LedgerTicker";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
        <span className="text-lg font-bold tracking-tight text-foreground">
          OORT
        </span>

        <nav className="hidden sm:flex items-center gap-6 text-sm text-foreground-muted">
          <a href="#flow" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#demo" className="hover:text-foreground transition-colors">
            Demo
          </a>
          <a href="#reputation" className="hover:text-foreground transition-colors">
            Agents
          </a>
        </nav>

        <div className="flex items-center gap-2 text-xs font-mono text-foreground-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <LedgerTicker />
        </div>
      </div>
    </header>
  );
}
