"use client";

import { motion } from "framer-motion";

const CLAIM_FIELDS = [
  { key: "action", value: "BUY_XLM" },
  { key: "claimed_price", value: "$0.121" },
  { key: "protocol", value: "CCGU...2LH" },
  { key: "expected_min", value: "82 XLM" },
  { key: "footprint", value: "[Phoenix DEX]" },
];

const HASH = "a3f8c1d4e7b2094f6a1e5d8c3b7f0294";

export default function HashExplainer() {
  return (
    <section id="hash" className="h-full flex items-center px-6 py-8">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-2"
        >
          <h2 className="font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.8rem, 1rem + 3vw, 3rem)" }}>
            Cryptographic Commitment
          </h2>
          <p className="text-sm text-foreground-muted max-w-lg mx-auto">
            The agent locks its claim before execution. Change it later? Impossible.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch max-w-3xl mx-auto">

          {/* 1. Agent Claim */}
          <div className="rounded-xl bg-surface border border-border p-5 flex flex-col">
            <div className="text-[10px] font-mono text-foreground-muted uppercase tracking-wider mb-4">
              1 · Agent builds claim
            </div>
            <div className="font-mono text-[11px] space-y-0.5 flex-1">
              <div className="text-foreground-muted/40">AgentClaim {'{'}</div>
              {CLAIM_FIELDS.map((f) => (
                <div key={f.key} className="pl-3 flex gap-2">
                  <span className="text-foreground-muted">{f.key}:</span>
                  <span className="text-foreground font-medium">{f.value}</span>
                </div>
              ))}
              <div className="text-foreground-muted/40">{'}'}</div>
            </div>
          </div>

          {/* 2. Hash */}
          <div className="rounded-xl bg-surface border border-border p-5 flex flex-col">
            <div className="text-[10px] font-mono text-foreground-muted uppercase tracking-wider mb-4">
              2 · SHA-256 hash
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <svg width="16" height="18" viewBox="0 0 16 18" className="text-foreground-muted/30">
                <path d="M8 0v14M4 11l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="text-[11px] font-mono text-accent break-all leading-relaxed">
                {HASH}...
              </div>
              <div className="text-[9px] text-foreground-muted">
                Committed on-chain · immutable
              </div>
            </div>
          </div>

          {/* 3. Verification */}
          <div className="rounded-xl bg-surface border border-border p-5 flex flex-col">
            <div className="text-[10px] font-mono text-foreground-muted uppercase tracking-wider mb-4">
              3 · OORT verifies
            </div>
            <div className="space-y-1.5 flex-1">
              <VRow label="Hash match" detail="revealed == committed" />
              <VRow label="Price check" detail="$0.121 vs median → 0%" />
              <VRow label="Footprint" detail="Phoenix DEX ∈ whitelist" />
            </div>
            <div className="text-[10px] font-medium text-accent text-center pt-3 border-t border-border mt-3">
              All passed · safe to execute
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex justify-center gap-8 text-[11px] text-foreground-muted max-w-2xl mx-auto text-center">
          <div className="flex-1 border-t border-border pt-3">
            <span className="font-bold text-foreground">Why hash?</span>
            <br />
            Agent commits before seeing verification result. Can't change story after.
          </div>
          <div className="flex-1 border-t border-border pt-3">
            <span className="font-bold text-foreground">Why footprint?</span>
            <br />
            Claim includes target contracts. OORT checks they're all whitelisted.
          </div>
        </div>
      </div>
    </section>
  );
}

function VRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent-bg/50">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
        <path d="M2 5l2 2L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-accent">{label}</span>
        <span className="text-[9px] text-foreground-muted ml-1.5">{detail}</span>
      </div>
    </div>
  );
}
