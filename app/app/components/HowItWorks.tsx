"use client";

import { motion } from "framer-motion";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="h-full flex items-center px-6 py-8">
      <div className="max-w-4xl mx-auto w-full space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Commit — Verify — Execute
          </h2>
          <p className="text-foreground-muted text-sm max-w-lg mx-auto">
            Your money never moves until everything checks out. No shortcuts.
          </p>
        </motion.div>

        {/* Pipeline: 4 compact cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { n: "01", t: "Lock", d: "Funds held in escrow", tag: "Auto-expiry" },
            { n: "02", t: "Commit", d: "Agent submits claim hash", tag: "SHA-256" },
            { n: "03", t: "Verify", d: "4 checks run on-chain", tag: "All must pass" },
            { n: "04", t: "Decide", d: "Pass → trade. Fail → refund.", tag: "Atomic" },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="rounded-xl border border-border bg-surface p-4 space-y-1.5 card-hover"
            >
              <span className="text-lg font-bold font-mono text-accent/20">{s.n}</span>
              <div className="text-sm font-bold text-foreground">{s.t}</div>
              <div className="text-xs text-foreground-muted">{s.d}</div>
              <div className="text-[9px] font-mono text-accent/50">{s.tag}</div>
            </motion.div>
          ))}
        </div>

        {/* 4 Layers */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
              4 Layers of Protection
            </h3>
            <p className="text-xs text-foreground-muted mt-1">One failure blocks the entire transaction.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LCard n="1" t="Hash Check" d="Claim matches committed hash?" c="Bait-and-switch" i={0} live />
            <LCard n="2" t="Oracle Check" d="Price within 1.5% of 3+ sources?" c="Hallucination & manipulation" i={1} live />
            <LCard n="3" t="Footprint Check" d="Target contracts whitelisted?" c="Redirect to malicious contract" i={2} />
            <LCard n="4" t="Policy Check" d="Within spending & slippage limits?" c="Wallet drain & sandwich attacks" i={3} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LCard({ n, t, d, c, i, live }: { n: string; t: string; d: string; c: string; i: number; live?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.06, duration: 0.4 }}
      className="rounded-xl border border-border bg-surface p-4 card-hover flex gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold font-mono text-accent">L{n}</span>
      </div>
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground">{t}</span>
          {live ? (
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-accent-bg text-accent">ACTIVE</span>
          ) : (
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-foreground-muted/8 text-foreground-muted">READY</span>
          )}
        </div>
        <div className="text-[11px] text-foreground-muted">{d}</div>
        <div className="text-[10px] text-danger/60 font-mono">Catches: {c}</div>
      </div>
    </motion.div>
  );
}
