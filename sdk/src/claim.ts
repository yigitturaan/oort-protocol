import { Address, nativeToScVal, xdr, hash } from "@stellar/stellar-sdk";
import { AgentClaim } from "./types";

/**
 * Serialize an AgentClaim to XDR bytes matching the Soroban contract's
 * `#[contracttype] AgentClaim` ScVal encoding.
 *
 * Soroban contracttype structs serialize as ScVal::Map with field names
 * as Symbol keys in ALPHABETICAL order. This must match exactly what
 * `claim.to_xdr(&env)` produces in Rust.
 */
export function serializeClaim(claim: AgentClaim): Buffer {
  const scVal = claimToScVal(claim);
  return scVal.toXDR();
}

/**
 * Compute SHA-256 hash of serialized claim bytes.
 * Must produce the same hash as `env.crypto().sha256(&claim_bytes)` in Soroban.
 */
export function computeClaimHash(claim: AgentClaim): Buffer {
  const claimBytes = serializeClaim(claim);
  return hash(claimBytes);
}

/**
 * Convert AgentClaim to ScVal (Map with alphabetically sorted field keys).
 * Field order MUST be alphabetical to match Soroban's contracttype encoding.
 *
 * Rust struct fields (alphabetical):
 *   action, claimed_price, expected_output_min, expiry_ledger,
 *   footprint_contracts, footprint_hash, price_feed, protocol,
 *   reasoning, timestamp
 */
export function claimToScVal(claim: AgentClaim): xdr.ScVal {
  const entries: xdr.ScMapEntry[] = [
    mapEntry("action", nativeToScVal(claim.action, { type: "symbol" })),
    mapEntry(
      "claimed_price",
      nativeToScVal(claim.claimedPrice, { type: "i128" })
    ),
    mapEntry(
      "expected_output_min",
      nativeToScVal(claim.expectedOutputMin, { type: "i128" })
    ),
    mapEntry(
      "expiry_ledger",
      nativeToScVal(claim.expiryLedger, { type: "u32" })
    ),
    mapEntry(
      "footprint_contracts",
      xdr.ScVal.scvVec(
        claim.footprintContracts.map((addr) =>
          new Address(addr).toScVal()
        )
      )
    ),
    mapEntry(
      "footprint_hash",
      nativeToScVal(claim.footprintHash, { type: "bytes" })
    ),
    mapEntry(
      "price_feed",
      nativeToScVal(claim.priceFeed, { type: "symbol" })
    ),
    mapEntry("protocol", new Address(claim.protocol).toScVal()),
    mapEntry(
      "reasoning",
      nativeToScVal(claim.reasoning, { type: "string" })
    ),
    mapEntry("timestamp", nativeToScVal(claim.timestamp, { type: "u64" })),
  ];

  return xdr.ScVal.scvMap(entries);
}

function mapEntry(key: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol(key),
    val,
  });
}
