# STELLAR DEV SKILL — OORT PROTOCOL Sürümü

> **Amaç:** Bu dosya, OORT Protocol'ün (Stellar / Soroban üzerinde AI-ajan işlem doğrulama + escrow protokolü) geliştirilmesi sırasında Claude'un başvuracağı **tek ve nihai teknik referanstır**. Genel `stellar-dev` skill'inin (`~/.claude/skills/stellar-dev/`) damıtılmış, projeye özel ve güncel bir uzantısıdır.
>
> **Kullanım kuralı:** Her geliştirme prompt'unda önce bu dosya + `CLAUDE.md` okunacak. Bu dosyada yer almayan derin bir konu çıkarsa, genel `stellar-dev` skill alt dosyalarına (aşağıda haritası var) ve resmi dokümana başvurulacak. Volatil bilgiler (SDK sürümü, RPC endpoint, CAP/SEP statüsü, kontrat adresleri) **kullanılmadan önce resmi kaynaktan doğrulanacak.**

---

## 0. Tazelik Politikası (ZORUNLU)

Aşağıdaki bilgiler zamanla değişir. Bir prompt'ta bunlardan birine güveneceksen **önce WebFetch/WebSearch ile doğrula**, sonra kullan:

| Konu | Doğrulama kaynağı |
|---|---|
| `soroban-sdk` en güncel sürüm | https://crates.io/crates/soroban-sdk |
| `stellar-cli` en güncel sürüm | https://github.com/stellar/stellar-cli/releases |
| `@stellar/stellar-sdk` (JS) sürümü | https://www.npmjs.com/package/@stellar/stellar-sdk |
| Soroban RPC / Horizon endpoint'leri | https://developers.stellar.org/docs/data/apis |
| Reflector / Band / DIA kontrat adresleri | https://reflector.network , ilgili explorer (stellar.expert) |
| Protocol / CAP statüsü (CAP-71 vb.) | https://github.com/stellar/stellar-protocol |
| SEP-40 / SEP-41 arayüzleri | https://github.com/stellar/stellar-protocol/tree/master/ecosystem |

> Bu dosyadaki sürüm/adres örnekleri **yazıldığı an itibarıyla** geçerlidir; her zaman doğrula.

---

## 1. OORT için Karar Verilmiş Yığın (Opinionated Stack)

OORT MVP'sini şu yığınla kuruyoruz — sapma yapmadan önce gerekçe yaz:

| Katman | Seçim | Gerekçe |
|---|---|---|
| Akıllı kontrat dili | **Rust + `soroban-sdk`** | Soroban'ın native dili, tek production seçeneği |
| Build/deploy aracı | **`stellar` CLI** (eski adı `soroban` CLI) | Resmi, build + optimize + deploy + invoke |
| Workspace | **Cargo workspace** (çok-kontratlı) | oort-core, price-verifier, mock-oracle |
| İstemci SDK | **`@stellar/stellar-sdk`** (TypeScript) | RPC + tx build + Soroban invoke |
| Cüzdan | **`@creit.tech/stellar-wallets-kit`** + Freighter | Multi-wallet, demo dostu |
| Fiyat oracle | **Reflector (SEP-40)** + **SDEX TWAP** (MVP); Band/DIA (V2) | Multi-source, tek kaynak zafiyetini kapatır |
| Token standardı | **SEP-41** (SAC köprüsü ile XLM/USDC) | Ecosystem uyumu |
| Demo UI | **Next.js + TypeScript + Tailwind** | SSR + hızlı koyu tema |
| Ağ | **Testnet** (MVP demo); Mainnet (sonra) | Friendbot ile ücretsiz fon |
| RPC | **Stellar RPC** birincil, Horizon legacy/historik | RPC yeni projeler için tercih |

---

## 2. Genel Skill Dosya Haritası (derin konu çıkarsa buraya bak)

`~/.claude/skills/stellar-dev/` altında:

