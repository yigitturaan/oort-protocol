# OORT Protocol

**Pre-execution claim verification and escrow protection for AI agents on Stellar/Soroban.**

AI agents on Stellar are making autonomous trades — but none of them prove their data claims before executing. When the YieldBlox DAO lost **$10.2M** to oracle manipulation on Blend (Feb 2026), it showed that `simulateTransaction` alone isn't enough: it validates structure, not semantics.

OORT Protocol fixes this. Before an agent can touch user funds, it must **commit** its claims (price, target, reasoning), then **verify** them against multi-source oracles and policy rules, then — and only then — **execute**. If verification fails, funds are returned untouched and the agent is penalized.

> **30-Second Pitch:** 260+ agentic projects on Stellar, zero pre-execution verification. Soroban's `simulateTransaction` checks if a tx *can* run — not if the agent's price claim is *true*, the spending limit is *respected*, or the oracle is *manipulated*. OORT adds the missing semantic layer: Commit-Verify-Execute with multi-source oracles, footprint analysis, and escrow protection. The YieldBlox attack would have been stopped at Layer 2.

---

## How It Works — Commit-Verify-Execute (CVE)

```
User locks funds ──► Agent commits claim hash ──► OORT Guard verifies 4 layers:
     (Vault)              (SHA-256)
                                                    Layer 1: Hash integrity
                                                    Layer 2: Multi-source oracle check
                                                    Layer 3: Footprint whitelist
                                                    Layer 4: Policy compliance
                                                         │
                                          ┌──────────────┴──────────────┐
                                     All passed ✅                  Any failed ❌
                                          │                              │
                                    Execute trade                  Refund to user
                                    Reputation +20                 Slash agent stake
                                                                   Reputation −50
```

**Funds never leave the Vault unless all 4 layers pass. The user loses nothing on failure.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OORT PROTOCOL                            │
│                                                                 │
│   Any AI Agent ──► Oort SDK ──► Soroban Contracts               │
│   (Eliza, LangChain, custom)     │                              │
│                                  ├── Oort Vault (escrow)        │
│                                  ├── Oort Guard (4-layer verify)│
│                                  └── Reputation (ELO-style)     │
│                                                                 │
│   Oracle Sources: Reflector (SEP-40) + SDEX TWAP + Band         │
│   Policy Engines: SpendingLimit, ContractWhitelist, SlippageGuard│
└─────────────────────────────────────────────────────────────────┘
```

For detailed architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Verification Layers

| Layer | What It Checks | Source |
|-------|----------------|--------|
| **1 — Hash Integrity** | SHA-256(claim) matches committed hash — agent can't change its story | On-chain commit |
| **2 — Oracle Check** | Agent's claimed price vs. median of 2+ independent oracles (±1.5% soft / ±5% hard tolerance) | Reflector, Band, SDEX TWAP |
| **3 — Footprint** | All contracts in the transaction footprint are on the approved whitelist | `simulateTransaction` + whitelist |
| **4 — Policy** | Spending limits, contract whitelist, slippage bounds | Configurable on-chain rules |

---

## Testnet Deployment

| Contract | Address |
|----------|---------|
| **oort-core** | `CD4FHPNNRPZ66Q4GF4JL2CIMYQ3V42AVBHE36E2J42XNDMJW3EFORLSF` |
| **oracle-a** (mock) | `CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ` |
| **oracle-b** (mock) | `CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z` |
| **oracle-c** (mock) | `CCK2TATLSSY5ANJ2RT7FUVUN542UMDE3SAZL5RQUJ7GZMJXMW7R3ZOZL` |

Network: `Test SDF Network ; September 2015`
Explorer: [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Rust, `soroban-sdk` 26.0.1 |
| Build / Deploy | `stellar` CLI |
| SDK | TypeScript, `@stellar/stellar-sdk` 15.1.x |
| Demo UI | Next.js 16, React 19, Tailwind CSS 4 |
| Wallet | `@creit.tech/stellar-wallets-kit` + Freighter |
| Oracles (MVP) | Mock SEP-40 oracles (Reflector-compatible interface) |
| Network | Stellar Testnet |

---

## Quick Start

### Prerequisites

- Rust + `wasm32v1-none` target (`rustup target add wasm32v1-none`)
- `stellar` CLI ([install guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli))
- Node.js 18+
- A funded Testnet identity (`stellar keys generate --global oort-deployer --network testnet --fund`)

### Build & Test (Contracts)

```bash
# Build all contracts
make build

# Run all unit + integration tests
make test

# Optimize WASM for deployment
make optimize

# Check WASM sizes (must be under 64KB)
make sizes
```

### SDK

```bash
cd sdk
npm install
npm run build
npm test
```

### Demo UI (Oort Terminal)

```bash
cd app
npm install
npm run dev
# Open http://localhost:3000
```

### Demo Bots

```bash
# Honest agent — claims correct price, gets verified ✅
cd bots && npx tsx honest-bot.ts

