# OORT PROTOCOL — PROMPT ROADMAP (Kopyala-Yapıştır Geliştirme Rehberi)

> **Bu nedir?** OORT Protocol'ü sıfırdan demo'ya kadar inşa etmek için **kronolojik, kopyala-yapıştır prompt zinciri**. Her prompt'u sırayla Claude Code'a yapıştır. Her prompt; gerekli kaynakları okumayı, doğrulamayı ve net bir çıktı üretmeyi içerir.
>
> **3 temel dosya** (her prompt bunlara dayanır):
> - `CLAUDE.md` — çalışma kuralları
> - `STELLAR-DEV-SKILL.md` — teknik referans
> - `OORT-PROTOCOL-proje-dokumani.md` — ürün/mimari spec (tek doğruluk kaynağı)

---

## NASIL KULLANILIR

1. Prompt'ları **sırayla** çalıştır. Bir fazı bitirmeden sonrakine geçme (bağımlılıklar var).
2. Her prompt'un başında **[ORTAK BAŞLIK]** bloğu vardır — bu blok zaten prompt metnine gömülü; olduğu gibi yapıştır.
3. Bir prompt'tan sonra Claude **derle/test çıktısını** gösterir. Yeşil değilse bir sonrakine geçme; "düzelt" de.
4. Faz sonlarındaki **✅ Kontrol Noktası**'nı kendin doğrula.
5. Takıldığında: `STELLAR-DEV-SKILL.md §10` (kaynaklar) ve genel `stellar-dev` skill alt dosyaları.

### [ORTAK BAŞLIK] (her prompt'un içinde tekrarlanır — silme)
> *Başlamadan önce şunları oku ve özümse: (1) `CLAUDE.md` kuralları, (2) `STELLAR-DEV-SKILL.md` ilgili bölümleri, (3) `OORT-PROTOCOL-proje-dokumani.md`'nin belirtilen bölümü. Kullanacağın volatil her bilgiyi (SDK sürümü, RPC endpoint, kontrat adresi, API imzası) resmi kaynaktan doğrula. Spec'teki sabitleri (tolerans, itibar puanı, stake, TTL, fonksiyon/struct adları) birebir koru. Küçük adımlarla ilerle, sonunda derle/test et ve çıktıyı göster.*

---

## FAZ HARİTASI

| Faz | Başlık | Çıktı |
|---|---|---|
| 0 | Ortam, Workspace İskeleti, Testnet | Derlenebilir boş workspace + identity |
| 1 | Tip Sistemi & Kontrat İskeleti | `types.rs`, `events.rs`, `lib.rs` init |
| 2 | Oort Vault (Escrow) | `lock_vault`, `refund` + testler |
| 3 | Mock Oracle & PriceVerifier | multi-source median + tolerans + testler |
| 4 | Oort Guard (commit / verify) | CVE çekirdeği + hash round-trip |
| 5 | Politika Motorları | SpendingLimit / Whitelist / Slippage |
| 6 | İtibar Sistemi & Slash | reputation + K-faktör + slash/ban |
| 7 | FootprintVerifier | footprint hash + whitelist |
| 8 | Entegrasyon Test + Build/Deploy | uçtan uca test + testnet deploy |
| 9 | Oort SDK (TypeScript) | client/types/claim/index |
| 10 | Demo Botlar | HonestBot + LiarBot |
| 11 | Oort Terminal (Next.js UI) | doğrulama akışı + itibar tablosu |
| 12 | Uçtan Uca Demo & Sunum | canlı demo + README + pitch |
| 13 | Güvenlik & Cila | audit-style review + son rötuş |

---
---

# FAZ 0 — ORTAM, WORKSPACE İSKELETİ, TESTNET

### Prompt 0.1 — Ortam doğrulama
```
[ORTAK BAŞLIK — CLAUDE.md, STELLAR-DEV-SKILL.md (§6), spec §18/§24'ü oku.]

Geliştirme ortamımı doğrula ve eksikleri kur. Sırasıyla kontrol et ve her birinin
sürümünü raporla: rustc, cargo, rustup (ve wasm32-unknown-unknown target), stellar CLI,
node, npm. Eksik olanlar için Windows/PowerShell'e uygun kurulum komutlarını ver ama
çalıştırmadan önce bana göster. stellar CLI ve soroban-sdk'nin GÜNCEL sürümünü
crates.io ve GitHub releases'ten doğrula, hangi sürümü hedefleyeceğimizi söyle.
Hiçbir şey kurmadan önce mevcut durumu özetle.
```

### Prompt 0.2 — Workspace iskeleti
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§1,§2,§3.2), spec §13'ü oku.]

