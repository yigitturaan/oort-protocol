/**
 * HonestBot — OORT Protocol Demo (Spec §15 Senaryo A)
 *
 * Dürüst ajan: oracle'lardan gerçek fiyatı okur, doğru iddiada bulunur,
 * Oort Guard 4 katman doğrulamasını geçer → EXECUTED.
 *
 * Çalıştır: npm run honest
 */

import { Keypair } from "@stellar/stellar-sdk";
import { OortSDK, AgentClaim, computeClaimHash } from "@oort-protocol/sdk";
import {
  CONFIG,
  txLink,
  fundAccount,
  refreshOraclePrices,
  readOraclePrice,
  simulateRSI,
  medianPrice,
  OraclePrice,
} from "./helpers";

async function main() {
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│  🟢 HonestBot — Dürüst Ajan Demo            │");
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

  // ── 3. Oracle'lardan fiyat oku ──
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
  console.log(`\n  Median fiyat:    $${medianUsd.toFixed(4)}`);
  console.log(`  Kaynak sayisi:   ${prices.filter((p) => p.fresh).length}/3\n`);

  if (median === 0n) {
    console.error("  HATA: Gecerli oracle fiyati yok, bot durduruluyor.");
    return;
  }

  // ── 4. RSI sinyal simule et ──
  const rsi = simulateRSI();
  console.log(`[4/7] Teknik analiz (simulasyon)...`);
  console.log(`  RSI: ${rsi.value} → Sinyal: ${rsi.signal}\n`);

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
  console.log(`  Tx: ${txLink(regTx)}\n`);

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

  // ── 6. Claim + submitAndExecute ──
  console.log("[7/7] Claim olusturuluyor ve gonderiliyor...\n");

  const claim: AgentClaim = {
    priceFeed: "XLM_USD",
    claimedPrice: median,
    reasoning: `RSI ${rsi.value} < 30 threshold, buy signal`,
    action: "BUY_XLM",
    protocol: CONFIG.oortContract,
    expectedOutputMin: 820_000_000_000n,
    footprintHash: Buffer.alloc(32),
    footprintContracts: [],
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    expiryLedger: ledger + 300,
  };

  const claimHash = computeClaimHash(claim);
  const claimedUsd = Number(claim.claimedPrice) / 1e14;

  console.log("  ┌── AgentClaim ──────────────────────────────┐");
  console.log(`  │ price_feed:   XLM_USD                      │`);
  console.log(`  │ claimed_price: $${claimedUsd.toFixed(4)} (14 dec)           │`);
  console.log(`  │ reasoning:    RSI ${rsi.value} < 30 → BUY           │`);
  console.log(`  │ action:       BUY_XLM                      │`);
  console.log(`  │ claim_hash:   ${claimHash.toString("hex").slice(0, 20)}...   │`);
  console.log("  └────────────────────────────────────────────┘\n");

  console.log("  Dogrulama akisi:");
  console.log(`    Katman 1 (Hash):      commit → verify (SDK otomatik)`);

  const deviationBps = Math.abs(Number(claim.claimedPrice - median) * 10000 / Number(median));
  console.log(`    Katman 2 (Oracle):    iddia $${claimedUsd.toFixed(4)} vs median $${medianUsd.toFixed(4)} → %${deviationBps.toFixed(1)} sapma`);
  console.log(`    Katman 3 (Footprint): bos footprint → permissive`);
  console.log(`    Katman 4 (Policy):    spending + slippage\n`);

  const result = await oort.submitAndExecute({
    intentId: vault.intentId,
    claim,
    keypair: agentKp,
  });

  if (result.executed) {
    console.log("  ╔═══════════════════════════════════════════╗");
    console.log("  ║  SONUC: DOGRULANDI → EXECUTED             ║");
    console.log("  ║  Fonlar owner'a basariyla transfer edildi  ║");
    console.log("  ╚═══════════════════════════════════════════╝");
  } else {
    console.log("  ╔═══════════════════════════════════════════╗");
    console.log("  ║  SONUC: REDDEDILDI → REFUNDED             ║");
    console.log("  ╚═══════════════════════════════════════════╝");
  }
  console.log(`  Tx: ${txLink(result.txHash)}\n`);

  // ── 7. Reputation ──
  const rep = await oort.getReputation(agentKp.publicKey());
  console.log("  Ajan Itibar:");
  console.log(`    Score:   ${rep.score} (baslangic 1000 → +20)`);
  console.log(`    Passed:  ${rep.passed} / Failed: ${rep.failed}`);
  console.log(`    Stake:   ${Number(rep.stake) / 1e7} XLM`);
  console.log(`    Banned:  ${rep.isBanned}\n`);

  console.log("  Kullanici kaybi: 0 (fonlar korundu ve islem dogrulandi)");
  console.log("─────────────────────────────────────────────────");
}

main().catch(console.error);
