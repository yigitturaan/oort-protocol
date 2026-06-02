import { describe, it, expect } from "vitest";
import { serializeClaim, computeClaimHash } from "../src/claim";
import { AgentClaim } from "../src/types";
import { Keypair } from "@stellar/stellar-sdk";

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

describe("serializeClaim", () => {
  it("produces deterministic bytes", () => {
    const claim = makeSampleClaim();
    const bytes1 = serializeClaim(claim);
    const bytes2 = serializeClaim(claim);
    expect(bytes1.equals(bytes2)).toBe(true);
  });

  it("produces non-empty bytes", () => {
    const claim = makeSampleClaim();
    const bytes = serializeClaim(claim);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("different claim produces different bytes", () => {
    const claim1 = makeSampleClaim();
    const claim2 = { ...claim1, claimedPrice: 50_000_000_000_000n };
    const bytes1 = serializeClaim(claim1);
    const bytes2 = serializeClaim(claim2);
    expect(bytes1.equals(bytes2)).toBe(false);
  });
});

describe("computeClaimHash", () => {
  it("produces 32-byte hash", () => {
    const claim = makeSampleClaim();
    const hash = computeClaimHash(claim);
    expect(hash.length).toBe(32);
  });

  it("is deterministic", () => {
    const claim = makeSampleClaim();
    const hash1 = computeClaimHash(claim);
    const hash2 = computeClaimHash(claim);
    expect(hash1.equals(hash2)).toBe(true);
  });

  it("different claim produces different hash", () => {
    const claim1 = makeSampleClaim();
    const claim2 = { ...claim1, claimedPrice: 99_000_000_000_000n };
    const hash1 = computeClaimHash(claim1);
    const hash2 = computeClaimHash(claim2);
    expect(hash1.equals(hash2)).toBe(false);
  });
});
