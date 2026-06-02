"use client";

import { useEffect, useState } from "react";
import { getLatestLedger } from "../lib/stellar";

export default function LedgerTicker() {
  const [ledger, setLedger] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const seq = await getLatestLedger();
        if (active) setLedger(seq);
      } catch {
        // RPC hiccup — keep last value
      }
    }

    poll();
    const id = setInterval(poll, 6000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <span className="text-accent tabular-nums">
      {ledger !== null ? `#${ledger.toLocaleString()}` : "..."}
    </span>
  );
}
