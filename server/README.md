# Diyet API vekili

Cloudflare Worker. Danışanın telefonunda Anthropic anahtarı durmaz; uygulama diyetisyenin verdiği **davet koduyla** bu vekile gelir. Vekil:

- isteği kendi anahtarıyla Anthropic'e iletir,
- yalnızca uygulamanın kullandığı iki modele izin verir (`claude-sonnet-5-5`, `claude-haiku-5-5`),
- her kodun aylık harcamasını sayar ve bütçe dolunca durdurur,
- yalnızca uygulamanın sitesinden gelen isteklere açıktır (`ORIGINS`).

## Kurulum (bir kez)

Bu projenin wrangler oturumu, aynı bilgisayardaki diğer Cloudflare hesaplarından ayrı tutulur. Her komuttan önce:

```bash
export XDG_CONFIG_HOME=$HOME/.diyet-cloudflare
```

Sonra bu klasörde çalıştır:

```bash
npx wrangler login
```

```bash
npx wrangler kv namespace create DIYET
```

Çıkan `id` değerini `wrangler.toml` içindeki `KV_ID` yerine yaz. Sonra Anthropic anahtarını gizli değer olarak gir (komut anahtarı sorar; ekrana yazılmaz):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

```bash
npx wrangler deploy
```

Yayın adresi: `https://diyet-api.basedchimpers.workers.dev` (`app.js` içindeki `PROXY_URL`). Gerçek davet kodlarını bu dosyaya ya da repoya yazma; örnekteki kod uydurmadır.

## Davet kodu ekleme

`usd` aylık bütçedir (dolar). Kod büyük harf ve rakam olsun.

```bash
npx wrangler kv key put --remote --binding DIYET "code:FATIH-7K2M" '{"name":"Fatih","usd":5}'
```

Bu ayki kullanımı görmek:

```bash
npx wrangler kv key get --remote --binding DIYET "use:FATIH-7K2M:2026-11"
```

Kodu iptal etmek:

```bash
npx wrangler kv key delete --remote --binding DIYET "code:FATIH-7K2M"
```
