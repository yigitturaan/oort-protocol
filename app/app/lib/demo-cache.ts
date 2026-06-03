import type { BotResult } from "./bot-runner";

interface CachedResult {
  data: BotResult;
  timestamp: number;
}

const cache: { honest: CachedResult | null; liar: CachedResult | null } = {
  honest: null,
  liar: null,
};

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function getCached(type: "honest" | "liar"): BotResult | null {
  const entry = cache[type];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) {
    cache[type] = null;
    return null;
  }
  return entry.data;
}

export function setCache(type: "honest" | "liar", data: BotResult) {
  cache[type] = { data, timestamp: Date.now() };
}

export function isReady(): boolean {
  return getCached("honest") !== null && getCached("liar") !== null;
}

export function getStatus(): { honest: boolean; liar: boolean; ready: boolean } {
  return {
    honest: getCached("honest") !== null,
    liar: getCached("liar") !== null,
    ready: isReady(),
  };
}
