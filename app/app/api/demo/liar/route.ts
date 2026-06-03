import { NextResponse } from "next/server";
import { runBot } from "../../../lib/bot-runner";
import { getCached, setCache } from "../../../lib/demo-cache";

export const maxDuration = 120;

export async function POST() {
  try {
    const cached = getCached("liar");
    if (cached) return NextResponse.json(cached);
    const result = await runBot(false);
    setCache("liar", result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Bot failed" }, { status: 500 });
  }
}
