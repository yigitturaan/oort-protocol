import {
  Account,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  rpc,
  Keypair,
  Networks,
} from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK = Networks.TESTNET;
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const EXPLORER = "https://stellar.expert/explorer/testnet/tx";

export const CONFIG = {
  rpcUrl: RPC_URL,
  network: NETWORK,
  oortContract: "CCGUSOPYBZ3VNWW4AFOEKFFOYMCEBQ2GI3ADEEVFAGBD2GCSAFQXL2LH",
  oracleA: "CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ",
  oracleB: "CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z",
  oracleC: "CCK2TATLSSY5ANJ2RT7FUVUN542UMDE3SAZL5RQUJ7GZMJXMW7R3ZOZL",
  xlmSac: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};

export function txLink(hash: string): string {
  return `${EXPLORER}/${hash}`;
}

export async function fundAccount(publicKey: string): Promise<void> {
  const resp = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!resp.ok) {
    const text = await resp.text();
    if (!text.includes("createAccountAlreadyExist")) {
      throw new Error(`Friendbot failed: ${text}`);
    }
  }
}

export function refreshOraclePrices(prices?: {
  a?: string;
  b?: string;
  c?: string;
}): void {
  const { execSync } = require("child_process");
  const now = Math.floor(Date.now() / 1000);
  const pp = "Test SDF Network ; September 2015";
  const rpcUrl = "https://soroban-testnet.stellar.org";

  const oracleMap: [string, string][] = [
    [CONFIG.oracleA, prices?.a ?? "12100000000000"],
    [CONFIG.oracleB, prices?.b ?? "12100000000000"],
    [CONFIG.oracleC, prices?.c ?? "12000000000000"],
  ];

  for (const [id, price] of oracleMap) {
    const cmd = [
      `stellar contract invoke --id ${id}`,
      `--source-account oort-deployer`,
      `--network-passphrase "${pp}" --rpc-url ${rpcUrl}`,
      `-- set_price --asset '{"Other":"XLM_USD"}'`,
      `--price ${price} --timestamp ${now}`,
    ].join(" ");
    try {
      execSync(cmd, { stdio: "pipe", timeout: 30000 });
    } catch {
      // non-fatal for demo
    }
  }
}

export interface OraclePrice {
  source: string;
  price: bigint;
  priceUsd: number;
  timestamp: bigint;
  fresh: boolean;
}

export async function readOraclePrice(
  oracleId: string,
  sourceName: string
): Promise<OraclePrice | null> {
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(oracleId);

  const assetScVal = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Other"),
    xdr.ScVal.scvSymbol("XLM_USD"),
  ]);

  const account = new Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "0"
  );

  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: NETWORK,
  })
    .addOperation(contract.call("lastprice", assetScVal))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) return null;

  const simOk = sim as rpc.Api.SimulateTransactionSuccessResponse;
  if (!simOk.result) return null;

  const retval = simOk.result.retval;

  // Option<PriceData>: Some → Map (PriceData struct), None → Void
  if (retval.switch().name === "scvVoid") return null;

  const pdMap = retval.map();
  if (!pdMap) return null;

  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of pdMap) {
    fields[entry.key().sym().toString()] = entry.val();
  }

  const priceRaw = scValToI128(fields["price"]);
  const ts = BigInt(fields["timestamp"].u64().toString());
  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  const fresh = nowSecs >= ts && nowSecs - ts <= 600n;

  return {
    source: sourceName,
    price: priceRaw,
    priceUsd: Number(priceRaw) / 1e14,
    timestamp: ts,
    fresh,
  };
}

function scValToI128(val: xdr.ScVal): bigint {
  const i128 = val.i128();
  const hi = BigInt(i128.hi().toString());
  const lo = BigInt(i128.lo().toString());
  return (hi << 64n) | lo;
}

export function simulateRSI(): { value: number; signal: string } {
  const rsi = 25 + Math.random() * 10;
  const signal = rsi < 30 ? "BUY (oversold)" : "HOLD";
  return { value: Math.round(rsi * 10) / 10, signal };
}

export function medianPrice(prices: OraclePrice[]): bigint {
  const vals = prices
    .filter((p) => p.fresh)
    .map((p) => p.price)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (vals.length === 0) return 0n;
  if (vals.length % 2 === 1) return vals[Math.floor(vals.length / 2)];
  return (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2n;
}
