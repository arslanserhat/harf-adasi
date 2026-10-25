# Harf Adası — güncel devir notu

## Geçerli kapsam

Kullanıcı mevcut altı bölümü koruyarak uygulamayı **Laravel** projesine dönüştürmemizi istedi. Adı Harf Adası kalır. Başlıca gerçek cihaz sorunları: iPad Safari'de yazarken sayfanın kayması, İngilizce cihaz sesinin `nine` kelimesini yanlış okuması ve daha iyi ses/görsel geri bildirim ihtiyacı.

Yalnızca `arslanserhat/harf-adasi` üzerinde çalış. Başlangıç dalı `main`; diğer depolarda veya mevcut e-Tahlil uygulamasında değişiklik yapma. Kaynak artık tek bir HTML içinde değildir; eski tek dosyalı sürümü yeniden kopyalama.

## Kaynak ve mimari

- `src/game.js`: mevcut altı bölümün oyun kuralları, manuel Devam ve ebeveyn onayı.
- `src/writing.js` / `writing.css`: tam ekrana sığan yazı alanı, Safari Touch Events koruması, kaydırma kilidi ve çıkışta eski kaydırmanın geri gelmesi. Çizim koordinatları SVG ekran matrisiyle dönüştürülür.
- `src/audio.js`: Howler, yerel Türkçe kayıtlar, yalnızca Türkçe cihaz sesi yedeği, ses/efekt ayarları.
- `src/visuals.js`: yerel Fluent 3D görseller ve erişilebilir arayüz dönüşümü.
- `src/progress-sync.js`: Laravel'de oturuma ait ilerleme ve CSRF ile tamamlama/sıfırlama; statik sürümde yerel kayıt.
- `resources/views/game.blade.php`, `routes/web.php`, `app/`, `database/`: gerçek Laravel 13 backend.
- `public/audio`: 362 Türkçe kayıt / 491 metin eşleştirmesi, dört özgün efekt.
- `public/illustrations`: 112 Microsoft Fluent 3D çizimi ve MIT lisansı.

PHP kilitli paketleri PHP 8.4.1+ ister; üretim Docker imajı FrankenPHP/PHP 8.5 kullanır. Node 22, Vite, Howler, canvas-confetti ve Lucide kullanılır. `.env`, gerçek anahtarlar, veritabanı ve vendor/build çıktıları Git'e eklenmez.

## Derleme ve kontroller

`npm run build` Pages için `dist/` üretir; `npm run build:laravel` Laravel için `public/build/` üretir. PHP giriş dosyası Pages artefaktından çıkarılır. `npm run dev` Laravel Vite entegrasyonunu, `npm run dev:static` statik arayüz geliştirmesini açar.

`php artisan test`, `node tests/audio-unit.cjs`, `npm run build && node tests/tablet.spec.cjs` komutlarını kullan. `TEST_VIEWPORT=768x1024`, `TEST_FILTER` ve `TEST_BASE_URL` incelemeyi sınırlayabilir. Gerçek dokunma testleri CDP girdi kullanır; uygulamaya doğru cevap/başarı durumu enjekte edilmez.

29 harfin büyük/küçük biçimleri, hece/kelime/cümle sırası, `anne/etti/inat`, okuma-resim, 0/10 sayma, `100` için ayrı sıfır kartları, çizim iptal/yeniden çizme, boş-yanlış çizim reddi, mola, ayarlar ve kayıt sınanmalı. `ı/i`, `I/İ`, `ç/ş/ğ/ö/ü` korunmalı. Serbest yazı otomatik tanınmaz; ebeveyn onayı açık kalmalı.

## Yayın ve doğruluk

Pages workflow'u yalnızca Vite'nin statik çıktısını yayımlar. PHP ve sunucu veritabanı GitHub Pages'te çalışmaz. Laravel VPS yayını için `docs/deploy.md` ve ayrı uygulama Compose servisini kullan; mevcut uygulamanın portlarını, veritabanını veya vhost'unu ezme.

Bu ortamda e-Tahlil sunucu adresi bulunmuştur; ancak bağlı SSH anahtarı/agent ve kullanılabilir izinli TCP yolu yoktur. VPS'ye bağlanıldığını veya Laravel'in orada yayımlandığını iddia etme. Erişim bilgilerini sohbete veya depoya yazma.

Workflow success, HTTP 200 veya tek görüntü tek başına oynanabilirlik kanıtı değildir. Canlı HTTPS adreste doğru yeni varlıkları ve en az bir tamamlanmış etkileşimli turu doğrula. Fiziksel iPad, WebKit ve duyulan ses kalitesi otomasyonla doğrulanmadıysa ayrı belirt. Kullanıcıya Türkçe yanıt ver.
