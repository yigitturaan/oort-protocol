"use client";

import LedgerTicker from "./LedgerTicker";
import WalletButton from "./WalletButton";

export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-wider text-accent">
          OORT TERMINAL
        </h1>
        <span className="text-xs px-2 py-0.5 rounded bg-accent-dim text-accent">
          Testnet
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="hidden sm:flex items-center gap-2 text-foreground/60">
          <span>Ledger</span>
          <LedgerTicker />
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
