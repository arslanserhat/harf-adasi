# Sürüm 5 kontrol kaydı — 26 Ekim 2026

- JavaScript: **64 mantık testi geçti**. Ses 7, eski macera 11, ada modeli 12,
  uyarlama modeli 21, kayıt/eşitleme 10 ve özgün hikâye 3 test içerir.
- Laravel: **28 feature testi / 205 assertion geçti**. Şifreli kayıt, Türkçe
  kelime ve hece doğrulaması, oturum ayrımı, revizyon çatışması, sıfırlama
  sonrasında eski isteğin reddi, uzun ve sınırlı yazı taslağı kapsanır. Sıfırlama
  sırasında değişen tarayıcı kaydı ve listeler yeniden kaydedildikten sonraki
  eski pencere çatışması da ayrıca sınandı.
- Yeni öğrenme akışı: dokunmatik Chromium 143 ile **18/18 senaryo geçti**;
  768×1024 ve 1024×768. Öğretmen listeleri, geçersiz giriş, hece düzenleme,
  işlenmemiş harfler, sekiz görevli gerçek tur, yanlış/ipucu kayıtları,
  yetişkinle yazı kontrolü, rotasyon, yenileme, anlam desteği ve harf tekrarı sınandı.
- Hikâye: gerçek çalışan CSS animasyonu, hareketi duraklatma, azaltılmış hareket
  tercihi, karakter konuşmalarıyla görev ilerlemesinin ayrılması ve cevap
  modelinin dinleme/hatırlama sırasında gizli kalması geçti.
- Eski altı bölüm: **32/32 tablet senaryosu geçti**; her iki görünümde 58 büyük/küçük
  harf, heceler, kelimeler, okuma, cümle, sayılar ve dokunmatik korumalar kapsanır.
  Yeni modülün eski yazı kilidini kapatması düzeltildi; kutlama açıkken kilidin
  korunmasına ayrıca regresyon kontrolü eklendi.
- Ada oyunları: statik sürümde **10/10**; Laravel gerektiren dört ek senaryo
  yerel PHP sunucusunda ayrıca **4/4** geçti. Statik çalıştırmadaki dört skip bu
  ayrı çalıştırmada kapsandı.
- Gerçek yerel Laravel HTTP sunucusunda CSRF'siz PUT **419**, geçerli kayıt ve
  geri yükleme, eski revizyonla **409** ve sıfırlama doğrulandı. Yeni öğrenme
  turu aynı sunucuda iki görünümde **2/2** geçti.
- Hem Pages hem Laravel Vite derlemesi geçti. Pages çıktısında PHP giriş dosyası yok.

Aralıklı tekrar için saf model testleri ve ek bir kontrollü tarayıcı saati
kullanıldı; günler süren bir çocuk öğrenme çalışması yapılmış değildir. Fiziksel
iPad, gerçek Safari/WebKit ve insan tarafından dinlenmiş ses kalitesi doğrulanmadı.

Ses envanteri: mevcut 509 anahtar / 379 aktif kayıt korunur. Yeni hikâye ve ilk
kelime paketinin toplam 33 metninden 25'inde hazır kayıt yoktur; gerçek Türkçe
cihaz sesi veya açık yetişkin desteği kullanılır. Bu kayıtlar ChatGPT Voice ile
yeniden seslendirilmiş değildir. Ayrıntı: [ses geçiş planı](voice-plan.md).

## Canlı yayın doğrulaması — 26 Ekim 2026, 09:23 UTC