| İhtiyaç | Dosya |
|---|---|
| Soroban kontrat detayı (storage, auth, cross-contract, events, errors) | `contracts-soroban.md` |
| Frontend + cüzdan + tx build/sign | `frontend-stellar-sdk.md` |
| Test stratejisi (unit, mock auth, integration) | `testing.md` |
| Stellar Asset / SAC / trustline | `stellar-assets.md` |
| RPC vs Horizon, simulate, indexing | `api-rpc-horizon.md` |
| Güvenlik kontrol listesi | `security.md` |
| Sık hatalar + çözümleri | `common-pitfalls.md` |
| Upgrade/factory/governance/DeFi mimarileri | `advanced-patterns.md` |
| SEP/CAP standart haritası | `standards-reference.md` |
| ZK / commitment / Poseidon (V2 ilgisi) | `zk-proofs.md` |
| Ekosistem projeleri (Phoenix, Blend, Aquarius...) | `ecosystem.md` |
| Referans linkler | `resources.md` |

---

## 3. Soroban Temel Kuralları (OORT bağlamında)

### 3.1 Kontratın iskeleti
```rust
#![no_std]                       // ZORUNLU — std yok. İlk satır.
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractevent,
    Address, BytesN, Bytes, Env, String, Symbol, Vec, Map, token,
};
```

