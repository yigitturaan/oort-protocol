# OORT Protocol — Faz Takibi

## Faz 0 — Ortam, Workspace, Testnet
- [x] 0.1 Ortam doğrulama
- [x] 0.2 Workspace iskeleti (3 kontrat derleniyor)
- [x] 0.3 Testnet identity + fon + ağ konfig
- [x] 0.4 Git hijyeni & env

## Faz 1 — Tip Sistemi & Kontrat İskeleti
- [x] 1.1 types.rs
- [x] 1.2 events.rs
- [x] 1.3 lib.rs init/constructor + sabitler

## Faz 2 — Oort Vault (Escrow)
- [x] 2.1 lock_vault + register_agent
- [x] 2.2 refund
- [x] 2.3 Vault unit testleri

## Faz 3 — Mock Oracle & PriceVerifier
- [x] 3.1 oort-mock-oracle
- [x] 3.2 PriceVerifier
- [x] 3.3 PriceVerifier testleri

## Faz 4 — Oort Guard (Commit / Verify)
- [x] 4.1 Serileştirme round-trip
  - **Şema:** AgentClaim (contracttype struct) → ScVal XDR → Bytes → SHA-256
  - **Strateji:** Opak Bytes (Strateji A). Kontrat claim_data'yı parse etmez, sadece hash'ler.
  - **Alanlar:** price_feed(Symbol), claimed_price(i128), reasoning(String), action(Symbol), protocol(Address), expected_output_min(i128), footprint_hash(BytesN<32>), timestamp(u64), expiry_ledger(u32)
  - **TS tarafı (Faz 9):** nativeToScVal(claim) → toXDR() → sha256 = aynı hash
  - **Helper:** `claim_to_bytes()` test util + `compute_claim_hash()` guard.rs
- [x] 4.2 commit
- [x] 4.3 verify_and_execute
- [x] 4.4 Guard akış testleri

## Faz 5 — Politika Motorları
- [x] 5.1 SpendingLimit + ContractWhitelist
- [x] 5.2 SlippageGuard + check_all_policies
- [x] 5.3 Politika testleri

## Faz 6 — İtibar Sistemi & Slash
- [x] 6.1 reputation.rs
- [x] 6.2 İtibar/slash testleri

## Faz 7 — FootprintVerifier
- [x] 7.1 FootprintVerifier
- [x] 7.2 Footprint testleri

## Faz 8 — Entegrasyon Test + Build/Deploy
- [x] 8.1 Uçtan uca entegrasyon testleri
- [x] 8.2 Build + optimize + boyut kontrolü
- [x] 8.3 Testnet deploy + initialize + smoke test

## Faz 9 — Oort SDK (TypeScript)
- [x] 9.1 SDK iskeleti + types.ts + claim.ts
- [x] 9.2 client.ts
- [x] 9.3 index.ts + örnek + README
- [x] 9.4 SDK ↔ kontrat canlı doğrulama

## Faz 10 — Demo Botlar
- [x] 10.1 HonestBot
- [x] 10.2 LiarBot

## Faz 11 — Oort Terminal (Next.js UI)
- [x] 11.1 Next.js kurulum + tema + cüzdan
- [x] 11.2 Canlı Doğrulama Akışı
- [x] 11.3 İtibar Tablosu + metrikler
- [x] 11.4 Demo tetikleyici + cila

## Faz 12 — Uçtan Uca Demo & Sunum
- [x] 12.1 Tam dikey dilim provası
- [x] 12.2 README + mimari + deploy dokümanı
- [ ] 12.3 Pitch / sunum notları

## Faz 13 — Güvenlik & Cila
- [x] 13.1 Audit-style güvenlik incelemesi
- [x] 13.2 Son cila + temizlik