# Liar agent — claims wrong price, gets rejected ❌ + slashed
cd bots && npx tsx liar-bot.ts
```

### Deploy to Testnet

See [DEPLOY.md](DEPLOY.md) for step-by-step instructions.

---

## Demo Flow (What the Jury Sees)

1. **HonestBot** claims XLM = $0.121 → Oracle median confirms → Swap executes → Reputation +20 → Green card in UI
2. **LiarBot** claims XLM = $0.50 → Oracle median $0.121, deviation 313% → HARD REJECT → Funds refunded to user, 10% stake slashed → Reputation −50 → Red alarm in UI
3. **Reputation table** shows agent scores, total protected funds, blocked bad transactions

---

## MVP Scope — What's In, What's Not

### In (MVP)

- `oort-core`: register, vault (lock/refund), commit, verify_and_execute, slash
- PriceVerifier: multi-source oracle median + 3-tier tolerance (pass / soft reject / hard reject)
- FootprintVerifier: transaction footprint whitelist check
- Policy engines: SpendingLimit, ContractWhitelist, SlippageGuard
- Reputation system: ELO-style K-factor scoring, ban threshold
- Oort SDK: TypeScript client for full CVE flow
- Demo bots: HonestBot + LiarBot
- Oort Terminal: live verification feed + reputation table + demo triggers

### Not in MVP (V2 Roadmap)

- Standing Escrow (continuous DCA-style escrow)
- DrawdownPolicy (portfolio max drawdown)
- Circuit Breaker (market crash auto-freeze)
- CAP-71 Custom Account Vault
- ERC-8004 post-execution registry integration
- Real oracle integration (Reflector mainnet, DIA, Band)
- ManipBot, YieldBot (additional demo bots)

---

## Known Limitations

| Limitation | Details |
|------------|---------|
| **Does not evaluate strategy quality** | OORT checks if "RSI is 28" is true — not if buying at RSI 28 is smart |
| **Cannot verify off-chain data** | Twitter sentiment, news — only on-chain oracle data |
| **~15 second CVE cycle** | Adequate for agent trading, not for HFT |
| **Oracle-dependent** | Can only verify assets that oracle sources support |
| **Mock oracles in MVP** | Testnet uses mock SEP-40 oracles, not live Reflector/Band feeds |
| **Single-tx escrow** | No standing/continuous escrow yet (V2) |

---

## Project Structure

```
oort-protocol/
├── contracts/
│   ├── oort-core/              # Vault + Guard + Reputation
│   │   └── src/                # lib, vault, guard, reputation, policies, types, events, test
│   ├── oort-price-verifier/    # Multi-source oracle median verification
│   └── oort-mock-oracle/       # SEP-40-compatible mock oracle for testing
├── sdk/                        # @oort-protocol/sdk (TypeScript)
│   └── src/                    # client, types, claim, index
├── bots/                       # honest-bot.ts, liar-bot.ts
├── app/                        # Oort Terminal (Next.js)
├── Cargo.toml                  # Workspace root
├── Makefile                    # build, test, optimize, deploy-testnet
├── ARCHITECTURE.md             # System architecture details
└── DEPLOY.md                   # Testnet deployment guide
```

---

## Inspiration & References

- **TALOS Protocol** (Monad) — Commit-Verify-Execute mechanism, adapted from Solidity to Rust/Soroban
- **YieldBlox / Blend Exploit** ($10.2M, Feb 2026) — Single-source oracle vulnerability that OORT's multi-source design prevents
- **Alqithami 2026** — "Autonomous Agents on Blockchains" (arXiv:2601.04583), C1-C7 threat taxonomy
- **Nava** ($8.3M funding, Arbitrum) — Market validation that agent verification is a real, funded category
- **x402 / MPP** — Machine-to-machine payment protocols on Stellar that OORT secures

---

## License

MIT

---

## Turkce Ozet

OORT Protocol, Stellar uzerinde calisan yapay zeka ajanlarinin islem oncesi veri iddialarini dogrulayan ve fonlari escrow ile koruyan bir guvenlik protokoludur. Ajan bir islem yapmak istediginde once iddialarini commit eder, sonra OORT Guard 4 katmanli dogrulama yapar (hash butunlugu, multi-source oracle kontrolu, footprint whitelist, politika uyumu). Tum katmanlar gecerse islem gerceklesir; herhangi biri duserse fonlar kullaniciya iade edilir ve ajan cezalandirilir. YieldBlox'un $10.2M kaybina yol acan tek-kaynak oracle manipulasyonu bu sistemde engellenir.

HackStellar Istanbul / Rise In <> Stellar Build On Stellar Hackathon IBW 2026 icin gelistirilmistir.