OORT Protocol için Cargo workspace iskeletini kur. Spec Bölüm 13'teki dizin yapısına
birebir uy:
- contracts/oort-core (src: lib.rs, vault.rs, guard.rs, reputation.rs, types.rs, events.rs, test.rs)
- contracts/oort-price-verifier (src/lib.rs)
- contracts/oort-mock-oracle (src/lib.rs)
- kök Cargo.toml (workspace), Makefile
Şimdilik her kontrat sadece DERLENEBİLİR bir "hello"/boş iskelet olsun (gerçek mantık yok).
Her Cargo.toml'da soroban-sdk'nin doğruladığın güncel sürümünü ve spec'teki release profilini
kullan. Kurulum bitince `stellar contract build` ile HEPSİNİN derlendiğini kanıtla ve çıktıyı göster.
Henüz mantık yazma.
```

### Prompt 0.3 — Testnet identity + fon + ağ konfig
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§6), spec §24'ü oku.]

Testnet geliştirme için hazırlık yap:
1. `oort-deployer` adında global bir stellar identity oluştur ve Friendbot ile fonla.
2. Adresini ve bakiyesini göster.
3. Testnet XLM ve USDC SAC adreslerini al/öğret (`stellar contract id asset`), nasıl
   bulacağımı açıkla.
4. Ağ konfigürasyonunu (passphrase, RPC, Horizon, friendbot, explorer) spec §24'teki
   JSON'a uygun şekilde repo köküne `network.config.json` olarak yaz.
Komutları çalıştırmadan önce göster, sonra çalıştır ve sonuçları raporla.
```

### Prompt 0.4 — Git hijyeni & env
```
[ORTAK BAŞLIK — CLAUDE.md (§6,§1.6) oku.]

Repo hijyenini kur:
- Kapsamlı `.gitignore` (Rust target/, node_modules/, .env, *.key, build artefaktları,
  Next.js .next/, wasm çıktıları).
- `.env.example` (gerçek değer yok; OORT_CONTRACT_ID, ORACLE_IDS, RPC_URL gibi
  placeholder'lar).
- Kısa bir `PROGRESS.md` (faz takibi için boş şablon: her faz için onay kutusu).
Hiçbir secret repoya girmesin. Mevcut git durumunu kontrol et, yanlışlıkla izlenen
hassas dosya var mı bak. Değişiklikleri özetle; commit ETME (ben isteyince).
```

**✅ Kontrol Noktası 0:** `stellar contract build` 3 kontratı da derliyor; testnet identity fonlu; `.gitignore` secret'ları kapsıyor.

---

# FAZ 1 — TİP SİSTEMİ & KONTRAT İSKELETİ

### Prompt 1.1 — types.rs (tüm veri modelleri)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.1,§3.9,§4), spec §10,§12,§13'ü oku.]

contracts/oort-core/src/types.rs dosyasını yaz. Spec ile BİREBİR uyumlu olsun:
- Escrow struct (intent_id: BytesN<16>, owner, agent, token: Address, amount: i128,
  created_at: u64, expiry_ledger: u32, status, commit_hash: BytesN<32>, verified: bool)
- EscrowStatus enum (Locked, Committed, Executed, Refunded, Expired)
- Reputation struct (agent, score: u32, total_verifications, passed, failed,
  total_volume: i128, stake: i128, registered_at, last_verified, is_banned)
- VerificationResult enum (Passed{deviation_bps:u32}, SoftReject{...}, HardReject{...})
- PolicyResult enum (Allowed, Denied{reason: String})
- OortError contracterror enum (STELLAR-DEV-SKILL.md §3.9'daki liste)
- DataKey enum (Admin, XlmToken, UsdcToken, OracleAddresses, Config, Whitelist,
  SpendingLimit(Address), Reputation(Address)) — storage anahtarları
Tüm tiplerde gerekli #[contracttype]/#[derive] makrolarını koy. Sadece tipler;
fonksiyon mantığı yok. `cargo build` ile derlendiğini kanıtla.
```

### Prompt 1.2 — events.rs
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.8), spec §8,§16'yı oku.]

contracts/oort-core/src/events.rs yaz. Intent lifecycle ve doğrulama için event'ler:
VaultLocked, AgentCommitted, Verified (katman sonuçları + deviation_bps),
Rejected (sebep + slash miktarı), Refunded, ReputationUpdated.
UI'nın canlı akışı (spec §16) ve botların sonucu dinlemesi için yeterli alan koy.
#[contractevent] kullan, uygun topic'ler ver. Derlendiğini kanıtla.
```

### Prompt 1.3 — lib.rs init/constructor + sabitler
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3,§6 constructor notu), spec §13'ü oku.]

contracts/oort-core/src/lib.rs yaz:
- #![no_std], modül bağlantıları (mod types; mod events; mod vault; mod guard; mod reputation;)
- OortProtocol #[contract] struct
- initialize (veya hedef protocol 22+ ise __constructor): admin, xlm_token, usdc_token,
  oracle_addresses: Vec<Address>, whitelist: Vec<Address> alır; Instance storage'a yazar;
  re-init korumalı.
- Tüm protokol sabitleri tek yerde (MIN_STAKE=1000 XLM 7dec, SOFT/HARD_TOLERANCE_BPS=150/500,
  itibar +20/-50/-5/-10, başlangıç 1000, ban eşiği 100, TTL 300, MIN_TTL/EXTEND_TO).
