"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FlowDiagram, { type FlowPhase } from "./FlowDiagram";
import type { BotResult } from "../lib/bot-runner";

type BotType = "honest" | "liar";

const HONEST_PHASES: FlowPhase[] = ["funding", "locking", "committing", "l1", "l2", "l3", "l4"];
const LIAR_PHASES: FlowPhase[] = ["funding", "locking", "committing", "l1", "l2"];
const STEP_MS = 800;

function fakeHash(honest: boolean): string {
  return honest
    ? "a3f8c1d4e7b2094f6a1e5d8c3b7f0294e6d1a8b5c3f7e0d294a8b1c6e3f5d7"
    : "d9e2f4a1b7c30586e1d4f8a2c6b90374d5e8f1a3b7c2d6e094f5a8b1c3e7d9";
}

export default function DemoControls() {
  const [running, setRunning] = useState<BotType | null>(null);
  const [result, setResult] = useState<BotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [honest, setHonest] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [ready, setReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);

  const clearAnim = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    phaseRef.current = 0;
  }, []);

  useEffect(() => () => clearAnim(), [clearAnim]);

  useEffect(() => {
    fetch("/api/demo/prepare").then(r => r.json()).then(d => {
      if (d.ready) setReady(true);
    }).catch(() => {});
  }, []);

  const prepare = useCallback(async () => {
    setPreparing(true);
    try {
      const resp = await fetch("/api/demo/prepare", { method: "POST" });
      if (resp.ok) setReady(true);
    } catch {}
    setPreparing(false);
  }, []);

  const run = useCallback(async (type: BotType) => {
    setRunning(type);
    setResult(null);
    setError(null);
    setHonest(type === "honest");

    const seq = type === "honest" ? HONEST_PHASES : LIAR_PHASES;
    phaseRef.current = 0;
    setPhase(seq[0]);
    intervalRef.current = setInterval(() => {
      phaseRef.current++;
      if (phaseRef.current < seq.length) {
        setPhase(seq[phaseRef.current]);
      }
    }, STEP_MS);

    try {
      const resp = await fetch(`/api/demo/${type}`, { method: "POST" });
      const data = await resp.json();

      const totalAnimTime = seq.length * STEP_MS;
      const elapsed = phaseRef.current * STEP_MS;
      const remaining = Math.max(0, totalAnimTime - elapsed + 600);
      await new Promise(r => setTimeout(r, remaining));

      clearAnim();
      if (!resp.ok) {
        setPhase("idle");
        setRunning(null);
        setError(data.error || "Failed");
        return;
      }
      setPhase("done");
      setRunning(null);
      setResult(data);
    } catch (err: any) {
      clearAnim();
      setPhase("idle");
      setRunning(null);
      setError(err.message);
    }
  }, [clearAnim]);

  const reset = useCallback(() => {
    clearAnim();
    setPhase("idle");
    setResult(null);
    setError(null);
  }, [clearAnim]);

  const isRunning = running !== null;
  const hasDone = !!(result || error);

  return (
    <section id="demo" className="h-full flex items-center px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-3"
        >
          <h2
            className="font-bold text-foreground tracking-tight"
            style={{ fontSize: "clamp(1.8rem, 1rem + 3vw, 3rem)" }}
          >
            See It In Action
          </h2>
          <p className="text-foreground-muted max-w-md mx-auto">
            Real on-chain transactions on Stellar Testnet.
          </p>
        </motion.div>

        {/* Prepare */}
        {!ready && (
          <div className="text-center space-y-2">
            <button onClick={prepare} disabled={preparing}
              className="px-6 py-3 rounded-xl bg-accent text-white font-semibold text-sm
                         hover:bg-accent-light transition-colors disabled:opacity-60 cursor-pointer">
              {preparing ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Preparing on-chain demo...
                </span>
              ) : "Prepare Demo"}
            </button>
            <p className="text-[11px] text-foreground-muted">
              Runs both scenarios on testnet ahead of time (~30s)
            </p>
          </div>
        )}

        {ready && (
          <div className="space-y-4">
            {/* Buttons */}
            <div className="flex gap-2">
              <button onClick={() => run("honest")} disabled={isRunning}
                className="flex-1 py-2.5 rounded-xl border-2 border-accent text-accent font-semibold text-sm
                           hover:bg-accent-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                {running === "honest" ? "Processing..." : "Honest Agent"}
              </button>
              <button onClick={() => run("liar")} disabled={isRunning}
                className="flex-1 py-2.5 rounded-xl border-2 border-danger text-danger font-semibold text-sm
                           hover:bg-danger-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                {running === "liar" ? "Processing..." : "Lying Agent"}
              </button>
              {hasDone && !isRunning && (
                <button onClick={reset}
                  className="py-2.5 px-4 rounded-xl border border-border text-foreground-muted text-sm
                             hover:border-border-strong transition-colors cursor-pointer">
                  Reset
                </button>
              )}
            </div>

            {/* Terminal */}
            {phase !== "idle" && (
              <FlowDiagram
                phase={phase}
                honest={honest}
                claimHash={fakeHash(honest)}
              />
            )}

            {/* Result card */}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                    result.executed ? "border-accent/15 bg-success-bg/50" : "border-danger/15 bg-danger-bg/50"
                  }`}>
                  <div className="flex flex-wrap gap-2">
                    <Tag l="Price" v={`$${result.claimedPrice}`} />
                    <Tag l="Dev" v={`${result.deviationPct}%`} />
                    <Tag l="Score" v={String(result.score)} c={result.score >= 1000 ? "text-accent" : "text-danger"} />
                  </div>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-accent hover:underline inline-flex items-center gap-1">
                    tx on stellar.expert
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M2 6l4-4M3 2h3v3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-xl border border-danger/15 bg-danger-bg p-3 text-center text-xs text-danger">
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

function Tag({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <span className="text-[10px] font-mono px-2 py-1 rounded bg-surface border border-border">
      <span className="text-foreground-muted">{l} </span>
      <span className={`font-bold ${c || "text-foreground"}`}>{v}</span>
    </span>
  );
}

function Spinner() {
  return <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>;
}
