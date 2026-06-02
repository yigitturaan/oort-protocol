import {
  Keypair,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  xdr,
  rpc,
  Transaction,
  hash,
} from "@stellar/stellar-sdk";
import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  OORT_CONTRACT_ID,
  server,
} from "./stellar";

const ORACLE_A = "CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ";
const ORACLE_B = "CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z";
const ORACLE_C = "CCK2TATLSSY5ANJ2RT7FUVUN542UMDE3SAZL5RQUJ7GZMJXMW7R3ZOZL";
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const FRIENDBOT = "https://friendbot.stellar.org";
const FEE = "10000000";
const TIMEOUT = 180;

export interface BotResult {
  executed: boolean;
  agent: string;
  txHash: string;
  intentId: string;
  score: number;
  stakeXlm: number;
  claimedPrice: string;
  deviationPct: string;
}

async function fund(pub: string) {
  const r = await fetch(`${FRIENDBOT}?addr=${pub}`);
  if (!r.ok) {
    const t = await r.text();
    if (!t.includes("createAccountAlreadyExist")) throw new Error("Fund failed");
  }
}

async function submitTx(signer: Keypair, op: xdr.Operation): Promise<string> {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(TIMEOUT)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Sim failed: ${(sim as any).error}`);
  }

  const prepared = rpc.assembleTransaction(tx, sim).build() as Transaction;
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error("Send error");

  for (let i = 0; i < 30; i++) {
    const resp = await server.getTransaction(sent.hash);
    if (resp.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (resp.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error("Tx failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Tx timeout");
}

function buildClaimScVal(
  claimedPrice: bigint,
  ledger: number
): { scVal: xdr.ScVal; bytes: Buffer; claimHash: Buffer } {
  const entries: xdr.ScMapEntry[] = [
    me("action", nativeToScVal("BUY_XLM", { type: "symbol" })),
    me("claimed_price", nativeToScVal(claimedPrice, { type: "i128" })),
    me("expected_output_min", nativeToScVal(BigInt("820000000000"), { type: "i128" })),
    me("expiry_ledger", nativeToScVal(ledger + 300, { type: "u32" })),
    me(
      "footprint_contracts",
      xdr.ScVal.scvVec([])
    ),
    me("footprint_hash", nativeToScVal(Buffer.alloc(32), { type: "bytes" })),
    me("price_feed", nativeToScVal("XLM_USD", { type: "symbol" })),
    me("protocol", new Address(OORT_CONTRACT_ID).toScVal()),
    me("reasoning", nativeToScVal("demo bot signal", { type: "string" })),
    me(
      "timestamp",
      nativeToScVal(BigInt(Math.floor(Date.now() / 1000)), { type: "u64" })
    ),
  ];
  const scVal = xdr.ScVal.scvMap(entries);
  const bytes = Buffer.from(scVal.toXDR());
  const claimHash = hash(bytes);
  return { scVal, bytes, claimHash };
}

function me(key: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol(key),
    val,
  });
}

function refreshOracles(): void {
  try {
    const { execSync } = require("child_process");
    const now = Math.floor(Date.now() / 1000);
    const pp = "Test SDF Network ; September 2015";
    const ru = "https://soroban-testnet.stellar.org";
    for (const [id, price] of [
      [ORACLE_A, "12100000000000"],
      [ORACLE_B, "12100000000000"],
      [ORACLE_C, "12000000000000"],
    ]) {
      execSync(
        `stellar contract invoke --id ${id} --source-account oort-deployer --network-passphrase "${pp}" --rpc-url ${ru} -- set_price --asset '{"Other":"XLM_USD"}' --price ${price} --timestamp ${now}`,
        { stdio: "pipe", timeout: 30000 }
      );
    }
  } catch {
    // non-fatal for demo
  }
}

function randomIntent(): Buffer {
  const crypto = require("crypto");
  return crypto.randomBytes(16);
}

export { refreshOracles };

export async function runBot(honest: boolean): Promise<BotResult> {
  // Refresh oracle prices before every bot run (ensures fresh timestamps)
  refreshOracles();

  const ownerKp = Keypair.random();
  const agentKp = Keypair.random();
  await Promise.all([fund(ownerKp.publicKey()), fund(agentKp.publicKey())]);

  const contract = new Contract(OORT_CONTRACT_ID);
  const ledger = (await server.getLatestLedger()).sequence;

  // register
  await submitTx(
    agentKp,
    contract.call(
      "register_agent",
      new Address(agentKp.publicKey()).toScVal(),
      nativeToScVal(BigInt("10000000000"), { type: "i128" })
    )
  );

  // lock
  const intentId = randomIntent();
  await submitTx(
    ownerKp,
    contract.call(
      "lock_vault",
      nativeToScVal(intentId, { type: "bytes" }),
      new Address(ownerKp.publicKey()).toScVal(),
      new Address(agentKp.publicKey()).toScVal(),
      new Address(XLM_SAC).toScVal(),
      nativeToScVal(BigInt("100000000"), { type: "i128" }),
      nativeToScVal(ledger + 300, { type: "u32" })
    )
  );

  // claim
  const claimedPrice = honest
    ? BigInt("12100000000000") // $0.121
    : BigInt("50000000000000"); // $0.50

  const { bytes, claimHash } = buildClaimScVal(claimedPrice, ledger);

  // commit
  await submitTx(
    agentKp,
    contract.call(
      "commit",
      nativeToScVal(intentId, { type: "bytes" }),
      nativeToScVal(claimHash, { type: "bytes" })
    )
  );

  // verify (oracle addresses read from contract Instance storage — F2 fix)
  const verifyHash = await submitTx(
    agentKp,
    contract.call(
      "verify_and_execute",
      nativeToScVal(intentId, { type: "bytes" }),
      xdr.ScVal.scvBytes(bytes),
      nativeToScVal(claimedPrice, { type: "i128" }),
      nativeToScVal("XLM_USD", { type: "symbol" })
    )
  );

  // read reputation
  const rep = await readRep(agentKp.publicKey());
  const medianPrice = 12100000000000;
  const deviation = Math.abs(
    ((Number(claimedPrice) - medianPrice) / medianPrice) * 100
  );

  return {
    executed: rep.score > 1000,
    agent: agentKp.publicKey(),
    txHash: verifyHash,
    intentId: intentId.toString("hex"),
    score: rep.score,
    stakeXlm: rep.stakeXlm,
    claimedPrice: (Number(claimedPrice) / 1e14).toFixed(3),
    deviationPct: deviation.toFixed(1),
  };
}

async function readRep(
  agent: string
): Promise<{ score: number; stakeXlm: number }> {
  try {
    const { fetchReputation } = await import("./stellar");
    const rep = await fetchReputation(agent);
    if (!rep) return { score: 0, stakeXlm: 0 };
    return {
      score: rep.score,
      stakeXlm: Number(rep.stake) / 1e7,
    };
  } catch {
    return { score: 0, stakeXlm: 0 };
  }
}