- Uygulama kodu: `15ca41e36631245e6039f8f752c17679257c6389`, sürüm `5.0.0`.
- [Pages workflow 40298881520](https://github.com/arslanserhat/harf-adasi/actions/runs/40298881520)
  başarılı; [gerçek HTTPS adresi](https://arslanserhat.github.io/harf-adasi/) açıldı.
- Canlı JavaScript `index-BrTYCwgB.js` yerel üretim çıktısıyla bayt bayt aynı:
  SHA-256 `b33404c56d227240130caa6ac8ee2e45e5b793ee49ea495b51e10d145fa44f37`.
  Çalışan sayfanın `HARF_ADASI_VERSION` değeri de `5.0.0` doğrulandı.
- Gerçek HTTPS sayfasında 768×1024 ve 1024×768 dokunmatik görünümlerinde **2/2
  bağlı öğrenme turu** tamamlandı: yanlış cevap, ipucu, ayrı çift `n` kartları,
  dinleme, heceleme, kelime kurma, örneksiz hatırlama, gerçek çizim hareketi,
  yetişkin onayı ve sekiz görev sonrası özet. Uygulama başarı durumuna veri enjekte
  edilmedi; gerçek kontroller kullanıldı. Sonuçlar tarayıcı kaydından yalnız okundu.
- Yazma hareketi sayfayı kaydırmadı; tur bitişinde kilit kalktı; hata konsolu,
  yatay taşma ve uygulama hata ekranı kontrolü geçti. Her iki turun ekran görüntüleri
  çalışma alanındaki `scratch/harf-v5-live-*` dosyalarında tutuldu.
- Bu doğrulama statik Pages yayınıdır. Laravel API yerel sunucuda sınandı; bu
  oturumdan VPS sürüm 5 yayını yapılmadı. Pages'teki kayıt bu tarayıcıya aittir.

Fiziksel iPad, Safari/WebKit ve duyulan ses kalitesi bu canlı turla doğrulanmış
değildir. Yeni hikâye kayıtlarının eksikleri yukarıdaki ses envanterinde geçerlidir.

## Önceki sürüm 4 kontrol kaydı

- Laravel 13.38.0 / PHP 8.5 ortamı: **10 feature testi, 55 assertion geçti**. Oturum ayrımı, gerçek CSRF reddi/onayı, idempotent kayıt ve yalnızca mevcut oturumun sıfırlanması kapsanır.
- `node tests/audio-unit.cjs`: **7/7 geçti**. Kayıtlı `nine`, Türkçe ses seçimi, İngilizce yedeğin reddi, konuşma iptali ve sessize alma kapsanır.
- `npm run build` ve `npm run build:laravel`: başarılı. Statik çıktıda PHP giriş dosyası bulunmaz.
- Dokunmatik Chromium 143: 768×1024 ve 1024×768 görünümlerinde 28 senaryo. İlk toplu çalışmada 27 senaryo geçti; 58 harf çiziminin dikey turunda Docker ağı açılırken `ERR_NETWORK_CHANGED` kaydı yakalandı. Aynı test sabit ağ altında `TEST_VIEWPORT=768x1024 TEST_FILTER='all 58'` ile yeniden çalıştırıldı ve geçti. Son durumda 28 senaryonun tamamı doğrulandı; hata kontrolü susturulmadı.
- Yazı odak modu: dokunma hareketlerinin iptal edilmesi, sayfa kaydırma kilidi, kontrollerin ekrana sığması, yön değiştirme ve gezinirken kilidin bırakılması geçti.
- Ses kapsamı: 80 kelime, `nine`, tebrik kaydı ve dört efekt için yerel dosyalar doğrulandı. Bu, bir insanın ses kalitesini dinlediği anlamına gelmez.
- Üretim Docker imajı `harf-adasi:qa` derlendi. FrankenPHP/PHP 8.5 sunucusunda `/healthz` yanıtı, CSRF ile POST 201 ve oturuma ait GET 200 ilerleme kaydı doğrulandı. Bu testler yerel ortamda yapıldı; VPS yayını değildir.

Fiziksel iPad, gerçek Safari/WebKit ve insan tarafından dinlenmiş ses doğrulaması yapılmadı. Canlı yayın kaydı ve canlı tur kontrolü ayrıca yapılmalıdır.
