"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export type FlowPhase =
  | "idle"
  | "funding"
  | "locking"
  | "committing"
  | "l1"
  | "l2"
  | "l3"
  | "l4"
  | "done";

interface Props {
  phase: FlowPhase;
  honest: boolean;
  claimHash?: string;
}

const P: Record<FlowPhase, number> = {
  idle: 0, funding: 1, locking: 2, committing: 3,
  l1: 4, l2: 5, l3: 6, l4: 7, done: 8,
};

interface Line {
  text: string;
  status?: "pass" | "fail" | "info" | "warn" | "result";
  indent?: boolean;
  phase: FlowPhase;
}

function getLines(honest: boolean, hash: string): Line[] {
  const lines: Line[] = [
    { text: "Locking 10 XLM in Oort Vault (escrow)...", phase: "funding" },
    { text: "Vault locked — funds secured", status: "pass", indent: true, phase: "locking" },
    { text: `Committing claim  sha256:${hash.slice(0, 16)}...`, phase: "committing" },
    { text: honest ? "claimed_price: $0.121" : "claimed_price: $0.500", status: honest ? "info" : "warn", indent: true, phase: "committing" },
    { text: "L1  Hash Match — sha256(claim) == committed", status: "pass", phase: "l1" },
    { text: "L2  Oracle Check", phase: "l2" },
    ...(honest
      ? [
          { text: "  oracles: $0.121 $0.121 $0.120 → median $0.121", status: "info" as const, indent: true, phase: "l2" as FlowPhase },
          { text: "  claimed $0.121 | deviation 0.0%", status: "pass" as const, indent: true, phase: "l2" as FlowPhase },
        ]
      : [
          { text: "  oracles: $0.121 $0.121 $0.120 → median $0.121", status: "info" as const, indent: true, phase: "l2" as FlowPhase },
          { text: "  claimed $0.500 | deviation 313.2% — HARD REJECT", status: "fail" as const, indent: true, phase: "l2" as FlowPhase },
        ]),
    ...(honest
      ? [
          { text: "L3  Footprint — contracts ∈ whitelist", status: "pass" as const, phase: "l3" as FlowPhase },
          { text: "L4  Policy — spending ok, slippage ok", status: "pass" as const, phase: "l4" as FlowPhase },
        ]
      : [
          { text: "L3  Footprint — skipped", status: "warn" as const, phase: "l3" as FlowPhase },
          { text: "L4  Policy — skipped", status: "warn" as const, phase: "l4" as FlowPhase },
        ]),
    { text: "────────────────────────────────────", status: "result" as const, phase: "done" as FlowPhase },
    ...(honest
      ? [
          { text: "EXECUTED — Vault → Protocol  |  rep 1000→1020", status: "pass" as const, phase: "done" as FlowPhase },
        ]
      : [
          { text: "REJECTED — Vault → Owner (refund)  |  stake -10%", status: "fail" as const, phase: "done" as FlowPhase },
          { text: "rep 1000→950  |  agent penalized", status: "warn" as const, indent: true, phase: "done" as FlowPhase },
        ]),
  ];
  return lines;
}

export default function FlowDiagram({ phase, honest, claimHash }: Props) {
  const hash = claimHash || "a3f8c1d4e7b2094f6a1e5d8c3b7f0294e6d1a8b5c3f7e0d294a8b1c6e3f5d7";
  const allLines = getLines(honest, hash);
  const visibleLines = allLines.filter((l) => P[l.phase] <= P[phase]);

  const [typedCount, setTypedCount] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const prevHonestRef = useRef(honest);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset typing when scenario changes or goes idle
  useEffect(() => {
    if (phase === "idle" || honest !== prevHonestRef.current) {
      setTypedCount(0);
      setCharIndex(0);
      prevHonestRef.current = honest;
    }
  }, [phase, honest]);

  // Type out lines character by character
  useEffect(() => {
    if (phase === "idle") return;

    const target = visibleLines.length;
    if (typedCount >= target) return;

    const currentLine = visibleLines[typedCount];
    if (!currentLine) return;

    const fullLen = currentLine.text.length;

    if (fullLen === 0) {
      setTypedCount((c) => c + 1);
      setCharIndex(0);
      return;
    }

    const speed = currentLine.status === "result" ? 6 : 14;
    const timer = setTimeout(() => {
      if (charIndex < fullLen) {
        setCharIndex((c) => c + 1);
      } else {
        setTypedCount((c) => c + 1);
        setCharIndex(0);
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [typedCount, charIndex, visibleLines, phase]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl bg-[#1a1714] border border-[#2a2520] p-5 sm:p-6 font-mono text-xs sm:text-[13px] leading-[1.6] select-text overflow-hidden"
      style={{ userSelect: "text", WebkitUserSelect: "text", height: 400 }}
    >
      <div>
      {/* Prompt header */}
      <div className="text-[#8c8279] mb-2">
        <span className="text-[#d4a574]">oort</span>
        <span className="text-[#6b635a]">@</span>
        <span className="text-[#8c8279]">stellar-testnet</span>
        <span className="text-[#6b635a]"> ~ $ </span>
        <span className="text-[#e5ddd4]">verify</span>
      </div>

      {/* Typed lines */}
      {visibleLines.map((line, i) => {
        if (i > typedCount) return null;
        const isCurrentlyTyping = i === typedCount;
        const displayText = isCurrentlyTyping ? line.text.slice(0, charIndex) : line.text;

        if (line.text === "" && i < typedCount) {
          return <div key={i} className="h-2" />;
        }
        if (line.text === "" && isCurrentlyTyping) {
          return <div key={i} className="h-2" />;
        }

        return (
          <div key={i} className="flex items-start gap-0 min-h-[1.25em]">
            {/* Prefix */}
            <span className="text-[#6b635a] shrink-0 select-none w-4">
              {line.indent ? " " : "›"}
            </span>
            {line.indent && <span className="w-3 shrink-0" />}

            {/* Text */}
            <span className={statusColor(line.status)}>
              {displayText}
              {isCurrentlyTyping && charIndex < line.text.length && (
                <span className="animate-pulse text-[#d4a574]">▋</span>
              )}
            </span>

            {/* Status badge (after line is fully typed) */}
            {!isCurrentlyTyping && line.status === "pass" && !line.text.startsWith("─") && !line.text.startsWith("RESULT") && !line.text.startsWith("EXECUTED") && !line.text.startsWith("REJECTED") && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="ml-auto shrink-0 text-[#2d8a5e] text-[10px]"
              >
                ✓
              </motion.span>
            )}
            {!isCurrentlyTyping && line.status === "fail" && !line.text.startsWith("─") && !line.text.startsWith("RESULT") && !line.text.startsWith("EXECUTED") && !line.text.startsWith("REJECTED") && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="ml-auto shrink-0 text-[#c93b3b] text-[10px]"
              >
                ✗
              </motion.span>
            )}
          </div>
        );
      })}

      {/* Cursor at end */}
      {phase !== "idle" && typedCount >= visibleLines.length && phase !== "done" && (
        <div className="flex items-center gap-0 mt-1">
          <span className="text-[#6b635a]">›</span>
          <span className="animate-pulse text-[#d4a574] ml-1">▋</span>
        </div>
      )}
      </div>{/* end inner flex */}
    </div>
  );
}

function statusColor(status?: string): string {
  switch (status) {
    case "pass": return "text-[#2d8a5e]";
    case "fail": return "text-[#c93b3b]";
    case "warn": return "text-[#b8860b]";
    case "info": return "text-[#8c8279]";
    case "result": return "text-[#6b635a]";
    default: return "text-[#e5ddd4]";
  }
}
