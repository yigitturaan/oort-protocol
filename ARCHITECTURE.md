# OORT Protocol — Architecture

This document describes the system architecture of OORT Protocol, a pre-execution claim verification and escrow protection layer for AI agents on Stellar/Soroban.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       OORT PROTOCOL (Stellar/Soroban)                │
│                                                                      │
│  External Agents:                                                    │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐            │
│  │ Eliza-based    │ │ LangChain      │ │ Any Stellar    │            │
│  │ agent          │ │ agent          │ │ agent          │            │
│  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘            │
│          └──────────────────┼──────────────────┘                      │
│                             ▼                                        │
│                   ┌───────────────────┐                               │
│                   │    OORT SDK       │  TypeScript                   │
│                   │    @oort/sdk      │  build→sim→sign→send          │
│                   └────────┬──────────┘                               │
│                            │                                         │
│      ┌─────────────────────┼─────────────────────┐                   │
│      ▼                     ▼                     ▼                    │
│ ┌──────────┐     ┌──────────────┐     ┌──────────────┐               │
│ │OORT VAULT│     │   COMMIT     │     │ OORT GUARD   │               │
│ │ (escrow) │     │ (SHA-256)    │     │ (4 layers)   │               │
│ │          │     │              │     │              │                │
│ │ SEP-41   │     │ claim_hash   │     │ Hash check   │               │
│ │ lock/    │     │ on-chain     │     │ Oracle check │               │
│ │ refund   │     │ Temporary    │     │ Footprint    │               │
│ │          │     │ Storage      │     │ Policy       │               │
│ └────┬─────┘     └──────┬───────┘     └──────┬───────┘               │
│      │                  │                    │                        │
│      │            ┌─────┴────────────────────┘                        │
│      │      ┌─────┴──────────────────┐                                │
│      │      │                        │                                │
│      ▼      ▼                        ▼                                │
│ ┌──────────────────┐     ┌──────────────────┐                         │
│ │  ✅ VERIFIED       │     │  ❌ REJECTED       │                      │
│ │  Execute trade    │     │  Refund to user   │                      │
│ │  Reputation +20   │     │  Slash agent 10%  │                      │
│ └──────────────────┘     └──────────────────┘                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Core Mechanism: Commit-Verify-Execute (CVE)

The entire protocol operates as a single 5-step flow, regardless of what the agent is doing (swap, stake, lend):

### Step 1 — Lock Funds (Vault)

User sends funds to the Oort Vault contract via `lock_vault()`. Funds are held in the smart contract, not in the agent's wallet. SEP-41 `transfer` — single step, no approve needed.

```
User → lock_vault(intent_id, agent, token, amount, expiry_ledger)
     → Escrow created in Temporary Storage (TTL = expiry - current sequence)
     → Status: Locked
```

### Step 2 — Commit Claim (Agent)

The agent constructs an `AgentClaim` with its data assertions (price, action, target protocol, expected output, footprint hash), serializes it, computes SHA-256, and writes the hash on-chain via `commit()`.

```
Agent → commit(intent_id, sha256(claim))
      → Hash stored in Temporary Storage
      → Status: Locked → Committed
```

### Step 3 — Verify (Guard)

The agent submits the full claim data to `verify_and_execute()`. Oort Guard runs 4 verification layers sequentially:

| Layer | Check | Failure Mode |
|-------|-------|-------------|
| **1 — Hash** | `sha256(claim_data) == committed_hash` | Instant reject — agent changed its story |
| **2 — Oracle** | Agent's claimed price vs. median of 2+ oracles | Soft reject (≤5%, no slash) or Hard reject (>5%, slash) |
| **3 — Footprint** | All contracts in transaction footprint on whitelist | Reject — unauthorized contract interaction |
| **4 — Policy** | SpendingLimit + ContractWhitelist + SlippageGuard | Reject — policy violation |

### Step 4a — All Passed → Execute

Vault releases funds, trade executes, agent reputation increases (+20).

### Step 4b — Any Failed → Refund

Funds return to user untouched. On Hard Reject: agent's stake is slashed 10%, reputation drops (−50). On Soft Reject: no slash, minor reputation hit (−5).

### Timeout

If the agent never commits or verification never completes before `expiry_ledger`, anyone can call `refund()` (permissionless). Funds return to user. Agent receives a minor reputation penalty (−10), no slash.

---

## Smart Contract Architecture

### Contract Layout

```
contracts/
├── oort-core/                    # Main contract — all protocol logic
│   └── src/
│       ├── lib.rs                # Entry point, initialize, constants, module wiring
│       ├── vault.rs              # register_agent, lock_vault, refund
│       ├── guard.rs              # commit, verify_and_execute, compute_claim_hash
│       ├── reputation.rs         # update_reputation, slash_agent, get_reputation
│       ├── policies.rs           # SpendingLimit, ContractWhitelist, SlippageGuard
│       ├── types.rs              # Escrow, EscrowStatus, Reputation, VerificationResult, etc.
│       ├── events.rs             # VaultLocked, Committed, Verified, Rejected, Refunded, etc.
│       └── test.rs               # Unit + integration tests
├── oort-price-verifier/          # Standalone price verification (cross-contract)
│   └── src/lib.rs                # verify_price: multi-source median + tolerance
└── oort-mock-oracle/             # SEP-40-compatible mock for testing
    └── src/lib.rs                # lastprice, set_price, decimals, resolution
```

### Storage Strategy

Soroban's 3-tier storage maps directly to OORT's data lifecycle:

| Storage Type | Cost / Lifetime | OORT Usage |
|-------------|----------------|------------|
| **Temporary** | Cheapest, permanently deleted at TTL expiry, unrecoverable | Intent/Escrow data, commit hashes — ephemeral by design |
| **Persistent** | Expensive, archivable but recoverable from ESS | Agent reputation, stake balances — must survive |
| **Instance** | Tied to contract instance, ≤64KB | Admin address, oracle addresses, whitelist, global config |

Key invariant: Persistent storage TTL is extended on every access to prevent accidental archival of reputation data.

### State Machine

```
                    lock_vault()
                        │
                        ▼
                    ┌────────┐
                    │ Locked │
                    └───┬────┘
                        │ commit()
                        ▼
                   ┌──────────┐
                   │Committed │
                   └────┬─────┘
                        │ verify_and_execute()
               ┌────────┴────────┐
               ▼                 ▼
          ┌──────────┐     ┌──────────┐
          │ Executed │     │ Refunded │
          └──────────┘     └──────────┘

          Any state + expiry_ledger reached:
               │ refund()
               ▼
          ┌──────────┐
          │ Expired  │
          └──────────┘
```

Transitions are strictly enforced. Invalid transitions return `OortError`.

---

## Verification Details

### PriceVerifier — Multi-Source Oracle

Reads price from 2+ independent oracle contracts (SEP-40 interface), computes median, and compares against the agent's claim:

```
Tolerance:
  ≤1.5%  →  Passed        (normal network latency range)
  ≤5.0%  →  Soft Reject   (retry encouraged, no slash, reputation −5)
  >5.0%  →  Hard Reject   (malicious/hallucination, 10% slash, reputation −50)
```

The 3-tier system distinguishes honest latency from malicious claims. Median naturally eliminates a single manipulated source (the YieldBlox attack vector).

### FootprintVerifier — Stellar-Native

Unique to Soroban — impossible on EVM chains. The agent runs `simulateTransaction` off-chain, gets the footprint (list of ledger keys the tx will touch), and includes the contract addresses in its claim. Oort Guard checks every contract in the footprint against the on-chain whitelist.

Bonus: if the ledger state changes between simulation and execution (e.g., MEV manipulation), the footprint goes stale and Soroban HOST rejects the tx automatically — double-layer MEV protection.

### Policy Engines

| Policy | What It Enforces |
|--------|-----------------|
| **SpendingLimitPolicy** | Daily spend cap per agent (configurable, Persistent storage) |
| **ContractWhitelistPolicy** | Target contract must be in approved list (Instance storage) |
| **SlippageGuardPolicy** | `expected_output_min` must be within max slippage tolerance of market price |

All policies return `PolicyResult::Allowed` or `PolicyResult::Denied { reason }`. First denial short-circuits.

---

## Reputation System

ELO-inspired scoring with K-factor decay:

| Agent Experience | K-Factor | Effect |
|-----------------|----------|--------|
| < 50 verifications | 40 | Score changes fast — new agents prove themselves quickly |
| 50–200 verifications | 20 | Balanced |
| 200+ verifications | 10 | Score changes slowly — established agents are stable |

```
Starting score:   1000
Range:            0 – 2000
Ban threshold:    < 100 (agent cannot create new vaults)
```

| Event | Score Change |
|-------|-------------|
| Verification passed | +20 (scaled by K-factor) |
| Hard Reject | −50 |
| Soft Reject | −5 |
| Timeout | −10 |

Slash (10% of staked XLM) only occurs on Hard Reject. Soft Reject and timeout do not slash — protecting honest agents from network latency penalties.

---

## SDK Architecture

```
sdk/src/
├── index.ts      # Public exports
├── types.ts      # AgentClaim, OortConfig, VaultUpdate, result types
├── claim.ts      # serializeClaim, computeClaimHash (byte-for-byte match with Rust)
└── client.ts     # OortSDK class — registerAgent, lockVault, commit,
                  #   verifyAndExecute, submitAndExecute, getReputation,
                  #   onVaultUpdate (event polling)
```

Every Soroban transaction follows: **build → simulate → assembleTransaction → sign → send → poll**. No transaction is ever sent without simulation.

Claim serialization in `claim.ts` produces byte-for-byte identical output to the Rust contract's `compute_claim_hash`. This is verified by round-trip tests.

---

## Why Stellar?

| Stellar Feature | OORT Benefit |
|----------------|-------------|
| `simulateTransaction` + Footprint | FootprintVerifier layer — see tx access map before execution (impossible on EVM) |
| Temporary Storage | Intent lifecycle with zero state bloat — self-cleaning architecture |
| No reentrancy (host-level) | ReentrancyGuard unnecessary — one attack vector eliminated |
| CAP-71 delegated auth | Foundation for Vault escrow (V2: Custom Account) |
| SEP-41 single-step transfer | No approve+transferFrom friction |
| Multi-source oracles | Reflector + Band + SDEX TWAP available |
| ~5 second finality | ~15 second CVE cycle — adequate for agent trading |

---

## Security Properties

- Funds are never in the agent's wallet — always in the Vault contract
- `verify_and_execute` is atomic: all layers pass and execute, or refund. No partial state.
- Agent key theft cannot drain Vault funds without passing verification
- Single manipulated oracle is eliminated by median calculation (2/3 agreement required)
- Stale footprint = Soroban HOST rejects tx automatically (MEV protection)
- Permissionless `refund()` after expiry prevents stuck funds
- Re-initialization protection on the contract
- `require_auth()` on all sensitive operations (owner for lock, agent for commit/verify, admin for config)
