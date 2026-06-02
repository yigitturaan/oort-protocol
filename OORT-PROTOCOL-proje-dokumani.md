# OORT PROTOCOL — Otonom Ticaret Ajanları İçin İşlem Öncesi İddia Doğrulama ve Escrow Koruma Protokolü (Stellar)

> **Tam Proje Dökümanı | HackStellar Istanbul Edition — Rise In <> Stellar Build On Stellar Hackathon IBW 2026**
> **Son Güncelleme:** 1 Haziran 2026 (v1)
> **Geliştirici:** Solo (AI-destekli vibe coding)
> **Ağ:** Stellar Mainnet / Testnet — Soroban Smart Contracts
> **Dil:** Rust (soroban-sdk)

---

## İçindekiler

1. [Vizyon ve Problem](#1-vizyon-ve-problem)
2. [Oort Protocol Nedir / Ne Değildir](#2-oort-protocol-nedir--ne-değildir)
3. [Oort'un Çözdüğü 5 Ajan Tehdidi](#3-oortun-çözdüğü-5-ajan-tehdidi)
4. [İlham Kaynakları ve Referanslar](#4-ilham-kaynakları-ve-referanslar)
5. [Stellar'a Özel Avantajlar — Neden Bu Zincir?](#5-stellara-özel-avantajlar--neden-bu-zincir)
6. [Mevcut Ekosistem ve Rekabet Analizi](#6-mevcut-ekosistem-ve-rekabet-analizi)
7. [Sistem Mimarisi — Büyük Resim](#7-sistem-mimarisi--büyük-resim)
8. [Temel Mekanizma: Commit-Verify-Execute](#8-temel-mekanizma-commit-verify-execute)
9. [Oort Guard — Modüler Doğrulayıcılar ve Politika Motorları](#9-oort-guard--modüler-doğrulayıcılar-ve-politika-motorları)
10. [Oort Vault — Escrow ve Fon Koruma Sistemi](#10-oort-vault--escrow-ve-fon-koruma-sistemi)
11. [Footprint Doğrulama Katmanı (Stellar-Native)](#11-footprint-doğrulama-katmanı-stellar-native)
12. [İtibar Sistemi](#12-itibar-sistemi)
13. [Akıllı Kontrat Mimarisi (Rust / Soroban)](#13-akıllı-kontrat-mimarisi-rust--soroban)
14. [Oort SDK — Entegrasyon Katmanı](#14-oort-sdk--entegrasyon-katmanı)
15. [Kullanıcı Akışları — Adım Adım Senaryolar](#15-kullanıcı-akışları--adım-adım-senaryolar)
16. [Demo UI — Oort Terminal](#16-demo-ui--oort-terminal)
17. [Desteklenen İşlem Türleri](#17-desteklenen-işlem-türleri)
18. [Teknik Yığın (Tech Stack)](#18-teknik-yığın-tech-stack)
19. [Gelir Modeli](#19-gelir-modeli)
20. [Rakip Analizi (Stellar Ekosistemi)](#20-rakip-analizi-stellar-ekosistemi)
21. [Hackathon MVP Kapsamı ve Takvim](#21-hackathon-mvp-kapsamı-ve-takvim)
22. [V2 Roadmap](#22-v2-roadmap)
23. [Bilinen Sınırlamalar ve Dürüst Değerlendirme](#23-bilinen-sınırlamalar-ve-dürüst-değerlendirme)
24. [Stellar Ağ Konfigürasyonu ve Deploy Rehberi](#24-stellar-ağ-konfigürasyonu-ve-deploy-rehberi)

---

## 1. Vizyon ve Problem

### Problem

Stellar'da yapay zeka ajanları hızla büyüyen bir ekonomi oluşturuyor — Stellar Agentic Bazaar (SAB), x402 ödeme protokolü, Machine Payments Protocol (MPP), Stellar AI Agent Kit ve Eliza Labs + Stanford araştırma ortaklığı bu ekosistemin temellerini atıyor. DoraHacks'teki Stellar Agents hackathon'unda 600 hacker 260+ proje gönderdi — agentic ekonomi Stellar'ın en hızlı büyüyen kategorisi.

Ancak mevcut tüm ajan altyapıları tek bir kritik varsayıma dayanıyor:

> **"Ajan dürüsttür."**

Bu varsayım tehlikeli. Bir yapay zeka ajanı şunları yapabilir:

| Tehdit | Açıklama | Sonuç |
|---|---|---|
| **Halüsinasyon** | LLM yanlış veri üretir, "XLM $0.50" der ama aslında $0.12 | Kullanıcı yanlış zamanda alım yapar, zarar eder |
| **Manipülasyon** | Ajan kötü niyetli kodlanmıştır, kasıtlı kötü fiyat verir | Kullanıcının parası çalınır |
| **Tutarsızlık** | Ajan farklı zamanlarda farklı mantık kullanır, öngörülemez | Strateji güvenilmez, sonuçlar rastgele |
| **Dolandırıcılık** | Ajan "en iyi rotayı buldum" der ama kendi havuzuna yönlendirir | Gizli komisyon kesintisi |

**Bu sorunun gerçekliği kanıtlanmış:** Şubat 2026'da YieldBlox DAO, Blend protokolü üzerinde Reflector oracle manipülasyonu ile **$10.2M** kaybetti. Saldırgan tek bir trade ile VWAP oracle'ını zehirleyerek USTRY fiyatını 100x şişirdi. Eğer otonom bir AI ajan bu zehirlenmiş veriyi ingeste etmiş olsaydı, doğrudan kullanıcı fonlarını manipüle edilmiş bir havuza yatırırdı.

**Soroban'ın `simulateTransaction` + footprint mekanizması bu sorunu çözmüyor.** simulateTransaction yapısal doğrulama sağlar (transaction çalışır mı, hangi ledger key'lere dokunur), anlamsal doğrulama sağlamaz (ajanın fiyat iddiası doğru mu, harcama limiti aşıldı mı, oracle manipüle edilmiş mi). (Detaylı analiz: Bölüm 11)

### Vizyon

**Oort Protocol, bir yapay zeka ajanının Stellar'da herhangi bir işlem yapmadan önce veri iddialarını kriptografik olarak kanıtlamasını zorunlu kılan ve iddialar doğrulanmazsa işlemi hiç gerçekleştirmeyen doğrulama kapısıdır.**

Oort Protocol üç temel bileşenden oluşur:

| Bileşen | Rol |
|---|---|
| **Oort Guard** | Politika motoru — ajanın footprint simülasyonunu, slippage limitlerini ve oracle iddialarını denetleyen on-chain kurallar bütünü |
| **Oort Vault** | Escrow katmanı — CAP-71 ve Soroban'ın Temporary Storage gücünü kullanarak fonları işlem öncesi güvene alan akıllı kontrat |
| **Oort SDK** | Entegrasyon kütüphanesi — Eliza, LangChain veya herhangi bir ajan framework'üne 3 satırda entegre |

### 30 Saniyelik Asansör Sunumu

> "Stellar'da AI ajanları giderek daha fazla otonom işlem yapıyor — 260+ agentic proje, x402, MPP, SAB büyüyor. Ama hiçbirinde 'ajan yanlış iddia ederse ne olacak?' mekanizması yok. Soroban'ın simulateTransaction'ı yapısal doğrulama sağlar ama anlamsal doğrulama — fiyat kontrolü, harcama limiti, oracle manipülasyonu tespiti — sağlamaz. YieldBlox $10.2M kaybetti, simulateTransaction bunu engelleyemezdi. Oort Protocol engellerdi. Ajan işlem yapmadan önce iddialarını commit ediyor, Oort Guard bunu multi-source oracle ve footprint analizi ile karşılaştırıyor — doğrulanamazsa fonlar Oort Vault'ta güvende, işlem hiç gerçekleşmiyor. Stellar'ın agentic ekonomisi için eksik güvenlik primitifi."

---

## 2. Oort Protocol Nedir / Ne Değildir

### Oort Protocol NE

| Özellik | Açıklama |
|---|---|
| **Doğrulama primitifi** | Ajanın mantığını on-chain oracle verisiyle karşılaştırır |
| **Fon koruma kapısı** | Doğrulama geçmezse fonlar harcanmaz, iade edilir |
| **Footprint analiz katmanı** | Soroban-native: transaction'ın dokunacağı ledger key'lerini önceden denetler |
| **İtibar sistemi** | Her ajanın doğrulanabilir geçmişi on-chain'de tutulur |
| **Entegrasyon katmanı** | Herhangi bir ajan çerçevesine Oort SDK ile 3 satırda eklenir |
| **İşlem agnostik** | Swap, stake, lending, yield — her Soroban işlemine uygulanabilir |
| **Stellar-native** | Temporary Storage, CAP-71 __check_auth, footprint analizi kullanır |

### Oort Protocol NE DEĞİL

| Değil | Neden Değil |
|---|---|
| DEX / Swap platformu | Kendi rotası yok, Phoenix/SDEX zaten var |
| Ajan çerçevesi (framework) | Ajan oluşturmuyor, Eliza/LangChain zaten var |
| Oracle | Kendi veri üretmiyor, Reflector/DIA/Band'ı referans kontrol ediyor |
| B2C ticaret uygulaması | Son kullanıcı arayüzü değil, altyapı katmanı |
| Policy Signer alternatifi | Stellar AI Agent Kit'in Policy Signer'ını tamamlar, değiştirmez |

### Analoji

```
Oort Protocol = AI ajanları için "pre-flight checklist"

Bir pilot uçağı kaldırmadan önce kontrol listesini geçer.
Oort, bir ajanın işlem yapmadan önce veri iddialarını doğrulatır.

Pilot listesi geçemezse → uçak kalkmaz, yolcular güvende.
Ajan doğrulamayı geçemezse → işlem gerçekleşmez, fonlar güvende.

Oort uçağı uçurmaz, rotayı belirlemez.
Sadece "bu ajanın iddiaları doğru mu?" sorusunu cevaplar.
```

### Neden "Oort"?

Oort Bulutu, güneş sistemimizin en dış savunma hattıdır — uzaydan gelen potansiyel tehditleri Dünya'ya ulaşmadan önce karşılayan kozmik kalkan. Oort Protocol da Stellar ekosisteminde aynı rolü üstlenir: otonom ajanların potansiyel olarak zararlı işlemlerini kullanıcı fonlarına ulaşmadan ÖNCE yakalar.

---

## 3. Oort'un Çözdüğü 5 Ajan Tehdidi

### Tehdit 1: Veri İddiası Tutarsızlığı (Halüsinasyon / Yalan)

```
Problem:  Ajan "XLM fiyatı $0.50" diyor ama gerçekte $0.12.
          LLM halüsinasyonu veya kasıtlı manipülasyon olabilir.

Oort Çözümü:
  → PriceVerifier: Ajanın fiyat iddiasını multi-source oracle ile karşılaştırır
    (Reflector VWAP + DIA + Band — tek kaynak bağımlılığı yok)
  → BalanceVerifier: Bakiye iddialarını SEP-41 balance() ile doğrular
  → SHA-256 commitment: Ajan iddialarını önceden taahhüt eder, sonra değiştiremez

Sonuç: İddia doğrulanmazsa → işlem gerçekleşmez, fonlar iade edilir.
```

### Tehdit 2: Özel Anahtar Ele Geçirme

```
Problem:  Ajanın secret key'i çalınırsa, saldırgan fonları boşaltabilir.
          Klasik ajan çerçevelerinde ajan cüzdanında doğrudan fon tutulur.

Oort Çözümü:
  → Fonlar asla ajanın cüzdanında değil — Oort Vault kontratında kilitli
  → Ajan sadece commit + verify yapabilir, doğrudan fon transferi yapamaz
  → İşlem ancak doğrulama geçerse gerçekleşir
  → Anahtar çalınsa bile saldırgan geçerli iddia + doğrulama olmadan fon çekemez

Sonuç: Ajanın anahtarı ele geçirilse bile Oort Vault'taki fonlar korunur.
```

### Tehdit 3: Kötü Strateji / Kontrolsüz Harcama

```
Problem:  Ajan teknik olarak dürüst olabilir ama stratejisi zararlı:
          - Tek seferde tüm bakiyeyi riskli bir token'a yatırır
          - Bir günde 50 işlem yapar, fee'lerle bakiyeyi eritir
          - Kullanıcının risk toleransını aşan işlemler yapar

Oort Guard Çözümü — Politika Motorları:
  → SpendingLimitPolicy: Günlük/haftalık harcama limiti
    Örnek: "Günde max 500 USDC" → aşarsa işlem reddedilir
  → ContractWhitelistPolicy: Sadece onaylı protokollerle etkileşim

Sonuç: Ajan doğru veri iddia etse bile politika kurallarını aşamaz.
```

### Tehdit 4: Slippage Saldırısı / Sandwich Attack

```
Problem:  Ajan "minimum 100 XLM alacağım" diyor ama işlem sırasında
          fiyat kayar ve kullanıcı 85 XLM alır. Veya ajan kasıtlı
          olarak düşük min output belirleyerek MEV saldırısına kapı açar.

Oort Çözümü:
  → SlippageGuardPolicy: Ajanın belirlediği expectedOutputMin değerini
    mevcut piyasa fiyatıyla karşılaştırır
  → Tolerans aşılırsa (örn. %2'den fazla slippage beklentisi) → RED
  → Commit-reveal yapısı: intent hash'i gizli, MEV botları göremez
  → Footprint stale olursa: Soroban HOST düzeyinde tx otomatik düşer

Sonuç: Stellar'ın footprint mekanizması + Oort Guard = çift katmanlı MEV koruması.
```

### Tehdit 5: Yetkisiz Kontrat Etkileşimi

```
Problem:  Ajan "Phoenix'te swap yapacağım" diyor ama aslında bilinmeyen
          veya kötü niyetli bir kontrata fon gönderiyor. Sahte DEX,
          exploit edilmiş kontrat, veya honeypot token.

Oort Çözümü:
  → ContractWhitelistPolicy: İşlemin hedef kontratı whitelist'te mi?
    Örnek: Sadece Phoenix DEX, Blend, Aquarius izinli
  → FootprintVerifier: simulateTransaction footprint'inde yetkisiz
    kontrat adresi varsa → intent otomatik reddedilir
  → Whitelist kullanıcı/operatör tarafından yapılandırılabilir

Sonuç: Ajan sadece onaylanmış protokollerle etkileşime girebilir.
```

### 5 Tehdit Özet Tablosu

| # | Tehdit | Oort Mekanizması | Koruma Seviyesi |
|---|---|---|---|
| 1 | Veri tutarsızlığı (halüsinasyon/yalan) | PriceVerifier + Multi-source oracle | İşlem öncesi, tam koruma |
| 2 | Özel anahtar ele geçirme | Oort Vault — fonlar ajanda değil | Mimari seviyede koruma |
| 3 | Kötü strateji / aşırı harcama | SpendingLimit + Whitelist politikaları | Politika bazlı koruma |
| 4 | Slippage / MEV saldırısı | SlippageGuard + Footprint + Commit-reveal | Çift katmanlı koruma |
| 5 | Yetkisiz kontrat etkileşimi | ContractWhitelist + FootprintVerifier | Whitelist + Footprint |

---

## 4. İlham Kaynakları ve Referanslar

### 4.1 TALOS Protocol (Monad)

**İlham:** Talos Protocol — Monad Blitz Hackathon'da geliştirilen Commit-Verify-Execute doğrulama protokolü. Aynı ekip tarafından geliştirildi.

**Ne aldık:** Commit-verify-execute temel mekanizması, modüler verifier/policy mimarisi, ELO-bazlı itibar sistemi, escrow fon koruması.
**Ne değiştirdik:** Solidity → Rust/Soroban, Chainlink → Multi-source oracle (Reflector + DIA + Band), ERC-20 → SEP-41, keccak256 → SHA-256, approve+transferFrom → require_auth, ReentrancyGuard → gereksiz (Soroban'da reentrancy yok). Footprint doğrulama katmanı eklendi (Stellar-native, EVM'de mümkün değil).

### 4.2 YieldBlox / Blend Exploit (Şubat 2026)

**İlham:** $10.2M oracle manipülasyon saldırısı — Stellar ekosisteminin en büyük hack'i.

**Ne aldık:** Tek kaynak oracle'a bağımlılığın tehlikesi. Reflector VWAP oracle'ının düşük likidite ortamında manipüle edilebilirliği. Deviation check logic'inin bypass edilme tekniği.
**Ne ekledik:** Multi-source oracle aggregation (en az 2/3 kaynak uyuşmalı), manipülasyon tespiti, bu spesifik saldırı vektörünü engelleyen doğrulama mantığı.

### 4.3 x402 Ödeme Protokolü

**İlham:** HTTP 402 tabanlı machine-to-machine ödeme. Stellar'da aktif.

**Ne aldık:** Makine ödeme konsepti, ajan ekonomisi vizyonu.
**İlişki:** Oort Protocol, x402 ile ödeme yapan ajanların güvenlik katmanı olarak çalışır.

### 4.4 Machine Payments Protocol (MPP)

**İlham:** Stripe destekli, session-bazlı mikro ödemeler. Stellar'ın `@stellar/mpp` SDK'sı ile çalışır.

**Ne aldık:** Yüksek frekanslı ajan etkileşimi modeli.
**İlişki:** MPP session'ları üzerinden ödeme yapan ajanlar, Oort Guard ile doğrulanabilir.

### 4.5 Akademik Temel: Alqithami 2026 — Agent-Blockchain Threat Model

**İlham:** "Autonomous Agents on Blockchains: Standards, Execution Models, and Trust Boundaries" (arXiv:2601.04583, Ocak 2026).

**Ne aldık:** C1-C7 tehdit taksonomisi. Oort'un doğrulama pipeline'ı 5 saldırı sınıfına doğrudan karşılık geliyor.

| Makale Sınıfı | Saldırı | Oort Karşılığı | Koruma Mekanizması |
|---|---|---|---|
| **C1** — Prompt Injection | Ajan manipüle edilip yanlış karar veriyor | Tehdit 1 (Halüsinasyon) | PriceVerifier: ajan ne derse desin, oracle ile karşılaştır |
| **C2** — Data/Tool Spoofing | Sahte fiyat verisi | Tehdit 1 (Veri tutarsızlığı) | Multi-source oracle — tek kaynak bypass imkansız |
| **C3** — Policy Bypass | Ajan politika kurallarını atlıyor | Tehdit 3 (Kontrolsüz harcama) | On-chain policy engine — kontrat zorunlu kılıyor |
| **C4** — Key Exfiltration | Ajan anahtarı çalındı | Tehdit 2 (Anahtar ele geçirme) | Oort Vault: anahtar çalınsa bile fonlar güvende |
| **C5** — MEV/Ordering | Sandwich saldırısı, front-running | Tehdit 4 (Slippage) | Commit-reveal + SlippageGuard + Footprint stale rejection |
| **C6** — Contract Traps | Kötü niyetli kontrata yönlendirme | Tehdit 5 (Yetkisiz kontrat) | ContractWhitelist + FootprintVerifier |
| **C7** — Sybil/Collusion | Sahte ajanlarla puan şişirme | Sybil koruması | Minimum stake + oracle-bazlı doğrulama |

### 4.6 Nava — Pazar Doğrulaması

**Önemli:** Nava ($8.3M yatırım, Arbitrum'da) aynı konsepti (ajan doğrulama + escrow) farklı bir zincirde implemente ediyor. Bu, Oort'un çözdüğü problemin gerçek ve fonlanmış olduğunu kanıtlar. Stellar'da ise bu kategoride hiçbir tam protokol yok.

---

## 5. Stellar'a Özel Avantajlar — Neden Bu Zincir?

### 5.1 simulateTransaction + Footprint — Doğal Pre-Flight

Soroban'da her transaction, yürütülmeden ÖNCE `simulateTransaction` RPC endpoint'i ile simüle edilir. Bu simülasyon, transaction'ın dokunacağı tüm ledger key'lerini (footprint) döner.

```
Soroban'ın Footprint Mekanizması:

1. Ajan swap yapmak istiyor
2. simulateTransaction çağrılır → footprint döner:
   - READ:  Oracle kontrat data, Pool reserves
   - WRITE: User balance, Pool state

3. Oort Guard footprint'i analiz eder:
   → READ listesinde yetkisiz oracle var mı?
   → WRITE listesinde whitelist dışı kontrat var mı?
   → Resource consumption makul mü?

4. Footprint onaylanırsa → normal verify akışına devam

EVM'de bu mümkün değildi — transaction neye dokunacağını
önceden bilemiyordun. Soroban'da footprint sayesinde
transaction'ın TAM erişim haritasını önceden görüyorsun.
```

**Ayrıca:** Gerçek yürütme anında ledger state değiştiyse (örn. MEV botu pool state'ini değiştirdiyse), footprint stale olur ve Soroban HOST düzeyinde transaction otomatik düşer. Bu, ek bir MEV koruması katmanı sağlar — Oort'un commit-reveal'ı ile birlikte çift katmanlı koruma.

### 5.2 Temporary Storage — Ephemeral Intent'ler İçin Mükemmel

Soroban'ın 3 katmanlı storage modeli, Oort'un intent lifecycle'ına birebir uyuyor:

```
Soroban Storage Modeli:

┌─────────────────────────────────────────────────┐
│  PERSISTENT STORAGE (Kalıcı)                     │
│  → Pahalı, silinse bile ESS'den kurtarılabilir   │
│  → Oort kullanımı: Ajan itibar skorları,         │
│    stake bakiyeleri, protokol konfigürasyonu      │
├─────────────────────────────────────────────────┤
│  INSTANCE STORAGE (Kontrat Örneği)               │
│  → Kontrat instance'ına bağlı, max 64KB          │
│  → Oort kullanımı: Admin adresleri, oracle        │
│    adresleri, global parametreler                 │
├─────────────────────────────────────────────────┤
│  TEMPORARY STORAGE (Geçici) ★                    │
│  → En ucuz, TTL dolunca KALıCı olarak silinir    │
│  → Kurtarılamaz — ESS'ye gitmez                  │
│  → Oort kullanımı: Intent hash'leri,              │
│    claim commitment'ları, escrow metadata         │
└─────────────────────────────────────────────────┘

Neden mükemmel:
→ AI ajan intent'leri doğası gereği ephemeral (geçici)
→ Bir arbitraj hesabı 5 dakika içinde geçerliliğini yitirir
→ Temporary Storage: ucuz, TTL dolunca otomatik temizlenir
→ State bloat riski SIFIR — EVM'de bu sorun çözülemez
→ Self-cleaning architecture
```

### 5.3 Reentrancy İmkansız

Soroban, recursive contract call'ları yasaklar. EVM'de her DeFi kontratı `ReentrancyGuard` kullanmak zorundaydı. Soroban'da bu tehdit mimari düzeyde ortadan kalkar.

```
EVM:     Oort Solidity versiyonunda ReentrancyGuard gerekli
Soroban: Gereksiz — host düzeyinde recursive call engeli
→ Bir saldırı vektörü daha ortadan kalktı
```

### 5.4 CAP-71 — Delegated Authentication

CAP-71, Custom Account kontratlarının (__check_auth) authentication yetkisini başka bir adrese delegate etmesini sağlar. Bu, Oort Vault'un escrow mekanizması için doğal bir altyapı sunar:

```
CAP-71 ile Oort Vault Akışı:

1. Oort Vault = Custom Account (escrow kontratı)
2. Kullanıcı fonları Vault'a yatırır
3. Ajan doğrulamayı geçer → Oort Guard onaylar
4. Vault, CAP-71 ile ajanın transaction'ını
   sadece onaylanmış call tree için yetkilendirir
5. Ajan fonlara doğrudan erişemez — sadece
   Vault'un delegated auth'u ile işlem yapabilir

→ Ajanın key'i çalınsa bile Vault'taki fonlar güvende
→ EVM'de approve+transferFrom gerekiyordu — burada native
```

### 5.5 Multi-Source Oracle Ekosistemi

Stellar'da birden fazla oracle provider mevcut — bu, YieldBlox'un tek-kaynak zafiyetini doğrudan çözer:

| Oracle | Tip | Metodoloji | Kontrat (Mainnet) |
|---|---|---|---|
| **Reflector** (ReflectorPulse) | Push | VWAP, 5dk interval, ücretsiz | `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` (SDEX) |
| **Reflector** (ReflectorBeam) | Push | Hızlı güncelleme, XRF fee | Özel provision |
| **DIA** | Pull | Doğrudan 100+ primary market | Testnet aktif, mainnet yakında |
| **Band Protocol** | Pull | BandChain cross-chain | `CCQXWMZVM3KRTXTUPTN53YHL272QGKF32L7XEDNZ2S6OSUFK3NFBGG5M` |

```
Oort Multi-Source Oracle Aggregation:

1. Reflector'dan fiyat çek: $0.121
2. Band'dan fiyat çek:     $0.120
3. SDEX TWAP hesapla:      $0.122

Median: $0.121
Ajan iddiası: $0.121
Sapma: %0 → ✅ DOĞRU

Eğer tek kaynak (Reflector) manipüle edilseydi:
1. Reflector (manipüle): $1.20  ← 10x şişirilmiş
2. Band:                 $0.120
3. SDEX TWAP:            $0.122

Median: $0.122 (manipüle edilen değer outlier olarak atılır)
Ajan iddiası: $1.20
Sapma: %883 → ❌ HARD REJECT + SLASH

→ YieldBlox saldırısı bu sistemde başarısız olurdu
```

### 5.6 Native SDEX Entegrasyonu

Stellar'ın built-in DEX'i (SDEX), EVM zincirlerinde bulunmayan bir avantaj sunar:

```
EVM zincileri: Swap için external DEX kontratı gerekli (Uniswap, vb.)
Stellar:       SDEX Stellar Core'da native — manage_buy/sell_offer operation'ları

Oort avantajı:
→ SDEX offer'ları Soroban VM overhead'i olmadan çalışır
→ SDEX trade history'den TWAP hesaplanabilir (ek oracle kaynağı)
→ Soroban AMM'ler (Phoenix, Aquarius) ile de entegrasyon mümkün
```

### 5.7 Sub-6-Saniye Finality

Stellar'ın SCP (Stellar Consensus Protocol) konsensüsü ~5 saniye ledger close süresi sağlar:

```
Karşılaştırma:
                    Stellar        Ethereum        Monad
                    ───────        ────────        ─────
Blok/Ledger süresi: ~5 saniye      ~12 saniye      400ms
Finality:           ~5 saniye      ~15 dakika*     800ms
CVE döngüsü:       ~15 saniye     ~36 saniye      ~2 saniye

* Ethereum'da finality: 2 epoch ≈ 12.8 dakika
```

CVE döngüsü Monad kadar hızlı değil ama Ethereum'dan çok daha hızlı. Ajan ticareti (saniyeler-dakikalar bazında) için yeterli.

### Stellar Avantajları Özet

| Avantaj | Stellar Özelliği | Oort Etkisi |
|---|---|---|
| Yapısal pre-flight | simulateTransaction + Footprint | FootprintVerifier katmanı (EVM'de yok) |
| Ucuz ephemeral state | Temporary Storage | Intent lifecycle, sıfır state bloat |
| Reentrancy koruması | Host-level recursive call engeli | ReentrancyGuard gereksiz |
| Doğal delegasyon | CAP-71 __check_auth | Vault → ajan yetkilendirme |
| Çoklu oracle | Reflector + DIA + Band | Multi-source aggregation |
| Built-in DEX | SDEX native | Ek TWAP kaynağı + ucuz swap |
| Hızlı finality | ~5 saniye SCP | ~15 saniye CVE döngüsü |

---

## 6. Mevcut Ekosistem ve Rekabet Analizi

Stellar'da Oort'un çözdüğü sorunla kısmen örtüşen mevcut projeler var. "Sıfır rakip" demek doğru değil — ama hiçbiri Oort'un tam kapsamını sunmuyor. Dürüst analiz:

### 6.1 OpenZeppelin Smart Accounts (Soroban)

**Ne yapıyor:** Soroban'da genel amaçlı policy-based authorization framework — spending caps, time-based limits, multisig, scoped permissions.

**Örtüşme:** Politika motoru kısmı doğrudan örtüşüyor.
**Eksik:** Oracle doğrulama yok, escrow yok, itibar sistemi yok, commit-reveal yok, AI-spesifik hiçbir şey yok, slashing yok.
**Fark:** Building block (altyapı parçası), tam protokol değil. Oort bunu internal olarak kullanabilir.

### 6.2 Stellar AI Agent Kit — Policy Signer

**Ne yapıyor:** AI agent transaction imzalamadan ÖNCE policy kontrolü yapan signing gateway. MCP + Passkey Kit + LaunchTube entegrasyonu.

**Örtüşme:** Pre-execution policy checking konsepti benzer.
**Eksik:** Off-chain/semi-on-chain mekanizma — compromise olursa atlanabilir. Oracle doğrulama yok, escrow yok, itibar yok, slashing yok.
**Fark:** "Guardrail" (atlanabilir) vs. Oort "Constraint" (on-chain zorunlu).

### 6.3 ERC-8004 / Stellar 8004

**Ne yapıyor:** 3 on-chain registry — Identity (ajan kimliği), Reputation (itibar puanı), Validation (bağımsız doğrulama).

**Örtüşme:** İtibar sistemi doğrudan örtüşüyor.
**KRİTİK FARK:** ERC-8004'ün Validation Registry'si POST-execution çalışır — ajan işlemi YAPTIKTAN SONRA doğrulayıcılar kontrol eder. Oort PRE-execution — işlem YAPMADAN ÖNCE doğrular. Fonlar hiç risk altına girmez.
**Fark:** Complementary (tamamlayıcı) — Oort + ERC-8004 birlikte çalışabilir.

### 6.4 Trustless Work

**Ne yapıyor:** Soroban üzerinde genel amaçlı milestone-based escrow altyapısı.

**Örtüşme:** Escrow mekanizması örtüşüyor.
**Eksik:** Human-in-the-loop milestone onayı — otomatik oracle doğrulama yok, AI trading için optimize değil.
**Fark:** Generic escrow, trading-specific değil.

### 6.5 ROZO Intents

**Ne yapıyor:** Intent-based stablecoin ödeme routlama.

**Örtüşme:** Yok — payment rail, güvenlik middleware'i değil.

### Rekabet Matrisi

```
                            Oort    OZ Smart   Policy   ERC-8004  Trustless
                            Prot.   Accounts   Signer   /8004     Work
                            ─────   ────────   ──────   ────────  ────────
Pre-execution doğrulama      ✅       ❌         ⚠️*       ❌        ❌
On-chain policy engine       ✅       ✅         ❌         ❌        ❌
Multi-source oracle kontrol  ✅       ❌         ❌         ❌        ❌
Escrow fon koruması          ✅       ❌         ❌         ❌        ✅
Footprint analizi            ✅       ❌         ❌         ❌        ❌
Commit-reveal integrity      ✅       ❌         ❌         ❌        ❌
İtibar sistemi               ✅       ❌         ❌         ✅        ❌
Stake/slash ekonomisi        ✅       ❌         ❌         ❌        ❌
AI hallucination tespiti     ✅       ❌         ❌         ❌        ❌
Trading-specific             ✅       ❌         ❌         ❌        ❌

* Policy Signer: off-chain pre-signing check, on-chain değil
```

**Sonuç:** Parçalar var — policy framework'ler, genel escrow'lar, post-execution reputation — ama hiçbiri bunları birleştirip AI ajan ticareti için pre-execution Commit-Verify-Execute protokolü sunmuyor. Oort bu gap'i dolduruyor.

---

## 7. Sistem Mimarisi — Büyük Resim

```
┌──────────────────────────────────────────────────────────────────────┐
│                       OORT PROTOCOL (Stellar)                        │
│                                                                      │
│  Dış Dünya (Oort'a giren):                                           │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐            │
│  │ Eliza ile      │ │ LangChain ile  │ │ Herhangi bir   │            │
│  │ yazılmış ajan  │ │ ajan           │ │ Stellar ajan   │            │
│  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘            │
│          │                  │                  │                      │
│          └──────────────────┼──────────────────┘                      │
│                             │                                        │
│                             ▼                                        │
│                   ┌───────────────────┐                               │
│                   │    OORT SDK       │                               │
│                   │    npm install    │                               │
│                   │    @oort/sdk      │                               │
│                   └────────┬──────────┘                               │
│                            │                                         │
│      ┌─────────────────────┼─────────────────────┐                   │
│      │                     │                     │                    │
│      ▼                     ▼                     ▼                    │
│ ┌──────────┐     ┌──────────────┐     ┌──────────────┐               │
│ │OORT VAULT│     │   COMMIT     │     │ OORT GUARD   │               │
│ │          │     │              │     │              │                │
│ │ Fonları  │     │ Ajan iddia   │     │ İddiaları   │               │
│ │ kilitle  │     │ SHA-256      │     │ oracle +     │               │
│ │ (SEP-41) │     │ hash'ini     │     │ footprint    │               │
│ │          │     │ on-chain'e   │     │ ile doğrula  │               │
│ │ Temporary│     │ yaz          │     │              │               │
│ │ Storage  │     │              │     │ Multi-source │               │
│ └────┬─────┘     └──────┬───────┘     └──────┬───────┘               │
│      │                  │                    │                        │
│      │            ┌─────┴────────────────────┘                        │
│      │            │                                                   │
│      │      ┌─────┴─────┐                                            │
│      │      │ DOĞRULAMA │                                            │
│      │      │ SONUCU    │                                            │
│      │      └─────┬─────┘                                            │
│      │            │                                                   │
│      │      ┌─────┴──────────────────┐                                │
│      │      │                        │                                │
│      ▼      ▼                        ▼                                │
│ ┌──────────────────┐     ┌──────────────────┐                         │
│ │  ✅ DOĞRULANDI    │     │  ❌ RED            │                       │
│ │                   │     │                   │                       │
│ │ Vault → İşlemi   │     │ Vault → Fonlar    │                       │
│ │ gerçekleştir      │     │ kullanıcıya iade  │                       │
│ │ (Phoenix/SDEX/    │     │                   │                       │
│ │  Blend/vb.)       │     │ Ajan stake'i      │                       │
│ │                   │     │ kesildi            │                       │
│ │ İtibar: +puan     │     │ İtibar: -puan     │                       │
│ └──────────────────┘     └──────────────────┘                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────┐              │
│  │  OORT GUARD — MODÜLER DOĞRULAYICILAR                 │              │
│  │                                                      │              │
│  │  PriceVerifier ── Multi-source oracle fiyat kontrolü │              │
│  │    (Reflector + DIA + Band + SDEX TWAP)              │              │
│  │  BalanceVerifier ── SEP-41 balance() kontrolü        │              │
│  │  FootprintVerifier ── simulateTransaction analizi    │ ★ YENİ       │
│  │    (whitelist dışı kontrat tespiti)                  │              │
│  │                                                      │              │
│  │  POLİTİKA MOTORLARI                                  │              │
│  │  SpendingLimitPolicy ── Günlük/haftalık limit        │              │
│  │  ContractWhitelistPolicy ── İzinli kontrat listesi   │              │
│  │  SlippageGuardPolicy ── Min output kontrolü          │              │
│  └─────────────────────────────────────────────────────┘              │
│                                                                       │
│  ┌─────────────────────────┐                                          │
│  │     İTİBAR KAYDI        │                                          │
│  │     Her ajanın           │                                          │
│  │     doğrulanabilir       │  ◄── On-chain, herkes okuyabilir        │
│  │     geçmişi              │      Persistent Storage'da              │
│  └─────────────────────────┘                                          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Temel Mekanizma: Commit-Verify-Execute

Oort Protocol'ün tüm işleyişi 5 adımlık tek bir akışa dayanır. Bu akış ajan ne yaparsa yapsın (swap, stake, lending) aynı şekilde çalışır.

### Adım 1: Fon Kilitleme (Oort Vault)

Kullanıcı veya ajan, işlem fonlarını Oort Vault kontratına gönderir. Para ajanın elinde değildir — akıllı kontratta kilitlidir.

```
Kullanıcı: "1000 USDC ile XLM almak istiyorum"
         │
         ▼
Oort Vault Kontratı: 1000 USDC kilitlendi (SEP-41 transfer)
         │
         ▼
Durum: Locked (kilitli) — Temporary Storage'da
Sahibi: Kullanıcı adresi (iade hakkı)
İşlemi yapacak: Ajan X (yetkilendirilmiş)
TTL: 300 ledger (~25 dakika)
```

Soroban'da approve + transferFrom yerine `require_auth` + `token.transfer()` tek adımda çalışır — EVM'deki 2-tx friction'ı yok.

### Adım 2: İddia Commit (Ajan Taahhüdü)

Ajan, işlemi neden ve nasıl yapacağını açıklayan bir "iddia paketi" (AgentClaim) oluşturur ve bu paketin SHA-256 hash'ini on-chain'e yazar.

```
Ajan oluşturur (off-chain):
┌────────────────────────────────────────┐
│  AgentClaim {                          │
│    // Veri referansları                │
│    price_feed: Reflector XLM/USD,      │
│    claimed_price: 121_000,             │  ← $0.121 (6 ondalık)
│    // Gerekçe                          │
│    reasoning: "RSI 28.4 < 30 eşiği",  │
│    // Planlanan işlem                  │
│    action: BUY_XLM,                    │
│    protocol: PHOENIX_DEX,              │
│    expected_output_min: 8200_0000000,  │  ← min 8200 XLM (7 dec)
│    // Footprint                        │
│    footprint_hash: 0xab12...,          │  ★ Stellar-native
│    // Meta                             │
│    timestamp: 1748736000,              │
│    expiry_ledger: 52847300,            │  ← ~25 dakika
│  }                                     │
└────────────────────────────────────────┘

Ajan hesaplar (off-chain):
  claim_hash = SHA-256(borsh_serialize(AgentClaim)) = 0x7f3a8b...

Ajan gönderir (on-chain tx):
  oort.commit(intent_id, claim_hash)
  → Hash Temporary Storage'a yazıldı
  → ledger_sequence kaydedildi
```

### Adım 3: Doğrulama (Oort Guard)

Ajan şimdi tam iddia paketini Oort Guard'a gönderir. Oort Guard dört katmanlı doğrulama yapar:

```
DOĞRULAMA KATMANI 1 — Hash Eşleşmesi:
─────────────────────────────────────────
SHA-256(borsh_serialize(claim)) == commit edilen hash?

  Eşleşiyorsa  → Katman 2'ye geç
  Eşleşmiyorsa → ❌ ANINDA RED
                  "Ajan commit ettiğinden farklı bir mantık sundu"

DOĞRULAMA KATMANI 2 — Multi-Source Oracle Kontrolü:
─────────────────────────────────────────────────
Birden fazla oracle'dan gerçek fiyat oku ve iddialarla karşılaştır:

  Reflector XLM/USD: $0.121
  Band XLM/USD:      $0.120
  SDEX TWAP (5dk):   $0.122
  
  Median fiyat:      $0.121
  Ajanın iddiası:    $0.121
  Fark: %0
  Tolerans: %1.5 (soft) / %5 (hard)
  %0 < %1.5 → ✅ Fiyat iddiası doğru

DOĞRULAMA KATMANI 3 — Footprint Kontrolü (★ Stellar-Native):
────────────────────────────────────────────────────────────
simulateTransaction footprint'i Oort Guard whitelist'iyle karşılaştır:

  Footprint READ keys:  [Oracle kontrat, Pool reserves] → ✅ İzinli
  Footprint WRITE keys: [User balance, Pool state]      → ✅ İzinli
  Yetkisiz kontrat:     Yok                              → ✅ Temiz

DOĞRULAMA KATMANI 4 — Politika Uyumu:
─────────────────────────────────────────
Ajanın işlemi tanımlı politika kurallarına uyuyor mu?

  SpendingLimitPolicy:     Günlük harcama limiti aşılmadı mı? ✅
  ContractWhitelistPolicy: Hedef kontrat (Phoenix) izinli mi?  ✅
  SlippageGuardPolicy:     expected_output_min makul mü?       ✅
  
  (Herhangi bir politika ihlali → ❌ RED)
```

### Adım 4a: Doğrulandı → İşlem Gerçekleşir

```
Tüm katmanlar geçti → Oort Vault'tan fonları serbest bırakır

  Vault'tan 1000 USDC çekilir
           │
           ▼
  Phoenix DEX üzerinden swap: 1000 USDC → 8264 XLM
           │
           ▼
  8264 XLM kullanıcı adresine gönderilir
           │
           ▼
  Ajan itibar puanı güncellenir: +20

Sonuç:
  Kullanıcı: 8264 XLM aldı ✅
  Ajan: İtibar arttı ✅
  Oort: Doğrulama ücreti aldı ✅
```

### Adım 4b: Reddedildi → Fonlar İade Edilir

```
Herhangi bir katman başarısız → Oort işlemi YAPMAZ

  Vault'taki 1000 USDC dokunulmaz
           │
           ▼
  1000 USDC kullanıcı adresine İADE edilir (SEP-41 transfer)
           │
           ▼
  Ajanın stake'i kesilir → Oort hazinesine
           │
           ▼
  Ajan itibar puanı düşürülür: -50 (veya yasaklama)

Sonuç:
  Kullanıcı: Parasını geri aldı, 0 kayıp ✅
  Ajan: Stake kaybetti, itibar düştü ❌
  Sistem: Kötü ajan cezalandırıldı ✅
```

### Tam Akış Diyagramı

```
KULLANICI         OORT VAULT / GUARD          AJAN           ORACLE(lar)
    │                    │                      │                │
    │ 1. Fon kilitle     │                      │                │
    │ (1000 USDC)        │                      │                │
    │───────────────────►│                      │                │
    │  require_auth +    │                      │                │
    │  lock_vault()      │                      │                │
    │                    │                      │                │
    │                    │  2. "İşlem yap"      │                │
    │                    │─────────────────────►│                │
    │                    │                      │                │
    │                    │                      │ Oracle'lardan  │
    │                    │                      │ fiyat çek      │
    │                    │                      │───────────────►│
    │                    │                      │◄───────────────│
    │                    │                      │ $0.121         │
    │                    │                      │                │
    │                    │                      │ simulateTx()   │
    │                    │                      │ → footprint al │
    │                    │                      │                │
    │                    │  3. commit(hash)     │                │
    │                    │◄────────────────────│                │
    │                    │  hash → temp storage │                │
    │                    │                      │                │
    │                    │  4. verify_and_exec  │                │
    │                    │     (tam claim +     │                │
    │                    │      footprint)      │                │
    │                    │◄────────────────────│                │
    │                    │                      │                │
    │                    │── K1: Hash ✅         │                │
    │                    │── K2: Oracle ✅       │                │
    │                    │───────────────────────────────────►│
    │                    │◄───────────────────────────────────│
    │                    │── K3: Footprint ✅    │                │
    │                    │── K4: Politika ✅     │                │
    │                    │                      │                │
    │               ┌────┴────────────────┐    │                │
    │               │ TÜM KONTROLLER ✅    │    │                │
    │               └────┬────────────────┘    │                │
    │                    │                      │                │
    │                    │  5. Execute           │                │
    │                    │  Vault → Phoenix swap │                │
    │                    │  1000 USDC → 8264 XLM│                │
    │                    │                      │                │
    │ 6. 8264 XLM geldi │                      │                │
    │◄───────────────────│                      │                │
    │                    │  7. İtibar +20        │                │
    │                    │─────────────────────►│                │
    │                    │                      │                │
```

---

## 9. Oort Guard — Modüler Doğrulayıcılar ve Politika Motorları

### PriceVerifier — Multi-Source Fiyat Doğrulama

```
Görev:  Ajanın iddia ettiği fiyatın birden fazla bağımsız oracle
        kaynağıyla eşleşip eşleşmediğini kontrol eder.

Kaynaklar (en az 2/3 uyuşmalı):
  1. Reflector Oracle (SEP-40 uyumlu, VWAP/TWAP)
  2. Band Protocol (BandChain cross-chain pull)
  3. SDEX TWAP (native Stellar DEX'ten hesaplanan)

Kontrol:
  1. Oracle verisi güncel mi? (Son heartbeat süresi içinde mi?)
  2. En az 2/3 kaynak birbiriyle tutarlı mı? (outlier tespiti)
  3. Median fiyat, ajanın iddiasına yakın mı? (tolerans kontrolü)

Başarısızlık örnekleri:
  → Ajan: "XLM = $0.50"   Median: $0.121   Fark: %313   ❌ HARD REJECT
  → Ajan: "XLM = $0.119"  Median: $0.121   Fark: %1.7   ❌ SOFT REJECT
  → Ajan: "XLM = $0.120"  Median: $0.121   Fark: %0.8   ✅ GEÇTİ
  → Reflector manipüle ama Band+SDEX tutarlı              ❌ OUTLIER TESPİT
```

### Kademeli Tolerans Sistemi

Ağ gecikmesi ile kötü niyeti ayırt etmek için 3 katmanlı karar mekanizması:

| Sapma Aralığı | Karar | Slash | İtibar | Gerekçe |
|---|---|---|---|---|
| %0 - %1.5 | ✅ Passed | Yok | +puan | Normal ağ gecikmesi aralığı |
| %1.5 - %5 | ❌ Soft Reject | **Yok** | -5 (hafif) | "Tekrar dene" — dürüst ajan korunur |
| %5+ | ❌ Hard Reject | **%10 slash** | -50 | Kötü niyet veya ciddi halüsinasyon |

```rust
// PriceVerifier — Kademeli tolerans (Rust / Soroban)
const SOFT_TOLERANCE_BPS: u32 = 150;  // %1.5 — ağ gecikmesi marjı
const HARD_TOLERANCE_BPS: u32 = 500;  // %5.0 — kötü niyet eşiği

pub fn verify_price(
    env: &Env,
    claimed_price: i128,
    oracle_addresses: Vec<Address>,
) -> VerificationResult {
    // Multi-source fiyat toplama
    let mut prices: Vec<i128> = Vec::new(env);
    for oracle_addr in oracle_addresses.iter() {
        let client = oracle::Client::new(env, &oracle_addr);
        let price_data = client.lastprice(&Asset::Other(xlm_symbol.clone()));
        if let Some(pd) = price_data {
            prices.push_back(pd.price);
        }
    }

    // En az 2 kaynak gerekli
    if prices.len() < 2 {
        return VerificationResult::HardReject;
    }

    // Median hesapla
    let median_price = calculate_median(env, &prices);

    // Sapma hesapla (basis points)
    let diff = if claimed_price > median_price {
        claimed_price - median_price
    } else {
        median_price - claimed_price
    };
    let deviation_bps = (diff * 10000) / median_price;

    if deviation_bps <= SOFT_TOLERANCE_BPS as i128 {
        VerificationResult::Passed { deviation_bps: deviation_bps as u32 }
    } else if deviation_bps <= HARD_TOLERANCE_BPS as i128 {
        VerificationResult::SoftReject { deviation_bps: deviation_bps as u32 }
    } else {
        VerificationResult::HardReject { deviation_bps: deviation_bps as u32 }
    }
}
```

### BalanceVerifier — Bakiye Doğrulama

```
Görev:  Ajanın iddia ettiği bakiyenin gerçek SEP-41 bakiyesiyle
        eşleşip eşleşmediğini kontrol eder.

Kaynak: SEP-41 token::TokenClient::balance() (doğrudan on-chain)

Kontrol:
  1. Referans verilen token adresi geçerli bir SEP-41 kontratı mı?
  2. Hesaptaki bakiye, ajanın iddiasıyla eşleşiyor mu?
  3. Bakiye işlem tutarını karşılıyor mu?
```

### Politika Motorları (Oort Guard)

Doğrulayıcılar "ajan doğru mu söylüyor?" sorusunu cevaplar. Politika motorları "ajan bunu yapmaya yetkili mi?" sorusunu cevaplar.

#### SpendingLimitPolicy — Harcama Limiti

```
Görev:  Ajanın belirli zaman dilimlerinde harcayabileceği
        maksimum tutarı kontrol eder.

Yapılandırma (kullanıcı tarafından):
  daily_limit:  500_000_000    // Günde max 500 USDC (6 decimals)
  weekly_limit: 2_000_000_000  // Haftada max 2000 USDC
```

#### ContractWhitelistPolicy — Kontrat Beyaz Listesi

```
Görev:  Ajanın etkileşime girebileceği Soroban kontratlarını kısıtlar.

Yapılandırma (kullanıcı/operatör tarafından):
  allowed_contracts: [
    PHOENIX_ROUTER,      // C...
    BLEND_POOL,          // C...
    AQUARIUS_POOL,       // C...
  ]
```

#### SlippageGuardPolicy — Slippage Koruması

```
Görev:  Ajanın belirlediği minimum çıktı miktarının (expected_output_min)
        mevcut piyasa koşullarına göre makul olup olmadığını kontrol eder.

Yapılandırma:
  max_slippage_bps: 200  // Maksimum %2 slippage toleransı
```

### Doğrulayıcı/Politika Trait Mimarisi (Rust)

```rust
// Her doğrulayıcı bu trait'i implemente eder
#[contracttype]
pub enum VerificationResult {
    Passed { deviation_bps: u32 },
    SoftReject { deviation_bps: u32 },
    HardReject { deviation_bps: u32 },
}

// Her politika motoru bu trait'i implemente eder
#[contracttype]
pub enum PolicyResult {
    Allowed,
    Denied { reason: String },
}
```

---

## 10. Oort Vault — Escrow ve Fon Koruma Sistemi

### Neden Escrow?

Eğer fonlar doğrudan ajanın elindeyse, doğrulama başarısız olsa bile para çoktan harcanmış olabilir. Oort Vault, fonları akıllı kontratta tutar. İşlem ancak doğrulama geçerse gerçekleşir.

### Vault Yapısı (Soroban ContractType)

```rust
#[contracttype]
pub struct Escrow {
    pub intent_id: BytesN<16>,      // Benzersiz niyet ID (UUID)
    pub owner: Address,              // Fon sahibi (kullanıcı)
    pub agent: Address,              // Yetkili ajan
    pub token: Address,              // SEP-41 token kontrat adresi
    pub amount: i128,                // Kilitli tutar
    pub created_at: u64,             // Oluşturulma zamanı (ledger timestamp)
    pub expiry_ledger: u32,          // Son geçerli ledger sequence
    pub status: EscrowStatus,        // Enum: durumu
    pub commit_hash: BytesN<32>,     // Ajan commit hash'i (veya boş)
    pub verified: bool,              // Doğrulama geçti mi?
}

#[contracttype]
pub enum EscrowStatus {
    Locked,       // Fonlar kilitli, commit bekleniyor
    Committed,    // Ajan commit yaptı, doğrulama bekleniyor
    Executed,     // İşlem gerçekleşti, fonlar dağıtıldı
    Refunded,     // Doğrulama başarısız, fonlar iade edildi
    Expired,      // Süre doldu, fonlar iade edildi
}
```

### Storage Stratejisi

```rust
// TEMPORARY STORAGE — Intent lifecycle (ucuz, self-cleaning)
env.storage().temporary().set(&intent_id, &escrow);
env.storage().temporary().extend_ttl(&intent_id, 300, 300);
// TTL: 300 ledger ≈ 25 dakika — intent timeout'u ile eşleşir
// TTL dolunca kalıcı olarak silinir — state bloat sıfır

// PERSISTENT STORAGE — İtibar (kalıcı, kurtarılabilir)
env.storage().persistent().set(&agent_address, &reputation);

// INSTANCE STORAGE — Global konfigürasyon (kontrata bağlı)
env.storage().instance().set(&CONFIG_KEY, &protocol_config);
```

### Fon Akış Diyagramı

```
KULLANICI CÜZDANİ                    OORT VAULT
     │                                     │
     │  lock_vault(intent_id, agent, ...)  │
     │  → require_auth(kullanıcı)          │
     │  → token.transfer(kullanıcı→vault)  │
     │────────────────────────────────────►│
     │                                     │  1000 USDC kilitli
     │                                     │  status: Locked
     │                                     │  storage: Temporary (TTL: 300)
     │                                     │
     │                              ┌──────┴──────┐
     │                              │             │
     │                         DOĞRULANDI ✅  RED ❌
     │                              │             │
     │                              ▼             ▼
     │                        PHOENİX SWAP   KULLANICIYA İADE
     │                        1000 USDC      1000 USDC
     │                        → 8264 XLM     → Kullanıcı
     │                              │             │
     │  8264 XLM                    │             │  1000 USDC iade
     │◄─────────────────────────────┘             │
     │                                            │
     │  (veya iade durumunda)                     │
     │◄───────────────────────────────────────────┘
     │
```

### Zaman Aşımı Koruması

```
Eğer ajan commit yapmadan veya doğrulama tamamlanmadan
expiry_ledger geçerse:

  → Fonlar OTOMATİK olarak kullanıcıya iade edilir
  → Ajan'a zaman aşımı cezası: itibar -10
  → Ajanın stake'i kesilmez (aktif kötü niyet kanıtı yok)

  → Ayrıca: Temporary Storage TTL dolunca intent verisi
    otomatik silinir — temizleme işlemi gereksiz

Herkes refund() fonksiyonunu çağırabilir (permissionless) —
  yeterli ki env.ledger().sequence() >= expiry_ledger olsun.
```

---

## 11. Footprint Doğrulama Katmanı (Stellar-Native)

Bu, Oort Protocol'ün EVM zincirlerinde yapılamayan, Stellar'a özgü güvenlik katmanıdır.

### simulateTransaction Neyi YAPAR, Neyi YAPMAZ

| Soru | simulateTransaction | Oort Guard |
|---|---|---|
| "Transaction yapısal olarak geçerli mi?" | ✅ Evet | N/A (zincire bırakır) |
| "Hangi ledger key'lere dokunulacak?" | ✅ Footprint döner | ✅ Footprint'i analiz eder |
| "Resource consumption ne kadar?" | ✅ CPU/memory tahmini | N/A |
| "Ajanın fiyat iddiası doğru mu?" | ❌ Hayır | ✅ Oracle karşılaştırma |
| "Harcama limiti aşıldı mı?" | ❌ Hayır | ✅ SpendingLimit policy |
| "Hedef kontrat güvenli mi?" | ❌ Hayır | ✅ Whitelist + footprint analizi |
| "Oracle manipüle edilmiş mi?" | ❌ Hayır | ✅ Multi-source kontrol |
| "min_output makul mü?" | ❌ Hayır | ✅ SlippageGuard |

### FootprintVerifier Akışı

```
1. Ajan → simulateTransaction çağırır (Soroban RPC)
2. RPC → footprint döner:
   {
     readOnly: [
       ContractData(REFLECTOR_ORACLE, price_key),
       ContractData(PHOENIX_POOL, reserves_key),
     ],
     readWrite: [
       ContractData(PHOENIX_POOL, user_balance_key),
       ContractData(USDC_CONTRACT, balance_key),
     ]
   }

3. Ajan → footprint hash'ini claim'e ekler
4. Oort Guard → footprint'i whitelist ile karşılaştırır:
   
   for key in footprint.read_write {
     if !whitelist.contains(key.contract_id) {
       return FootprintResult::Rejected("Unauthorized contract");
     }
   }

5. Whitelist kontrolü geçerse → normal doğrulama akışına devam

Bonus: Gerçek yürütme anında state değişmişse (MEV botu pool'u
manipüle etmişse), footprint stale olur → Soroban HOST düzeyinde
tx otomatik düşer. Çift katmanlı MEV koruması.
```

### YieldBlox Exploit Testi

```
YieldBlox saldırısında olsaydı Oort ne yapardı?

1. Saldırgan Reflector oracle'ını manipüle etti → USTRY $1.05 → $106.73
2. AI ajan bu veriyi ingeste etti, "USTRY $106.73" iddia etti
3. Oort Guard PriceVerifier devreye girer:
   - Reflector: $106.73 (manipüle edilmiş)
   - Band Protocol: $1.05 (gerçek)
   - SDEX TWAP: $1.04 (gerçek)
   - Outlier tespiti: Reflector devasa sapıyor → güvenilmez işaretlenir
   - Median: $1.045
   - Ajan iddiası: $106.73
   - Sapma: %10,100+ → ❌ HARD REJECT + SLASH

4. İşlem HİÇ GERÇEKLEŞMEDİ
5. Fonlar kullanıcıya iade, ajan cezalandırıldı
6. $10.2M kaybı önlendi
```

---

## 12. İtibar Sistemi

### Puan Hesaplama

```
Başlangıç puanı: 1000
Minimum: 0 (yasaklama eşiği: 100'ün altı)
Maksimum: 2000

Puan Değişimleri:
─────────────────────────────────────────────────────
Doğrulama başarılı (tüm katmanlar geçti)    → +15 ile +25
Doğrulama başarısız — Hard Reject            → -50 ile -80
Doğrulama başarısız — Soft Reject            → -5 (hafif)
Zaman aşımı (commit yapmadı)               → -10
Puan 100'ün altına düştü                    → YASAKLANDI
```

### K-Faktör (Yeni vs. Deneyimli Ajan)

```
Satranç ELO'sundan ilham:

Yeni ajan (< 50 işlem):      K = 40 (hızlı yükselir/düşer)
Orta ajan (50-200 işlem):     K = 20 (dengeli)
Deneyimli ajan (200+ işlem):  K = 10 (yavaş değişir, stabil)
```

### İtibar Yapısı (Rust)

```rust
#[contracttype]
pub struct Reputation {
    pub agent: Address,
    pub score: u32,                 // 0-2000 arası puan
    pub total_verifications: u32,
    pub passed: u32,
    pub failed: u32,
    pub total_volume: i128,         // Toplam doğrulanan hacim (USDC, 6 dec)
    pub stake: i128,                // Kilitli teminat (XLM, 7 dec)
    pub registered_at: u64,
    pub last_verified: u64,
    pub is_banned: bool,
}
```

**Storage:** Persistent Storage — itibar kalıcı olmalı, expire olsa bile ESS'den kurtarılabilir.

---

## 13. Akıllı Kontrat Mimarisi (Rust / Soroban)

### Proje Yapısı

```
oort-protocol/
├── contracts/
│   ├── oort-core/                  ← Ana kontrat (Oort Vault + Guard)
│   │   ├── src/
│   │   │   ├── lib.rs              ← Entry point
│   │   │   ├── vault.rs            ← Escrow mantığı (lock, refund)
│   │   │   ├── guard.rs            ← Doğrulama mantığı (commit, verify)
│   │   │   ├── reputation.rs       ← İtibar sistemi
│   │   │   ├── types.rs            ← Struct/Enum tanımları
│   │   │   └── events.rs           ← Event tanımları
│   │   ├── Cargo.toml
│   │   └── src/test.rs             ← Unit testler
│   ├── oort-price-verifier/        ← Multi-source fiyat doğrulama
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   └── oort-mock-oracle/           ← Test için mock oracle
│       ├── src/lib.rs
│       └── Cargo.toml
├── sdk/                             ← Oort SDK (TypeScript)
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── claim.ts
│   ├── package.json
│   └── tsconfig.json
├── bots/                            ← Demo botlar
│   ├── honest-bot.ts
│   └── liar-bot.ts
├── app/                             ← Oort Terminal UI (Next.js)
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── next.config.js
├── Cargo.toml                       ← Workspace root
└── Makefile
```

### Ana Kontrat — Temel Fonksiyonlar

```rust
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, String, Vec,
    token,
};

#[contract]
pub struct OortProtocol;

#[contractimpl]
impl OortProtocol {
    // ══════════════════════════════════════════════
    // 1. register_agent — Ajan kaydı
    // ══════════════════════════════════════════════
    pub fn register_agent(env: Env, agent: Address, stake_amount: i128) {
        agent.require_auth();

        let min_stake: i128 = 1000_0000000; // 1000 XLM (7 decimals)
        assert!(stake_amount >= min_stake, "Insufficient stake");

        let xlm_token = env.storage().instance().get::<_, Address>(&XLM_KEY).unwrap();
        token::TokenClient::new(&env, &xlm_token)
            .transfer(&agent, &env.current_contract_address(), &stake_amount);

        let reputation = Reputation {
            agent: agent.clone(),
            score: 1000,
            total_verifications: 0,
            passed: 0,
            failed: 0,
            total_volume: 0,
            stake: stake_amount,
            registered_at: env.ledger().timestamp(),
            last_verified: 0,
            is_banned: false,
        };

        env.storage().persistent().set(&agent, &reputation);
    }

    // ══════════════════════════════════════════════
    // 2. lock_vault — Fon kilitleme (Oort Vault)
    // ══════════════════════════════════════════════
    pub fn lock_vault(
        env: Env,
        intent_id: BytesN<16>,
        owner: Address,
        agent: Address,
        token_addr: Address,
        amount: i128,
        expiry_ledger: u32,
    ) {
        owner.require_auth();

        // Ajan kayıtlı ve yasaklı değil mi kontrol
        let rep: Reputation = env.storage().persistent().get(&agent).unwrap();
        assert!(!rep.is_banned, "Agent banned");
        assert!(expiry_ledger > env.ledger().sequence(), "Invalid expiry");

        // SEP-41 token transfer — tek adımda, approve gereksiz
        token::TokenClient::new(&env, &token_addr)
            .transfer(&owner, &env.current_contract_address(), &amount);

        let escrow = Escrow {
            intent_id: intent_id.clone(),
            owner,
            agent,
            token: token_addr,
            amount,
            created_at: env.ledger().timestamp(),
            expiry_ledger,
            status: EscrowStatus::Locked,
            commit_hash: BytesN::from_array(&env, &[0u8; 32]),
            verified: false,
        };

        // Temporary Storage — ucuz, self-cleaning
        let ttl = expiry_ledger - env.ledger().sequence();
        env.storage().temporary().set(&intent_id, &escrow);
        env.storage().temporary().extend_ttl(&intent_id, ttl, ttl);
    }

    // ══════════════════════════════════════════════
    // 3. commit — İddia hash'i commit
    // ══════════════════════════════════════════════
    pub fn commit(env: Env, intent_id: BytesN<16>, claim_hash: BytesN<32>) {
        let mut escrow: Escrow = env.storage().temporary().get(&intent_id).unwrap();
        escrow.agent.require_auth();

        assert!(matches!(escrow.status, EscrowStatus::Locked), "Invalid state");
        assert!(env.ledger().sequence() < escrow.expiry_ledger, "Expired");

        escrow.commit_hash = claim_hash;
        escrow.status = EscrowStatus::Committed;
        env.storage().temporary().set(&intent_id, &escrow);
    }

    // ══════════════════════════════════════════════
    // 4. verify_and_execute — Doğrula ve yürüt (atomik)
    // ══════════════════════════════════════════════
    pub fn verify_and_execute(
        env: Env,
        intent_id: BytesN<16>,
        claim_data: BytesN<256>,        // Serialized AgentClaim
        oracle_addresses: Vec<Address>, // Oracle kontrat adresleri
    ) {
        let mut escrow: Escrow = env.storage().temporary().get(&intent_id).unwrap();
        escrow.agent.require_auth();

        assert!(matches!(escrow.status, EscrowStatus::Committed), "Invalid state");
        assert!(env.ledger().sequence() < escrow.expiry_ledger, "Expired");

        // KATMAN 1: Hash eşleşmesi
        let computed_hash = env.crypto().sha256(&claim_data);
        let hash_matched = computed_hash == escrow.commit_hash;

        // KATMAN 2: Multi-source oracle doğrulama
        let mut oracle_matched = false;
        if hash_matched {
            let result = Self::verify_price(&env, &claim_data, &oracle_addresses);
            oracle_matched = matches!(result, VerificationResult::Passed { .. });
        }

        // KATMAN 3: Politika uyumu
        let mut policy_passed = false;
        if hash_matched && oracle_matched {
            policy_passed = Self::check_all_policies(&env, &claim_data, &escrow);
        }

        if hash_matched && oracle_matched && policy_passed {
            // ✅ TÜM KONTROLLER GEÇTİ
            escrow.verified = true;
            escrow.status = EscrowStatus::Executed;
            env.storage().temporary().set(&intent_id, &escrow);

            // Fonları hedef protokole gönder
            Self::execute_action(&env, &escrow, &claim_data);

            // İtibar artır
            Self::update_reputation(&env, &escrow.agent, true, escrow.amount);
        } else {
            // ❌ DOĞRULAMA BAŞARISIZ
            escrow.status = EscrowStatus::Refunded;
            env.storage().temporary().set(&intent_id, &escrow);

            // Fonları kullanıcıya iade
            token::TokenClient::new(&env, &escrow.token)
                .transfer(&env.current_contract_address(), &escrow.owner, &escrow.amount);

            // Ajan stake'ini kes
            Self::slash_agent(&env, &escrow.agent);

            // İtibar düşür
            Self::update_reputation(&env, &escrow.agent, false, escrow.amount);
        }
    }

    // ══════════════════════════════════════════════
    // 5. refund — İade (zaman aşımı)
    // ══════════════════════════════════════════════
    pub fn refund(env: Env, intent_id: BytesN<16>) {
        let mut escrow: Escrow = env.storage().temporary().get(&intent_id).unwrap();

        assert!(
            matches!(escrow.status, EscrowStatus::Locked | EscrowStatus::Committed),
            "Cannot refund"
        );
        assert!(env.ledger().sequence() >= escrow.expiry_ledger, "Not expired");

        escrow.status = EscrowStatus::Expired;
        env.storage().temporary().set(&intent_id, &escrow);

        token::TokenClient::new(&env, &escrow.token)
            .transfer(&env.current_contract_address(), &escrow.owner, &escrow.amount);

        Self::update_reputation(&env, &escrow.agent, false, 0);
    }
}
```

---

## 14. Oort SDK — Entegrasyon Katmanı

### Kurulum

```bash
npm install @oort-protocol/sdk @stellar/stellar-sdk @stellar/freighter-api
```

### Temel Kullanım — Ajan Tarafı

```typescript
import { OortSDK, AgentClaim } from '@oort-protocol/sdk';
import * as StellarSdk from '@stellar/stellar-sdk';

// 1. Oort'a bağlan
const oort = new OortSDK({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: StellarSdk.Networks.TESTNET,
  contractId: OORT_CONTRACT_ID,
});

// 2. Ajan olarak kayıt ol (bir kere yapılır)
await oort.registerAgent({
  keypair: agentKeypair,
  stakeAmount: 10000000000n, // 1000 XLM (7 decimals)
});

// 3. İşlem yapmak istediğinde — iddia paketi oluştur
const claim: AgentClaim = {
  priceFeed: REFLECTOR_ORACLE_ID,
  claimedPrice: 121000n,                 // $0.121 (6 decimals)
  reasoning: 'RSI 28.4 < 30 threshold, buy signal',
  action: 'BUY_XLM',
  protocol: PHOENIX_DEX_ID,
  expectedOutputMin: 82000000000n,       // min 8200 XLM (7 dec)
};

// 4. Commit + Verify + Execute (SDK hepsini yapar)
const result = await oort.submitAndExecute({
  intentId: crypto.randomUUID(),
  claim,
  keypair: agentKeypair,
});

if (result.verified) {
  console.log(`İşlem başarılı: ${result.outputAmount} XLM alındı`);
} else {
  console.log(`Doğrulama başarısız: ${result.failureReason}`);
}
```

### Temel Kullanım — Kullanıcı/Uygulama Tarafı

```typescript
// Kullanıcı tarafı — sadece vault oluştur ve sonucu izle

// Vault oluştur — tek tx, approve gereksiz
const vault = await oort.lockVault({
  owner: userKeypair,
  agent: trustedAgentAddress,
  token: USDC_CONTRACT_ID,
  amount: 1000000000n,         // 1000 USDC (6 decimals)
  expiryLedger: currentLedger + 300, // ~25 dakika
});

// Sonucu dinle (Soroban events polling)
oort.onVaultUpdate(vault.intentId, (update) => {
  switch (update.status) {
    case 'Executed':
      console.log('İşlem doğrulandı ve gerçekleşti!');
      break;
    case 'Refunded':
      console.log('Ajan doğrulamayı geçemedi. Paranız iade edildi.');
      break;
    case 'Expired':
      console.log('Süre doldu. Paranız iade edildi.');
      break;
  }
});
```

---

## 15. Kullanıcı Akışları — Adım Adım Senaryolar

### Senaryo A: Dürüst Ajan (HonestBot) — Swap İşlemi

```
Zaman  Olay
─────  ──────────────────────────────────────────────────
00:00  Kullanıcı 1000 USDC'yi lock_vault() ile kilitler
       → Vault oluştu, status: Locked, Temporary Storage'da

00:03  HonestBot oracle'lardan XLM fiyatını çeker:
       Reflector: $0.121 | Band: $0.120 | SDEX TWAP: $0.122
       → RSI hesaplar: 28.4 (eşik: 30)
       → Karar: ALIM

00:04  HonestBot iddia paketi oluşturur:
       {price: 0.121, reasoning: "RSI 28.4", action: BUY}
       → SHA-256 hash hesaplar: 0x7f3a...

00:05  HonestBot commit(0x7f3a...) → Temporary Storage'a yazıldı
       → Vault status: Committed

00:08  HonestBot verify_and_execute(tam_claim) gönderir
       → Katman 1: SHA-256(claim) == 0x7f3a...? ✅
       → Katman 2: Median fiyat $0.121, iddia $0.121? ✅ (%0 sapma)
       → Katman 3: Footprint temiz? ✅
       → Katman 4: Politika kuralları? ✅

00:10  TÜM KATMANLAR GEÇTİ ✅
       → Vault'tan 1000 USDC → Phoenix DEX swap → 8264 XLM
       → 8264 XLM → kullanıcı adresine
       → HonestBot itibar: 1000 → 1020 (+20)
       → Vault status: Executed
```

### Senaryo B: Yalancı Ajan (LiarBot) — Sahte Fiyat İddiası

```
Zaman  Olay
─────  ──────────────────────────────────────────────────
00:00  Kullanıcı 1000 USDC'yi vault'a kilitler

00:03  LiarBot fiyatı YANLIŞ bilir (halüsinasyon):
       → Gerçek XLM fiyatı: $0.121
       → LiarBot "diyor ki": $0.50 (yanlış!)

00:04  LiarBot iddia paketi: {price: 0.50, action: BUY}
       → SHA-256 hash: 0xd21b...

00:05  LiarBot commit(0xd21b...) → Temporary Storage'a yazıldı

00:08  LiarBot verify_and_execute(tam_claim) gönderir
       → Katman 1: hash ✅ (hash tutarlı)
       → Katman 2: Multi-source oracle kontrolü:
         Reflector: $0.121 | Band: $0.120 | SDEX: $0.122
         Median: $0.121
         İddia: $0.50
         Sapma: %313
         → ❌ HARD REJECT

00:10  DOĞRULAMA BAŞARISIZ ❌
       → İşlem HİÇ GERÇEKLEŞMEDİ
       → 1000 USDC → kullanıcı adresine İADE
       → LiarBot stake'inden 100 XLM KESİLDİ (%10 slash)
       → LiarBot itibar: 1000 → 950 (-50)
       → Vault status: Refunded

Sonuç: Kullanıcı 1 kuruş kaybetmedi. Ajan cezalandırıldı.
```

---

## 16. Demo UI — Oort Terminal

### Tasarım Felsefesi

Koyu tema, terminal estetiği, uzay teması. Veriye odaklı, minimal. Jüri 3 şeyi görmeli:
1. Canlı doğrulama akışı (dürüst vs. yalancı ajan)
2. İtibar skor tablosu
3. Vault durumu (kilitli/iade/yürütüldü)

### Ana Ekran

```
┌────────────────────────────────────────────────────────────────────┐
│  OORT TERMINAL                   Ağ: Stellar  │  Ledger: 52847300 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Canlı Doğrulama Akışı                    Bugün: 247 doğrulama   │
│  ════════════════════                     Başarılı: 239 (%96.8)  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ● 5sn önce   HonestBot                        1000 USDC   │  │
│  │  İddia: "XLM $0.121, RSI 28.4, ALIM"                       │  │
│  │                                                              │  │
│  │  Doğrulama:                                                  │  │
│  │  ├── Hash eşleşmesi:       ✅ 0x7f3a... == 0x7f3a...        │  │
│  │  ├── Oracle kontrolü:      ✅ Reflector/Band/SDEX tutarlı   │  │
│  │  │   Median $0.121 / İddia $0.121 / Sapma %0               │  │
│  │  ├── Footprint kontrolü:   ✅ Tüm kontratlar whitelist'te   │  │
│  │  └── Politika uyumu:       ✅ Tüm politikalar geçti          │  │
│  │                                                              │  │
│  │  Sonuç: ✅ DOĞRULANDI → 8264 XLM → kullanıcıya              │  │
│  │  İtibar: 1020 → 1040 (+20)                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ● 12sn önce  LiarBot                          2000 USDC   │  │
│  │  İddia: "XLM $0.50, fiyat düşük, ALIM"                     │  │
│  │                                                              │  │
│  │  Doğrulama:                                                  │  │
│  │  ├── Hash eşleşmesi:       ✅ 0xd21b... == 0xd21b...        │  │
│  │  ├── Oracle kontrolü:      ❌ Median $0.121 / İddia $0.50   │  │
│  │  │                           Sapma: %313 (HARD REJECT)      │  │
│  │  ├── Footprint kontrolü:   ⏭️ (önceki adım başarısız)       │  │
│  │  └── Politika uyumu:       ⏭️ (önceki adım başarısız)       │  │
│  │                                                              │  │
│  │  Sonuç: ❌ REDDEDİLDİ → 2000 USDC kullanıcıya İADE          │  │
│  │  Stake: 100 XLM KESİLDİ │ İtibar: 950 → 900 (-50)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  Ajan İtibar Tablosu                                               │
│  ═══════════════════                                               │
│  Sıra │ Ajan          │ Puan  │ Doğrulama │ Başarı │ Hacim        │
│  ─────┼───────────────┼───────┼───────────┼────────┼──────────────│
│  #1   │ ◆ HonestBot   │ 1040  │ 89        │ %97.8  │ $847K       │
│  #2   │ ◇ SwapBot     │ 920   │ 34        │ %91.2  │ $210K       │
│  ──   │ ██ LiarBot    │ 900   │ 11        │ %18.2  │ $5K         │
│                                                                    │
│  Toplam Korunan Fon: $2.1M  │  Engellenen Kötü İşlem: 47         │
└────────────────────────────────────────────────────────────────────┘
```

---

## 17. Desteklenen İşlem Türleri

| İşlem Türü | Ajan İddiası | Oort Doğrulaması | Doğrulama Kaynağı |
|---|---|---|---|
| **Swap** | "XLM fiyatı $0.121, alıyorum" | Fiyat gerçekten $0.121 mi? | Multi-source oracle |
| **Lending Deposit** | "Blend APY %8.2, yatırıyorum" | APY gerçekten %8.2 mi? | Blend kontratı |
| **Lending Withdraw** | "Health factor 1.1, çekiyorum" | HF gerçekten 1.1 mi? | Lending kontratı |
| **LP Deposit** | "Phoenix havuzunda fiyat uygun" | Fiyat aralıkta mı? | Pool kontratı |

**Hackathon MVP'de:** Swap (multi-source oracle fiyat doğrulama) demo edilecek.

---

## 18. Teknik Yığın (Tech Stack)

### Akıllı Kontrat

| Teknoloji | Neden |
|---|---|
| **Rust** | Soroban'ın native dili |
| **soroban-sdk** | Soroban kontrat geliştirme kiti |
| **stellar-cli** | Build, deploy, invoke |
| **Reflector Oracle** | SEP-40 uyumlu fiyat verisi (mainnet aktif) |
| **Band Protocol** | Cross-chain pull oracle (mainnet aktif) |

### SDK (TypeScript)

| Teknoloji | Neden |
|---|---|
| **@stellar/stellar-sdk** | Soroban RPC + Horizon etkileşimi |
| **@stellar/freighter-api** | Freighter cüzdan bağlantısı |
| **@creit.tech/stellar-wallets-kit** | Multi-wallet desteği |

### Demo UI (Oort Terminal)

| Teknoloji | Neden |
|---|---|
| **Next.js** | SSR + API routes |
| **TypeScript** | Tip güvenliği |
| **Tailwind CSS** | Koyu tema, hızlı stil |
| **Stellar Wallets Kit** | Freighter / Lobstr bağlantısı |

### Demo Botlar

| Teknoloji | Neden |
|---|---|
| **TypeScript** | SDK ile aynı dil |
| **@stellar/stellar-sdk** | Oracle okuma + tx gönderme |

### Altyapı

| Teknoloji | Neden |
|---|---|
| **Stellar Testnet** | Test SDF Network |
| **Soroban RPC** | https://soroban-testnet.stellar.org |
| **Horizon** | https://horizon-testnet.stellar.org |
| **Friendbot** | https://friendbot.stellar.org (10K test XLM) |
| **Vercel** | Frontend deploy |

---

## 19. Gelir Modeli

```
OORT GELİR AKIŞI

1. Doğrulama Ücreti
   Her başarılı doğrulama: işlem hacminin %0.05'i
   (1000 USDC işlem = 0.50 USDC ücret)

2. Ajan Kayıt Stake'i
   Her ajan minimum 1000 XLM stake kilitler
   → Protokol güvenliği + likidite

3. Slash Geliri
   Başarısız doğrulamalarda kesilen stake (%10)
   → Protokol hazinesine

4. SDK Lisansı (gelecek)
   Premium: öncelikli doğrulama, gelişmiş analitik
```

---

## 20. Rakip Analizi (Stellar Ekosistemi)

(Detaylı analiz Bölüm 6'da yapıldı. Burada özet matris:)

```
                            Oort    OZ Smart   Policy   ERC-8004  Trustless  ROZO
                            Prot.   Accounts   Signer   /8004     Work       Intents
                            ─────   ────────   ──────   ────────  ────────   ──────
Pre-execution doğrulama      ✅       ❌         ⚠️        ❌        ❌         ❌
Multi-source oracle          ✅       ❌         ❌         ❌        ❌         ❌
Escrow fon koruması          ✅       ❌         ❌         ❌        ✅         ✅
Footprint analizi            ✅       ❌         ❌         ❌        ❌         ❌
Commit-reveal                ✅       ❌         ❌         ❌        ❌         ❌
İtibar sistemi               ✅       ❌         ❌         ✅        ❌         ❌
Stake/slash                  ✅       ❌         ❌         ❌        ❌         ❌
Trading-specific             ✅       ❌         ❌         ❌        ❌         ❌
```

---

## 21. Hackathon MVP Kapsamı ve Takvim

### MVP'de VAR / YOK

| Bileşen | MVP'de VAR | V2 Roadmap |
|---|---|---|
| **oort-core kontratı** | register, vault, commit, verify, refund, slash | Proxy upgrade pattern |
| **PriceVerifier** | Multi-source oracle (Reflector + SDEX TWAP) | DIA + Band eklenmesi |
| **BalanceVerifier** | SEP-41 balance() kontrolü | Tüm token standartları |
| **FootprintVerifier** | simulateTransaction footprint analizi | Gelişmiş footprint scoring |
| **SpendingLimitPolicy** | Günlük harcama limiti | Haftalık/aylık |
| **ContractWhitelistPolicy** | İzinli kontrat listesi | Dinamik whitelist |
| **SlippageGuardPolicy** | Min output kontrolü | Adaptif slippage |
| **Oort SDK** | Temel commit-verify-execute akışı | Tam framework entegrasyonları |
| **HonestBot** | Oracle + Phoenix ile dürüst swap | Çoklu strateji |
| **LiarBot** | Sahte fiyat iddiası ile yakalanan bot | Çeşitli saldırı vektörleri |
| **Oort Terminal UI** | Doğrulama akışı + itibar tablosu | Detaylı analitik |

### MVP'de YOK (V2 Roadmap — Bölüm 22)

| Bileşen | Neden Ertelendi |
|---|---|
| Standing Escrow | Sermaye verimliliği, MVP'de gereksiz |
| DrawdownPolicy | Portföy takibi karmaşık |
| Meta-Politika | Ajan self-adjustment lüks özellik |
| Circuit Breaker | Demo'da gösterilmesi zor |
| CAP-71 Custom Account Vault | Elegant ama karmaşık |
| ERC-8004 entegrasyonu | Ekosistem uyumu, sonraya |
| ManipBot + YieldBot | 2 demo bot yeterli |

### Demo Botlar

| Bot | Davranış | Beklenen Sonuç |
|-----|----------|----------------|
| **HonestBot** | Gerçek oracle fiyatları, meşru iddialar | Onaylandı ✅ |
| **LiarBot** | Fiyatı %313 yüksek iddia eder | Reddedildi ❌ (oracle uyuşmazlığı) |

### Jüri Demo Akışı (3 Dakika)

```
Dakika 0:00 — Problem (30 saniye)
  "Stellar'da 260+ AI ajan projesi ama hiçbirinde doğrulama yok.
   YieldBlox $10.2M kaybetti — simulateTransaction bunu engelleyemezdi."

Dakika 0:30 — Çözüm (30 saniye)
  "Oort Protocol: escrow-bazlı, multi-source oracle doğrulama +
   Stellar-native footprint analizi — 4 katmanlı güvenlik"

Dakika 1:00 — Canlı Demo Sahne 1 (45 saniye)
  HonestBot → commit → Oracle doğruladı ✅ → swap gerçekleşti → yeşil

Dakika 1:45 — Canlı Demo Sahne 2 (45 saniye)
  LiarBot → commit → Oracle uyuşmadı ❌ → fonlar iade → kırmızı alarm
  "Kullanıcı 0 kayıp. Ajan stake kaybetti."

Dakika 2:30 — Pazar + Vizyon (30 saniye)
  "Nava Arbitrum'da $8.3M aldı — Stellar'da bu boşluğu dolduruyoruz.
   Stellar'ın footprint'i bunu diğer zincirlerden daha güçlü yapıyor."
```

---

## 22. V2 Roadmap

### V2 Özellikleri (Hackathon Sonrası)

| Özellik | Açıklama | Öncelik |
|---|---|---|
| **Standing Escrow** | Sürekli açık escrow — DCA/bot dostu, per-tx limit | Yüksek |
| **DrawdownPolicy** | Portföy max düşüş limiti | Yüksek |
| **Circuit Breaker** | Piyasa çöküşünde otomatik dondurma | Yüksek |
| **Meta-Politika** | Ajan kendi limitlerini ceiling dahilinde ayarlama | Orta |
| **CAP-71 Custom Account** | Vault = Custom Account, delegated auth | Orta |
| **ERC-8004 Entegrasyonu** | Post-execution doğrulama sonuçlarını 8004 registry'ye yaz | Orta |
| **DIA Oracle Eklenmesi** | 3. bağımsız oracle kaynağı (mainnet hazır olduğunda) | Orta |
| **ManipBot** | Hash değiştirme denemesi ile yakalanan demo bot | Düşük |
| **YieldBot** | Blend vault APY doğrulama + deposit demo | Düşük |
| **MPP Entegrasyonu** | Machine Payments Protocol session'ları ile doğrulama | Düşük |
| **x402 Middleware** | x402 ödeme yapan ajanlar için otomatik doğrulama katmanı | Düşük |

---

## 23. Bilinen Sınırlamalar ve Dürüst Değerlendirme

### Guardrails vs. Constraints

- **Guardrails** = Ajanın off-chain kodundaki `if risk > threshold: stop()` kuralları. Ajan hacklenirse atlanabilir. (Stellar AI Agent Kit Policy Signer bu kategoride)
- **Constraints** = On-chain akıllı kontrattaki deterministik kurallar. Ajan ne yaparsa yapsın, kontrat izin vermezse işlem gerçekleşmez.

Oort Protocol **Constraints** kategorisindedir. Oort Vault + Oort Guard on-chain'de çalışır.

### Oort Neyi YAPMAZ

| Sınırlama | Açıklama |
|---|---|
| **Strateji kalitesini değerlendirmez** | "RSI 28'de al" iyi bir strateji mi? Oort bunu yargılamaz. Sadece "RSI 28" iddiasının doğru olup olmadığını kontrol eder. |
| **Off-chain veriyi doğrulayamaz** | Twitter sentiment, haber verisi gibi off-chain kaynaklar doğrulanamaz. |
| **AI reasoning kalitesini ölçmez** | "Bu ajan zeki mi?" sorusunu cevaplamaz. |
| **Latency maliyeti vardır** | CVE akışı ~15 saniye ekler. HFT için uygun değil. |
| **Oracle kapsamına bağlı** | Oracle'ların desteklemediği asset'ler için fiyat doğrulama yapılamaz. |

### Stellar-Spesifik Kısıtlar

| Kısıt | Açıklama | Durum |
|---|---|---|
| **~5 sn ledger close** | CVE döngüsü ~15 saniye | Ajan ticareti için yeterli, HFT için değil |
| **Temporary Storage TTL** | Expire olunca kalıcı silme | ✅ Avantaja dönüştü — self-cleaning |
| **Kontrat boyutu limiti** | 64KB WASM | Modüler mimari ile yönetilebilir |
| **Oracle ekosistemi** | EVM'ye göre daha küçük | Reflector + Band + SDEX TWAP yeterli |
| **DeFi ekosistemi** | EVM'ye göre daha küçük | Phoenix + Blend + Aquarius mevcut |

### Adreslenebilir Pazar

- AI ajan ticareti büyüyen ama henüz olgunlaşmamış bir pazar
- Stellar'da 260+ agentic proje → talep var
- YieldBlox $10.2M exploit → güvenlik ihtiyacı kanıtlanmış
- Nava'nın Arbitrum'da $8.3M yatırım alması → konsept doğrulanmış
- Eliza Labs + Stanford araştırma ortaklığı → kurumsal ilgi artan

---

## 24. Stellar Ağ Konfigürasyonu ve Deploy Rehberi

### Ağ Bilgileri

```json
{
  "testnet": {
    "networkPassphrase": "Test SDF Network ; September 2015",
    "horizonUrl": "https://horizon-testnet.stellar.org",
    "sorobanRpcUrl": "https://soroban-testnet.stellar.org",
    "friendbotUrl": "https://friendbot.stellar.org",
    "explorerUrl": "https://stellar.expert/explorer/testnet"
  },
  "mainnet": {
    "networkPassphrase": "Public Global Stellar Network ; September 2015",
    "horizonUrl": "https://horizon.stellar.org",
    "sorobanRpcUrl": "(ecosystem provider gerekli)",
    "explorerUrl": "https://stellar.expert/explorer/public"
  }
}
```

### RPC Provider'ları (Mainnet)

SDF mainnet için public RPC sunmuyor — ecosystem provider gerekli:

| Provider | Açıklama |
|---|---|
| **QuickNode** | Stellar RPC desteği |
| **Validation Cloud** | Stellar RPC + indexing |
| **Ankr** | Multi-chain RPC |
| **NowNodes** | Stellar endpoint |

### Oracle Kontrat Adresleri (Mainnet)

```
Reflector Oracle (SDEX prices):
  CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M

Reflector Oracle (CEX/DEX prices):
  CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN

Band Protocol:
  CCQXWMZVM3KRTXTUPTN53YHL272QGKF32L7XEDNZ2S6OSUFK3NFBGG5M

DIA Oracle (Testnet):
  CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4
```

### Deploy Komutları

```bash
# 1. Stellar CLI kurulumu
cargo install stellar-cli

# 2. Testnet identity oluştur
stellar keys generate oort-deployer --network testnet
stellar keys fund oort-deployer --network testnet

# 3. Kontrat build
cd contracts/oort-core
cargo build --target wasm32-unknown-unknown --release

# 4. WASM optimizasyonu
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/oort_core.wasm

# 5. Deploy (Testnet)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/oort_core.optimized.wasm \
  --source-account oort-deployer \
  --network testnet

# 6. Kontrat initialize
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account oort-deployer \
  --network testnet \
  -- \
  initialize \
  --admin oort-deployer \
  --xlm_token <XLM_SAC_ID> \
  --usdc_token <USDC_SAC_ID>
```

### Cüzdan Entegrasyonu

```bash
# Frontend paketleri
npm install @creit.tech/stellar-wallets-kit @stellar/freighter-api @lobstrco/signer-extension-api
```

```typescript
// Wallet connection
import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: 'freighter',
  modules: allowAllModules(),
});

await kit.openModal({ onWalletSelected: async (option) => {
  kit.setWallet(option.id);
  const { address } = await kit.getAddress();
  console.log('Connected:', address);
}});
```

### Stellar Ekosistem Entegrasyonları

| Protokol | Kategori | Oort Entegrasyonu |
|---|---|---|
| **Phoenix DEX** | AMM | Swap doğrulama hedef protokolü |
| **SDEX** | Native DEX | TWAP hesaplama kaynağı + swap hedefi |
| **Blend** | Lending | Yield deposit doğrulama |
| **Aquarius** | DEX/AMM | Alternatif swap hedefi |
| **Reflector** | Oracle | Multi-source fiyat kaynağı #1 |
| **Band Protocol** | Oracle | Multi-source fiyat kaynağı #2 |
| **DIA** | Oracle | Multi-source fiyat kaynağı #3 (gelecek) |
| **USDC (Circle)** | Stablecoin | Ana vault token'ı |
| **Stellar Wallets Kit** | Cüzdan | Frontend cüzdan bağlantısı |

---

> **Oort Protocol: Güvenme, Doğrula.**
> **Yapay zeka ajanlarının Stellar'daki veri iddiaları işlem öncesi doğrulanır, fonlar Oort Vault ile korunur.**
> **Stellar-native: Footprint analizi, Temporary Storage ve multi-source oracle ile diğer zincirlerde yapılamayan güvenlik katmanı.**
