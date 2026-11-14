# Diyet

Diyetisyen planını takip eden kişisel PWA. iPhone'da ana ekrana eklenip uygulama gibi kullanılıyor. Kullanıcıyla Türkçe konuş; arayüz metinleri de Türkçe.

- Canlı: https://fdemirci52.github.io/diyet/ (GitHub Pages, `main` dalı, repo herkese açık)
- Derleme adımı yok, bağımlılık yok. Dosyayı düzenle, tarayıcıda yenile.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | Tüm CSS + iskelet (`#app`, `#dock`, `.scrim`, `#sheet`, gizli `#cam` ve `#file` inputları) |
| `app.js` | Veri, motor, görünümler, olay işleyiciler; tek dosya |
| `sw.js` | Service worker, önce ağ; önbellek yalnızca çevrimdışıyken |
| `manifest.json`, `icon-*.png` | PWA kimliği |

## Çalıştırma ve yayın

- Önizleme: `.claude/launch.json` içindeki `diyet` (python http.server, port 4173). Mobil görünümde, açık ve koyu temada kontrol et.
- Yayın: `main`'e push. **Her yayında `sw.js` içindeki `const C = 'diyet-N'` sayısını bir artır**, yoksa telefonda eski sürüm kalabilir.
- Push'tan sonra doğrula: `curl -s https://fdemirci52.github.io/diyet/sw.js | grep diyet-` yeni sayıyı göstermeli (1-2 dakika sürebilir).
- Commit ve push'u kullanıcı isteyince yap.

## app.js yapısı (yukarıdan aşağı)

1. **Veri:** `MAINS` (ana yemekler; grup `g`, kcal `k`, protein `p`, muadiller `subs`), `QUOTA` (haftalık ana yemek kotası), `ROTA` (varsayılan haftalık dağılım), `MEALS` (sabah, kahvalti, ogle, ikindi, aksam, gece), `RULES`, `SWAPS`, `BODY`, `WORKOUTS` (1 = Pzt üst, 3 = Çar alt, 5 = Cum full body), hedef sabitleri, `AI_MODEL`.
2. **Durum:** `localStorage['diyet-v1']` → `S = { days: { 'YYYY-MM-DD': { items, main, mode, extras, water, coffee, walk, gym, z2 } }, weights }`. Öğe anahtarı `'ogun.oge'`, durum `done | skip | swap`. API anahtarı ayrı tutulur (`diyet-ai-key`) ve yedeğe girmez.
3. **Motor:** `mainFor` (kalan haftalık kotayı dağıtır, aynı gün iki öğüne aynı grubu vermez), `balance` (günün kalori/protein açığı), `adjust` (telafi önerileri: açıkta protein/ekmek/ara öğün ekler, fazlada salata-yağ-ekmekten kısar, proteinden asla kısmaz).
4. **Görünümler:** `todayView` (zaman çizelgesi), `weekView`, `planView` + `progSheet`; `render()` hepsini ve alt çubuğu basar.
5. **Alt sayfalar ve yapay zekâ:** `openSheet`, `writeSheet`, `analyze` (fotoğraf veya yazıdan öğün kaydı), `resultSheet`, `applyAI`.
6. **Olaylar:** tek bir delegeli `click` dinleyicisi, `data-act` üzerinden `switch`; sonunda `save(); render();`.

Şema değişirse eski `diyet-v1` kayıtlarını bozma: kullanıcının telefonunda gerçek veri var. Yeni alanlara varsayılan değer ver.

## Yapay zekâ çağrısı

Tarayıcıdan doğrudan `https://api.anthropic.com/v1/messages`; kullanıcı kendi anahtarını uygulamada girer. Model `claude-sonnet-5-5` (kullanıcının tercihi; fotoğraf ve yazı için aynı). Yapılandırılmış çıktı `output_config.format` + `SCHEMA` ile. Fotoğraf canvas'ta en çok 1280 px'e küçültülür.

Bu çağrı gerçek anahtarla hiç denenmedi, yalnızca sahte `fetch` ile test edildi. İlk gerçek kullanımda hata çıkarsa istek biçimini güncel API belgelerinden doğrula.

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