vault/guard/reputation modülleri şimdilik boş `impl` stub olabilir. `cargo build`
ve `stellar contract build` ile derlendiğini kanıtla.
```

**✅ Kontrol Noktası 1:** Tüm tipler/eventler/sabitler derleniyor; `initialize` re-init korumalı; sabitler spec ile aynı.

---

# FAZ 2 — OORT VAULT (ESCROW)

### Prompt 2.1 — lock_vault + register_agent
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.3,§3.4,§3.5), spec §8(Adım1),§10,§13'ü oku.]

contracts/oort-core/src/vault.rs içinde iki fonksiyon yaz (spec §13 referans kod ile uyumlu):
1. register_agent(env, agent, stake_amount): agent.require_auth; min_stake (1000 XLM) kontrolü;
   XLM SAC ile stake'i kontrata transfer; Reputation oluştur (score=1000) → Persistent storage
   + TTL uzat.
2. lock_vault(env, intent_id, owner, agent, token_addr, amount, expiry_ledger):
   owner.require_auth; agent kayıtlı ve banlı değil; expiry > current sequence; SEP-41 transfer
   (owner→kontrat); Escrow (status=Locked) → Temporary storage, TTL = expiry - sequence.
   VaultLocked event yay.
Decimals farkına dikkat (USDC 6 / XLM 7). `cargo build` ile derlendiğini kanıtla.
```

### Prompt 2.2 — refund (timeout, permissionless)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.3,§9), spec §10(Zaman Aşımı),§13'ü oku.]

vault.rs'e refund(env, intent_id) ekle: status Locked|Committed olmalı; ledger sequence
>= expiry_ledger olmalı (permissionless — herkes çağırabilir); status=Expired; SEP-41 ile
fonu owner'a iade; itibar -10 (slash YOK); Refunded event. Geçersiz durumlarda OortError döndür.
`cargo build` ile kanıtla.
```

### Prompt 2.3 — Vault unit testleri
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§8), spec §15'i oku.]

contracts/oort-core/src/test.rs'e Vault testleri yaz (Env::default, mock auth, mock SAC token):
1. register_agent başarılı → reputation score=1000, stake kilitli.
2. Yetersiz stake → reddedilir.
3. lock_vault başarılı → Escrow Locked, fon kontratta.
4. Banlı ajana lock_vault → reddedilir.
5. Geçmiş expiry → reddedilir.
6. refund: expiry geçmeden çağrı → reddedilir; expiry geçince → fon iade + status Expired + itibar -10.
env.ledger().set_sequence_number/set_timestamp ile zaman akışını simüle et. Test için
mock SEP-41 token kontratı kullan (soroban test token örneği). `cargo test` yeşil olmalı,
çıktıyı göster.
```

**✅ Kontrol Noktası 2:** Vault testleri yeşil; fon kilitleme + permissionless iade + timeout cezası çalışıyor.

---

# FAZ 3 — MOCK ORACLE & PRICEVERIFIER

### Prompt 3.1 — oort-mock-oracle (SEP-40 uyumlu)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§4), spec §5.5,§9'u oku.]

contracts/oort-mock-oracle/src/lib.rs yaz. SEP-40 / Reflector arayüzünü BİREBİR taklit et:
Asset enum (Stellar(Address)/Other(Symbol)), PriceData{price:i128,timestamp:u64},
fonksiyonlar: lastprice(asset)->Option<PriceData>, price(asset,timestamp), decimals()->u32 (14),
resolution()->u32. Ek olarak TEST için: set_price(asset, price, timestamp) ve init(admin).
Mainnet Reflector ile aynı imza olsun ki ileride sadece adres değişsin. `cargo build` ile kanıtla.
```

### Prompt 3.2 — PriceVerifier (multi-source median + tolerans)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§4,§9), spec §9 (PriceVerifier + kademeli tolerans)'ı oku.]

contracts/oort-price-verifier/src/lib.rs (veya oort-core içinde guard'a bağlı bir modül —
hangisinin daha temiz olduğunu gerekçeyle seç) içinde verify_price yaz:
- Birden fazla oracle adresinden lastprice oku (cross-contract; mock-oracle ile aynı arayüz).
- Heartbeat: çok eski timestamp'li kaynağı ele.
- En az 2 geçerli kaynak yoksa → HardReject.
- Median hesapla (outlier doğal eleme).
- deviation_bps = |claimed - median| * 10000 / median (overflow/decimals'a dikkat; median>0).
- <=150 Passed | <=500 SoftReject | >500 HardReject (spec sabitleri).
Spec'teki örnek Rust koduyla uyumlu olsun. `cargo build` ile kanıtla.
```

### Prompt 3.3 — PriceVerifier testleri (YieldBlox senaryosu dahil)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§8), spec §9,§11(YieldBlox testi)'i oku.]

