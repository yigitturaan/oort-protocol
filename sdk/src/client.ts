import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  Address,
  nativeToScVal,
  xdr,
  rpc,
  Transaction,
} from "@stellar/stellar-sdk";
import { AgentClaim, OortConfig, VaultUpdate, VerifyResult, ReputationInfo } from "./types";
import { serializeClaim, computeClaimHash, claimToScVal } from "./claim";

const DEFAULT_FEE = "10000000";
const TX_TIMEOUT = 180;
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

export class OortSDK {
  private server: rpc.Server;
  private contractId: string;
  private contract: Contract;
  private networkPassphrase: string;
  private oracleIds: string[];

  constructor(config: OortConfig) {
    this.server = new rpc.Server(config.rpcUrl);
    this.contractId = config.contractId;
    this.contract = new Contract(config.contractId);
    this.networkPassphrase = config.networkPassphrase;
    this.oracleIds = config.oracleIds;
  }

  // ── Public API ──

  async registerAgent(opts: {
    keypair: Keypair;
    stakeAmount: bigint;
  }): Promise<string> {
    const agentScVal = new Address(opts.keypair.publicKey()).toScVal();
    const stakeScVal = nativeToScVal(opts.stakeAmount, { type: "i128" });

    return this.submitTx(
      opts.keypair,
      this.contract.call("register_agent", agentScVal, stakeScVal)
    );
  }

  async lockVault(opts: {
    owner: Keypair;
    agent: string;
    token: string;
    amount: bigint;
    expiryLedger: number;
  }): Promise<{ intentId: Buffer; txHash: string }> {
    const intentId = randomIntentId();

    const intentIdScVal = nativeToScVal(intentId, { type: "bytes" });
    const ownerScVal = new Address(opts.owner.publicKey()).toScVal();
    const agentScVal = new Address(opts.agent).toScVal();
    const tokenScVal = new Address(opts.token).toScVal();
    const amountScVal = nativeToScVal(opts.amount, { type: "i128" });
    const expiryScVal = nativeToScVal(opts.expiryLedger, { type: "u32" });

    const txHash = await this.submitTx(
      opts.owner,
      this.contract.call(
        "lock_vault",
        intentIdScVal,
        ownerScVal,
        agentScVal,
        tokenScVal,
        amountScVal,
        expiryScVal
      )
    );

    return { intentId, txHash };
  }

  async commit(opts: {
    intentId: Buffer;
    claimHash: Buffer;
    keypair: Keypair;
  }): Promise<string> {
    const intentIdScVal = nativeToScVal(opts.intentId, { type: "bytes" });
    const claimHashScVal = nativeToScVal(opts.claimHash, { type: "bytes" });

    return this.submitTx(
      opts.keypair,
      this.contract.call("commit", intentIdScVal, claimHashScVal)
    );
  }

  async verifyAndExecute(opts: {
    intentId: Buffer;
    claim: AgentClaim;
    keypair: Keypair;
  }): Promise<VerifyResult> {
    // F2 fix: oracle addresses are now read from contract Instance storage
    const claimBytes = serializeClaim(opts.claim);
    const intentIdScVal = nativeToScVal(opts.intentId, { type: "bytes" });
    const claimDataScVal = xdr.ScVal.scvBytes(claimBytes);
    const claimedPriceScVal = nativeToScVal(opts.claim.claimedPrice, {
      type: "i128",
    });
    const assetSymbolScVal = nativeToScVal(opts.claim.priceFeed, {
      type: "symbol",
    });

    const txHash = await this.submitTx(
      opts.keypair,
      this.contract.call(
        "verify_and_execute",
        intentIdScVal,
        claimDataScVal,
        claimedPriceScVal,
        assetSymbolScVal
      )
    );

    const txResult = await this.server.getTransaction(txHash);
    const executed =
      txResult.status === rpc.Api.GetTransactionStatus.SUCCESS &&
      parseReturnBool(txResult);

    return { executed, txHash };
  }

  async submitAndExecute(opts: {
    intentId: Buffer;
    claim: AgentClaim;
    keypair: Keypair;
  }): Promise<VerifyResult> {
    const claimHash = computeClaimHash(opts.claim);

    await this.commit({
      intentId: opts.intentId,
      claimHash,
      keypair: opts.keypair,
    });

    return this.verifyAndExecute({
      intentId: opts.intentId,
      claim: opts.claim,
      keypair: opts.keypair,
    });
  }

