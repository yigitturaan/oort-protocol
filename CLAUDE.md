# CLAUDE.md — OORT PROTOCOL Çalışma Kuralları

> Bu dosya, OORT Protocol deposunda Claude Code'un **her oturumda** uyacağı kural setidir. Amaç: hatasız, doğrulanabilir, hackathon-demo'ya hazır kod üretmek. Bu dosya kısa, kesin ve uygulanabilir tutulur — açıklama değil, **kural**.

---

## 0. Proje Kimliği

- **Proje:** OORT Protocol — Stellar/Soroban üzerinde AI-ajan işlem öncesi iddia doğrulama + escrow koruma protokolü (Commit-Verify-Execute).
- **Bağlam:** HackStellar Istanbul / Rise In <> Stellar Build On Stellar IBW 2026. Solo geliştirici, AI-destekli.
- **Tek doğruluk kaynağı (spec):** `OORT-PROTOCOL-proje-dokumani.md`. Mimari/davranış kararı gerektiğinde **önce bu dokümanı oku.** Doküman ile bu dosya çelişirse → dokümanın ilgili bölümünü referans göster ve kullanıcıya sor.
- **Diller:** Kontrat = Rust (`soroban-sdk`); SDK/bot/UI = TypeScript. Ağ = Testnet (MVP).

---

## 1. ALTIN KURALLAR (her görevde, istisnasız)

1. **Her görevin başında oku:** (a) bu `CLAUDE.md`, (b) `STELLAR-DEV-SKILL.md`, (c) `OORT-PROTOCOL-proje-dokumani.md`'nin ilgili bölümü. Okumadan kod yazma.
2. **Doğrula, varsayma.** Volatil her şeyi (SDK sürümü, RPC endpoint, kontrat adresi, CAP/SEP statüsü, API imzası) kullanmadan önce resmi kaynaktan WebFetch/WebSearch ile teyit et. "Muhtemelen böyledir" yasak.
3. **Spec'e sadık kal.** Fonksiyon adları, struct alanları, tolerans değerleri (%1.5 / %5), itibar puanları (+15..+25 / −50..−80), stake (1000 XLM), TTL (300 ledger) `OORT-PROTOCOL-proje-dokumani.md`'deki ile birebir aynı olmalı. Değiştirmen gerekiyorsa önce sor.
4. **Küçük, doğrulanmış adımlar.** Bir prompt = bir net çıktı. Büyük değişikliği parçalara böl. Her adımda derle/test et.
5. **Kanıtla.** "Çalışıyor" deme — `cargo test` / `cargo build` / `stellar contract build` çıktısını göster. Test geçmiyorsa açıkça söyle, çıktıyı paylaş.
6. **Sırrı sızdırma.** Secret key, seed, `.env` içeriği repoya/commit'e/çıktıya girmez. Mainnet anahtarı asla. `.gitignore` her zaman güncel.
7. **Mevcut kodu taklit et.** Yeni kod, çevresindeki kodun adlandırma, yorum yoğunluğu ve idiomuna uysun. Tutarsız stil bırakma.
8. **Geri dönüşü zor işlemleri onayla.** Deploy (özellikle mainnet), `git push`, dosya silme, dış servise veri gönderme → önce kullanıcıya açıkla ve onay al. Testnet deploy düşük risk ama yine de bildir.

---

## 2. Dosya / Dizin Düzeni (spec Bölüm 13)

```
oort-protocol/
├── contracts/
│   ├── oort-core/          # vault + guard + reputation (lib, vault, guard, reputation, types, events, test)
│   ├── oort-price-verifier/
│   └── oort-mock-oracle/
├── sdk/                    # @oort-protocol/sdk (TypeScript): index, client, types, claim
├── bots/                   # honest-bot.ts, liar-bot.ts
├── app/                    # Oort Terminal (Next.js)
├── Cargo.toml              # workspace root
└── Makefile
```
- Yeni dosya açmadan önce bu ağaca uyduğunu doğrula. Spec'te olmayan dizin açacaksan gerekçe yaz.

---

## 3. Rust / Soroban Kuralları (özet — detay: STELLAR-DEV-SKILL.md §3)