PriceVerifier için testler yaz:
1. 3 kaynak tutarlı ($0.121), claim $0.121 → Passed (%0).
2. claim $0.119 (median $0.121) → ~%1.7 → SoftReject.
3. claim $0.50 → ~%313 → HardReject.
4. Tek kaynak manipüle ($106 vs gerçek $1.05/$1.04), claim manipüle değeri → median outlier'ı
   eler, sapma çok büyük → HardReject (YieldBlox saldırısı bu sistemde düşer — kanıtla).
5. Sadece 1 geçerli kaynak → HardReject.
6. Eski (stale) timestamp → o kaynak elenir.
Mock oracle'lara set_price ile değer bas. `cargo test` yeşil, çıktıyı göster.
```

**✅ Kontrol Noktası 3:** Multi-source median + kademeli tolerans çalışıyor; YieldBlox tarzı tek-kaynak manipülasyonu test ile reddediliyor.

---

# FAZ 4 — OORT GUARD (COMMIT / VERIFY-EXECUTE)

### Prompt 4.1 — Serileştirme round-trip (ÖNCE BU)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.6,§7.1), spec §8 (Adım2)'yi oku.]

Katman-1 hash kontrolünün TS ile uyumlu olması için ÖNCE serileştirme şemasını sabitle:
- AgentClaim'in alanlarını (price_feed, claimed_price, reasoning, action, protocol,
  expected_output_min, footprint_hash, timestamp, expiry_ledger) deterministik bir byte
  layout'una koy. Strateji A (ScVal/Bytes) mı Strateji B (sabit BytesN<256>) mi — STELLAR-DEV-SKILL.md
  §7.1'i değerlendir, MVP için en az hata riskli olanı GEREKÇEYLE seç.
- Rust tarafında claim_data:Bytes alıp env.crypto().sha256 ile hash hesaplayan bir yardımcı yaz.
- Bir Rust testi: bilinen bir byte dizisinin SHA-256'sını hesapla, beklenen hash ile eşleştir.
Bu şema sdk/src/claim.ts ile birebir aynı olacak (Faz 9). Şemayı kısa bir not olarak
PROGRESS.md'ye yaz. `cargo test` yeşil, çıktıyı göster.
```

### Prompt 4.2 — commit
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.4), spec §8(Adım2),§13'ü oku.]

contracts/oort-core/src/guard.rs içine commit(env, intent_id, claim_hash: BytesN<32>) yaz:
escrow Temporary'den oku; escrow.agent.require_auth; status Locked olmalı; expiry geçmemiş;
commit_hash set, status=Committed; AgentCommitted event. Geçersiz durum/expired → OortError.
`cargo build` ile kanıtla.
```

### Prompt 4.3 — verify_and_execute (CVE çekirdeği, atomik)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.4,§3.6,§9), spec §8(Adım3,4a,4b),§13'ü oku.]

guard.rs içine verify_and_execute(env, intent_id, claim_data: Bytes, oracle_addresses: Vec<Address>)
yaz. Spec §13 referans kod ile uyumlu, ATOMİK:
- escrow Committed olmalı, expiry geçmemiş, agent.require_auth.
- KATMAN 1: sha256(claim_data) == commit_hash? değilse RED.
- KATMAN 2: verify_price (Faz 3) → Passed değilse RED (SoftReject vs HardReject ayrımını koru).
- KATMAN 3 (footprint): şimdilik stub/placeholder — Faz 7'de dolacak (TODO bırak, ama akışı kır).
- KATMAN 4: check_all_policies (Faz 5 stub) → şimdilik hep Allowed dönen stub.
- Hepsi geçerse: status=Executed, execute_action (şimdilik fonu owner'a/protokole gönderen
  basit placeholder + Executed event), itibar +.
- Biri düşerse: status=Refunded, fonu owner'a iade, HardReject ise slash (Faz 6 stub),
  itibar -, Rejected event.
update_reputation/slash şimdilik stub olabilir ama imzaları net olsun. `cargo build` ile kanıtla.
```

### Prompt 4.4 — Guard akış testleri
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§8), spec §15 (Senaryo A & B)'yi oku.]

guard testleri (Senaryo A/B):
1. Dürüst akış: lock→commit→verify (hash ✅, oracle Passed) → Executed, itibar +.
2. Yalancı fiyat: hash ✅ ama oracle HardReject → Refunded + fon iade + (slash stub çağrıldı).
3. Hash uyuşmazlığı: commit edilen ≠ claim_data hash'i → anında RED.
4. Yanlış state geçişleri (commit'siz verify, expired verify) → reddedilir.
`cargo test` yeşil, çıktıyı göster.
```

**✅ Kontrol Noktası 4:** Commit-Verify-Execute çekirdeği çalışıyor; dürüst→Executed, yalancı→Refunded; hash round-trip kanıtlı.

---

# FAZ 5 — POLİTİKA MOTORLARI

### Prompt 5.1 — SpendingLimitPolicy + ContractWhitelistPolicy
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.3,§3.4), spec §9 (Politika Motorları)'nı oku.]

guard.rs (veya policies.rs) içine:
- SpendingLimitPolicy: ajan başına günlük harcama takibi (Persistent storage, timestamp pencereli).
  daily_limit config'ten; aşılırsa Denied. set_spending_limit(admin auth).
- ContractWhitelistPolicy: claim'in hedef protokolü/kontratı Instance'taki whitelist'te mi?
  set_whitelist(admin auth). Değilse Denied.
PolicyResult dön. Decimals/zaman penceresine dikkat. `cargo build` ile kanıtla.
```

### Prompt 5.2 — SlippageGuardPolicy + check_all_policies
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§4), spec §9 (SlippageGuard),§3(Tehdit4)'ü oku.]

