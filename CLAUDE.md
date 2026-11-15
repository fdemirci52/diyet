# Diyet

Diyetisyen planını takip eden kişisel PWA. iPhone'da ana ekrana eklenip uygulama gibi kullanılıyor. Kullanıcıyla Türkçe konuş; arayüz metinleri de Türkçe.

- Canlı: https://fdemirci52.github.io/diyet/ (GitHub Pages, `main` dalı, repo herkese açık)
- Derleme adımı yok, bağımlılık yok. Dosyayı düzenle, tarayıcıda yenile.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | Tüm CSS + iskelet (`#app`, `#dock`, `.scrim`, `#sheet`, gizli `#cam` ve `#file` inputları) |
| `plan.js` | Varsayılan diyetisyen programı (`PLAN_DEFAULT`): saf JSON. Uygulama ile ileride yapılacak diyetisyen paneli arasındaki sözleşme. Bağlantıyla yüklenen program `localStorage['diyet-plan']` içinde durur ve bunun yerine geçer |
| `foods.js` | Yerel yemek kütüphanesi (`FOODS`): yaklaşık 160 yaygın yemek ve içecek, porsiyon başına yaklaşık kcal ve protein |
| `app.js` | Motor, görünümler, olay işleyiciler; plan verisini yalnızca okur |
| `sw.js` | Service worker, önce ağ; önbellek yalnızca çevrimdışıyken |
| `server/` | Yapay zekâ vekili (Cloudflare Worker): `worker.js`, `wrangler.toml`, kurulum ve davet kodu komutları `README.md`'de |
| `manifest.json`, `icon-*.png` | PWA kimliği |

## Çalıştırma ve yayın

- Önizleme: `.claude/launch.json` içindeki `diyet` (python http.server, port 4173). Mobil görünümde, açık ve koyu temada kontrol et.
- Yayın: `main`'e push. **Her yayında `sw.js` içindeki `const C = 'diyet-N'` sayısını bir artır**, yoksa telefonda eski sürüm kalabilir.
- Push'tan sonra doğrula: `curl -s https://fdemirci52.github.io/diyet/sw.js | grep diyet-` yeni sayıyı göstermeli (1-2 dakika sürebilir).
- Commit ve push'u kullanıcı isteyince yap.

## app.js yapısı (yukarıdan aşağı)

