import { NextResponse } from "next/server";
import { refreshOracles } from "../../../lib/bot-runner";

export const maxDuration = 60;

export async function POST() {
  try {
    refreshOracles();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Oracle refresh failed" },
      { status: 500 }
    );
  }
}
