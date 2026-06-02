import { NextResponse } from "next/server";
import { runBot } from "../../../lib/bot-runner";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await runBot(true);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Bot failed" },
      { status: 500 }
    );
  }
}