- SlippageGuardPolicy: claim.expected_output_min, mevcut median fiyata göre makul mü?
  max_slippage_bps (200=%2) aşılırsa Denied.
- check_all_policies(env, claim, escrow): üç politikayı sırayla çalıştırıp ilk Denied'da
  PolicyResult::Denied döner, hepsi geçerse Allowed. verify_and_execute'taki KATMAN 4 stub'ını
  bununla değiştir.
`cargo build` ile kanıtla.
```

### Prompt 5.3 — Politika testleri
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§8), spec §3 (Tehdit 3,4,5)'i oku.]

Politika testleri:
1. Günlük limiti aşan işlem → Denied (Tehdit 3).
2. Whitelist dışı kontrat → Denied (Tehdit 5).
3. Aşırı slippage → Denied (Tehdit 4).
4. Tüm politikalar uyumlu → Allowed.
5. Tam akış: politika ihlali olan verify_and_execute → Refunded.
`cargo test` yeşil, çıktıyı göster.
```

**✅ Kontrol Noktası 5:** Üç politika motoru çalışıyor; ihlal eden işlem verify aşamasında reddediliyor.

---

# FAZ 6 — İTİBAR SİSTEMİ & SLASH

### Prompt 6.1 — reputation.rs (update + K-faktör + slash + ban)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.3,§9), spec §12'yi oku.]

contracts/oort-core/src/reputation.rs yaz:
- update_reputation(env, agent, passed: bool, volume: i128): K-faktör (yeni<50 →40, 50-200 →20,
  200+ →10) ile score güncelle; passed→+ (spec: +15..+25, MVP'de +20), fail→− (HardReject -50,
  SoftReject -5, timeout -10 — çağıran ayrımı geçirsin); total_verifications/passed/failed/
  total_volume/last_verified güncelle; score<100 → is_banned=true; 0..2000 clamp. Persistent +
  TTL uzat. ReputationUpdated event.
- slash_agent(env, agent, bps): stake'in %10'unu kes → hazineye (admin adresi veya kontrat),
  reputation.stake azalt.
- get_reputation(env, agent) read-only getter (UI için).
verify_and_execute ve refund'daki stub'ları bunlarla değiştir. `cargo build` ile kanıtla.
```

### Prompt 6.2 — İtibar/slash testleri
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§8), spec §12,§15'i oku.]

Testler:
1. Başarılı doğrulama → score +20, passed++.
2. HardReject → score -50, %10 slash, stake azaldı.
3. SoftReject → score -5, slash YOK.
4. Timeout (refund) → score -10, slash YOK.
5. K-faktör: yeni ajan hızlı, deneyimli ajan yavaş değişir (işlem sayısına göre).
6. score<100 → is_banned=true; banlı ajan lock_vault alamaz (Faz 2 ile entegre).
7. clamp: score 0..2000 dışına çıkmaz.
`cargo test` yeşil, çıktıyı göster.
```

**✅ Kontrol Noktası 6:** İtibar K-faktörle güncelleniyor; HardReject'te slash, SoftReject/timeout'ta slash yok; ban eşiği çalışıyor.

---

# FAZ 7 — FOOTPRINTVERIFIER

### Prompt 7.1 — FootprintVerifier (hash + whitelist)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§5), spec §11'i oku.]

verify_and_execute'taki KATMAN 3 footprint stub'ını gerçekle:
- Claim, footprint_hash içeriyor (simulateTransaction'dan SDK tarafında üretilecek).
- MVP yaklaşımı: claim içindeki footprint'te yer alan kontrat adreslerinin (SDK'nın claim'e
  koyduğu liste) HEPSİ whitelist'te mi? Değilse FootprintResult::Rejected → RED.
- footprint_hash'in claim_data ile tutarlılığını (Katman 1 zaten claim bütününü hash'liyor)
  koru; footprint'in whitelist analizini ekle.
Spec §11'deki akışa sadık kal. Tam on-chain footprint parse MVP'de gerekmez (SDK sağlar);
karmaşıklaştırma. `cargo build` ile kanıtla.
```

### Prompt 7.2 — Footprint testleri
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§5,§8), spec §11 (YieldBlox/whitelist)'i oku.]

Testler:
1. Footprint'teki tüm kontratlar whitelist'te → geçer.
2. Whitelist dışı kontrat footprint'te → RED (Tehdit 5).
3. Tam akış: temiz footprint + temiz oracle + politika → Executed.
`cargo test` yeşil, çıktıyı göster.
```

