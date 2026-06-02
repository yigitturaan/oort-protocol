# @oort-protocol/sdk

OORT Protocol SDK — AI agent pre-trade claim verification on Stellar/Soroban.

Commit-Verify-Execute: agents must cryptographically prove their data claims before any trade executes. If verification fails, funds stay safe in the Oort Vault.

## Installation

```bash
npm install @oort-protocol/sdk @stellar/stellar-sdk
```

## Quick Start — Agent Side (3 lines)

```typescript
import { OortSDK, AgentClaim } from "@oort-protocol/sdk";
import { Keypair, Networks } from "@stellar/stellar-sdk";

const oort = new OortSDK({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  contractId: OORT_CONTRACT_ID,
  oracleIds: [ORACLE_A, ORACLE_B],
});

// Register once (stakes 1000 XLM)
await oort.registerAgent({
  keypair: agentKeypair,
  stakeAmount: 1_000_0000000n, // 1000 XLM (7 decimals)
});

// Build a claim — what the agent believes and plans to do
const claim: AgentClaim = {
  priceFeed: "XLM_USD",
  claimedPrice: 121_000_000_000_00n, // $0.121 (14 decimals, oracle scale)
  reasoning: "RSI 28.4 < 30 threshold, buy signal",
  action: "BUY_XLM",
  protocol: PHOENIX_DEX_ID,
  expectedOutputMin: 8_200_0000000n, // min 8200 XLM (7 decimals)
  footprintHash: Buffer.alloc(32),
  footprintContracts: [],
  timestamp: BigInt(Math.floor(Date.now() / 1000)),
  expiryLedger: currentLedger + 300,
};

// Commit + Verify + Execute in one call
const result = await oort.submitAndExecute({
  intentId,
  claim,
  keypair: agentKeypair,
});

console.log(result.executed ? "Verified & executed" : "Rejected — funds refunded");
```

## Quick Start — User/App Side

```typescript
// Lock funds into Oort Vault — single tx, no approve needed (SEP-41)
const vault = await oort.lockVault({
  owner: userKeypair,
  agent: trustedAgentAddress,
  token: USDC_CONTRACT_ID,
  amount: 1_000_000000n, // 1000 USDC (6 decimals)
  expiryLedger: currentLedger + 300, // ~25 minutes
});

// Watch for outcome via Soroban event polling
oort.onVaultUpdate(vault.intentId, (update) => {
  switch (update.status) {
    case "Executed":
      console.log("Agent verified — trade executed!");
      break;
    case "Refunded":
      console.log("Agent failed verification — funds returned safely.");
      break;
    case "Expired":
      console.log("Timeout — funds returned.");
      break;
  }
});
```

## API Reference

### `new OortSDK(config: OortConfig)`

| Field | Type | Description |
|-------|------|-------------|
| `rpcUrl` | `string` | Soroban RPC endpoint |
| `networkPassphrase` | `string` | `Networks.TESTNET` or `Networks.PUBLIC` |
| `contractId` | `string` | Deployed oort-core contract ID |
| `oracleIds` | `string[]` | Default oracle contract addresses |

### Methods

| Method | Description |
|--------|-------------|
| `registerAgent({keypair, stakeAmount})` | Register agent with XLM stake (min 1000 XLM) |
| `lockVault({owner, agent, token, amount, expiryLedger})` | Lock funds in escrow, returns `{intentId, txHash}` |
| `commit({intentId, claimHash, keypair})` | Commit claim hash on-chain |
| `verifyAndExecute({intentId, claim, keypair})` | Run 4-layer verification + execute |
| `submitAndExecute({intentId, claim, keypair})` | Commit + verify in one flow |
| `getReputation(agent)` | Read agent reputation (simulated, no tx fee) |
| `getLatestLedger()` | Current ledger sequence number |
| `onVaultUpdate(intentId, callback)` | Poll events for vault status changes |

### Utilities

| Function | Description |
|----------|-------------|
| `serializeClaim(claim)` | Serialize AgentClaim to XDR bytes |
| `computeClaimHash(claim)` | SHA-256 hash of serialized claim |

## Verification Layers

Every `verifyAndExecute` call runs 4 checks atomically:

1. **Hash match** — SHA-256(claim) must equal committed hash
2. **Oracle check** — Multi-source median price vs claimed price (±1.5% pass, ±5% soft reject, >5% hard reject + slash)
3. **Footprint check** — All touched contracts must be whitelisted
4. **Policy check** — Spending limits, contract whitelist, slippage guard

All pass → execute. Any fail → refund + reputation penalty.

## Network Config

See `network.config.json` in the repo root for testnet contract IDs, oracle addresses, and asset SAC addresses.

## License

MIT
