# Harf Adası

Alparslan ile Türkçe okuma, yazma ve sayı alıştırmaları. Mevcut oyun tek `index.html` içinde çalışır; üretimde framework, paket kurulumu, hesap veya sunucu gerektirmez.

## Oyunun bölümleri

- 29 Türkçe harfin büyük/küçük biçimleri: eşleştirme, iz sürme, serbest yazma.
- 48 hece ve 80 kelime: sıralı harf kartları ve birlikte yazma.
- Kelimeyi okuyup resmini bulma; 17 kısa cümlede kelime sıralama.
- 0–9 rakam çizimi, 0–10 nesne sayma ve 0–100 sayı oluşturma.
- Mola, ebeveynin harf seçimi, çıkartmalar ve tarayıcıda ilerleme kaydı.

Sonraki adıma çocuk **Devam** ile geçer. Serbest el yazısı otomatik olarak doğru sayılmaz; ebeveynin birlikte kontrol etmesi gerekir. Türkçe seslendirme cihazın konuşma motoruna bağlıdır. İlerleme yalnızca aynı tarayıcıda saklanır; depolama veya ses kullanılamasa da oyun devam eder.

## Yerel açılış

```sh
python3 -m http.server 4173
```

Tarayıcıda `http://localhost:4173/` adresini açın.

## Tablet regresyon testleri

Node.js 20+ gerekir. Paketler yalnızca geliştirme/test içindir:

```sh
npm ci
npx playwright install --with-deps chromium
npm test
```

Sistem Chromium'u varsa testler onu kullanır; `CHROMIUM_EXECUTABLE_PATH` ile değiştirilebilir. Testler kendi yerel HTTP sunucusunu açar ve `/harf-adasi/` alt yolunda 768×1024 ve 1024×768 görünümünde Chromium'un gerçek dokunma girdisini taklit eder. `TEST_BASE_URL` ile aynı testler canlı siteye yönlendirilebilir; `TEST_FILTER` senaryo adına göre sınırlar. Başarısızlık görüntüleri `test-results/` içine yazılır.

Bu emülasyon fiziksel iPad testi veya sesin duyulduğu anlamına gelmez. WebKit için gereken sistem kütüphaneleri bu çalışma ortamında eksik olduğundan WebKit testi yapılamadı.

## GitHub Pages

Depo ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilir. `main` güncellenince `pages.yml` yalnızca `index.html` ve `.nojekyll` dosyalarını yayımlar. Testler ve devir notu yayın artefaktına dahil edilmez. Eski tek seferlik aktarım workflow'u kaldırılmıştır; oyun başka bir depodan yeniden alınmaz.

Başarılı workflow tek başına oynanabilirlik kanıtı değildir. Teslim için deployment kaydına ek olarak gerçek HTTPS sayfası açılmalı, oyun içeriği ve en az bir etkileşimli turun tamamlanması doğrulanmalıdır.
