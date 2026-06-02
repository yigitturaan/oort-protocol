import { rpc, Networks, Account, Contract, TransactionBuilder, Address, xdr } from "@stellar/stellar-sdk";

export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const OORT_CONTRACT_ID =
  "CD4FHPNNRPZ66Q4GF4JL2CIMYQ3V42AVBHE36E2J42XNDMJW3EFORLSF";

export const server = new rpc.Server(RPC_URL);

export async function getLatestLedger(): Promise<number> {
  const resp = await server.getLatestLedger();
  return resp.sequence;
}

export interface ReputationData {
  agent: string;
  score: number;
  totalVerifications: number;
  passed: number;
  failed: number;
  totalVolume: bigint;
  stake: bigint;
  isBanned: boolean;
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

export async function fetchReputation(
  agentAddress: string
): Promise<ReputationData | null> {
  try {
    const contract = new Contract(OORT_CONTRACT_ID);
    const agentScVal = new Address(agentAddress).toScVal();

    const account = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0"
    );

    const tx = new TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("get_reputation", agentScVal))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return null;

    const simOk = sim as rpc.Api.SimulateTransactionSuccessResponse;
    if (!simOk.result) return null;

    const retval = simOk.result.retval;
    const map = retval.map();
    if (!map) return null;

    const fields: Record<string, xdr.ScVal> = {};
    for (const entry of map) {
      fields[entry.key().sym().toString()] = entry.val();
    }

    return {
      agent: agentAddress,
      score: fields["score"]?.u32() ?? 0,
      totalVerifications: fields["total_verifications"]?.u32() ?? 0,
      passed: fields["passed"]?.u32() ?? 0,
      failed: fields["failed"]?.u32() ?? 0,
      totalVolume: fields["total_volume"] ? scValToI128(fields["total_volume"]) : BigInt(0),
      stake: fields["stake"] ? scValToI128(fields["stake"]) : BigInt(0),
      isBanned: fields["is_banned"]?.b() ?? false,
    };
  } catch {
    return null;
  }
}

export async function discoverAgentsFromEvents(
  startLedger: number
): Promise<string[]> {
  try {
    const response = await server.getEvents({
      filters: [
        {
          type: "contract",
          contractIds: [OORT_CONTRACT_ID],
        },
      ],
      startLedger,
      limit: 200,
    });

    if (!response.events) return [];

    const agents = new Set<string>();
    for (const ev of response.events) {
      if (!ev.topic || ev.topic.length < 2) continue;
      try {
        const name = ev.topic[0].sym().toString();
        if (
          name === "Verified" ||
          name === "Rejected" ||
          name === "ReputationUpdated"
        ) {
          const addr =
            name === "ReputationUpdated"
              ? Address.fromScVal(ev.topic[1]).toString()
              : ev.topic.length >= 3
                ? Address.fromScVal(ev.topic[2]).toString()
                : null;
          if (addr) agents.add(addr);
        }
      } catch {
        // skip unparseable
      }
    }
    return Array.from(agents);
  } catch {
    return [];
  }
}