**✅ Kontrol Noktası 7:** 4 katman (hash→oracle→footprint→policy) tam; yetkisiz kontrat footprint'te yakalanıyor.

---

# FAZ 8 — ENTEGRASYON TEST + BUILD/DEPLOY

### Prompt 8.1 — Uçtan uca entegrasyon testleri
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§8,§9), spec §15 (tam senaryolar)'ı oku.]

Tüm 4 katmanı ve botları tek testte birleştiren entegrasyon testleri yaz:
- Senaryo A (HonestBot): register→lock→commit→verify(4 katman ✅)→Executed→itibar +→event'ler.
- Senaryo B (LiarBot): oracle HardReject→Refunded→fon iade→%10 slash→itibar −→event'ler.
- Senaryo C: timeout→permissionless refund→itibar -10.
- Senaryo D: politika ihlali (limit/whitelist/slippage) → Refunded.
Tüm event'lerin doğru yayıldığını assert et. `cargo test` (tüm workspace) yeşil, çıktıyı göster.
Bu, demo'nun on-chain davranışının kanıtıdır.
```

### Prompt 8.2 — Build + optimize + boyut kontrolü
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§3.2,§6), common-pitfalls (64KB)'i oku.]

Tüm kontratları release build et, optimize et, WASM boyutlarını raporla. oort-core 64KB'ı
aşıyorsa: cargo-bloat ile analiz, modül ayırma/optimizasyon öner ve uygula. Makefile'a
`build`, `optimize`, `test`, `deploy-testnet` hedefleri ekle. Boyutları ve build çıktısını göster.
```

### Prompt 8.3 — Testnet deploy + initialize + smoke test
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§6,§7), spec §24'ü oku. Deploy geri-dönüşü zor değil
ama dış işlem; komutları önce göster.]

Testnet'e deploy et:
1. oort-mock-oracle deploy + init + set_price (XLM/USD ~$0.121, USDC ~$1.00).
2. (Gerekiyorsa) ikinci mock oracle deploy (multi-source için).
3. oort-core deploy + initialize (admin, xlm/usdc SAC, oracle adresleri, whitelist).
4. CLI ile smoke test: register_agent (test ajanı) → lock_vault → commit → verify_and_execute,
   stellar.expert'te tx'leri göster.
Tüm CONTRACT_ID'leri ve adresleri `network.config.json` ve `.env.example`'a (placeholder olarak)
işle; gerçek değerleri `.env`'e (gitignore'lu) yaz. Komutları çalıştırmadan önce göster.
```

**✅ Kontrol Noktası 8:** Tüm workspace testleri yeşil; kontratlar testnet'te deploy + initialize; CLI smoke test stellar.expert'te görülüyor.

---

# FAZ 9 — OORT SDK (TYPESCRIPT)

### Prompt 9.1 — SDK iskeleti + types.ts + claim.ts
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7), spec §14'ü oku. claim serileştirme Faz 4.1 ile
BİREBİR aynı olmalı — PROGRESS.md'deki şemayı uygula.]

sdk/ altında @oort-protocol/sdk paketini kur (package.json, tsconfig, @stellar/stellar-sdk
güncel sürüm — doğrula):
- src/types.ts: AgentClaim, OortConfig, VaultUpdate, sonuç tipleri (spec §14 ile uyumlu).
- src/claim.ts: serializeClaim(claim) ve computeClaimHash(claim) — Faz 4.1'de kontratta
  belirlenen layout ile BİREBİR aynı. SHA-256 hesaplama.
- Bir round-trip testi (Jest/Vitest): TS'de hesaplanan hash, kontrata commit edip verify
  ettiğinde Katman-1'i geçmeli (kontratla aynı byte → aynı hash). Mümkünse testnet'e karşı doğrula.
Build/test çalıştır, çıktıyı göster.
```

### Prompt 9.2 — client.ts (RPC + tx akışı)
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7.2,§7.4), spec §14'ü oku.]

sdk/src/client.ts: OortSDK sınıfı. Her Soroban tx için build→simulate→assembleTransaction→
sign→send→poll akışını uygula (asla simülasyonsuz gönderme). Metodlar:
- registerAgent({keypair, stakeAmount})
- lockVault({owner, agent, token, amount, expiryLedger})
- commit({intentId, claimHash, keypair})
- verifyAndExecute({intentId, claim, oracleAddresses, keypair})
- submitAndExecute({intentId, claim, keypair}) — commit+verify'i tek akışta yapar (spec §14).
- getReputation(agent), onVaultUpdate(intentId, cb) — RPC getEvents polling ile durum dinleme.
Doğru networkPassphrase, taze sequence, bigint (i128) yönetimi. Build/test, çıktıyı göster.
```

### Prompt 9.3 — index.ts + örnek + README
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7), spec §14'ü oku.]

sdk/src/index.ts (public export'lar). sdk/README.md: kurulum + spec §14'teki "3 satır
entegrasyon" örneği (ajan tarafı + kullanıcı tarafı). examples/ altında çalışan minimal bir
script: testnet'e karşı lock→submitAndExecute→sonuç. Çalıştırıp çıktıyı göster.
```

