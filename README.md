# Harf Adası

Türkçe okuma, yazma ve sayı alıştırmaları için Laravel 13 uygulaması. Altı mevcut oyun bölümü korunur; aynı oyun arayüzü hem Laravel sunucusunda hem GitHub Pages için üretilen statik sürümde çalışır.

## Sürüm 5.1: adanın içinde öğrenme

Ana ada ve dört iç sahne özgün görsellerle yenilendi. Postane, atölye, köprü ve
bahçe gerçek oyun girişleridir; kartlar ve parçalar sahnenin içinde kullanılır.
Pırpır'ın kanat çırpma sprite'ı, bulutlar, deniz halkaları, mektup teslimi,
köprü tahtaları ve sulama hareketleri durdurulabilir; azaltılmış hareket desteklenir.

“Devam et” bitirilen kelime/heceyi ve son beceriyi sonraki plana taşır. Sonraki
turlar kelime ve görev sırasını değiştirir; üç yazılmış hikâye arasında ilerler:
Kayıp Bahçe Mektubu, Pırpır'ın Bahçe Pazarı ve Fener Şenliği. Gerekli 77 sabit metnin
hazır Türkçe kaydı vardır; bunlar ChatGPT Voice sesiyle üretilmiş değildir.

## Hikâyeli öğrenme yolculuğu

- **Özgün animasyonlu hikâye:** Alparslan ve Kayıp Bahçe Mektubu; tamamlanan görevlerle değişen beş sahne, karakterler, açıkça başlatılan Türkçe anlatım ve azaltılmış hareket desteği.
- **Öğretmenin kelimeleri:** birden fazla kelime listesi, toplu giriş, düzenlenebilir heceler, isteğe bağlı anlam ve cümle. İşlenmemiş harf içeren kelimeler açıkça gösterilir.
- **Bağlı ve uyarlanan çalışmalar:** dinleme, heceleme, kelime kurma, örneksiz hatırlama, yetişkinle yazı kontrolü ve uygun anlam/cümle görevleri. Yardım ve hata kayıtları sonraki desteği etkiler.
- **Hatırlama takibi:** aynı kelime farklı görevlerde geri gelir; sonraki günlere yayılan bağımsız hatırlama, ilk günkü tamamlamadan ayrı izlenir. Çalışılan harflerin yazma ve kart sıralama gözlemleri de ayrıca izlenir.
- **Kaldığın yerden devam:** görev sırası, ipucu kayıtları ve sınırlı yazı taslağı bu tarayıcıda; Laravel'de ayrıca oturuma ayrılmış şifreli kayıt içinde korunur.

[Araştırma ve tasarım kararları](docs/learning-design.md), kullanılan kaynakları, uyarlama kurallarını ve sınırlarını açıklar. Bu kurallar kendini yeniden yazan yapay zekâ veya öğrenme güçlüğü tanısı değildir. Yeni öğretmen kelimelerinde kayıt yoksa gerçek Türkçe cihaz sesi ya da yetişkin okuması kullanılır; her yeni kelime için sunucuda otomatik ses üretimi yoktur.

## Korunan oyunlar ve araçlar

- **Yazı stüdyosu:** tablet ekranına sığan defter, yazarken sayfa kaydırma kilidi, Safari için pasif olmayan dokunma koruması, çoklu parmak ayrımı ve yön değişimine uyum.
- **Türkçe anlatım:** EmelNeural ile üretilmiş yerel MP3 kayıtları. `nine` dahil hazır kelimeler cihazın İngilizce sesine bırakılmaz; yedek ses yalnızca gerçekten Türkçe bir ses varsa kullanılır.
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
npm run test:unit
node tests/learning.spec.cjs
node tests/island.spec.cjs
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
python scripts/complete-story-speech.py
python scripts/download-illustrations.py
```

Ses üreteci kayıtları önbelleğe alır ve TLS doğrulamasını açık tutar. Dört efekt bu proje için dalga senteziyle üretildi. 112 görsel, [Microsoft Fluent Emoji 3D](https://github.com/microsoft/fluentui-emoji) koleksiyonundan MIT lisansıyla gelir; lisans kopyası `public/illustrations/LICENSE.microsoft.txt` içindedir. Howler, canvas-confetti, Lucide, Vite ve Laravel paket sürümleri kilit dosyalarındadır.

Yeni ada/sahne resimleri ve Pırpır sprite atlası bu proje için üretildi;
`public/art/` altında bulunur. Nunito Sans değişken yazı tipi Fontsource üzerinden
yerel sunulur; OFL lisansı `public/fonts/LICENSE.NunitoSans.txt` içindedir.