**Kritik kısıtlar (OORT'u etkileyen):**
- `#![no_std]` — `std::*` yok. `soroban_sdk::{String, Vec, Map}` kullan, `HashMap`/`println!` yok.
- **64KB WASM limiti** — `oort-core` büyürse modülleri ayır (vault / guard / reputation / verifier ayrı kontratlar). MVP'de tek `oort-core` + `oort-price-verifier` + `oort-mock-oracle` üçlüsü hedefle.
- Heap sınırlı, recursion yok → **reentrancy host düzeyinde imkansız** (OORT'un avantajı; `ReentrancyGuard` gerekmez).
- `Symbol` ≤ 32 karakter; 9 karakter altı için `symbol_short!()` (daha ucuz).
- Tam sayılar: `i128` para tutarları için standart. Stellar `i64`/`i128`/`U256` destekler. Overflow için release profilinde `overflow-checks = true`.

### 3.2 Cargo.toml (release profili — boyut için kritik)
```toml
[dependencies]
soroban-sdk = "25.0.1"   # crates.io'dan en güncelini DOĞRULA

[dev-dependencies]
soroban-sdk = { version = "25.0.1", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

### 3.3 Storage tipleri — OORT eşlemesi (EZBERLE)
OORT'un mimarisi üç katmanlı storage'a birebir oturur:

| Storage | Maliyet / Yaşam | OORT kullanımı |
|---|---|---|
| **Temporary** | En ucuz, TTL dolunca **kalıcı silinir**, kurtarılamaz | **Intent / Escrow / commit_hash** — ephemeral, self-cleaning. `intent_id → Escrow` |
| **Persistent** | Pahalı, archive olsa da ESS'den kurtarılır | **Reputation, stake bakiyeleri** — kalıcı olmalı |
| **Instance** | Kontrat instance'ına bağlı, ≤64KB | **Admin, oracle adresleri, XLM/USDC SAC, global config** |

```rust
// Intent — Temporary, TTL = expiry'ye kadar
let ttl = expiry_ledger - env.ledger().sequence();
env.storage().temporary().set(&intent_id, &escrow);
env.storage().temporary().extend_ttl(&intent_id, ttl, ttl);

// Reputation — Persistent
env.storage().persistent().set(&agent, &reputation);
env.storage().persistent().extend_ttl(&agent, MIN_TTL, EXTEND_TO);

// Config — Instance
env.storage().instance().set(&CONFIG_KEY, &config);
env.storage().instance().extend_ttl(100, 518400);
```

> **PITFALL:** TTL uzatılmazsa Persistent veri (itibar) archive olur → çağrı patlar. İtibarı **okuyan/yazan her fonksiyonda** TTL uzat. Temporary için TTL = intent ömrü; bilerek expire olmasını istiyoruz.

### 3.4 Authorization
```rust
// İlgili tarafın imzasını zorunlu kıl
owner.require_auth();                 // lock_vault → owner
escrow.agent.require_auth();          // commit / verify → agent

// Admin pattern
fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}
```
- `require_auth()` → host düzeyinde imza kontrolü. Testte `env.mock_all_auths()` veya hassas test için `env.mock_auths(&[MockAuth{...}])`.
- OORT akışında **fonlar asla ajanın cüzdanında değil** — Vault kontratında. Ajan sadece `commit` + `verify_and_execute` çağırabilir, doğrudan transfer edemez. Anahtar çalınsa bile doğrulama olmadan fon çıkmaz (Tehdit 2 koruması).

### 3.5 SEP-41 token transfer (approve yok)
```rust
use soroban_sdk::token;
// Tek adım — EVM'deki approve+transferFrom friction'ı YOK
token::TokenClient::new(&env, &token_addr)
    .transfer(&owner, &env.current_contract_address(), &amount);  // kilitle
token::TokenClient::new(&env, &escrow.token)
    .transfer(&env.current_contract_address(), &escrow.owner, &escrow.amount);  // iade
```
- `balance()` ile bakiye doğrulama (BalanceVerifier): `token::TokenClient::new(&env,&t).balance(&addr)`.
- XLM ve USDC, SAC (Stellar Asset Contract) üzerinden SEP-41 arayüzüyle çağrılır. Testnet'te XLM SAC adresini `stellar contract id asset --asset native` ile al.

### 3.6 Kriptografi — commit-reveal için
```rust
// Claim hash (Katman 1)
let computed: BytesN<32> = env.crypto().sha256(&claim_data).into();
let matched = computed == escrow.commit_hash;
```
- `env.crypto().sha256(&bytes)` → `Hash<32>`; `.into()` ile `BytesN<32>`'e çevir.
- **Borsh/serileştirme uyumu kritik:** SDK tarafında (TS) claim'i serialize edip SHA-256 alıyorsun; kontratta aynı byte dizisinin hash'i hesaplanmalı. **Aynı serileştirme şeması** her iki tarafta = byte-byte aynı. Aksi halde Katman 1 hep RED verir. (Bkz. Bölüm 7.)

### 3.7 Cross-contract call (oracle / DEX)
```rust
// Oracle import (SEP-40 arayüzü) — mock oracle ile aynı imza
let oracle = oracle_mod::Client::new(&env, &oracle_addr);
let price_data = oracle.lastprice(&asset);   // Option<PriceData>

// Phoenix/SDEX swap hedefi: kontrat import + client.swap(...)
```

### 3.8 Events
```rust
#[contractevent(topics = ["oort", "verified"])]
pub struct VerifiedEvent { pub intent_id: BytesN<16>, pub agent: Address, pub amount: i128 }
// ...
VerifiedEvent { intent_id, agent, amount }.publish(&env);
```
- UI ve botlar sonucu **event polling** ile dinler (RPC `getEvents`). `Locked / Committed / Executed / Refunded / Expired` geçişlerinde event yay.

### 3.9 Errors
```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OortError {
    NotInitialized = 1, AgentBanned = 2, InvalidExpiry = 3, InvalidState = 4,
    Expired = 5, HashMismatch = 6, OracleRejected = 7, PolicyDenied = 8,
    InsufficientStake = 9, Unauthorized = 10, NotExpired = 11, FootprintRejected = 12,
}
```
- Hatalı durumda `panic!` yerine `Result<_, OortError>` tercih et (UI'da okunabilir kod). Ancak invariant ihlallerinde `assert!` kabul edilebilir (proje dokümanındaki örnekler `assert!` kullanıyor — tutarlı kal veya hepsini Result'a çevir, karışık bırakma).

---

## 4. SEP-40 Oracle Arayüzü (Reflector uyumlu) — OORT Çekirdeği

PriceVerifier'ın doğru çalışması için oracle arayüzü tam olmalı. SEP-40 / Reflector arayüzünün özü:

```rust
#[contracttype]
#[derive(Clone)]
pub enum Asset {
    Stellar(Address),   // SAC adresi
    Other(Symbol),      // "XLM", "USDC" gibi sembol
}

#[contracttype]
#[derive(Clone)]
pub struct PriceData {
    pub price: i128,    // fiyat (decimals() ondalıkla)
    pub timestamp: u64, // güncelleme zamanı (heartbeat kontrolü)
}

// Oracle kontratının sunduğu fonksiyonlar (subset):
pub trait PriceOracle {
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
    fn price(env: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
    fn decimals(env: Env) -> u32;        // genelde 14
    fn resolution(env: Env) -> u32;      // saniye cinsinden interval
}
```

**`oort-mock-oracle`** bu arayüzü birebir implemente etmeli; testlerde fiyatı `set_price()` ile elle ayarlayıp halüsinasyon/manipülasyon senaryolarını kurarsın. Mainnet'te gerçek Reflector kontratı aynı arayüzü sunar → kod değişmez, sadece adres değişir.

> **Reflector mainnet adresleri (DOĞRULA):** SEP/DEX feed `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`, CEX/DEX feed `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`. Band: `CCQXWMZVM3KRTXTUPTN53YHL272QGKF32L7XEDNZ2S6OSUFK3NFBGG5M`. DIA testnet: `CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4`.

### Multi-source median + sapma (basis points)
```rust
const SOFT_TOLERANCE_BPS: i128 = 150;  // %1.5 — ağ gecikmesi marjı
const HARD_TOLERANCE_BPS: i128 = 500;  // %5.0 — kötü niyet eşiği

// 1) Her oracle'dan lastprice oku, heartbeat (timestamp tazeliği) kontrol et
// 2) En az 2 geçerli kaynak yoksa → HardReject
// 3) Median hesapla (outlier doğal olarak elenir)
// 4) deviation_bps = |claimed - median| * 10000 / median
// 5) <=150 Passed | <=500 SoftReject (slash yok) | >500 HardReject (%10 slash)
```
> Manipüle tek kaynak (örn. zehirlenmiş Reflector) median sayesinde outlier olur → YieldBlox tarzı saldırı bu katmanda düşer. **En az 2/3 kaynak uyuşmalı** invariantını test et.

---

## 5. Footprint Doğrulama (Stellar-native, EVM'de yok)

- `simulateTransaction` (RPC) bir Soroban tx'in dokunacağı **ledger key'leri** (footprint: `readOnly` + `readWrite`) döner.
- OORT akışı: SDK tarafında ajan `simulateTransaction` çağırır → footprint alır → footprint'in hash'ini `AgentClaim`'e koyar → kontrat (`FootprintVerifier`) whitelist dışı kontrat adresi var mı diye denetler.
- MVP'de footprint **hash eşleşmesi + whitelist üyeliği** seviyesinde; kontrat içinden tam footprint parse etmek yerine SDK footprint'i sağlar, kontrat whitelist'e karşı doğrular.
- **Bonus MEV koruması:** gerçek yürütmede state değişmişse footprint stale olur → Soroban HOST tx'i otomatik düşürür. Commit-reveal + footprint = çift katman.

TS tarafı:
```typescript
const sim = await rpc.simulateTransaction(tx);
if (StellarSdk.rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build();
// footprint: sim.transactionData / restorePreamble içinden okunur
```

---

## 6. Build / Deploy / Invoke (CLI) — OORT akışı

```bash
# Kurulum doğrulama
rustc --version && cargo --version
rustup target add wasm32-unknown-unknown
stellar --version            # yoksa: cargo install stellar-cli (en güncel sürümü doğrula)

# Identity + fon (Testnet)
stellar keys generate --global oort-deployer --network testnet --fund
stellar keys address oort-deployer

# Build (workspace kökünden tüm kontratlar)
stellar contract build
# çıktı: target/wasm32-unknown-unknown/release/<crate>.wasm

# Optimize
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/oort_core.wasm

# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/oort_core.optimized.wasm \
  --source-account oort-deployer --network testnet
# → CONTRACT_ID (C...)

# XLM/USDC SAC adresi al
stellar contract id asset --asset native --network testnet

# Initialize / constructor
stellar contract invoke --id <CONTRACT_ID> --source-account oort-deployer --network testnet \
  -- initialize --admin <ADDR> --xlm_token <XLM_SAC> --usdc_token <USDC_SAC> \
     --oracle_addresses '[ "C...","C..." ]'
```

> **Protocol 22+** ise `__constructor` ile atomik init tercih et (ayrı `initialize` tx'i yerine; front-run riski azalır). Eski ortamda guarded `initialize` (re-init engelli).

---

## 7. TypeScript SDK Tarafı (Oort SDK + Botlar + UI)

### 7.1 Kritik: Claim serileştirme tutarlılığı
Katman 1 hash kontrolü için **TS'de serialize edilen byte dizisi = kontratın hash aldığı byte dizisi** olmalı.
- Strateji A (önerilen MVP): Claim'in alanlarını **deterministik bir XDR/ScVal** olarak `nativeToScVal` ile kontrata gönder; hash'i kontrat içinde `claim_data: Bytes`'tan hesapla. SDK aynı `Bytes`'ı SHA-256'lar.
- Strateji B: Sabit-uzunluk `BytesN<256>` buffer + manuel layout (proje dokümanındaki örnek). Layout'u tek bir yerde (TS `claim.ts` + Rust `types.rs`) **birebir** tanımla ve test et.
- **Altın kural:** Önce bir "round-trip" testi yaz: TS serialize → hash → kontrata commit → verify; eşleşmezse layout'u düzelt. Bunu Faz 4'te ilk iş yap.

### 7.2 Temel SDK çağrıları
```typescript
import * as StellarSdk from "@stellar/stellar-sdk";
const rpc = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");
const PASSPHRASE = StellarSdk.Networks.TESTNET; // "Test SDF Network ; September 2015"

// Soroban tx: build → simulate → assemble → sign → send → poll
const tx = new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: PASSPHRASE })
  .addOperation(contract.call("commit", ...args)).setTimeout(180).build();
const sim = await rpc.simulateTransaction(tx);
const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build();
prepared.sign(keypair);
const sent = await rpc.sendTransaction(prepared);
// getTransaction ile SUCCESS olana kadar poll
```

### 7.3 Cüzdan (UI)
```typescript
import { StellarWalletsKit, WalletNetwork, allowAllModules } from "@creit.tech/stellar-wallets-kit";
const kit = new StellarWalletsKit({ network: WalletNetwork.TESTNET, modules: allowAllModules() });
```

### 7.4 SDK sık hatalar (common-pitfalls'tan damıtık)
- `tx_bad_auth` → yanlış network passphrase. Her tx'te doğru passphrase.
- `tx_bad_seq` → bayat account; her tx öncesi `loadAccount`/fresh sequence.
- Soroban tx **simulate edilmeden** gönderilmez → `assembleTransaction` ile kaynakları ekle.
- `op_no_trust` → SEP-41 olmayan asset için trustline gerekir (USDC classic ise). SAC üzerinden Soroban'da genelde sorun olmaz ama testnet USDC için kontrol et.
- Freighter network ≠ app network → tx patlar; `getNetwork()` ile doğrula.

---

## 8. Test Stratejisi (OORT'a özel)

### Unit (Rust, native, hızlı)
```rust
#![cfg(test)]
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Env};

