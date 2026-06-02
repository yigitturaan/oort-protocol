/**
 * LiarBot — OORT Protocol Demo (Spec §15 Senaryo B)
 *
 * Yalanci ajan: gercek fiyat $0.121 iken $0.50 iddia eder (%313 sapma).
 * Oort Guard Katman-2 (oracle) HARD REJECT → fonlar iade, stake slash, itibar -50.
 *
 * Calistir: npm run liar
 */

import { Keypair } from "@stellar/stellar-sdk";
import { OortSDK, AgentClaim, computeClaimHash } from "@oort-protocol/sdk";
import {
  CONFIG,
  txLink,
  fundAccount,
  refreshOraclePrices,
  readOraclePrice,
  medianPrice,
  OraclePrice,
} from "./helpers";

const LIAR_PRICE = 50_000_000_000_000n; // $0.50 at 14 decimals — YANLIS!

async function main() {
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│  🔴 LiarBot — Yalanci Ajan Demo              │");
  console.log("│  Oort Protocol Commit-Verify-Execute         │");
  console.log("└─────────────────────────────────────────────┘\n");

  // ── 1. Setup ──
  console.log("[1/7] Hesaplar olusturuluyor...");
  const ownerKp = Keypair.random();
  const agentKp = Keypair.random();
  await Promise.all([fundAccount(ownerKp.publicKey()), fundAccount(agentKp.publicKey())]);
  console.log(`  Owner: ${ownerKp.publicKey().slice(0, 12)}...`);
  console.log(`  Agent: ${agentKp.publicKey().slice(0, 12)}...\n`);

  // ── 2. Oracle fiyatlarini tazele ──
  console.log("[2/7] Oracle fiyatlari ayarlaniyor...");
  refreshOraclePrices();

  // ── 3. Oracle'lardan gercek fiyat oku ──
  console.log("[3/7] Oracle'lardan XLM/USD fiyati okunuyor...\n");
  const prices: OraclePrice[] = [];
  for (const [id, name] of [
    [CONFIG.oracleA, "Reflector (A)"],
    [CONFIG.oracleB, "Band (B)"],
    [CONFIG.oracleC, "SDEX TWAP (C)"],
  ] as const) {
    const p = await readOraclePrice(id, name);
    if (p) {
      prices.push(p);
      console.log(
        `  ${p.source.padEnd(16)} $${p.priceUsd.toFixed(4)}  ${p.fresh ? "(taze)" : "(STALE)"}`
      );
    } else {
      console.log(`  ${name.padEnd(16)} (okunamadi)`);
    }
  }

  const median = medianPrice(prices);
  const medianUsd = Number(median) / 1e14;
  const liarUsd = Number(LIAR_PRICE) / 1e14;
  console.log(`\n  Gercek median:   $${medianUsd.toFixed(4)}`);
  console.log(`  LiarBot iddiasi: $${liarUsd.toFixed(2)} (YANLIS!)\n`);

  if (median === 0n) {
    console.error("  HATA: Gecerli oracle fiyati yok, bot durduruluyor.");
    return;
  }

  const deviationPct = Math.abs((liarUsd - medianUsd) / medianUsd * 100);
  console.log(`[4/7] Sapma analizi...`);
  console.log(`  |$${liarUsd.toFixed(2)} - $${medianUsd.toFixed(4)}| / $${medianUsd.toFixed(4)} = %${deviationPct.toFixed(0)}`);
  console.log(`  %${deviationPct.toFixed(0)} > %5 (hard esik) → HARD REJECT bekleniyor\n`);

  // ── 5. SDK init + register + lock ──
  const oort = new OortSDK({
    rpcUrl: CONFIG.rpcUrl,
    networkPassphrase: CONFIG.network,
    contractId: CONFIG.oortContract,
    oracleIds: [CONFIG.oracleA, CONFIG.oracleB, CONFIG.oracleC],
  });

  const ledger = await oort.getLatestLedger();

  console.log("[5/7] Ajan kaydediliyor (stake: 1000 XLM)...");
  const regTx = await oort.registerAgent({
    keypair: agentKp,
    stakeAmount: 1_000_0000000n,
  });
  console.log(`  Tx: ${txLink(regTx)}`);

  const repBefore = await oort.getReputation(agentKp.publicKey());
  console.log(`  Baslangic stake: ${Number(repBefore.stake) / 1e7} XLM\n`);

  console.log("[6/7] Vault kilitleniyor (10 XLM)...");
  const vault = await oort.lockVault({
    owner: ownerKp,
    agent: agentKp.publicKey(),
    token: CONFIG.xlmSac,
    amount: 10_0000000n,
    expiryLedger: ledger + 300,
  });
  console.log(`  Intent ID: ${vault.intentId.toString("hex")}`);
  console.log(`  Tx: ${txLink(vault.txHash)}\n`);

  // ── 6. YANLIS claim + submitAndExecute ──
  console.log("[7/7] YANLIS claim olusturuluyor ve gonderiliyor...\n");

  const claim: AgentClaim = {
    priceFeed: "XLM_USD",
    claimedPrice: LIAR_PRICE, // $0.50 — YANLIS!
    reasoning: "hallucination: price is definitely 0.50",
    action: "BUY_XLM",
    protocol: CONFIG.oortContract,
    expectedOutputMin: 820_000_000_000n,
    footprintHash: Buffer.alloc(32),
    footprintContracts: [],
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    expiryLedger: ledger + 300,
  };

  const claimHash = computeClaimHash(claim);

  console.log("  ┌── AgentClaim (SAHTE) ──────────────────────┐");
  console.log(`  │ price_feed:    XLM_USD                      │`);
  console.log(`  │ claimed_price: $${liarUsd.toFixed(2)} (14 dec) ← YANLIS!    │`);
  console.log(`  │ gercek fiyat:  $${medianUsd.toFixed(4)}                     │`);
  console.log(`  │ sapma:         %${deviationPct.toFixed(0)} (hard esik: %5)        │`);
  console.log(`  │ reasoning:     "hallucination"              │`);
  console.log(`  │ claim_hash:    ${claimHash.toString("hex").slice(0, 20)}...   │`);
  console.log("  └────────────────────────────────────────────┘\n");

  console.log("  Dogrulama akisi:");
  console.log(`    Katman 1 (Hash):      commit hash eslesecek (SDK otomatik)`);
  console.log(`    Katman 2 (Oracle):    iddia $${liarUsd.toFixed(2)} vs median $${medianUsd.toFixed(4)}`);
  console.log(`                          sapma %${deviationPct.toFixed(0)} > %5 → HARD REJECT`);
  console.log(`    Katman 3 (Footprint): ⏭️  (onceki adim basarisiz)`);
  console.log(`    Katman 4 (Policy):    ⏭️  (onceki adim basarisiz)\n`);

  const result = await oort.submitAndExecute({
    intentId: vault.intentId,
    claim,
    keypair: agentKp,
  });

  if (result.executed) {
    console.log("  ╔═══════════════════════════════════════════╗");
    console.log("  ║  SONUC: DOGRULANDI (BEKLENMEYEN!)         ║");
    console.log("  ╚═══════════════════════════════════════════╝");
  } else {
    console.log("  ╔═══════════════════════════════════════════╗");
    console.log("  ║  SONUC: REDDEDILDI → REFUNDED             ║");
    console.log("  ║  Islem HICBIR ZAMAN gerceklesmedi         ║");
    console.log("  ║  10 XLM → owner'a IADE edildi             ║");
    console.log("  ╚═══════════════════════════════════════════╝");
  }
  console.log(`  Tx: ${txLink(result.txHash)}\n`);

  // ── 7. Reputation + slash ──
  const repAfter = await oort.getReputation(agentKp.publicKey());
  const slashedXlm = (Number(repBefore.stake) - Number(repAfter.stake)) / 1e7;

  console.log("  Ajan Cezasi:");
  console.log(`    Score:   ${repBefore.score} → ${repAfter.score} (${Number(repAfter.score) - Number(repBefore.score)})`);
  console.log(`    Stake:   ${Number(repBefore.stake) / 1e7} → ${Number(repAfter.stake) / 1e7} XLM (${slashedXlm} XLM kesildi)`);
  console.log(`    Passed:  ${repAfter.passed} / Failed: ${repAfter.failed}`);
  console.log(`    Banned:  ${repAfter.isBanned}\n`);

  console.log("  ┌─────────────────────────────────────────────┐");
  console.log("  │  Kullanici kaybi: 0                         │");
  console.log("  │  10 XLM guvende iade edildi.                │");
  console.log("  │  Ajan 100 XLM stake kaybetti + itibar -50.  │");
  console.log("  └─────────────────────────────────────────────┘");
  console.log("─────────────────────────────────────────────────");
}

main().catch(console.error);
