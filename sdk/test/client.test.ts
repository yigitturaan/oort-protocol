import { describe, it, expect } from "vitest";
import { OortSDK } from "../src/client";
import { AgentClaim, OortConfig } from "../src/types";
import { Keypair, Networks } from "@stellar/stellar-sdk";

const TEST_CONTRACT = "CCGUSOPYBZ3VNWW4AFOEKFFOYMCEBQ2GI3ADEEVFAGBD2GCSAFQXL2LH";
const TEST_ORACLE_A = "CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ";
const TEST_ORACLE_B = "CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z";

function makeConfig(): OortConfig {
  return {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    contractId: TEST_CONTRACT,
    oracleIds: [TEST_ORACLE_A, TEST_ORACLE_B],
  };
}

function makeSampleClaim(): AgentClaim {
  const kp = Keypair.random();
  return {
    priceFeed: "XLM_USD",
    claimedPrice: 12_100_000_000_000n,
    reasoning: "RSI 28.4 < 30",
    action: "BUY_XLM",
    protocol: kp.publicKey(),
    expectedOutputMin: 82_000_000_00n,
    footprintHash: Buffer.alloc(32, 0xab),
    footprintContracts: [],
    timestamp: 1_748_736_000n,
    expiryLedger: 52_847_300,
  };
}

describe("OortSDK constructor", () => {
  it("creates an instance with valid config", () => {
    const sdk = new OortSDK(makeConfig());
    expect(sdk).toBeDefined();
    expect(sdk).toBeInstanceOf(OortSDK);
  });
});

describe("OortSDK.getLatestLedger", () => {
  it("returns a positive ledger number from testnet", async () => {
    const sdk = new OortSDK(makeConfig());
    const ledger = await sdk.getLatestLedger();
    expect(ledger).toBeGreaterThan(0);
  }, 15000);
});

describe("OortSDK.getReputation (simulated read)", () => {
  it("throws for unregistered agent (simulation error expected)", async () => {
    const sdk = new OortSDK(makeConfig());
    const randomAgent = Keypair.random().publicKey();
    await expect(sdk.getReputation(randomAgent)).rejects.toThrow();
  }, 15000);
});

describe("OortSDK.onVaultUpdate", () => {
  it("can be started and stopped without error", () => {
    const sdk = new OortSDK(makeConfig());
    const intentId = Buffer.alloc(16, 0x01);
    const updates: any[] = [];
    const sub = sdk.onVaultUpdate(intentId, (u) => updates.push(u), {
      maxAttempts: 1,
    });
    expect(sub).toBeDefined();
    expect(typeof sub.stop).toBe("function");
    sub.stop();
  });
});