### Prompt 9.4 — SDK ↔ kontrat canlı doğrulama
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7,§8), spec §15'i oku.]

Faz 8'de deploy edilen testnet kontratına karşı SDK ile tam akışı koştur: registerAgent →
lockVault → submitAndExecute (dürüst claim) → Executed. Sonra yalancı claim → Refunded.
Event polling ile durumu yakala. Sorun çıkarsa (özellikle Katman-1 hash eşleşmesi)
serileştirme uyumunu düzelt. Sonuçları ve tx linklerini göster.
```

**✅ Kontrol Noktası 9:** SDK testnet kontratıyla uçtan uca çalışıyor; hash round-trip eşleşiyor; dürüst→Executed, yalancı→Refunded canlı kanıtlı.

---

# FAZ 10 — DEMO BOTLAR

### Prompt 10.1 — HonestBot
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7), spec §15(Senaryo A),§21(botlar)'ı oku.]

bots/honest-bot.ts: Oort SDK kullanır. Oracle'lardan (mock/testnet) gerçek XLM fiyatını çeker,
basit bir sinyal (örn. RSI eşiği simülasyonu) ile meşru bir AgentClaim üretir, doğru fiyatı
iddia eder, submitAndExecute çağırır. Beklenen: Executed ✅. Konsola adım adım (oracle fiyatı,
claim, hash, sonuç, itibar) loglar — UI/demo anlatımına uygun. Çalıştır, çıktıyı göster.
```

### Prompt 10.2 — LiarBot
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7), spec §15(Senaryo B),§21'i oku.]

bots/liar-bot.ts: Gerçek fiyat ~$0.121 iken kasıtlı/halüsinasyon $0.50 (~%313) iddia eder.
submitAndExecute çağırır. Beklenen: Refunded ❌ + slash + itibar −. Konsola "iddia vs median
vs sapma vs sonuç"u net loglar. Çalıştır, çıktıyı göster — kullanıcının 0 kayıp yaşadığını,
ajanın cezalandığını vurgula.
```

**✅ Kontrol Noktası 10:** İki bot da testnet'e karşı çalışıyor; HonestBot onaylanıyor, LiarBot yakalanıp cezalandırılıyor.

---

# FAZ 11 — OORT TERMINAL (NEXT.JS UI)

### Prompt 11.1 — Next.js kurulum + tema + cüzdan
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7.3), spec §16,§18,§24'ü oku.]

app/ altında Next.js + TypeScript + Tailwind projesi kur. Koyu/terminal/uzay teması (spec §16
estetiği). @creit.tech/stellar-wallets-kit ile cüzdan bağlantısı (Freighter), network=Testnet.
Üst bar: "OORT TERMINAL", ağ, canlı ledger sequence (RPC'den). Cüzdan bağla butonu çalışsın.
`npm run dev` ile ayağa kaldır, ekran görüntüsü/çıktı ile kanıtla.
```

### Prompt 11.2 — Canlı Doğrulama Akışı bileşeni
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7.2,§7.3), spec §16 (ana ekran)'ı oku.]

VerificationFeed bileşeni: Oort SDK / RPC getEvents ile son doğrulamaları çeker ve spec §16'daki
kart düzeniyle gösterir: ajan adı, iddia, 4 katman sonucu (hash/oracle/footprint/policy ✅❌⏭️),
median vs iddia vs sapma, sonuç (Executed/Refunded), itibar değişimi. Dürüst=yeşil, yalancı=kırmızı
alarm. Otomatik yenilensin (polling). Botları çalıştırıp akışta göründüğünü kanıtla.
```

### Prompt 11.3 — İtibar Tablosu + metrikler
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7.3), spec §16 (itibar tablosu)'nu oku.]

ReputationTable bileşeni: getReputation ile ajanları çeker, spec §16'daki tabloyu çizer
(sıra, ajan, puan, doğrulama sayısı, başarı %, hacim). Banlı ajanı işaretle. Altta
"Toplam Korunan Fon" ve "Engellenen Kötü İşlem" metrikleri (event'lerden hesapla).
Çalıştır, gerçek testnet verisiyle dolduğunu göster.
```

### Prompt 11.4 — Demo tetikleyici + cila
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§7.3), spec §16'yı oku.]

