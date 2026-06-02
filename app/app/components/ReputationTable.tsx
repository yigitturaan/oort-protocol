"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchReputation,
  discoverAgentsFromEvents,
  getLatestLedger,
  type ReputationData,
} from "../lib/stellar";
import type { VerificationEntry } from "../lib/events";

const DEMO_AGENTS: ReputationData[] = [
  {
    agent: "GBW5EIV37S55O3RLMNX2JMZEZTTY6SAUJTWQ3TJ4N35ANURPUGTVBU43",
    score: 1020,
    totalVerifications: 1,
    passed: 1,
    failed: 0,
    totalVolume: BigInt(10_0000000),
    stake: BigInt(1000_0000000),
    isBanned: false,
  },
  {
    agent: "GBSYZWDD2N63R6IOOIP2DI4GQPHID6RKDYSSW42G3U3PXTXV4SXA4KLZ",
    score: 950,
    totalVerifications: 1,
    passed: 0,
    failed: 1,
    totalVolume: BigInt(10_0000000),
    stake: BigInt(900_0000000),
    isBanned: false,
  },
];

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatXlm(val: bigint): string {
  const n = Number(val) / 1e7;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export default function ReputationTable({
  entries,
}: {
  entries: VerificationEntry[];
}) {
  const [agents, setAgents] = useState<ReputationData[]>(DEMO_AGENTS);

  const refresh = useCallback(async () => {
    try {
      const ledger = await getLatestLedger();
      const start = Math.max(0, ledger - 2000);
      const discovered = await discoverAgentsFromEvents(start);

      if (discovered.length === 0) return;

      const results = await Promise.all(
        discovered.map((addr) => fetchReputation(addr))
      );
      const valid = results.filter((r): r is ReputationData => r !== null);
      if (valid.length > 0) {
        setAgents(valid.sort((a, b) => b.score - a.score));
      }
    } catch {
      // keep demo data
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const totalProtected = entries.reduce(
    (sum, e) => sum + Number(e.amount) / 1e7,
    0
  );
  const blockedCount = entries.filter((e) => e.type === "rejected").length;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground/80">
        Ajan Itibar Tablosu
      </h2>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-foreground/50 text-xs uppercase tracking-wider">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Ajan</th>
              <th className="px-4 py-2 text-right">Puan</th>
              <th className="px-4 py-2 text-right">Dogrulama</th>
              <th className="px-4 py-2 text-right">Basari</th>
              <th className="px-4 py-2 text-right">Hacim</th>
              <th className="px-4 py-2 text-right">Stake</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, idx) => {
              const successRate =
                agent.totalVerifications > 0
                  ? (
                      (agent.passed / agent.totalVerifications) *
                      100
                    ).toFixed(1)
                  : "—";

              const scoreColor =
                agent.score >= 1000
                  ? "text-success"
                  : agent.score >= 500
                    ? "text-foreground"
                    : "text-danger";

              return (
                <tr
                  key={agent.agent}
                  className={`border-t border-border ${
                    agent.isBanned ? "opacity-50 line-through" : ""
                  }`}
                >
                  <td className="px-4 py-2 text-foreground/40">
                    {agent.isBanned ? "BAN" : `#${idx + 1}`}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {agent.isBanned && (
                      <span className="text-danger mr-1">██</span>
                    )}
                    {shortAddr(agent.agent)}
                  </td>
                  <td className={`px-4 py-2 text-right font-bold ${scoreColor}`}>
                    {agent.score}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground/60">
                    {agent.totalVerifications}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground/60">
                    %{successRate}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground/60">
                    {formatXlm(agent.totalVolume)} XLM
                  </td>
                  <td className="px-4 py-2 text-right text-foreground/60">
                    {formatXlm(agent.stake)} XLM
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Metrics */}
      <div className="flex gap-6 pt-2">
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 text-center">
          <div className="text-2xl font-bold text-accent">
            {totalProtected.toFixed(0)} XLM
          </div>
          <div className="text-xs text-foreground/40 mt-1">
            Toplam Korunan Fon
          </div>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 text-center">
          <div className="text-2xl font-bold text-danger">{blockedCount}</div>
          <div className="text-xs text-foreground/40 mt-1">
            Engellenen Kotu Islem
          </div>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 text-center">
          <div className="text-2xl font-bold text-success">{agents.length}</div>
          <div className="text-xs text-foreground/40 mt-1">
            Kayitli Ajan
          </div>
        </div>
      </div>
    </section>
  );
}
