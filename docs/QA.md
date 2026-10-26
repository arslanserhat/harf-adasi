# Altı macera dünyası ve Pixabay sesleri — 26 Ekim 2026

Son uygulama kodu **a716bfc775761a76a24c8842a252ee31ea006488** (teknik sürüm
5.4.0); ilk macera/ses uygulaması `421df87`, son düğme kontrastı ve gerçek
sonraki dünya kontrolü bu son kodda. Çocuk ekranında sürüm etiketi yok.
Pages workflow [40349996437](https://github.com/arslanserhat/harf-adasi/actions/runs/40349996437)
başarılı. Gerçek yayın: https://arslanserhat.github.io/harf-adasi/?yenile=4

Kullanıcının seçtiği onay sesi miraclei `success03` / Pixabay **360151**,
bitiş sesi Universfield `Level Complete` / **143022**. Dokunma/yeniden deneme
`Soft UI Click` / **147352**. Kaynak MP3'leri değiştirilmedi; oynatım düzeyi
uygulamada ayarlanır. Eski piyano seti etkin eşlemeden çıkarıldı. Bu sesler
Pixabay Content License kapsamındadır; kaynak ve özetler yayımlanan
`audio/pixabay-v4.sources.json` ve `audio/LICENSE-pixabay-v4.txt` içinde.

Son derleme üzerinde:

- **99/99 JavaScript mantık testi**, yerelde ve son Pages işinde geçti:
  ses 18, eski macera 11, ada 12, öğrenme 28, eşitleme 10, hikâye 4,
  yeni macera modeli 16. Öğretmen heceleri, ayrı çift harfler, öğretilen harf
  filtresi, bilinmeyen anlamlara içerik uydurmama, gerçek saatle tekrar
  vadesi ve biten dünyadan başka uygun dünya seçimi kapsanır.
- `tests/quests.spec.cjs`: **24/24 Chromium** ve **12/12 Linux WebKit 26.0**.
  Chromium: 390×660, 1366×768, 360×640, 844×390; WebKit: 390×660 ve 1366×768.
  Her boyutta altı dünyanın her biri altı gerçek cevapla bitirildi; ardından
  sonuçtaki düğmeyle farklı dünya açıldı. Cevap/Devam görünüm alanında kalır,
  belge yatay/dikey uzamaz; düğmenin hesaplanmış kontrastı en az 4.5'tir.
- Kelime Pazarı telefon turunda öğretmen formundan gerçekten `nane / anne`
  girilir. Hata ve ipucu toplamları tamamlanmada yeniden eklenmez. Gerçek
  çizim/yetişkin onayı, mola, ana sayfa, yenileme, döndürme ve benzetilmiş
  arka plandan dönüş sınanır. Eksik hece sorusu kendi başına ipucu sayılmaz;
  cümle ipucu tam öğretmen cümlesini gösterir. Sayılar okuma kaydı üretmez.
- Pages ve Laravel üretim derlemeleri geçti. Yeni bağımlılık veya sunucu
  uç noktası eklenmedi. Macera turu/geçmişi yerel; gerçek kelime/harf
  gözlemleri mevcut öğrenme eşitlemesini kullanır.

Son kontrast değişikliğinden önce, aynı oyun mantığıyla ek regresyonlar:
öğrenme **26/26**, bozuk macera kaydı kurtarma **2/2**, kapatma **2/2**.
İlk eski bölüm koşusu **25/32** idi: dört senaryo değişen ana sayfa
seçicilerini bekliyordu; iki kutlama ve bir sayı senaryosu, etkin olmayan
macera bileşeninin başka bölümün yazı korumasını açtığını gösterdi. Seçiciler
güncellendi, bileşenin kendisine ait olmayan korumayı kapatması kaldırıldı.
Yazı stüdyosu, 1. sınıf menüsü, kutlama ve sayı hedefli tekrarları **8/8** geçti.
Tek bir son tam koşu 32/32 yapılmış gibi raporlanmaz. Sonraki kaynak değişikliği
yalnız yeni macera düğmesi stili, testler ve ses seçim metadata'sıdır.

## Son kodla gerçek yayın kontrolü

390×660 gerçek Pages adresinde öğretmen listesiyle **Kelime Pazarı'nın altı
görevi** tamamlandı; sonuçtaki **Hece Ekspresi** düğmesi farklı dünyayı açtı.
390×844 ile eski **sekiz görevli hikâye**; yazı, rotasyon, yetişkin kontrolü ve
son sesli kartıyla tamamlandı. Dört Pixabay MP3'ünün gerçek ses yanıtları,
gerçek Web Audio kaynaklarının `ended` olayları ve kayıtlı macera tebrik
sesinin `ended` olayı doğrulandı. 390×660 ve 1366×768 gerçek yayında ayarlar
iki kez açılıp kapatıldı; tek X ve 44px dokunma alanı doğrulandı. Toplam
**4/4 canlı senaryo**, tüm süreçler çıkış kodu 0. Başarı enjekte edilmedi.

Yayımlanan JS ve CSS yerel son derlemeyle bayt bayt aynı:

- `assets/index-Ct02pfBQ.js`: SHA-256
  `1dd75ec08cc2a1d9f206ba4b6aff492b4176fa1aaa2333fb700ce38b993953a8`
- `assets/index-CgiRj8Dn.css`: SHA-256
  `2060c000c24ab4ce3940cb7811e6d5d60098a5cb14979479b50b42367f20a14a`

Çalışma alanı kanıtları `test-results/live-v54/` ve
`/workspace/scratch/harf-v54-final-*.log` içinde. HTTPS doğrulaması kapatılmadı;
ortamın mevcut proxy CA'sı ve Chromium'un mevcut NSS veritabanı kullanıldı.
Eski `harf-v54-live-*` kaydı ilk `421df87` yayınına aittir; final kaydı
`harf-v54-final-live-*` dosyalarıdır.

Fiziksel iPhone/iOS Chrome veya iPad testi ve insan tarafından ses dinlemesi
yapılmadı. Linux WebKit gerçek motor kontrolüdür; fiziksel Apple cihazı değildir.
Anlatıcı hâlâ mevcut Türkçe Emel kaydıdır; ChatGPT Voice/oyuncu kaydı eklenmedi.
Uzun dönem öğrenme/pedagojik etkililik pilotu yapılmadı. Bu, Pages statik
yayınıdır; PHP/Laravel sunucusu Pages'te çalışmaz. VPS bu sürümle güncellenmedi;
e-Tahlil, diğer depolar ve pytest değiştirilmedi. Backend değişmediği için eski
PHP testleri bu turda yeniden koşulmuş gibi sayılmaz.

---

# Önceki sürüm: ekrana sığan macera ve akustik bildirimler — 26 Ekim 2026

Uygulama kodu **036da60191dc7bf0a3f33908e81d2fa9bdaad956** (teknik sürüm
5.3.0); çocuk arayüzünde sürüm etiketi yok. Pages workflow
[40331521520](https://github.com/arslanserhat/harf-adasi/actions/runs/40331521520)
başarılı. Yayın adresi: https://arslanserhat.github.io/harf-adasi/?yenile=3

Bu kayıt aşağıdaki 5.2 doğrulamasının yerine geçer. Kullanıcının ekran
fotoğrafları önceki testlerin cevapların görünürlüğünü yeterince sınamadığını
gösterdi. Yeni kontroller yalnız yatay taşmaya bakmaz: başlangıç düğmesi,
cevaplar ve Devam gerçek görünüm alanında kalır; etkin oyuncu belgeyi aşağı
uzatmaz. Uzun cümleler gerektiğinde yalnız kendi etkileşim alanında kayar.

Son uygulama derlemesinde geçen kontroller:

- `npm run test:unit`: **80/80**; bunun 15'i gerçek yükleme durumlarını içeren
  ses mantığı testidir. `preload:false` efekt ilk istekte açıkça yüklenir;
  yükleme sırasında sessize alma eski bir oynatma kuyruğunu geri getiremez.
- `node tests/player-fit.spec.cjs`: **6/6 Chromium tam turu**; aynı dosya gerçek
  **Linux WebKit 26.0 ile 6/6**. Boyutlar 1366×768, 1024×768, 390×844,
  390×660, 360×640 ve 844×390. Her turda sekiz gerçek görev, yazı/yetişkin
  kontrolü, döndürme, kaydırma kilidi ve bitiş kartı doğrulandı.
- `node tests/tablet.spec.cjs`: **32/32**; iki tablet yönünde 58 büyük/küçük
  Türkçe harf kılavuzu, hece, kelime, okuma, cümle, sayı ve son kutlama.
  Ara adımda modal açılmaz; son gerçek tamamlamada kayıtlı tebrik çalar.
- `node tests/learning.spec.cjs`: **26/26**; kendi kelimelerini düzenleme,
  öğretilen harf filtresi, bağlı görevler, destek/bağımsızlık ayrımı, geri
  yükleme, harita durakları ve başka bir hikâyeye geçiş korunur.
- `node tests/ambience.spec.cjs`: **6/6**; altı ayrı hayvanın gerçek WebP
  atlasları yüklenir, resim/düğmelerle çakışmaz, yazıda gizlenir ve hareket
  durdurma/azaltılmış hareket uygulanır.
- `node tests/writing-controls.spec.cjs`: **2/2** gerçek CDP dokunma senaryosu;
  ikinci parmak mevcut yazıyı silemez/onaylayamaz. Eksik uyumluluk tıklaması
  tek manuel devam üretir; sonraki görev kendi cevabını bekler.
- Pages ve Laravel üretim derlemeleri geçti. Dört yeni PCM WAV 0.105/0.620/
  0.245/1.100 saniye; kırpılma yok, ilk/son örnekler sıfır. Kaynak ve CC BY 3.0
  atfı `visual-audio-assets.md` ve yayımlanan lisans dosyasında.

Canlı HTTPS varlığı `assets/index-DH_wB9WW.js`, yerel üretim çıktısıyla bayt
bayt aynı. SHA-256:
`06ab4d1dc0e1d2c8ffe3394ec52b759498196546e00f17f5ac4945f8f78a3350`.

390×660 gerçek Pages adresinde sekiz görev, bilinçli yanlış cevap/düzeltme,
yazı ve yetişkin kontrolüyle bitirildi. Dört akustik dosyanın 200/206 ses yanıtı,
gerçek Web Audio kaynaklarının `ended` olayları ve macera sonunun kayıtlı
Türkçe tebrik dosyasının `ended` olayı gözlendi. Oyun başarısı enjekte edilmedi.
İlk çalışanın testi 1/1 geçti; kabuk çıkışındaki olmayan geçici NSS takma adı
silme denemesi 255 döndürdü. Tarayıcı doğrulaması ve sertifika erişimi ayrıca
kontrol edildi; bu durum bir oyun hatası veya TLS doğrulamasını kapatma değildir.
390×844 ile ikinci canlı tur da tüm ses kontrolleriyle **1/1 geçti ve süreç 0
ile kapandı**. Chromium, ortamın mevcut NSS veritabanı için yazma erişimi
gerektiriyordu; mevcut proxy CA'sı kullanıldı, ek bir CA bırakılmadı.
Canlı intro/görev/son kart görüntüleri `test-results/live-v53/` altındadır.

Fiziksel iPhone/iOS Chrome veya iPad testi yapılmadı. Linux WebKit, fiziksel
Apple aygıtı değildir. Sesin estetik kalitesi insan dinlemesiyle onaylanmadı.
Konuşan kişi mevcut Türkçe Emel anlatıcısıdır; bu sürüm bildirimleri gerçek
piyano örnekleriyle değiştirir, ChatGPT Voice veya yeni oyuncu kaydı eklemez.
Backend değişmedi; eski PHP test sayıları bu çalışmada yeniden koşulmuş gibi
sayılmadı. VPS/e-Tahlil servislerinde değişiklik ve yeni VPS yayını yapılmadı.

---

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
