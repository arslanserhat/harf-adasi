# Ses, kutlama ve telefon düzeni — 26 Ekim 2026

Uygulama kaynağı 5.2.0; sürüm numarası çocuk arayüzünde gösterilmez.

- **74/74 JavaScript mantık testi** geçti. Noktalı tek kelimenin hazır kayda
  dönmesi, tam cümle eşleşmesinin korunması ve `1.` işaretinin sessizce `1`
  sayılmaması için iki yeni ses regresyonu var.
- **26/26 öğrenme tablet senaryosu** geçti. Tam turda macera kartı gerçekten
  açılır; orijinal kart görseli yüklenir, kendi kendine yeni hikâye başlamaz,
  Özetime bak ile kart kapanır ve sonraki hikâye elle seçilir.
- **32/32 önceki bölüm tablet senaryosu** geçti: 58 harf, heceler, kelimeler,
  okuma, cümle, sayılar, Türkçe kayıtlar, yeni v2 efekt dosyaları, tek tebrik,
  dokunma/kaydırma korumaları ve modal devam/Escape davranışı kapsanır.
- **10/10 Chromium telefon senaryosu** ve **10/10 gerçek Linux WebKit 26.0
  telefon senaryosu** geçti. Görünümler 360×800, 390×844, 393×852, 430×932 ve
  844×390. Her görünümde ana sayfa/dört durak/öğretmen formu/altı eski bölüm;
  ayrıca gerçek sekiz görevlik tur, çizim, rotasyon, kaydırma kilidi ve son kart sınandı.
- Dekorun önde görünmesi ve iPhone güvenli alanlarının son CSS düzenlemesinden
  sonra 390×844 ve 844×390 tekrarlandı: Chromium **4/4**, WebKit **4/4** geçti.
  Kontrol, dekorun ada resminin dışında body katmanında olduğunu ve dokunmayı
  engellemediğini ayrıca doğrular. Son görsel kırpma, karakteri telefon ekranında tutar.
- Chromium çizimleri CDP dokunma ve yerel kaydırma jesti kullanır. WebKit kontrolleri
  dokunma tap'i, çizimleri pointer kullanır. Linux WebKit gerçek motordur; fiziksel
  iPhone veya iOS Chrome çalıştırılmış değildir. Gerçek çentik ve tarayıcı çubuğu
  hareketi de fiziksel cihazda ayrıca değerlendirilmelidir.
- Yeni dört PCM16 stereo efekt üretimi tekrarlanabilir; kırpılma yoktur. Yeni
  `al`, cümle, kısa tebrik ve macera kartı MP3'leri ffprobe ile açıldı. Tebrik
  2,448 saniye; macera kartı tebriki 4,968 saniye. Bunlar insan dinleme kanıtı değildir.
- Pages ve Laravel Vite derlemeleri geçti. Backend değişmedi; önceki PHP kanıtı
  alt kayıttadır. Bu değişiklik VPS yayını değildir.

## Canlı yayın kanıtı

