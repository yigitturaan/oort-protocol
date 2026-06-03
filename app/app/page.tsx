"use client";

import { useState } from "react";
import TopBar from "./components/TopBar";
import Hero from "./components/Hero";
import LiveFlow from "./components/LiveFlow";
import HashExplainer from "./components/HashExplainer";
import DemoControls from "./components/DemoControls";
import SDKSection from "./components/SDKSection";
import ReputationTable from "./components/ReputationTable";
import type { VerificationEntry } from "./lib/events";

const DEMO_ENTRIES: VerificationEntry[] = [
  {
    id: "demo-1",
    type: "verified",
    intentId: "7c6807224a2c825fb5442fd1142e746f",
    agent: "GBW5EIV37S55O3RLMNX2JMZEZTTY6SAUJTWQ3TJ4N35ANURPUGTVBU43",
    amount: BigInt(10_0000000),
    oracleVerdict: "Passed",
    deviationBps: 0,
    slashAmount: BigInt(0),
    ledger: 2878924,
    timestamp: new Date(Date.now() - 30_000).toISOString(),
    reputation: { oldScore: 1000, newScore: 1020 },
  },
  {
    id: "demo-2",
    type: "rejected",
    intentId: "f498b474c2e25f53ceea9562116900f9",
    agent: "GBSYZWDD2N63R6IOOIP2DI4GQPHID6RKDYSSW42G3U3PXTXV4SXA4KLZ",
    amount: BigInt(10_0000000),
    oracleVerdict: "HardReject",
    deviationBps: 3132,
    slashAmount: BigInt(100_0000000),
    ledger: 2878930,
    timestamp: new Date(Date.now() - 15_000).toISOString(),
    reputation: { oldScore: 1000, newScore: 950 },
  },
];

export default function Home() {
  const [entries] = useState<VerificationEntry[]>(DEMO_ENTRIES);

  return (
    <div className="snap-container">
      <TopBar />

      <section className="snap-section">
        <Hero />
      </section>

      <section className="snap-section bg-surface-elevated">
        <LiveFlow />
      </section>

      <section className="snap-section">
        <HashExplainer />
      </section>

      <section className="snap-section bg-surface-elevated">
        <DemoControls />
      </section>

      <section className="snap-section bg-surface-elevated">
        <SDKSection />
      </section>

      <section className="snap-section">
        <ReputationTable entries={entries} />
      </section>

      <section className="snap-section">
        <footer className="flex items-center justify-center h-full px-6">
          <div className="text-center space-y-4">
            <div className="text-lg font-bold text-foreground">
              Trust No Agent. Verify Every Claim.
            </div>
            <p className="text-sm text-foreground-muted max-w-md mx-auto">
              OORT Protocol is the missing security layer for AI agents on Stellar.
              Open source. On-chain verified. Built for the agentic economy.
            </p>
            <div className="flex justify-center gap-6 pt-4 text-xs text-foreground-muted">
              <span>Stellar Testnet</span>
              <span>·</span>
              <span>HackStellar Istanbul 2026</span>
              <span>·</span>
              <a href="https://github.com" className="text-accent hover:underline">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
