import { rpc, xdr, Address } from "@stellar/stellar-sdk";
import { server, OORT_CONTRACT_ID } from "./stellar";

export type OracleVerdict = "Passed" | "SoftReject" | "HardReject";

export interface VerificationEntry {
  id: string;
  type: "verified" | "rejected";
  intentId: string;
  agent: string;
  amount: bigint;
  oracleVerdict: OracleVerdict;
  deviationBps: number;
  slashAmount: bigint;
  ledger: number;
  timestamp: string;
  reputation?: { oldScore: number; newScore: number };
}

function scValToI128(val: xdr.ScVal): bigint {
  try {
    const i128 = val.i128();
    const hi = BigInt(i128.hi().toString());
    const lo = BigInt(i128.lo().toString());
    return (hi << BigInt(64)) | lo;
  } catch {
    return BigInt(0);
  }
}

function parseOracleResult(val: xdr.ScVal): {
  verdict: OracleVerdict;
  bps: number;
} {
  try {
    const vec = val.vec();
    if (!vec || vec.length === 0) return { verdict: "HardReject", bps: 10000 };
    const variant = vec[0].sym().toString();
    const bps = vec.length > 1 ? vec[1].u32() : 0;
    if (variant === "Passed") return { verdict: "Passed", bps };
    if (variant === "SoftReject") return { verdict: "SoftReject", bps };
    return { verdict: "HardReject", bps };
  } catch {
    return { verdict: "HardReject", bps: 10000 };
  }
}

function fieldsFromMap(val: xdr.ScVal): Record<string, xdr.ScVal> {
  const fields: Record<string, xdr.ScVal> = {};
  try {
    const map = val.map();
    if (map) {
      for (const entry of map) {
        fields[entry.key().sym().toString()] = entry.val();
      }
    }
  } catch {
    // not a map
  }
  return fields;
}

export function parseVerificationEvent(
  event: rpc.Api.EventResponse
): VerificationEntry | null {
  if (!event.topic || event.topic.length < 3) return null;

  try {
    const eventName = event.topic[0].sym().toString();
    if (eventName !== "Verified" && eventName !== "Rejected") return null;

    const intentIdBytes = event.topic[1].bytes();
    const intentId = Buffer.from(intentIdBytes).toString("hex");
    const agent = Address.fromScVal(event.topic[2]).toString();

    const fields = fieldsFromMap(event.value);

    const amount = fields["amount"] ? scValToI128(fields["amount"]) : BigInt(0);

    const oracleInfo = fields["oracle_result"]
      ? parseOracleResult(fields["oracle_result"])
      : { verdict: "HardReject" as OracleVerdict, bps: 10000 };

    const deviationBps =
      eventName === "Verified" && fields["deviation_bps"]
        ? fields["deviation_bps"].u32()
        : oracleInfo.bps;

    const slashAmount =
      eventName === "Rejected" && fields["slash_amount"]
        ? scValToI128(fields["slash_amount"])
        : BigInt(0);

    return {
      id: event.id,
      type: eventName === "Verified" ? "verified" : "rejected",
      intentId,
      agent,
      amount,
      oracleVerdict: oracleInfo.verdict,
      deviationBps,
      slashAmount,
      ledger: event.ledger,
      timestamp: event.ledgerClosedAt,
    };
  } catch {
    return null;
  }
}

export function parseReputationEvent(
  event: rpc.Api.EventResponse
): { agent: string; oldScore: number; newScore: number } | null {
  if (!event.topic || event.topic.length < 2) return null;
  try {
    const name = event.topic[0].sym().toString();
    if (name !== "ReputationUpdated") return null;
    const agent = Address.fromScVal(event.topic[1]).toString();
    const fields = fieldsFromMap(event.value);
    return {
      agent,
      oldScore: fields["old_score"]?.u32() ?? 0,
      newScore: fields["new_score"]?.u32() ?? 0,
    };
  } catch {
    return null;
  }
}

export async function fetchRecentVerifications(
  startLedger: number
): Promise<VerificationEntry[]> {
  try {
    const response = await server.getEvents({
      filters: [
        {
          type: "contract",
          contractIds: [OORT_CONTRACT_ID],
        },
      ],
      startLedger,
      limit: 100,
    });

    if (!response.events || response.events.length === 0) return [];

    const repMap = new Map<
      string,
      { oldScore: number; newScore: number }
    >();
    for (const ev of response.events) {
      const rep = parseReputationEvent(ev);
      if (rep) repMap.set(rep.agent, rep);
    }

    const entries: VerificationEntry[] = [];
    for (const ev of response.events) {
      const entry = parseVerificationEvent(ev);
      if (entry) {
        const rep = repMap.get(entry.agent);
        if (rep) entry.reputation = rep;
        entries.push(entry);
      }
    }

    return entries.reverse();
  } catch {
    return [];
  }
}