Uygulama kodu `2a99b7b740dd1ec68e927b80e51c379aab6420e6`,
[workflow 40318291199](https://github.com/arslanserhat/harf-adasi/actions/runs/40318291199)
başarılı. [Gerçek HTTPS adresinde](https://arslanserhat.github.io/harf-adasi/?yenile=2)
390×844 dokunmatik Chromium ile **2/2 telefon senaryosu** geçti: dört ada
durağı, öğretmen formu, altı eski bölüm; ayrıca gerçek sekiz görev, yazı/rotasyon,
kaydırma kilidi ve sesli macera kartı.

Testin ikinci turunda öğretmen formundan gerçekten `al` ve `anne` girildi.
Gerçek HTMLMediaElement `ended` olayları izlenerek hem bağlamdan üretilen `al`
MP3'ünün hem macera kartının yeni tebrik kaydının sonuna kadar çalındığı doğrulandı.
İzleme gerçek `play()` çağrısını korur; doğru cevap veya tamamlama enjekte etmez.
Bu medya oynatımı kanıtıdır, insan tarafından duyulan telaffuz/ses kalitesi kanıtı değildir.

Canlı `index-DyJUKld8.js` yerel üretim çıktısıyla aynı;
SHA-256 `15253e3ae0bb489680e3adb53030f39727caa4c7fdb6d3cc613cbd3ccf66805b`.
Canlı ses manifesti de yerel dosyayla aynı. Kanıt ve ekran görüntüleri
`scratch/harf-v52-live-*` dosyalarında. Görünür sürüm etiketi yoktur.

Geçerli anlatıcı aynı EmelNeural'dır; ChatGPT Voice dışa aktarımı yapılmadı.
Fiziksel iPhone/iOS Chrome ve VPS yayını bu kontrollerle doğrulanmış değildir.

## Önceki sürüm 5.1 kontrol kaydı


- JavaScript: **72/72** geçti (ses 7, macera 11, ada 12, öğrenme modeli 28,
  eşitleme 10, hikâye 4). Bağlamdan devam, değişen görev dizisi, üç hikâyenin
  sırası ve yeniden yüklemede bölümün korunması ayrıca sınandı.
- Laravel: **28 feature testi / 209 assertion** geçti. Yeni storyEpisode alanının
  geri yüklenmesi ve 0..2 dışındaki değerin reddedilmesi kapsanır.
- Yeni arayüz: son derlemede **26/26** dokunmatik Chromium senaryosu geçti;
  768×1024 ve 1024×768. Dört gerçek harita girişi, yüklenmiş resimler, dünya
  içindeki kontroller, gerçek animasyonların durdurulması, yalnız doğru parçayla
  köprü yapımı, bitirilen eski kelimeden yeni plana geçiş ve iki ardışık yolculuk
  kontrol edildi. Tam tur sonrası Pırpır’ın Bahçe Pazarı açıldı ve görev dizisi değişti.
- Eski bölümler: ilk geniş turda **28/32** geçti. Ana sayfada kaldırılan hızlı harf
  alanını bekleyen ayar ve kısa macera senaryoları iki görünümde başarısızdı.
  Alan geri kondu; etkilenen **4/4** senaryo yeniden geçti. Son durumda 32 senaryonun
  tamamı kapsandı; hata gizlenmedi veya doğrulama kaldırılmadı.
- Yazıda kaydırma kilidi, gerçek çizim, yetişkin onayı, 58 harfin kılavuzu,
  hece/kelime/okuma/cümle/sayı bölümleri ve altı bölüm arasında gezinme korundu.
- Yeni ses paketi: **578 anahtar / 448 aktif MP3**. Gerekli **77/77** sabit metnin
  kaydı var; 69 yeni dosya eklendi. 77 dosyanın biçimi ve pozitif süresi ffprobe
  ile denetlendi (1,87–13,15 saniye). İnsan tarafından duyulan kalite doğrulanmadı.
- Pages ve Laravel üretim derlemeleri geçti. Fiziksel iPad ve Safari/WebKit
  kullanılmadı; bu sonuçlar Chromium dokunma emülasyonudur.

## Sürüm 5.1 canlı tur kanıtı

Uygulama kodu `b68f9d18ad4331a06e83b1c31bfbfd976c24b717`,
[workflow 40308955962](https://github.com/arslanserhat/harf-adasi/actions/runs/40308955962)
başarılı. Gerçek [HTTPS adreste](https://arslanserhat.github.io/harf-adasi/?v=5.1.0)
**12/12 canlı senaryo** geçti: iki tablet görünümünde tam sekiz görevli tur,
ikinci hikâyeye geçiş, sahne denetimleri, dört ayrı ada durağı, hareket durdurma,
köprü yapımı ve eski kelime çalışmasından bağlamlı devam. Başarı veya tamamlama
uygulamaya enjekte edilmedi; gerçek dokunma kontrolleri kullanıldı.

Canlı JS `index-B-0XA0QT.js` yerel derlemeyle bayt bayt aynıydı;
SHA-256 `2557cc08e1da0b2ca3c85aeb3fafd97799ca207caf8c1d24b50eda9ffe2570a3`.
Canlı ses manifesti de yerel dosyayla aynı doğrulandı. Ekran görüntüleri ve sonuç
kaydı çalışma alanındaki `scratch/harf-v51-live-*` dosyalarında tutulur.

Kullanıcının sonraki talebiyle görünür v5.1 etiketi kaldırıldı; bu değişiklik oyun
mantığını değiştirmez. Teknik sürüm bilgisi arayüz dışında tutulur. Sonraki
belge/etiket güncellemesini yeni öğrenme motoru veya VPS yayını olarak sunma.
Pages statik sürümdür; Laravel API yerelde sınandı, bu oturumdan VPS güncellenmedi.

## Önceki sürüm 5 kontrol kaydı


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