- `#![no_std]` ilk satır. `std::*` yok → `soroban_sdk::{String, Vec, Map}`.
- Release profili boyut için optimize (`opt-level="z"`, `lto`, `panic="abort"`, `strip`). 64KB WASM limitini aşma.
- **Storage eşlemesi sabit:** Intent/Escrow/commit_hash → **Temporary**; Reputation/stake → **Persistent**; admin/oracle/config → **Instance**. Persistent'ı her erişimde TTL uzat.
- `i128` para birimi; `overflow-checks = true`. Decimals'a dikkat: USDC 6, XLM 7, oracle fiyatı çoğu zaman 14 — karşılaştırmadan önce ölçeği eşitle.
- Auth: `owner.require_auth()` (lock), `agent.require_auth()` (commit/verify), admin pattern config için.
- State machine katı: `Locked → Committed → Executed | Refunded`, herhangi → `Expired`. Geçersiz geçiş = hata.
- `verify_and_execute` **atomik**: tüm katmanlar (hash → oracle → footprint → policy) geçerse yürüt; biri düşerse iade + (HardReject'te) slash. Kısmi state bırakma.
- Hata: invariant için `assert!`/`panic!` kabul; kullanıcıya dönen yol için `Result<_, OortError>`. Bir modülde tek stil kullan.
- SEP-41 transfer tek adım (`token::TokenClient::transfer`), approve yok.
- SHA-256: `env.crypto().sha256(&claim_data)`. TS↔Rust serileştirme byte-byte aynı olmalı (round-trip testi şart).

---

## 4. TypeScript Kuralları (detay: STELLAR-DEV-SKILL.md §7)

- Soroban tx daima: **build → simulate → assembleTransaction → sign → send → poll**. Simüle etmeden gönderme.
- Her tx'te doğru `networkPassphrase`. Her tx öncesi taze `account`/sequence.
- Claim serileştirme tek kaynaktan (`sdk/src/claim.ts`); Rust `types.rs` ile birebir. Önce round-trip hash testi.
- Cüzdan: `@creit.tech/stellar-wallets-kit` + Freighter. Network uyumsuzluğunu kontrol et.
- Sonuç dinleme: RPC `getEvents` polling (`Executed/Refunded/Expired`).
- `bigint` ile çalış (i128 ↔ JS). Ondalık dönüşümlerini açıkça yaz.

---

## 5. Test & Doğrulama Kapısı (DoD — Definition of Done)

Bir bileşen ancak şunlar sağlanınca "bitti" sayılır:
- [ ] `stellar contract build` / `cargo build --target wasm32-unknown-unknown --release` temiz geçer (warning'leri ele al).
- [ ] İlgili unit testler yazıldı ve `cargo test` yeşil. (Min. invariant listesi: STELLAR-DEV-SKILL.md §8.)
- [ ] Dürüst-akış + en az bir saldırı-akışı (yalancı fiyat) testi var.
- [ ] Public API spec ile uyumlu (fonksiyon adı/parametre/struct alanı).
- [ ] Değişen dosyalar + komutlar + ağ konfigürasyonu özetlendi.
- [ ] Yeni kalıcı karar oluştuysa hafızaya/`PROGRESS.md`'ye not düşüldü (varsa).

Test geçmezse: **gizleme.** Çıktıyı göster, kök nedeni söyle, düzelt.

---

## 6. Git / Komut Disiplini

- Platform: **Windows + PowerShell**. PowerShell sözdizimi (`$env:VAR`, `$null`, backtick). POSIX script gerekirse Bash aracını kullan.
- Kullanıcı istemeden `commit`/`push` yapma. Commit istenirse: `main` dışı bir branch kullan (veya kullanıcı onaylarsa main), anlamlı mesaj.
- Commit mesajı sonu:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Yıkıcı git komutlarından (`reset --hard`, `push --force`) önce daha güvenli alternatifi değerlendir ve onay al.
- Hook'ları atlama (`--no-verify`) — kullanıcı açıkça istemedikçe.

---

## 7. İletişim Stili

- Türkçe yanıt ver (kullanıcı Türkçe çalışıyor); kod/komut/teknik terim İngilizce kalır.
- Önce sonuç, sonra gerekçe. Gereksiz dolgu yok. Abartı yok ("mükemmel", "tamamen hazır" gibi ifadeleri kanıt olmadan kullanma).
- Belirsizlik gerçek bir karar noktasıysa (spec çelişkisi, iki geçerli mimari) sor; sıradan default'ları kendin seç ve belirt.
- Bir şey atlandıysa/eksikse açıkça yaz.

---

## 8. Hackathon Önceliklendirmesi

MVP kapsamı **spec Bölüm 21**'de net: VAR / YOK listesine sadık kal. V2 özelliklerini (Standing Escrow, DrawdownPolicy, CAP-71 Custom Account, ERC-8004, DIA/Band ekleme, ManipBot/YieldBot) MVP'de **yapma** — kullanıcı açıkça istemedikçe. Demo'nun çekirdeği:
1. HonestBot → doğrulandı → swap → yeşil.
2. LiarBot → oracle uyuşmadı → iade + slash → kırmızı.
3. İtibar tablosu + korunan fon metriği.

Zaman kısıtı varsa: **çalışan uçtan uca demo > eksiksiz özellik.** Önce dikey dilim (lock→commit→verify→execute→UI) çalışsın, sonra genişlet.

---

## 9. Yapma Listesi (Anti-patterns)

- ❌ Spec'teki sabitleri (tolerans, itibar, stake, TTL) habersiz değiştirmek.
- ❌ Soroban tx'i simüle etmeden göndermek.
- ❌ Persistent storage TTL'ini uzatmayı unutmak.
- ❌ TS ↔ Rust serileştirmeyi iki ayrı yerde farklı tanımlamak.
- ❌ Tek-kaynak oracle'a güvenmek (multi-source şart).
- ❌ Fonu ajan cüzdanında tutmak (Vault'ta olmalı).
- ❌ Secret/.env commit etmek.
- ❌ `mock_all_auths()`'a körü körüne güvenip auth invariantını test etmemek.
- ❌ Test çıktısını göstermeden "çalışıyor" demek.
- ❌ V2 özelliklerini MVP'ye sokmak.

---

> **Özet:** Önce oku (CLAUDE.md + STELLAR-DEV-SKILL.md + spec), doğrula, küçük adım at, derle+test et, kanıtla, sırrı koru, spec'e sadık kal. *Güvenme, Doğrula.*
