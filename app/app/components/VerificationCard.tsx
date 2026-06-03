"use client";

import { motion } from "framer-motion";
import type { VerificationEntry } from "../lib/events";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

type LayerStatus = "pass" | "fail" | "skip";

function LayerDot({ status }: { status: LayerStatus }) {
  if (status === "pass")
    return <span className="w-4 h-4 rounded-full bg-success/15 text-success flex items-center justify-center text-[10px]">&#10003;</span>;
  if (status === "fail")
    return <span className="w-4 h-4 rounded-full bg-danger/15 text-danger flex items-center justify-center text-[10px]">&#10005;</span>;
  return <span className="w-4 h-4 rounded-full bg-foreground-muted/10 text-foreground-muted flex items-center justify-center text-[10px]">—</span>;
}

function LayerRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: LayerStatus;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <LayerDot status={status} />
      <span className="text-foreground-muted w-32">{label}</span>
      {detail && <span className="text-foreground-muted/70 font-mono">{detail}</span>}
    </div>
  );
}

export default function VerificationCard({
  entry,
  index = 0,
}: {
  entry: VerificationEntry;
  index?: number;
}) {
  const isVerified = entry.type === "verified";
  const deviationPct = (entry.deviationBps / 100).toFixed(1);
  const amountXlm = (Number(entry.amount) / 1e7).toFixed(1);

  const hashStatus: LayerStatus = "pass";
  const oracleStatus: LayerStatus =
    entry.oracleVerdict === "Passed" ? "pass" : "fail";
  const footprintStatus: LayerStatus =
    oracleStatus === "pass" ? "pass" : "skip";
  const policyStatus: LayerStatus =
    footprintStatus === "pass" ? (isVerified ? "pass" : "fail") : "skip";

  const oracleDetail =
    entry.oracleVerdict === "Passed"
      ? `${deviationPct}% deviation`
      : entry.oracleVerdict === "SoftReject"
        ? `${deviationPct}% (soft)`
        : `${deviationPct}% (hard reject)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
      className={`rounded-2xl border bg-surface p-5 space-y-4 card-hover ${
        isVerified ? "border-accent/20 glow-success" : "border-danger/20 glow-danger"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${isVerified ? "bg-success" : "bg-danger"}`}
          />
          <span className="text-sm font-medium text-foreground">
            {shortAddr(entry.agent)}
          </span>
          <span className="text-xs text-foreground-muted font-mono" suppressHydrationWarning>
            {timeAgo(entry.timestamp)} ago
          </span>
        </div>
        <span className="text-sm font-mono text-foreground-muted">
          {amountXlm} XLM
        </span>
      </div>

      {/* Verification layers */}
      <div className="space-y-1.5">
        <LayerRow label="Hash match" status={hashStatus} />
        <LayerRow label="Oracle check" status={oracleStatus} detail={oracleDetail} />
        <LayerRow label="Footprint check" status={footprintStatus} />
        <LayerRow label="Policy compliance" status={policyStatus} />
      </div>

      {/* Result */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold uppercase tracking-wide ${
              isVerified ? "text-success" : "text-danger"
            }`}
          >
            {isVerified ? "Verified" : "Rejected"}
          </span>
          <span className="text-xs text-foreground-muted">
            {isVerified
              ? "— funds released"
              : `— funds returned${
                  entry.slashAmount > BigInt(0)
                    ? ` | ${(Number(entry.slashAmount) / 1e7).toFixed(0)} XLM slashed`
                    : ""
                }`}
          </span>
        </div>
        {entry.reputation && (
          <span
            className={`text-xs font-mono font-medium ${
              entry.reputation.newScore > entry.reputation.oldScore
                ? "text-success"
                : "text-danger"
            }`}
          >
            {entry.reputation.oldScore} → {entry.reputation.newScore}
          </span>
        )}
      </div>
    </motion.div>
  );
}
