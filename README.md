# Harf Adası

Türkçe okuma, yazma ve sayı alıştırmaları için Laravel 13 uygulaması. Altı mevcut oyun bölümü korunur; aynı oyun arayüzü hem Laravel sunucusunda hem GitHub Pages için üretilen statik sürümde çalışır.

## Bu sürüm

- **Yazı stüdyosu:** tablet ekranına sığan defter, yazarken sayfa kaydırma kilidi, Safari için pasif olmayan dokunma koruması, çoklu parmak ayrımı ve yön değişimine uyum.
- **Türkçe anlatım:** EmelNeural ile üretilmiş 362 yerel MP3, 491 metin eşleştirmesi. `nine` dahil kelimeler cihazın İngilizce sesine bırakılmaz; yedek ses yalnızca gerçekten Türkçe bir ses varsa kullanılır.
- **Geri bildirim:** dört yumuşak oyun efekti, ses düzeyi/efekt ayarları, sesli “Tebrikler, başardın!” ve azaltılmış hareket tercihine uyan kutlama.
- **Görseller:** platform emojileri yerine yerel 3D çizimler, Lucide arayüz ikonları, çıkartmalar ve öğrenme özeti.
- **Laravel ilerlemesi:** tarayıcı oturumuna ayrılmış kayıtlar, doğrulanan JSON API, CSRF, tekrar gönderimde çift kayıt oluşturmayan tamamlama ve mevcut tarayıcıya ait sıfırlama.

29 harfin büyük/küçük biçimi, 48 hece, 80 kelime, okuma-resim eşleştirme, 17 kısa cümle, 0–9 çizimi, 0–10 nesne sayma ve 0–100 sayı oluşturma içerir. Çocuk **Devam** demeden sonraki adıma geçilmez. Serbest yazı otomatik doğru sayılmaz; ebeveyn birlikte kontrol eder.

## Geliştirme

Node.js 22+, Composer ve kilitli PHP paketleri için PHP 8.4.1+ gerekir. Docker kurulumunda PHP 8.5 kullanılır.

```sh
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
npm ci
npm run build:laravel
php artisan serve
```

`http://localhost:8000/` adresini açın. Ön yüz geliştirme sunucusu için ayrı terminalde `npm run dev` kullanılabilir.

## Kontroller

```sh
php artisan test
npm run build
node tests/audio-unit.cjs
node tests/tablet.spec.cjs
```

PHP testleri SQLite `:memory:` kullanır. Tarayıcı testleri `dist/` çıktısını `/harf-adasi/` altında 768×1024 ve 1024×768 dokunmatik Chromium görünümünde çalıştırır. `CHROMIUM_EXECUTABLE_PATH` ile tarayıcı seçilir; `TEST_FILTER` senaryoları sınırlar. `TEST_BASE_URL` canlı adresi hedefler ve yerel adrese geri dönmez. Fiziksel iPad, WebKit ve insan tarafından dinlenmiş ses kalitesi bu otomasyonla kanıtlanmaz.

## Yayın

`npm run build` statik Pages çıktısını `dist/` içine, `npm run build:laravel` PHP sunucusunun Vite varlıklarını `public/build/` içine hazırlar. Pages artefaktında PHP giriş dosyası veya Laravel sunucu kodu bulunmaz. PHP API ve sunucu veritabanı GitHub Pages'te çalışmaz; statik sürüm tarayıcı kaydını kullanır.

VPS kurulumu, kalıcı SQLite volume'u ve ayrı uygulama portu için [yayın belgesi](docs/deploy.md); API için [backend belgesi](docs/backend-api.md) kullanılır. Mevcut e-Tahlil uygulaması üzerinde değişiklik yapılmaz. HTTPS yayınını tamamlandı saymak için deployment kaydına ek olarak gerçek adreste etkileşimli bir oyun turu doğrulanmalıdır.

## Ses ve görsel kaynakları

Çalışan oyunun ses üretim servisine ihtiyacı yoktur; MP3 ve WAV dosyaları yerel olarak sunulur. Geliştirmede ses paketini yenilemek için:

```sh
python -m pip install -r scripts/requirements-audio.txt
python scripts/generate-speech.py
python scripts/download-illustrations.py
```

Ses üreteci kayıtları önbelleğe alır ve TLS doğrulamasını açık tutar. Dört efekt bu proje için dalga senteziyle üretildi. 112 görsel, [Microsoft Fluent Emoji 3D](https://github.com/microsoft/fluentui-emoji) koleksiyonundan MIT lisansıyla gelir; lisans kopyası `public/illustrations/LICENSE.microsoft.txt` içindedir. Howler, canvas-confetti, Lucide, Vite ve Laravel paket sürümleri kilit dosyalarındadır.
