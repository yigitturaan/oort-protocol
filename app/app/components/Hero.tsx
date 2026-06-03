"use client";

import { motion } from "framer-motion";
import ShimmerText from "./ui/ShimmerText";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.19, 1, 0.22, 1] as const },
  }),
};

export default function Hero() {
  return (
    <section className="h-full flex items-center justify-center px-6 pt-14 pb-6">
      <div className="max-w-4xl mx-auto text-center space-y-5">
        <motion.h1 custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="font-bold text-foreground leading-[1.08] tracking-tight"
          style={{ fontSize: "clamp(2.5rem, 2rem + 4vw, 4.5rem)" }}>
          AI agents trade your money.
          <br />
          <ShimmerText className="text-accent">What if they lie?</ShimmerText>
        </motion.h1>

        <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="text-foreground-muted text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          OORT locks funds in escrow, forces agents to cryptographically commit claims,
          and verifies them against multiple oracles — before a single token moves.
        </motion.p>

        {/* Without / With comparison */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto text-left">

          {/* Without OORT */}
          <div className="rounded-2xl border border-danger/15 bg-surface p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="text-[10px] font-mono text-danger uppercase tracking-wider font-medium">Without OORT</span>
            </div>
            <div className="space-y-1">
              <FlowItem num="1" text="You give your funds to an AI agent" />
              <FlowConn />
              <FlowItem num="2" text="Agent decides what to trade — no oversight" />
              <FlowConn />
              <FlowItem num="3" text="If the agent hallucinates or lies, trade executes anyway" />
              <FlowConn />
              <FlowItem num="4" text="Funds gone. No way to reverse." danger />
            </div>
            <div className="text-[10px] text-foreground-muted italic">
              This is how every AI agent framework works today.
            </div>
          </div>

          {/* With OORT */}
          <div className="rounded-2xl border border-accent/15 bg-surface p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-[10px] font-mono text-accent uppercase tracking-wider font-medium">With OORT</span>
            </div>
            <div className="space-y-1">
              <FlowItem num="1" text="Funds locked in Oort Vault escrow — agent can't touch them" accent />
              <FlowConn />
              <FlowItem num="2" text="Agent commits a cryptographic hash of its claim on-chain" accent />
              <FlowConn />
              <FlowItem num="3" text="OORT verifies claim against 3+ oracles, checks contracts & limits" accent />
              <FlowConn />
              <FlowItem num="4" text="Verified → trade. Failed → funds return automatically." accent />
            </div>
            <div className="text-[10px] text-accent font-medium">
              Your funds never move unless the claim is proven true.
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FlowItem({ num, text, accent, danger }: {
  num: string; text: string; accent?: boolean; danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
        danger ? "bg-danger/10 text-danger"
          : accent ? "bg-accent-bg text-accent"
          : "bg-foreground-muted/10 text-foreground-muted"
      }`}>{num}</span>
      <span className={`text-sm leading-snug ${
        danger ? "text-danger font-medium" : accent ? "text-foreground" : "text-foreground/70"
      }`}>{text}</span>
    </div>
  );
}

function FlowConn() {
  return (
    <div className="pl-2.5 flex">
      <div className="w-[1px] h-2 bg-border-strong/30 ml-[9px]" />
    </div>
  );
}
