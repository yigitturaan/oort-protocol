"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import NumberTicker from "./ui/NumberTicker";
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
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatXlm(val: bigint): string {
  const n = Number(val) / 1e7;
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
    <section id="reputation" className="h-full flex items-center px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-3"
        >
          <h2
            className="font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.8rem, 1rem + 3vw, 3rem)" }}
          >
            Agent Scoreboard
          </h2>
          <p className="text-foreground-muted text-lg max-w-md mx-auto">
            Every agent builds a reputation on-chain. Honest agents thrive. Liars get banned.
          </p>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard value={`${totalProtected.toFixed(0)} XLM`} label="Protected" delay={0} />
          <MetricCard value={String(blockedCount)} label="Blocked" delay={0.1} />
          <MetricCard value={String(agents.length)} label="Agents" delay={0.2} />
        </div>

        {/* Agent cards */}
        <div className="space-y-3">
          {agents.map((agent, idx) => {
            const isGood = agent.score >= 1000;
            const successRate =
              agent.totalVerifications > 0
                ? ((agent.passed / agent.totalVerifications) * 100).toFixed(0)
                : "—";

            return (
              <motion.div
                key={agent.agent}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, duration: 0.4 }}
                className={`rounded-2xl border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4 card-hover ${
                  agent.isBanned
                    ? "border-danger/20 opacity-60"
                    : isGood
                      ? "border-accent/15"
                      : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    agent.isBanned ? "bg-danger" : isGood ? "bg-accent" : "bg-foreground-muted"
                  }`} />
                  <div className="min-w-0">
                    <div className="text-sm font-mono text-foreground truncate">
                      {shortAddr(agent.agent)}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {agent.isBanned ? "Banned" : isGood ? "Trusted" : "Under watch"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-center">
                  <div>
                    <div className={`text-lg font-bold font-mono ${isGood ? "text-accent" : "text-danger"}`}>
                      {agent.score}
                    </div>
                    <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Score</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold font-mono text-foreground">{successRate}%</div>
                    <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Pass</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold font-mono text-foreground">{formatXlm(agent.stake)}</div>
                    <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Stake</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="stat-card"
    >
      <div className="text-2xl font-bold text-foreground font-mono">
        {/^\d+$/.test(value) ? (
          <NumberTicker value={parseInt(value)} />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-foreground-muted mt-1">{label}</div>
    </motion.div>
  );
}