#[test]
fn honest_flow_executes() {
    let env = Env::default();
    env.mock_all_auths();
    // register_contract / register / Client::new
    // lock_vault → commit → verify_and_execute → status == Executed, itibar +
}

#[test]
fn liar_price_hard_rejected_and_slashed() {
    // mock oracle median $0.121, claim $0.50 → HardReject, refund, slash, itibar -
}
```
Test edilecek invariantlar (en az):
1. Dürüst akış → Executed, fon kullanıcıya/protokole, itibar +.
2. Yalancı fiyat (>%5) → HardReject + refund + slash + itibar −.
3. Soft reject (%1.5–%5) → reject ama **slash yok**, itibar hafif −.
4. Hash uyuşmazlığı → anında RED.
5. Expiry geçince `refund()` permissionless çalışır, fon iade.
6. Banlı ajan `lock_vault` alamaz.
7. Yetersiz stake ile `register_agent` reddedilir.
8. Whitelist dışı kontrat → footprint/whitelist RED.
9. Spending limit aşımı → PolicyDenied.
10. Yeniden init / yanlış state geçişleri reddedilir.
11. `env.ledger().set(...)` ile zaman/sequence ilerletip TTL ve expiry senaryoları.

> `env.ledger().set_sequence_number(...)` ve `env.ledger().set_timestamp(...)` ile zaman akışını simüle et. Auth testinde gerçek senaryo için `mock_auths` (kör `mock_all_auths` yerine kritik testte).

### Integration (Testnet)
- Deploy → SDK ile gerçek `lock → commit → verify` → event'leri RPC'den oku → UI'da göster.

---

## 9. Güvenlik Kontrol Listesi (OORT)

- [ ] Tüm hassas fonksiyonlarda doğru `require_auth()` (owner vs agent vs admin).
- [ ] Re-init koruması (init bir kez) / `__constructor`.
- [ ] State machine geçişleri katı: `Locked→Committed→Executed/Refunded`, `*→Expired`. Geçersiz geçiş = RED.
- [ ] `verify_and_execute` **atomik**: ya hepsi geçer ve yürütür, ya iade. Kısmi durum bırakma.
- [ ] Oracle: en az 2 geçerli kaynak; heartbeat tazeliği; median ile outlier eleme.
- [ ] i128 overflow: `overflow-checks = true`; deviation hesabında taşma yok (önce çarp sonra böl sırasına dikkat, median>0 garanti).
- [ ] Slash yalnızca HardReject'te; SoftReject'te slash yok (dürüst ajanı koruma).
- [ ] `refund()` permissionless ama yalnız `sequence >= expiry_ledger` iken.
- [ ] Reentrancy: Soroban'da host engeli var; yine de transfer' leri state güncellemesinden **sonra** yapma riski yok ama state'i transfer'den önce `Executed/Refunded` yap (checks-effects-interactions ruhu).
- [ ] TTL: Persistent (itibar) her erişimde uzatılır.
- [ ] Whitelist & spending limit instance/persistent'ta doğru saklanır, admin auth ile güncellenir.
- [ ] Demo anahtarları repoya girmez (`.env`, `.gitignore`). Mainnet anahtarı asla commit edilmez.

> Derin denetim için `~/.claude/skills/stellar-dev/security.md`.

---

## 10. Resmi Kaynaklar ve GitHub Repoları

**Dokümantasyon**
- Stellar Developers: https://developers.stellar.org/docs
- Soroban / smart contracts: https://developers.stellar.org/docs/build/smart-contracts
- Data (RPC/Horizon/Hubble): https://developers.stellar.org/docs/data
- CAP/SEP protokol: https://github.com/stellar/stellar-protocol

**SDK / Araçlar (GitHub)**
- `soroban-sdk` (Rust): https://github.com/stellar/rs-soroban-sdk
- Stellar CLI: https://github.com/stellar/stellar-cli
- JS SDK: https://github.com/stellar/js-stellar-sdk
- Soroban örnekleri: https://github.com/stellar/soroban-examples
- Scaffold Stellar: https://github.com/AhaLabs/scaffold-stellar
- OpenZeppelin Stellar Contracts: https://github.com/OpenZeppelin/stellar-contracts
- Stellar Wallets Kit: https://github.com/Creit-Tech/Stellar-Wallets-Kit
- Freighter API: https://github.com/stellar/freighter

**Oracle**
- Reflector: https://reflector.network , https://github.com/reflector-network
- Band Protocol (Stellar): https://docs.bandchain.org
- SEP-40 (price oracle arayüzü): stellar-protocol repo `ecosystem/sep-0040.md`
- SEP-41 (token arayüzü): stellar-protocol repo `ecosystem/sep-0041.md`

**Ekosistem (entegrasyon hedefleri)**
- Phoenix DEX: https://www.phoenix-hub.io , GitHub: https://github.com/Phoenix-Protocol-Group
- Blend (lending): https://www.blend.capital , https://github.com/blend-capital
- Aquarius (AMM): https://aqua.network

**Explorer / Faucet**
- stellar.expert (testnet): https://stellar.expert/explorer/testnet
- Friendbot: https://friendbot.stellar.org

**Akademik / İlham**
- Alqithami 2026, "Autonomous Agents on Blockchains" — arXiv:2601.04583
- TALOS Protocol (Monad) — commit-verify-execute ilhamı

---

## 11. OORT Bileşen → Skill Eşleme Tablosu (hızlı yönlendirme)

| OORT bileşeni | Bu dosyada | Genel skill |
|---|---|---|
| Oort Vault (escrow) | §3.3, §3.5 | contracts-soroban.md |
| commit / verify_and_execute | §3.4, §3.6, §7.1 | contracts-soroban.md |
| PriceVerifier (multi-source) | §4 | advanced-patterns.md, ecosystem.md |
| FootprintVerifier | §5 | api-rpc-horizon.md |
| Reputation / slash | §3.3, §8, §9 | contracts-soroban.md |
| Mock oracle | §4 | testing.md |
| Oort SDK (TS) | §7 | frontend-stellar-sdk.md |
| Demo botlar | §7.2 | frontend-stellar-sdk.md |
| Oort Terminal UI | §7.3 | frontend-stellar-sdk.md |
| Deploy/CLI | §6 | contracts-soroban.md |
| Güvenlik | §9 | security.md |

---

> **OORT mottosu kodda da geçerli:** *Güvenme, Doğrula.* Her sürüm/adres/arayüzü kullanmadan önce resmi kaynaktan doğrula; her invariantı testle kanıtla.
