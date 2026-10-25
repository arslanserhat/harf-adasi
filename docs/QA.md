# Sürüm 4 kontrol kaydı

- Laravel 13.38.0 / PHP 8.5 ortamı: **10 feature testi, 55 assertion geçti**. Oturum ayrımı, gerçek CSRF reddi/onayı, idempotent kayıt ve yalnızca mevcut oturumun sıfırlanması kapsanır.
- `node tests/audio-unit.cjs`: **7/7 geçti**. Kayıtlı `nine`, Türkçe ses seçimi, İngilizce yedeğin reddi, konuşma iptali ve sessize alma kapsanır.
- `npm run build` ve `npm run build:laravel`: başarılı. Statik çıktıda PHP giriş dosyası bulunmaz.
- Dokunmatik Chromium 143: 768×1024 ve 1024×768 görünümlerinde 28 senaryo. İlk toplu çalışmada 27 senaryo geçti; 58 harf çiziminin dikey turunda Docker ağı açılırken `ERR_NETWORK_CHANGED` kaydı yakalandı. Aynı test sabit ağ altında `TEST_VIEWPORT=768x1024 TEST_FILTER='all 58'` ile yeniden çalıştırıldı ve geçti. Son durumda 28 senaryonun tamamı doğrulandı; hata kontrolü susturulmadı.
- Yazı odak modu: dokunma hareketlerinin iptal edilmesi, sayfa kaydırma kilidi, kontrollerin ekrana sığması, yön değiştirme ve gezinirken kilidin bırakılması geçti.
- Ses kapsamı: 80 kelime, `nine`, tebrik kaydı ve dört efekt için yerel dosyalar doğrulandı. Bu, bir insanın ses kalitesini dinlediği anlamına gelmez.
- Üretim Docker imajı `harf-adasi:qa` derlendi. FrankenPHP/PHP 8.5 sunucusunda `/healthz` yanıtı, CSRF ile POST 201 ve oturuma ait GET 200 ilerleme kaydı doğrulandı. Bu testler yerel ortamda yapıldı; VPS yayını değildir.

Fiziksel iPad, gerçek Safari/WebKit ve insan tarafından dinlenmiş ses doğrulaması yapılmadı. Canlı yayın kaydı ve canlı tur kontrolü ayrıca yapılmalıdır.
