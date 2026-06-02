"use client";

import { useState } from "react";
import TopBar from "./components/TopBar";
import VerificationFeed from "./components/VerificationFeed";
import ReputationTable from "./components/ReputationTable";
import DemoControls from "./components/DemoControls";
import type { VerificationEntry } from "./lib/events";

export default function Home() {
  const [entries, setEntries] = useState<VerificationEntry[]>([]);

  return (
    <div className="flex flex-col flex-1">
      <TopBar />

      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-8">
        <DemoControls />
        <VerificationFeed onEntriesChange={setEntries} />
        <ReputationTable entries={entries} />
      </main>

      <footer className="text-center text-xs text-foreground/30 py-4 border-t border-border">
        OORT Protocol — Guvenmeden Dogrula — Stellar Testnet
      </footer>
    </div>
  );
}