  async getReputation(agent: string): Promise<ReputationInfo> {
    const agentScVal = new Address(agent).toScVal();
    const tx = await this.buildReadTx(
      this.contract.call("get_reputation", agentScVal)
    );
    const sim = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation error: ${(sim as any).error}`);
    }

    const simSuccess = sim as rpc.Api.SimulateTransactionSuccessResponse;
    const result = simSuccess.result;
    if (!result) {
      throw new Error("No result from simulation");
    }

    return parseReputation(result.retval);
  }

  async getLatestLedger(): Promise<number> {
    const resp = await this.server.getLatestLedger();
    return resp.sequence;
  }

  onVaultUpdate(
    intentId: Buffer,
    callback: (update: VaultUpdate) => void,
    opts?: { intervalMs?: number; maxAttempts?: number }
  ): { stop: () => void } {
    const intervalMs = opts?.intervalMs ?? 3000;
    const maxAttempts = opts?.maxAttempts ?? 200;
    let attempts = 0;
    let stopped = false;
    let cursor: string | undefined;
    let startLedger: number | undefined;

    const poll = async () => {
      if (stopped) return;
      attempts++;
      if (attempts > maxAttempts) {
        stopped = true;
        return;
      }

      try {
        if (!startLedger && !cursor) {
          const latest = await this.server.getLatestLedger();
          startLedger = latest.sequence - 100;
          if (startLedger < 0) startLedger = 0;
        }

        const request: rpc.Api.GetEventsRequest = cursor
          ? {
              filters: [
                {
                  type: "contract",
                  contractIds: [this.contractId],
                },
              ],
              cursor,
              limit: 50,
            }
          : {
              filters: [
                {
                  type: "contract",
                  contractIds: [this.contractId],
                },
              ],
              startLedger: startLedger!,
              limit: 50,
            };

        const response = await this.server.getEvents(request);

        if (response.events && response.events.length > 0) {
          cursor = response.cursor;

          for (const event of response.events) {
            const update = parseEventToVaultUpdate(event, intentId);
            if (update) {
              callback(update);
              if (
                update.status === "Executed" ||
                update.status === "Refunded" ||
                update.status === "Expired"
              ) {
                stopped = true;
                return;
              }
            }
          }
        }
      } catch {
        // RPC errors during polling are non-fatal
      }

      if (!stopped) {
        setTimeout(poll, intervalMs);
      }
    };

    poll();

    return {
      stop: () => {
        stopped = true;
      },
    };
  }

  // ── Internal helpers ──

  private async submitTx(
    signer: Keypair,
    operation: xdr.Operation
  ): Promise<string> {
    const account = await this.server.getAccount(signer.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: DEFAULT_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(TX_TIMEOUT)
      .build();

    const sim = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(
        `Simulation failed: ${(sim as any).error}`
      );
    }

    const prepared = rpc.assembleTransaction(tx, sim).build() as Transaction;
    prepared.sign(signer);

    const sendResult = await this.server.sendTransaction(prepared);

    if (sendResult.status === "ERROR") {
      throw new Error(`Send failed: ${sendResult.status}`);
    }

    return pollTxCompletion(this.server, sendResult.hash);
  }

  private async buildReadTx(
    operation: xdr.Operation
  ): Promise<Transaction> {
    const account = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0"
    );

    return new TransactionBuilder(account, {
      fee: DEFAULT_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(TX_TIMEOUT)
      .build();
  }
}

// ── Standalone helpers ──

function randomIntentId(): Buffer {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    const nodeCrypto = require("crypto");
    const randomBytes = nodeCrypto.randomBytes(16);
    bytes.set(randomBytes);
  }
  return Buffer.from(bytes);
}

async function pollTxCompletion(
  server: rpc.Server,
  hash: string
): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const txResponse = await server.getTransaction(hash);

    if (txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (txResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${hash}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Transaction polling timeout: ${hash}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseReturnBool(
  txResult: rpc.Api.GetTransactionResponse
): boolean {
  if (txResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) return false;
  const successResult = txResult as rpc.Api.GetSuccessfulTransactionResponse;
  if (!successResult.returnValue) return false;
  return successResult.returnValue.switch() === xdr.ScValType.scvBool() &&
    successResult.returnValue.b() === true;
}

function parseReputation(scVal: xdr.ScVal): ReputationInfo {
  const map = scVal.map();
  if (!map) throw new Error("Expected ScVal map for Reputation");

  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of map) {
    const key = entry.key().sym().toString();
    fields[key] = entry.val();
  }

  return {
    agent: Address.fromScVal(fields["agent"]).toString(),
    score: fields["score"].u32(),
    totalVerifications: fields["total_verifications"].u32(),
    passed: fields["passed"].u32(),
    failed: fields["failed"].u32(),
    totalVolume: scValToI128(fields["total_volume"]),
    stake: scValToI128(fields["stake"]),
    isBanned: fields["is_banned"].b(),
  };
}

function scValToI128(val: xdr.ScVal): bigint {
  const i128 = val.i128();
  const hi = BigInt(i128.hi().toString());
  const lo = BigInt(i128.lo().toString());
  return (hi << 64n) | lo;
}

function parseEventToVaultUpdate(
  event: rpc.Api.EventResponse,
  targetIntentId: Buffer
): VaultUpdate | null {
  if (!event.topic || event.topic.length < 2) return null;

  try {
    const eventName = event.topic[0].sym().toString();
    const statusMap: Record<string, VaultUpdate["status"]> = {
      VaultLocked: "Locked",
      AgentCommitted: "Committed",
      Verified: "Executed",
      Rejected: "Refunded",
      Refunded: "Expired",
    };

    const status = statusMap[eventName];
    if (!status) return null;

    const intentIdVal = event.topic[1];
    const intentIdBytes = intentIdVal.bytes();
    if (!intentIdBytes || !Buffer.from(intentIdBytes).equals(targetIntentId)) {
      return null;
    }

    const data = event.value.map();
    if (!data) return null;

    const fields: Record<string, xdr.ScVal> = {};
    for (const entry of data) {
      const key = entry.key().sym().toString();
      fields[key] = entry.val();
    }

    return {
      intentId: targetIntentId,
      status,
      agent: fields["agent"]
        ? Address.fromScVal(fields["agent"]).toString()
        : "",
      owner: fields["owner"]
        ? Address.fromScVal(fields["owner"]).toString()
        : "",
      amount: fields["amount"] ? scValToI128(fields["amount"]) : 0n,
    };
  } catch {
    return null;
  }
}
