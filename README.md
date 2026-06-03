<p align="center">
  <img src="https://img.shields.io/badge/Stellar-Soroban-blue?style=flat-square" alt="Stellar" />
  <img src="https://img.shields.io/badge/Rust-no__std-orange?style=flat-square" alt="Rust" />
  <img src="https://img.shields.io/badge/Network-Testnet-yellow?style=flat-square" alt="Testnet" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT" />
</p>

<h1 align="center">OORT Protocol</h1>

<p align="center">
  <strong>Pre-execution claim verification & escrow protection for AI agents on Stellar.</strong>
</p>

<p align="center">
  <a href="https://oort-protocol.vercel.app"><strong>Live Demo</strong></a> &nbsp;&middot;&nbsp;
  <a href="#how-it-works">How It Works</a> &nbsp;&middot;&nbsp;
  <a href="#verification-layers">Verification Layers</a> &nbsp;&middot;&nbsp;
  <a href="#quick-start">Quick Start</a>
</p>

---

## The Problem

260+ agentic projects are building on Stellar — but every single one assumes **the agent is honest**. Soroban's `simulateTransaction` checks if a transaction *can* run, not whether the agent's price claim is *true*, the spending limit is *respected*, or the oracle is *manipulated*.

When YieldBlox lost **$10.2M** to a single-oracle VWAP manipulation on Blend (Feb 2026), `simulateTransaction` couldn't have stopped it. **OORT would have.**

## The Solution

OORT Protocol is the missing security primitive: a **Commit-Verify-Execute** pipeline that forces every AI agent to prove its claims before touching user funds.

> *Think of it as a pre-flight checklist for AI agents. The plane doesn't take off unless every check passes.*

---

## How It Works

```
  User locks funds        Agent commits         OORT Guard verifies
  in Oort Vault           claim hash            through 4 layers
       |                  (SHA-256)                    |
       v                      |           +-----------+-----------+
   [ Vault ]                  v           |                       |
   Funds are            [ Commit ]     All pass               Any fail
   safe in escrow,      Tamper-proof      |                       |
   never in agent's     on-chain       Execute                 Refund
   wallet               record         trade                   to user
                                       Rep +20                 Slash stake
                                                               Rep -50
```

**Funds never leave the Vault unless all 4 layers pass. The user loses nothing on failure.**

---

## Verification Layers

| Layer | Question | How |
|-------|----------|-----|
| **1 — Hash Integrity** | Did the agent change its story? | SHA-256 of revealed claim must match committed hash |
| **2 — Oracle Check** | Is the claimed price real? | Median of 2+ independent oracles, ±1.5% soft / ±5% hard tolerance |
| **3 — Footprint** | Is the agent touching safe contracts? | Soroban-native footprint analysis against approved whitelist |
| **4 — Policy** | Is the agent within its limits? | Spending caps, contract whitelist, slippage bounds |

Layer 3 is **Stellar-native** — Soroban's footprint mechanism pre-declares which ledger keys a transaction will access. This is impossible on EVM.

---

## Architecture

```
+-----------------------------------------------------------------+
|                        OORT PROTOCOL                             |
|                                                                  |
|   Any AI Agent ----> Oort SDK ----> Soroban Contracts            |
|   (Eliza, LangChain, custom)        |                           |
|                                      +-- Oort Vault (escrow)    |
|                                      +-- Oort Guard (4-layer)   |
|                                      +-- Reputation (ELO-style) |
|                                                                  |
|   Oracles: Reflector (SEP-40) + SDEX TWAP + Band                |
|   Policies: SpendingLimit | ContractWhitelist | SlippageGuard    |
+-----------------------------------------------------------------+
```

---

## Demo

**[oort-protocol.vercel.app](https://oort-protocol.vercel.app)**

The live demo runs real on-chain transactions on Stellar Testnet:

1. **Honest Agent** claims XLM = $0.121 &rarr; oracle confirms &rarr; verified &rarr; reputation +20
2. **Liar Agent** claims XLM = $0.50 &rarr; oracle says $0.121 (313% deviation) &rarr; **HARD REJECT** &rarr; funds refunded, 10% stake slashed, reputation -50

---

## Testnet Contracts

| Contract | Address |
|----------|---------|
| **oort-core** | `CCGUSOPYBZ3VNWW4AFOEKFFOYMCEBQ2GI3ADEEVFAGBD2GCSAFQXL2LH` |
| **oracle-a** | `CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ` |
| **oracle-b** | `CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z` |
| **oracle-c** | `CCK2TATLSSY5ANJ2RT7FUVUN542UMDE3SAZL5RQUJ7GZMJXMW7R3ZOZL` |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Rust, `soroban-sdk` 26.0 |
| SDK | TypeScript, `@stellar/stellar-sdk` |
| Demo UI | Next.js 16, React 19, Tailwind CSS 4 |
| Wallet | `@creit.tech/stellar-wallets-kit` + Freighter |
| Oracles (MVP) | Mock SEP-40 oracles (Reflector-compatible) |
| Network | Stellar Testnet |

---

## Quick Start

```bash
# Build & test contracts
make build && make test

# Run demo UI
cd app && npm install && npm run dev

# Run bots directly
cd bots && npx tsx honest-bot.ts   # Verified
cd bots && npx tsx liar-bot.ts     # Rejected + slashed
```

<details>
<summary><strong>Prerequisites</strong></summary>

- Rust + `wasm32v1-none` target
- `stellar` CLI
- Node.js 18+
- Funded testnet identity: `stellar keys generate --global oort-deployer --network testnet --fund`

</details>

---

## Project Structure

```
oort-protocol/
├── contracts/
│   ├── oort-core/              # Vault + Guard + Reputation + Policies
│   ├── oort-price-verifier/    # Multi-source oracle median verification
│   └── oort-mock-oracle/       # SEP-40-compatible mock oracle
├── sdk/                        # @oort-protocol/sdk (TypeScript)
├── bots/                       # honest-bot.ts, liar-bot.ts
├── app/                        # Oort Terminal (Next.js demo UI)
├── Cargo.toml                  # Workspace root
└── Makefile                    # build, test, optimize, deploy
```

---

## MVP Scope

**In:** Vault escrow, 4-layer verification (hash + oracle + footprint + policy), ELO reputation with stake/slash, TypeScript SDK, live testnet demo.

**Not in MVP (V2):** Standing escrow, circuit breaker, CAP-71 custom account vault, real Reflector/DIA/Band integration, ERC-8004 registry.

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| Checks truth, not strategy | Verifies "RSI is 28" is correct — not if buying at RSI 28 is smart |
| On-chain data only | Cannot verify off-chain signals (news, sentiment) |
| ~15s CVE cycle | Fine for agent trading, not for HFT |
| Mock oracles in MVP | Testnet uses mock SEP-40 oracles |

---

## Inspiration

- **TALOS Protocol** (Monad) — CVE mechanism, adapted from Solidity to Soroban
- **YieldBlox Exploit** ($10.2M, Feb 2026) — single-oracle vulnerability that OORT's multi-source design prevents
- **Alqithami 2026** — "Autonomous Agents on Blockchains" threat taxonomy (arXiv:2601.04583)
- **Nava** ($8.3M, Arbitrum) — market validation for agent verification

---

<p align="center">
  <strong>Trust No Agent. Verify Every Claim.</strong>
  <br />
  <sub>HackStellar Istanbul &middot; Rise In &lt;&gt; Stellar Build On Stellar &middot; IBW 2026</sub>
</p>

---

## License

MIT
