"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VerificationEntry } from "../lib/events";
import { fetchRecentVerifications } from "../lib/events";
import { getLatestLedger } from "../lib/stellar";
import VerificationCard from "./VerificationCard";

const POLL_INTERVAL = 5000;
const LOOKBACK_LEDGERS = 500;

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

export default function VerificationFeed({
  onEntriesChange,
}: {
  onEntriesChange?: (entries: VerificationEntry[]) => void;
}) {
  const [entries, setEntriesState] = useState<VerificationEntry[]>(DEMO_ENTRIES);
  const [liveCount, setLiveCount] = useState(0);
  const seenIds = useRef(new Set(DEMO_ENTRIES.map((e) => e.id)));

  const setEntries = useCallback(
    (updater: VerificationEntry[] | ((prev: VerificationEntry[]) => VerificationEntry[])) => {
      setEntriesState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (next !== prev) onEntriesChange?.(next);
        return next;
      });
    },
    [onEntriesChange]
  );

  const poll = useCallback(async () => {
    try {
      const ledger = await getLatestLedger();
      const start = Math.max(0, ledger - LOOKBACK_LEDGERS);
      const fresh = await fetchRecentVerifications(start);

      if (fresh.length > 0) {
        setEntries((prev) => {
          const newOnes = fresh.filter((e) => !seenIds.current.has(e.id));
          if (newOnes.length === 0) return prev;
          for (const e of newOnes) seenIds.current.add(e.id);
          setLiveCount((c) => c + newOnes.length);
          return [...newOnes, ...prev].slice(0, 50);
        });
      }
    } catch {
      // non-fatal
    }
  }, [setEntries]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  const totalVerified = entries.filter((e) => e.type === "verified").length;
  const totalRejected = entries.filter((e) => e.type === "rejected").length;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          Verification Feed
        </h2>
        <div className="flex items-center gap-4 text-xs text-foreground-muted font-mono">
          <span className="text-success">{totalVerified} passed</span>
          <span className="text-danger">{totalRejected} rejected</span>
          {liveCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-accent-bg text-accent text-[10px] font-medium animate-pulse">
              {liveCount} live
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <VerificationCard key={entry.id} entry={entry} index={i} />
        ))}
      </div>

      {entries.length === 0 && (
        <div className="text-center text-foreground-muted py-16 text-sm">
          Waiting for verifications...
        </div>
      )}
    </section>
  );
}
