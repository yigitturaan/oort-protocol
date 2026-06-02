"use client";

import { useCallback, useState } from "react";
import type { BotResult } from "../lib/bot-runner";

type BotType = "honest" | "liar";

interface RunState {
  running: BotType | null;
  result: BotResult | null;
  error: string | null;
}

export default function DemoControls() {
  const [state, setState] = useState<RunState>({
    running: null,
    result: null,
    error: null,
  });
  const [oracleStatus, setOracleStatus] = useState<
    "idle" | "refreshing" | "fresh" | "error"
  >("idle");

  const refreshOracles = useCallback(async () => {
    setOracleStatus("refreshing");
    try {
      const resp = await fetch("/api/demo/refresh-oracles", { method: "POST" });
      setOracleStatus(resp.ok ? "fresh" : "error");
    } catch {
      setOracleStatus("error");
    }
  }, []);

  const run = useCallback(async (type: BotType) => {
    setState({ running: type, result: null, error: null });
    try {
      const resp = await fetch(`/api/demo/${type}`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) {
        setState({ running: null, result: null, error: data.error || "Failed" });
        return;
      }
      setState({ running: null, result: data, error: null });
    } catch (err: any) {
      setState({ running: null, result: null, error: err.message });
    }
  }, []);

  const { running, result, error } = state;
  const isRunning = running !== null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground/80">Demo Kontrolu</h2>

      <div className="flex gap-3">
        <button
          onClick={refreshOracles}
          disabled={isRunning || oracleStatus === "refreshing"}
          className="px-4 py-3 rounded-lg border border-accent-dim bg-surface
                     text-accent text-sm font-bold
                     hover:bg-accent-dim/30 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {oracleStatus === "refreshing" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Oracle...
            </span>
          ) : oracleStatus === "fresh" ? (
            "Oracle Taze"
          ) : (
            "Oracle Tazele"
          )}
        </button>
        <button
          onClick={() => run("honest")}
          disabled={isRunning}
          className="flex-1 py-3 rounded-lg border border-success/40 bg-success/10
                     text-success font-bold text-sm
                     hover:bg-success/20 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {running === "honest" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Calistiriliyor...
            </span>
          ) : (
            "HonestBot Calistir"
          )}
        </button>

        <button
          onClick={() => run("liar")}
          disabled={isRunning}
          className="flex-1 py-3 rounded-lg border border-danger/40 bg-danger/10
                     text-danger font-bold text-sm
                     hover:bg-danger/20 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {running === "liar" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Calistiriliyor...
            </span>
          ) : (
            "LiarBot Calistir"
          )}
        </button>
      </div>

      {/* Processing animation */}
      {isRunning && (
        <div className="rounded-lg border border-accent-dim bg-surface p-4 space-y-2">
          <div className="flex items-center gap-2 text-accent text-sm">
            <Spinner />
            <span className="animate-pulse">
              {running === "honest" ? "Durüst" : "Yalanci"} ajan testnet
              uzerinde calistiriliyor...
            </span>
          </div>
          <div className="text-xs text-foreground/40 space-y-1 pl-6">
            <p>1. Hesaplar olusturuluyor + fonlaniyor</p>
            <p>2. Oracle fiyatlari guncelleniyor</p>
            <p>3. Ajan kaydediliyor (1000 XLM stake)</p>
            <p>4. Vault kilitleniyor (10 XLM)</p>
            <p>5. Claim commit + 4-katman dogrulama</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg border p-4 space-y-2 ${
            result.executed
              ? "border-success/40 bg-success/5"
              : "border-danger/40 bg-danger/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-bold ${
                result.executed ? "text-success" : "text-danger"
              }`}
            >
              {result.executed ? "DOGRULANDI" : "REDDEDILDI → IADE"}
            </span>
            <span className="text-xs text-foreground/40">
              {result.agent.slice(0, 8)}...
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-foreground/60">
            <span>Iddia fiyati:</span>
            <span className="font-mono">${result.claimedPrice}</span>
            <span>Sapma:</span>
            <span className="font-mono">%{result.deviationPct}</span>
            <span>Itibar:</span>
            <span
              className={`font-mono font-bold ${
                result.score >= 1000 ? "text-success" : "text-danger"
              }`}
            >
              {result.score}
            </span>
            <span>Stake:</span>
            <span className="font-mono">{result.stakeXlm} XLM</span>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline block pt-1"
          >
            stellar.expert tx →
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-danger text-sm">
          Hata: {error}
        </div>
      )}
    </section>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