UI'ya demo kontrolü ekle: "HonestBot Çalıştır" ve "LiarBot Çalıştır" butonları (backend/API
route üzerinden botları tetikler veya hazır akışı simüle eder), böylece jüri önünde tek tıkla
sahneler oynar. Loading/animasyon (spec'teki ProcessingAnimation ruhu), hata durumları,
responsive düzen. Uçtan uca: buton→bot→on-chain→event→UI akışını kanıtla.
```

**✅ Kontrol Noktası 11:** Oort Terminal çalışıyor; cüzdan bağlanıyor; canlı doğrulama akışı + itibar tablosu testnet verisiyle dolu; demo butonları sahneleri oynatıyor.

---

# FAZ 12 — UÇTAN UCA DEMO & SUNUM

### Prompt 12.1 — Tam dikey dilim provası
```
[ORTAK BAŞLIK — CLAUDE.md (§8), STELLAR-DEV-SKILL.md (§8), spec §21 (demo akışı)'nı oku.]

Tüm sistemi uçtan uca prova et: temiz testnet ortamında register→lock→HonestBot(Executed)→
LiarBot(Refunded+slash)→UI'da yeşil/kırmızı→itibar tablosu güncellenir. Her adımın süresini ve
olası takılma noktalarını raporla. Kırılan/yavaş yeri düzelt. Demo'nun 3 dakikada akacağını
(spec §21 jüri akışı) kanıtla.
```

### Prompt 12.2 — README + mimari + deploy dokümanı
```
[ORTAK BAŞLIK — CLAUDE.md, spec'in tamamını referans al.]

Kök README.md yaz (İngilizce + kısa Türkçe özet): proje pitch (30 sn asansör), problem
(YieldBlox $10.2M), çözüm (4 katmanlı CVE), mimari diyagram, kurulum, build/test/deploy
komutları, demo nasıl çalıştırılır, testnet kontrat ID'leri, tech stack, sınırlamalar (spec §23).
Ayrı bir ARCHITECTURE.md (spec §7,§8 özeti) ve DEPLOY.md (spec §24). Dürüst ol —
abartma, MVP kapsamını net belirt.
```

### Prompt 12.3 — Pitch / sunum notları
```
[ORTAK BAŞLIK — spec §1,§5,§6,§21'i oku.]

3 dakikalık jüri sunumu için konuşma metni (spec §21 akışına göre): 0:00 problem, 0:30 çözüm,
1:00 HonestBot demo, 1:45 LiarBot demo, 2:30 pazar+vizyon (Nava $8.3M, Stellar footprint
avantajı). Ek olarak muhtemel jüri sorularına kısa cevaplar (neden Stellar? simulateTransaction
neden yetmez? rakiplerden farkı? gelir modeli?). PITCH.md olarak yaz.
```

**✅ Kontrol Noktası 12:** Demo 3 dakikada akıyor; README/ARCHITECTURE/DEPLOY/PITCH hazır; testnet ID'leri dokümanda.

---

# FAZ 13 — GÜVENLİK & CİLA

### Prompt 13.1 — Audit-style güvenlik incelemesi
```
[ORTAK BAŞLIK — STELLAR-DEV-SKILL.md (§9), genel skill security.md'yi oku.]

OORT kontratlarını audit gözüyle incele (STELLAR-DEV-SKILL.md §9 kontrol listesi):
auth doğruluğu, state machine geçişleri, atomiklik, overflow (i128, deviation), decimals
tutarlılığı, TTL (persistent itibar), slash sadece HardReject, refund permissionless şartı,
re-init koruması, whitelist/limit güncelleme yetkisi, secret sızıntısı. Bulguları
önem sırasına göre listele, her biri için düzeltme öner ve KRİTİK olanları uygula + test ekle.
Değişiklikleri ve test çıktısını göster.
```

### Prompt 13.2 — Son cila + temizlik
```
[ORTAK BAŞLIK — CLAUDE.md (§5 DoD)'i oku.]

Final temizlik: kullanılmayan kod/uyarıları temizle, isimlendirme tutarlılığı, kontrat
boyutu son kontrol, tüm workspace + SDK testleri yeşil mi doğrula, .env/secret sızıntısı
son taraması, README komutlarının gerçekten çalıştığını teyit. PROGRESS.md'de tüm fazları
işaretle. Eksik/risk kalan ne varsa dürüstçe listele. Commit ETMEDEN önce özet ver; ben
isteyince commit edeceğiz.
```

**✅ Kontrol Noktası 13:** Audit bulguları giderildi; tüm testler yeşil; secret yok; doküman komutları çalışıyor; proje demo + teslim hazır.

---
---

## EK: HIZLI BAŞVURU

**Faz bağımlılık zinciri:** 0 → 1 → 2 → 3 → 4 (4.1 önce!) → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

**Kritik erken kararlar:**
- Claim serileştirme şeması (Faz 4.1) — TS↔Rust birebir; en yüksek hata riski burada.
- Storage eşlemesi (Temporary=intent, Persistent=itibar, Instance=config) — baştan doğru.
- Decimals (USDC 6 / XLM 7 / oracle 14) — her karşılaştırmada ölçek eşitle.

**Zaman daralırsa öncelik:** Faz 0→4 (çekirdek CVE) → 9 (SDK) → 10 (botlar) → 11 (UI dikey dilim) → 12 (demo). Faz 5/7 stub'ları kalabilir; 6 (slash/itibar) demo etkisi için değerli.

**Her prompt sonrası kendine sor:** Derlendi mi? Test yeşil mi? Spec sabitleri korundu mu? Secret sızdı mı? Çıktı gösterildi mi?

> *Güvenme, Doğrula. — OORT Protocol*