1. **Plandan türetilenler:** `PLAN` (`plan.js`), `MEALS` (kalem kimlikleri `PLAN.items` kataloğundan nesneye açılır), `MAINS`, `GROUPS` (haftalık kota), `ROTA`, `MAIN_MEALS`, `TRAIN`/`WORKOUTS`, gün boyu hedefler, `AI_MODEL`. Planda değişiklik `plan.js`'te yapılır; `app.js`'te öğün ya da kalem kimliği sabit yazılmaz.
2. **Durum:** `localStorage['diyet-v1']` → `S = { days: { 'YYYY-MM-DD': { items, main, mode, extras, water, coffee, walk, gym, z2 } }, weights, foods }`. Öğe anahtarı `'ogun.oge'`, durum `done | skip | swap`. Önceden planlanan sapmada extras ve atlanan kalemler `pl: true` taşır (extras ayrıca ölçeksiz değerler için `src`); motor onları yenmiş sayar, "Yedim" ile bayrak kalkar. `foods` kullanıcının kendi gıda arşivi, anahtar `fold(ad)`: `{ n, u, k, p, c, t, m, own?, img? }` (k ve p bir porsiyon için; `own` kullanıcı girdi, yapay zekâ üstüne yazmaz; `img` 160 px küçük resim). Yoksa boş sayılır. Yedeğe girmeyen ayrı anahtarlar: `diyet-ai-key` (API anahtarı), `diyet-ai-use` (aylık token ve maliyet sayacı), `diyet-chat` (günün sohbeti), `diyet-ai-ok` (yapay zekâ veri paylaşım onayının tarihi).
Diyetisyen ayarları planın içinde: `PLAN.prefs.kcal` (`KC`: danışan kalori sayılarını görür mü; motor her durumda hesaplar), `PLAN.prefs.tune` (`TUNE_ON`: telafi önerileri), `PLAN.dietitian.phone` (haftalık rapor WhatsApp'a açılır). Program bağlantısı sayfasından düzenlenir; değişiklik programı `diyet-plan`'a yazar.

3. **Motor:** `mainFor` (kalan haftalık kotayı dağıtır, aynı gün iki ana öğüne aynı grubu vermez), `balance` (günün kalori/protein açığı), `adjust` (telafi: eşikler kodda, ne önerileceği `PLAN.tune` içinde; açıkta protein/ekmek/ara öğün ekler, fazlada `tune.cuts` sırasıyla kısar, proteinden asla kısmaz).
4. **Görünümler:** `todayView` (zaman çizelgesi), `weekView`, `planView` + `progSheet`; `render()` hepsini ve alt çubuğu basar.
5. **Alt sayfalar ve yapay zekâ:** `openSheet`, `analyze` (fotoğraf veya yazıdan öğün kaydı), `resultSheet`, `applyAI` (tanınanları `remember` ile kütüphaneye yazar). **Hızlı kayıt** (`quickSheet`, `qFind`, `qSave`): öğündeki kalem düğmesi açar; önce `S.foods`, sonra `FOODS`, en son açık bir "Yapay zekâyla işle" satırı. **Asistan** (`openChat`, `chatSend`, `dayContext`): Bugün başlığındaki düğme; sistem isteminde plan, her soruda `<durum>` içinde günün kaydı. **Kullanım sayacı** (`track`): her çağrının `usage` değerini aylık toplar. **Gıdalarım** (`foodsSheet`, `foodForm`, `foodAI`): Program'dan ya da hızlı kayıttaki "Yeni gıda ekle"den açılır; fotoğraf (`#pic`) ya da adla yapay zekâ doldurur. **Program bağlantısı** (`packPlan`, `unpackPlan`, `planCheck`, `planSheet`): `#plan=<kod>` bağlantısı, kod deflate-raw + base64url. iOS'ta ana ekran uygulaması Safari'den ayrı depolama kullanır; bu yüzden bağlantı uygulama içine yapıştırılarak da yüklenir. Yedek, yüklenmiş programı da taşır. **Önceden planlı sapma** (`planned`, `qLater`): saati 30 dakikadan uzak öğünde hızlı kaydın ana düğmesi "Planla" olur. **Haftalık rapor** (`weekReport`, `reportSheet`): Hafta sekmesinin altında; yerelde üretilen WhatsApp biçimli metin, kâğıt takip tablolarının yerine. **Yapay zekâ bağlantısı** (`aiFetch`, `aiJSON`, `aiErr`): bütün çağrılar buradan geçer; sunucu vekiline geçişte değişecek tek yer. **Rıza** (`aiReady`, `consentSheet`): her yapay zekâ özelliği önce anahtar, sonra açık rıza ister.
6. **Olaylar:** tek bir delegeli `click` dinleyicisi, `data-act` üzerinden `switch`; sonunda `save(); render();`.

Planı ya da motoru yeniden düzenlerken davranışın değişmediğini, aynı rastgele durumlar için eski ve yeni kodun tüm görünümlerini karşılaştırarak doğrula (vm içinde çalıştırılan bir anlık görüntü betiğiyle).

Şema değişirse eski `diyet-v1` kayıtlarını bozma: kullanıcının telefonunda gerçek veri var. Yeni alanlara varsayılan değer ver.

## Yapay zekâ çağrısı

İki yol, ikisi de `aiFetch`'ten geçer: davet kodu varsa ve `PROXY_URL` doluysa vekile (`server/worker.js`: model izin listesi, araç yok, `max_tokens` ≤ 16000, kod başına aylık dolar bütçesi KV'de, yalnızca `ORIGINS` kökenleri); yoksa kullanıcının kendi anahtarıyla doğrudan `https://api.anthropic.com/v1/messages`. Vekil yayında: `https://diyet-api.basedchimpers.workers.dev` (Cloudflare hesabı basedchimpers; bu projenin wrangler oturumu ayrı: komutlardan önce `export XDG_CONFIG_HOME=$HOME/.diyet-cloudflare`). Davet kodları erişim anahtarıdır: repoya, belgeye ya da commit mesajına yazma. Vekili değiştirirken sahte Anthropic ve bellekte KV ile yerel Node sarmalayıcısında uçtan uca dene. Rıza metni hukuki incelemeden geçmedi. Öğün analizi `claude-sonnet-5-5` (kullanıcının tercihi; fotoğraf ve yazı için aynı). Asistan `claude-haiku-5-5`: akışlı (SSE), düşünme kapalı, efor `low`, sistem istemi `cache_control` ile önbellekli. Asistan ve yazıdan öğün analizi canlı vekil üzerinden gerçek istekle çalıştı (15 Kasım 2026; ölçülen maliyet: Sonnet öğün analizi ~0,009 $, Haiku asistan sorusu ~0,0003 $). Yapılandırılmış çıktı `output_config.format` + `SCHEMA` ile. Fotoğraf canvas'ta en çok 1280 px'e küçültülür.

Yazıyla kayıt gerçek anahtarla çalıştı (14 Kasım 2026). Fotoğraf yolu gerçek anahtarla henüz doğrulanmadı.

## Tasarım kuralları

Kullanıcı arayüz kalitesine çok önem veriyor; "tek seferde üretilmiş" görünen işi geri çevirdi. Değişiklikleri ekran ekran, gerçek veriyle ve iki temada kontrol et.

- 4 pt ızgara. Köşe yarıçapı: kart 24, panel 22, kontrol 16-17, hap 999.
- Yazı boyutları: 34 / 22 / 17 / 15 / 13 / 11.
- Tek renkli zemin. **Turuncu yalnızca "şimdi" için** (`#ff6a1a` açık, `#ff7a2f` koyu), mavi yalnızca su için. Başka vurgu rengi ekleme.
- Açık tema: `#f2f2f4` zemin, gölgeli beyaz kartlar. Koyu tema: `#0a0a0b` zemin, `#161618` kartlar, ince çizgi. `prefers-color-scheme` izlenir.
- Alt çubuk: üç sekme sabit genişlikte (`repeat(3, 78px)`), ikon üstte, etiket altta ve her zaman görünür; seçili sekme çubuğun genişliğini değiştirmez. Kamera düğmesi ayrı, turuncu.
- Bir öğünde tek ana düğme ("Hepsini yedim"); yan yana eşit ağırlıkta üç düğme koyma.
- Yeniden çizimde titreme yaratan giriş animasyonu ekleme (`render()` her dakika ve her dokunuşta çalışır).

## Bağlam

- Plan: yaklaşık 2.080 kcal ve 140 g protein. Hedef: önce bel çevresindeki yağı azaltmak, sonra kas ağırlıklı 85 kg.
- Haftada üç gün ağırlık, şimdilik akşam 18:00-19:00; ileride sabaha alınacak (öğün saatleri o zaman güncellenmeli).
- Beslenme ya da antrenman içeriğini değiştiren işlerde plan diyetisyenin planıdır; veriyi kendi başına yeniden yazma, kullanıcıya sor.
