# OORT Protocol — Testnet Deployment Guide

Step-by-step instructions for deploying OORT Protocol contracts to Stellar Testnet and running the demo.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Rust + Cargo | [rustup.rs](https://rustup.rs) |
| WASM target | `rustup target add wasm32v1-none` |
| Stellar CLI | `cargo install stellar-cli` ([releases](https://github.com/stellar/stellar-cli/releases)) |
| Node.js 18+ | [nodejs.org](https://nodejs.org) |

Verify:

```bash
rustc --version
cargo --version
stellar --version
node --version
```

---

## 1. Create & Fund Testnet Identity

```bash
stellar keys generate --global oort-deployer --network testnet --fund
stellar keys address oort-deployer
```

This creates a keypair and funds it via Friendbot (10,000 test XLM).

To check the balance:

```bash
stellar keys address oort-deployer
# Copy the address, check at https://stellar.expert/explorer/testnet
```

---

## 2. Get Asset SAC Addresses

```bash
# Native XLM SAC address
stellar contract id asset --asset native --network testnet

# USDC SAC address (testnet issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)
stellar contract id asset \
  --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  --network testnet
```

Current testnet addresses (verify before using):

| Asset | SAC Address | Decimals |
|-------|-------------|----------|
| XLM | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | 7 |
| USDC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | 6 |

---

## 3. Build & Optimize Contracts

```bash
# From repo root
make build      # Compiles all 3 contracts
make optimize   # Produces .optimized.wasm files
make sizes      # Verify all are under 64KB
```

Output WASM files are at `target/wasm32v1-none/release/`.

---

## 4. Deploy Mock Oracles

Deploy 3 mock oracle instances (for multi-source verification):

```bash
# Oracle A
stellar contract deploy \
  --wasm target/wasm32v1-none/release/oort_mock_oracle.optimized.wasm \
  --source-account oort-deployer --network testnet
# → ORACLE_A_ID

# Oracle B
stellar contract deploy \
  --wasm target/wasm32v1-none/release/oort_mock_oracle.optimized.wasm \
  --source-account oort-deployer --network testnet
# → ORACLE_B_ID

# Oracle C
stellar contract deploy \
  --wasm target/wasm32v1-none/release/oort_mock_oracle.optimized.wasm \
  --source-account oort-deployer --network testnet
# → ORACLE_C_ID
```

Initialize and set prices:

```bash
# Initialize each oracle
stellar contract invoke --id <ORACLE_A_ID> --source-account oort-deployer --network testnet \
  -- init --admin oort-deployer

# Set XLM price: $0.121 (decimals=14 → 12100000000000)
stellar contract invoke --id <ORACLE_A_ID> --source-account oort-deployer --network testnet \
  -- set_price --asset '{"Other":"XLM"}' --price 12100000000000 --timestamp <CURRENT_UNIX>

# Repeat for Oracle B ($0.120) and Oracle C ($0.122) for multi-source diversity
```

---

## 5. Deploy oort-core

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/oort_core.optimized.wasm \
  --source-account oort-deployer --network testnet
# → OORT_CORE_ID
```

Initialize:

```bash
stellar contract invoke --id <OORT_CORE_ID> --source-account oort-deployer --network testnet \
  -- initialize \
  --admin oort-deployer \
  --xlm_token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --usdc_token CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \
  --oracle_addresses '["<ORACLE_A_ID>","<ORACLE_B_ID>","<ORACLE_C_ID>"]' \
  --whitelist '["<ALLOWED_CONTRACT_1>","<ALLOWED_CONTRACT_2>"]'
```

---

## 6. Update Configuration Files

After deploying, update `network.config.json` with the new contract IDs:

```json
{
  "testnet": {
    "contracts": {
      "oortCore": "<OORT_CORE_ID>",
      "oracleA": "<ORACLE_A_ID>",
      "oracleB": "<ORACLE_B_ID>",
      "oracleC": "<ORACLE_C_ID>"
    }
  }
}
```

Create `.env` (gitignored) from `.env.example`:

```bash
cp .env.example .env
# Fill in the real contract IDs
```

---

## 7. Smoke Test (CLI)

Register a test agent:

```bash
# Generate test agent identity
stellar keys generate --global test-agent --network testnet --fund

# Register agent (stake 1000 XLM = 10000000000 stroops)
stellar contract invoke --id <OORT_CORE_ID> --source-account test-agent --network testnet \
  -- register_agent \
  --agent test-agent \
  --stake_amount 10000000000
```

Check reputation:

```bash
stellar contract invoke --id <OORT_CORE_ID> --source-account oort-deployer --network testnet \
  -- get_reputation --agent <TEST_AGENT_ADDRESS>
```

---

## 8. Run Demo Bots

```bash
# Ensure SDK is built
cd sdk && npm install && npm run build && cd ..

# Run HonestBot (expects Executed ✅)
cd bots && npx tsx honest-bot.ts

# Run LiarBot (expects Refunded ❌ + slash)
cd bots && npx tsx liar-bot.ts
```

---

## 9. Run Demo UI

```bash
cd app
npm install
npm run dev
# Open http://localhost:3000
# Connect Freighter wallet (set to Testnet)
# Use demo trigger buttons to run HonestBot / LiarBot scenarios
```

---

## Current Testnet Deployment

| Contract | ID |
|----------|-----|
| oort-core | `CD4FHPNNRPZ66Q4GF4JL2CIMYQ3V42AVBHE36E2J42XNDMJW3EFORLSF` |
| oracle-a | `CDK63ZS6RQGSFCJ3IIOQ3WLNORQTNIKWIJQ4UZ2L6MVZQ437K3USDUIZ` |
| oracle-b | `CCYCE3BQSJMW2SD7WPQDRZYYUKONY6KV6ZIIE4X4XWQYDXNNKCMOFU6Z` |
| oracle-c | `CCK2TATLSSY5ANJ2RT7FUVUN542UMDE3SAZL5RQUJ7GZMJXMW7R3ZOZL` |
| deployer | `GBLTFE4S5QHT7DS6JABLGNZAYLYLKLYNIBXLYLF4GV6TBGDNVMARDRL3` |

Network: `Test SDF Network ; September 2015`
RPC: `https://soroban-testnet.stellar.org`
Horizon: `https://horizon-testnet.stellar.org`
Explorer: [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)

---

## Redeployment

If contracts are modified and need redeployment:

```bash
make clean
make optimize
make deploy-testnet
# Update network.config.json and .env with new IDs
# Re-initialize oracles and oort-core
# Re-register test agents
```

---

## Mainnet Notes (Not for MVP)

- Mainnet requires a commercial RPC provider (QuickNode, Validation Cloud, Ankr, NowNodes) — SDF does not provide public mainnet RPC
- Replace mock oracles with real Reflector (`CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`) and Band (`CCQXWMZVM3KRTXTUPTN53YHL272QGKF32L7XEDNZ2S6OSUFK3NFBGG5M`)
- Never commit mainnet secret keys
- Use a dedicated deployer identity with limited funds
