"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const CODE_LINES = [
  { text: 'import { OortSDK } from "@oort-protocol/sdk";', color: "keyword" },
  { text: "", color: "default" },
  { text: "const oort = new OortSDK({", color: "default" },
  { text: '  contractId: "CCGU...2LH",', color: "string" },
  { text: '  network: "testnet",', color: "string" },
  { text: "});", color: "default" },
  { text: "", color: "default" },
  { text: "// Lock funds in escrow", color: "comment" },
  { text: "const vault = await oort.lockVault({", color: "default" },
  { text: "  owner, agent, token, amount", color: "param" },
  { text: "});", color: "default" },
  { text: "", color: "default" },
  { text: "// Submit claim + verify + execute in one call", color: "comment" },
  { text: "const result = await oort.submitAndExecute({", color: "default" },
  { text: "  intentId: vault.intentId,", color: "param" },
  { text: "  claim, keypair", color: "param" },
  { text: "});", color: "default" },
  { text: "", color: "default" },
  { text: "if (result.executed) {", color: "default" },
  { text: "  // Trade verified and executed", color: "comment" },
  { text: "} else {", color: "default" },
  { text: "  // Rejected — funds returned automatically", color: "comment" },
  { text: "}", color: "default" },
];

const frameworks = [
  "Eliza Framework",
  "LangChain",
  "Stellar Agent Kit",
  "AutoGPT",
  "Any JS/TS agent",
];

export default function SDKSection() {
  const [typedLine, setTypedLine] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Start typing when section is in view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (typedLine >= CODE_LINES.length) return;

    const line = CODE_LINES[typedLine];
    if (line.text.length === 0) {
      const t = setTimeout(() => { setTypedLine(l => l + 1); setCharIdx(0); }, 80);
      return () => clearTimeout(t);
    }

    if (charIdx < line.text.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), 16);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => { setTypedLine(l => l + 1); setCharIdx(0); }, 120);
      return () => clearTimeout(t);
    }
  }, [started, typedLine, charIdx]);

  return (
    <section ref={sectionRef} className="h-full flex items-center px-6 py-8">
      <div className="max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-8 items-center">

          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-5"
          >
            <h2 className="font-bold text-foreground tracking-tight" style={{ fontSize: "clamp(1.8rem, 1.2rem + 3vw, 3rem)" }}>
              Oort SDK
            </h2>
            <p className="text-lg sm:text-xl font-semibold text-foreground/70 -mt-2">
              3 lines to protect any agent trade.
            </p>
            <p className="text-sm text-foreground-muted leading-relaxed">
              Install the SDK, wrap your agent's trade logic, done.
              OORT handles escrow, hashing, oracle verification,
              and fund protection automatically.
            </p>

            <div className="space-y-3 pt-2">
              <div className="text-[10px] font-mono text-foreground-muted uppercase tracking-wider">
                Works with
              </div>
              <div className="flex flex-wrap gap-2">
                {frameworks.map((f) => (
                  <span key={f} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface text-foreground-muted">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Install command */}
            <div className="rounded-lg bg-[#1a1714] border border-[#2a2520] px-4 py-2.5 font-mono text-xs inline-flex items-center gap-3">
              <span className="text-[#6b635a]">$</span>
              <span className="text-[#e5ddd4]">npm install @oort-protocol/sdk</span>
              <button
                onClick={() => navigator.clipboard.writeText("npm install @oort-protocol/sdk")}
                className="text-[#6b635a] hover:text-[#d4a574] transition-colors ml-2 cursor-pointer"
                title="Copy"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Right: code block */}
          <div className="rounded-xl bg-[#1a1714] border border-[#2a2520] p-5 font-mono text-[11px] sm:text-xs leading-[1.7] select-text"
            style={{ userSelect: "text", WebkitUserSelect: "text" }}>

            {/* File tab */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2520]">
              <span className="text-[9px] text-[#d4a574]">agent.ts</span>
            </div>

            {/* Code */}
            <div className="space-y-0">
              {CODE_LINES.map((line, i) => {
                if (i > typedLine) return <div key={i} className="h-[1.7em]" />;

                const isTyping = i === typedLine;
                const text = isTyping ? line.text.slice(0, charIdx) : line.text;

                if (line.text === "") return <div key={i} className="h-[1.7em]" />;

                return (
                  <div key={i} className="flex">
                    <span className="text-[#3a352f] w-6 shrink-0 text-right mr-3 select-none text-[10px]">
                      {i + 1}
                    </span>
                    <span className={lineColor(line.color)}>
                      {text}
                      {isTyping && charIdx < line.text.length && (
                        <span className="animate-pulse text-[#d4a574]">▋</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function lineColor(color: string): string {
  switch (color) {
    case "keyword": return "text-[#c9a0dc]";
    case "string": return "text-[#a8c97a]";
    case "comment": return "text-[#6b635a]";
    case "param": return "text-[#d4a574]";
    default: return "text-[#e5ddd4]";
  }
}
