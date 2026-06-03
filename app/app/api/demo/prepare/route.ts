import { NextResponse } from "next/server";
import { runBot, refreshOracles } from "../../../lib/bot-runner";
import { setCache, getStatus } from "../../../lib/demo-cache";

export const maxDuration = 120;

export async function POST() {
  try {
    await refreshOracles();
    const [honestResult, liarResult] = await Promise.all([
      runBot(true, { skipOracles: true }),
      runBot(false, { skipOracles: true }),
    ]);
    setCache("honest", honestResult);
    setCache("liar", liarResult);
    return NextResponse.json({ ready: true, honest: honestResult, liar: liarResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Prepare failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(getStatus());
}
