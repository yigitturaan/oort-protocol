/**
 * OORT Protocol SDK — Basic Flow Example
 *
 * Runs the full Commit-Verify-Execute cycle against testnet:
 *   1. Fund fresh accounts via Friendbot
 *   2. Refresh oracle prices (requires deployer key via `stellar keys`)
 *   3. Register agent (stake 1000 XLM)
 *   4. Lock vault (owner deposits XLM)
 *   5. submitAndExecute (commit + 4-layer verify)
 *   6. Check reputation
 *
 * Usage:
 *   npx ts-node examples/basic-flow.ts
 *
 * Prerequisites:
 *   - `stellar keys` identity "oort-deployer" with funds
 *   - Contracts deployed (see network.config.json)
 */

import { Keypair, Networks } from "@stellar/stellar-sdk";
import { OortSDK, AgentClaim } from "../src";

// ── Config (from network.config.json) ──

const RPC_URL = "https://soroban-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK = Networks.TESTNET;

const OORT_CONTRACT = "CD4FHPNNRPZ66Q4GF4JL2CIMYQ3V42AVBHE36E2J42XNDMJW3EFORLSF";
const ORACLE_A = "CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ";
const ORACLE_B = "CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z";
const ORACLE_C = "CCK2TATLSSY5ANJ2RT7FUVUN542UMDE3SAZL5RQUJ7GZMJXMW7R3ZOZL";
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// ── Helpers ──

async function fundAccount(publicKey: string): Promise<void> {
  const resp = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!resp.ok) {
    const text = await resp.text();
    if (!text.includes("createAccountAlreadyExist")) {
      throw new Error(`Friendbot failed: ${text}`);
    }
  }
}

async function refreshOraclePrices(): Promise<void> {
  const { execSync } = require("child_process");

  const now = Math.floor(Date.now() / 1000);
  const xlmPrice = "12100000000000"; // $0.121 at 14 decimals

  const oracles = [ORACLE_A, ORACLE_B, ORACLE_C];
  for (const oracleId of oracles) {
    try {
      const passphrase = "Test SDF Network ; September 2015";
      const rpcUrl = "https://soroban-testnet.stellar.org";
      const cmd = [
        "stellar contract invoke",
        `--id ${oracleId}`,
        "--source-account oort-deployer",
        `--network-passphrase "${passphrase}"`,
        `--rpc-url ${rpcUrl}`,
        "--",
        "set_price",
        '--asset \'{"Other":"XLM_USD"}\'',
        `--price ${xlmPrice}`,
        `--timestamp ${now}`,
      ].join(" ");

      execSync(cmd, { stdio: "pipe", timeout: 30000 });
      console.log(`  Oracle ${oracleId.slice(0, 8)}... price set`);
    } catch (err: any) {
      console.log(`  Oracle ${oracleId.slice(0, 8)}... FAILED: ${err.message?.split("\n")[0]}`);
    }
  }
}

// ── Main ──

async function main() {
  console.log("=== OORT Protocol — Basic Flow Demo ===\n");

  // 1. Create & fund accounts
  console.log("1. Creating test accounts...");
  const ownerKp = Keypair.random();
  const agentKp = Keypair.random();
  console.log(`   Owner: ${ownerKp.publicKey()}`);
  console.log(`   Agent: ${agentKp.publicKey()}`);

  await fundAccount(ownerKp.publicKey());
  await fundAccount(agentKp.publicKey());
  console.log("   Funded via Friendbot\n");

  // 2. Refresh oracle prices
  console.log("2. Refreshing oracle prices...");
  await refreshOraclePrices();
  console.log();

  // 3. Init SDK
  const oort = new OortSDK({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    contractId: OORT_CONTRACT,
    oracleIds: [ORACLE_A, ORACLE_B, ORACLE_C],
  });

  const currentLedger = await oort.getLatestLedger();
  console.log(`   Current ledger: ${currentLedger}\n`);

  // 4. Register agent
  console.log("3. Registering agent (stake: 1000 XLM)...");
  try {
    const regTx = await oort.registerAgent({
      keypair: agentKp,
      stakeAmount: 1_000_0000000n,
    });
    console.log(`   Tx: ${regTx}\n`);
  } catch (err: any) {
    console.error(`   Register failed: ${err.message}\n`);
    return;
  }

  // 5. Lock vault (owner deposits 10 XLM — under default 500M daily limit)
  console.log("4. Locking vault (10 XLM)...");
  let intentId: Buffer;
  try {
    const vault = await oort.lockVault({
      owner: ownerKp,
      agent: agentKp.publicKey(),
      token: XLM_SAC,
      amount: 10_0000000n, // 10 XLM (7 decimals)
      expiryLedger: currentLedger + 300,
    });
    intentId = vault.intentId;
    console.log(`   Intent ID: ${intentId.toString("hex")}`);
    console.log(`   Tx: ${vault.txHash}\n`);
  } catch (err: any) {
    console.error(`   Lock failed: ${err.message}\n`);
    return;
  }

  // 6. Build claim & submitAndExecute
  console.log("5. Submitting claim (commit + verify)...");
  // Slippage formula: fair_output = (amount * 10^14) / claimed_price
  // For 10 XLM: (10_0000000 * 10^14) / 12_100_000_000_000 ≈ 826_446_280_991
  // min_acceptable (2% slippage) ≈ 809_917_355_371
  const claim: AgentClaim = {
    priceFeed: "XLM_USD",
    claimedPrice: 12_100_000_000_000n, // $0.121 at 14 decimals (oracle scale)
    reasoning: "RSI 28.4 below 30 threshold",
    action: "BUY_XLM",
    protocol: OORT_CONTRACT, // MVP: target protocol = self (funds return to owner)
    expectedOutputMin: 820_000_000_000n, // passes slippage guard
    footprintHash: Buffer.alloc(32),
    footprintContracts: [],
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    expiryLedger: currentLedger + 300,
  };

  try {
    const result = await oort.submitAndExecute({
      intentId,
      claim,
      keypair: agentKp,
    });

    if (result.executed) {
      console.log(`   VERIFIED & EXECUTED`);
    } else {
      console.log(`   REJECTED — funds refunded to owner`);
    }
    console.log(`   Tx: ${result.txHash}\n`);
  } catch (err: any) {
    console.error(`   Verify failed: ${err.message}\n`);
  }

  // 7. Check reputation
  console.log("6. Agent reputation:");
  try {
    const rep = await oort.getReputation(agentKp.publicKey());
    console.log(`   Score: ${rep.score}`);
    console.log(`   Verifications: ${rep.totalVerifications}`);
    console.log(`   Passed: ${rep.passed} / Failed: ${rep.failed}`);
    console.log(`   Banned: ${rep.isBanned}`);
  } catch (err: any) {
    console.log(`   Could not fetch: ${err.message}`);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
