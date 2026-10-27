# Harf Adası — güncel devir notu

## 27 Ekim 2026 — ortak dinamik içerik, öğretmen heceleri ve yerel profil

Son uygulama kodu **505495332669775103dba854fd5db5d834af3a86**, teknik sürüm
5.5.0. Çocuk ekranına sürüm etiketi ekleme. Pages workflow
[40470683181](https://github.com/arslanserhat/harf-adasi/actions/runs/40470683181)
başarılı. Gerçek yayın https://arslanserhat.github.io/harf-adasi/?yenile=6
üzerinde **iki tam altı görevli öğretmen kelimesi turu** tamamlandı; ikinci
tur farklı hedefler getirdi. Canlı JS/CSS son yerel derlemeyle bayt bayt aynı.
Sonraki belge commit'i uygulama kodunu değiştirmez. Aşağıdaki 26 Ekim kayıtları
geçmiş sürümlerdir; güncel kapsam ve test kanıtı `docs/QA.md` başındadır.

- `content-selection.js`: harf, hece, kelime, cümle, sayı ve hazır etkinlik
  için ortak, kalıcı döngü/geçmiş. Gerçekte gösterilen hedef kaydedilir;
  seçenekler, hayali başarı veya öğrenme kanıtı eklenmez. Uygun havuzdaki yeni
  hedefler önceliklidir; havuz bitince en eski gösterimlerden yeni döngü başlar.
  Gerekli zorlanma/vadeli öğrenme tekrarı diğer kelimelerin sırasını dışlamaz.
  Oyun değişimi ve yenileme ilk küçük gruba sıfırlamaz. Eski ilerleme gerçek
  kayıtlarından taşınır; bozuk kayıt, boş/tek öğe ve silinen öğeler korunur.
- `teacher-content.js`, öğrenme düzenleyicisi ve Laravel doğrulaması:
  öğretmen **harflerini, bağımsız hecelerini ve kelimelerini ayrı** girebilir;
  hece için kelime girişi zorunlu değildir. Liste başına en çok 29 harf,
  100 hece ve 100 kelime; testteki sekiz kelime bir kapasite sınırı değildir.
  Türkçe yazım ve işlenmiş harfler dikkate alınır. Eski kelime parçaları
  korunur, ancak geçersiz parçalar hece hedefi yapılmaz. Gerçek anlam veya
  öğretmen cümlesi bulunmuyorsa uygulama anlam/cümle uydurmaz.
- Altı macera dünyası, eski öğrenme turu ve serbest kataloglar ortak depoyu
  kullanır. Sayılar 0–10 havuzunda döner; okuma başarısı üretmez. Liste/harf
  seviyesi değişince etkin plan güvenle yenilenir. Eski yarım planın eksik
  havuz metadata'sı tamamlanırken kimlik, cevaplar, konum ve çizim korunur;
  geçmişte görülmüş gibi hayali öğe eklenmez.
- Gerçek hesapla giriş sistemi yoktur. `child-profile.js/css` **bu tarayıcıda
  seçili yerel çocuk profili** sunar: kaydetme, değiştirme, yeniden adlandırma,
  çıkış ve yenileme. Adsız karşılama nötrdür; görsel hitaplar seçili adı kullanır.
  Mevcut anonim ilerleme/listeler profiller arasında ortaktır; arayüz bunu
  açıklar. Kişisel adlar TTS veya ağ isteklerine eklenmez. Mevcut Emel sesleri
  değişmedi; bazı eski kayıtlar kurgu karakterin Alparslan adını söyleyebilir.
- Karşılama kompakt header içine taşındı. Ana oyunu aşağı iten eski üst alan
  kaldırıldı; aslan ve kuş mevcut alt hayvan alanına taşındı. Altı hayvan,
  hareket durdurma, azaltılmış hareket ve çizim sırasında durma korunur.
  Kullanıcının seçtiği success03 / Level Complete / Soft UI Click değişmedi.
- Seçim geçmişi, macera geçmişi ve çocuk profili tarayıcıda yereldir; yeni
  hesap veya bu alanlar için sunucu eşitlemesi eklenmedi. Öğretmen harf/hece
  alanları mevcut Laravel öğrenme kaydı eşitlemesine dahildir.

Son uygulama kodunda **146/146 JS testi**, **31/31 PHP Feature testi / 248
doğrulama**, Pages ve Laravel derlemeleri geçti. Son derleme üzerinde
**44/44 Chromium/Linux WebKit senaryosu** ve gerçek yayında **9/9 Chromium
senaryosu** geçti. Önceki geniş 107 senaryo koşusu ile final 44 regresyonu
aynı koşu gibi sayma; ayrıntı QA belgesinde. Fiziksel iPhone Chrome/iPad,
gerçek iOS tarayıcı arayüzü ve insan ses dinleme kontrolü yapılmadı.

**VPS / alan adı / SSL ayrı ve tamamlanmadı.** İstenen hedefler
`harfadasi.com.tr` ve `www.harfadasi.com.tr`, VPS `94.138.209.208`.
Kullanıcının çalışan `https://94.138.209.208:8446/` yayınına dokunulmadı.
Mevcut SSH kimliği olmasına rağmen şu anki yönetilen Linux `/workspace`
executor'ının tanımlı TCP proxy'si `proxy:8088`, errno 111 / Connection refused
veriyor; `94.138.209.208:22` hedefli SSH, sunucuya ulaşmadan çıkış 255 veriyor.
Bu, VPS'nin SSH portu bozuk demek değildir. Eski kayıttaki başarılı kullanıcı
bilgisayarı oturumu bu executor'a bağlı değil; mevcut araçlarda o yerel SSH/VNC
oturumunu kontrol etme yolu yok. Bu oturumda TCP erişim ayarı yazma
aracı yoktur. Son Google/Cloudflare DNS sorgularında (08:11 UTC) iki A kaydı
ve alan adı NS sorgusu NXDOMAIN döndü; İHS tescil/NS etkinliği ve yayılımı
doğrulanmalı. Mevcut IP HTTPS kontrolünde proxy aracılı TLS adı uyuşmazlığı
nedeniyle gerçek sunucu sertifikası/SAN/süre okunamadı; TLS doğrulaması
kapatılmadı. Yeni sertifika, vhost, reload, firewall veya CA işlemi yapılmadı.
Devam için desteklenen VPS TCP erişim yolu ve çözümlenen yetkili DNS gerekir;
yeniden şifre/anahtar istemek ağ engelini çözmez. Bu sürüm VPS'ye yüklenmedi.
e-Tahlil, diğer depolar ve pytest değiştirilmedi.

## 26 Ekim 2026 — altı macera dünyası ve kullanıcının seçtiği Pixabay sesleri

Son uygulama kodu **a716bfc775761a76a24c8842a252ee31ea006488**, teknik sürüm
5.4.0. Görünür sürüm etiketi ekleme. Pages workflow
[40349996437](https://github.com/arslanserhat/harf-adasi/actions/runs/40349996437)
başarılı. Gerçek https://arslanserhat.github.io/harf-adasi/?yenile=4 adresinde
yeni altı görevlik Kelime Pazarı tamamlandı; sonuçtan **Hece Ekspresi** açıldı.
Eski sekiz görevlik hikâye ve dört efektin gerçek çalımı da ayrıca doğrulandı.
Canlı JS ve CSS yerel son derlemeyle aynı; kanıt ve sınırlar `docs/QA.md` başında.
Aşağıdaki 5.3 ve daha eski kayıtlar geçmiş sürümleri anlatır.

Kullanıcı piyano efektlerini açıkça reddetti. Doğru cevap **miraclei success03,
Pixabay 360151**; bitiş **Universfield Level Complete, 143022**; dokunma ve
sessiz yeniden deneme **Soft UI Click, 147352**. `audio.js` yalnız açıkça
eşlenmiş `fx-*-pixabay-v4.mp3` dosyalarını çalar; piyano yedeği yoktur.
Kaynaklar, özgün dosya özetleri ve **Pixabay Content License** atfı
`public/audio/pixabay-v4.sources.json` ve `LICENSE-pixabay-v4.txt` içindedir.
Konuşan kişi hâlâ mevcut Emel anlatıcısıdır; yeni insan veya ChatGPT Voice
kaydı eklenmedi. Ayarlardaki iki X, tek erişilebilir kapatma düğmesine indirildi.

- `quest-model.js`: öğretmenin gerçek kelime/hece/cümleleri ve işlenen harflerle
  altı ayrı altı aşamalı plan; vadesi gelen veya zorlanılan beceriye göre öneri,
  mümkünse bitirilen dünyadan farklı sonraki dünya. Keyfi kelimeye anlam uydurma.
- `quests.js`: Fener Atölyesi, Hece Ekspresi, Kelime Pazarı, Orman Dedektifi,
  Mektup Postanesi, Şenlik Bahçesi. Animasyon başarı üretmez; her devam elle,
  yazı yetişkin onayıyla. Hata/ipucu olayları toplamı iki kez eklenmez.
- `quest-scenes.js`, `quests.css`, `quest-home.js/css`: bu proje için üretilen
  altı özgün WebP dünya, ayrı sahne nesneleri ve hayvan hareketleri. Telefon
  oyuncusunda cevap ve Devam görünür; uzun içerik kendi alanında kayar.
  Sonraki dünya düğmesinin gerçek hesaplanmış renk kontrastı da sınanır.
- Yeni ana giriş macerayı önerir veya yarım turu sürdürür. Eski altı katalog
  Serbest alıştırmalar altında; eski sekiz görevli hikâye ayrı girişte korunur.
- `harf-adasi-quests-v1`: tur konumu ve sayısal geçmiş tarayıcıda. Kelime/harf
  gözlemleri mevcut öğrenme deposunu ve Laravel sürümünde onun eşitlemesini
  kullanır; yeni macera geçmişi sunucuya eşitlenmez. Boş cevap dizisi veya
  kazanılmamış doğru bayrağı tamamlanma üretmez. Sıfırlama listeleri korur.
- Yazı korumasını yalnız onu oluşturan bileşen kapatır. `quests.destroy()`
  etkin macera yokken genel `releaseWritingGuard()` çağırmamalı: eski bölümün
  yazı kilidini açan regresyon böyle düzeltildi. Gerçek çizim, mola, ana sayfa,
  yenileme, döndürme ve arka plandan dönüşte korunur.

Son derlemede **99/99** mantık ve **36/36** yeni macera tarayıcı senaryosu geçti
(Chromium 24, Linux WebKit 12). Gerçek yayında yeni tur, eski tam tur/sesler ve
iki kapatma senaryosu **4/4** geçti. Ayrıntılı eski bölüm regresyonlarının
ilk hata ve hedefli tekrar kaydı QA belgesindedir; eski sonucu yeni koşu diye sayma.
Pages ve Laravel derlemeleri başarılı. Fiziksel iPhone/iPad ve insan ses
dinlemesi yapılmadı; Linux WebKit fiziksel iOS değildir. Bu sürüm VPS'ye
yüklenmedi; e-Tahlil, diğer depolar ve pytest değiştirilmedi.

## 26 Ekim 2026 — ekrana sığan oyuncu ve gerçek akustik efektler

Güncel uygulama kodu **036da60191dc7bf0a3f33908e81d2fa9bdaad956**, teknik
sürüm 5.3.0. Görünür sürüm etiketi ekleme. Pages workflow `40331521520`
başarılı; https://arslanserhat.github.io/harf-adasi/?yenile=3 adresindeki
varlık yerel derlemeyle aynı. Gerçek yayında sekiz görevlik tur ve ses çalımı
sınandı; en yeni kanıt `docs/QA.md` başındadır. Sonraki QA/belge değişiklikleri
bu uygulama kodunu değiştirmez.

Kullanıcı önceki mobil görünümü ve v2 efektleri tekrar reddetti. Son açık
isteği efektleri kapatmak değil, daha iyi bildirimlerdir. Dört **gerçek
Salamander piyano kaydı türevi** acoustic-v3 WAV eklendi (Alexander Holm,
CC BY 3.0); atıf uygulama notları ve `public/audio/LICENSE-acoustic-effects-v3.txt`
içinde. Ayarlarda Dokunuş / Doğru cevap / Macera sonu önizlemesi bulunur.
Konuşan kişi hâlâ Emel; ChatGPT Voice veya yeni insan sesi eklenmedi.

- `player-viewport.js/css`: intro ve görev, kullanılabilir pencereye sığar.
  Telefon görevinde kendi Home/ses/mola çubuğu vardır; yinelenen başlık ve
  uzun üst diyalog gizlenir. Başlangıç resmi contain, telefon dünyası kısa
  resim + etkileşim alanıdır. Ana sayfa/yetişkin listeleri normal kayar.
- `world-ambience.js/css`: aslan, kuş, tavşan, tilki, sincap, kaplumbağa
  dört pozlu atlaslarla **görsellerin dışında** ayrılmış site alanlarında.
  Dar görev çubuğunda kuş düğmeye değiyorsa gizlenir; yazıda bütün dekor durur.
- `game.js`: ara doğru adımlar satır içi geri bildirim verir. Modal ve tek
  tebrik yalnız son adımda açılır. Öğrenme turunun gerçek son kartı korunur.
- `writing.js/css`: döndürmede eski genişliğin taşması sınırlanır. Kaybolan
  uyumluluk tıklamasına 120ms yedek yalnız birincil, çizim dışı düğme
  dokunuşunda devreye girer; hareket/ikinci parmak reddedilir. Kısa süreli
  çift tıklama engeli ekran geçişinde de kalır; yeni gerçek dokunuş temizler.
- `audio.js`: ilk efekt isteğinde açık `load()`, gerçek load callback'i,
  sessiz/efekt tercihi ve yükleme iptal koruması. Sadece `play()` çağırmak
  Howler preload:false dosyalarını yüklemez; sahte loaded testiyle yetinme.

Son kaynakta 80 JS mantık, 32 eski bölüm, 26 öğrenme, 6+6 Chromium/WebKit
oyuncu, 6 hayvan ve 2 yazı kontrolü geçti. Fiziksel iPhone ve insan dinlemesi
yapılmadı. Eski 5.2 testlerini bu sürümün kanıtı sayma. Yeni VPS yayını
varsayma; bu çalışmada e-Tahlil veya başka depo/servis değiştirilmedi.

## 26 Ekim 2026 — ses, kutlama ve iPhone revizyonu

Pages'te `2a99b7b` uygulama kodu yayımlandı; workflow `40318291199` başarılı.
Gerçek HTTPS adreste 390×844 ile 2/2 telefon kontrolü ve tam tur geçti; `al`
kaydı ve kartın tebrik kaydının gerçek medya `ended` olayları doğrulandı.
`docs/QA.md` en üstündeki kanıtı kullan. Sonraki belge güncellemesi uygulama
kodunu veya bu yayının kapsamını değiştirmez. Görünür sürüm etiketi ekleme.

Güncel kaynak `5.2.0`; görünür sürüm etiketi ekleme. Kullanıcı yeni ada tasarımını
beğendi. Son talepleri: kötü `al.` telaffuzu, uzun/robotik tebrik, Atari benzeri
efektler, hareketin yalnız ada resminde kalması, bölüm sonu kartının olmaması ve
mobil uyumsuzluk. Cihazı **iPhone Chrome**; Chromium emülasyonunu fiziksel iPhone
testi diye sunma.

- `audio.js`: tam kayıt eşleşmesi önceliklidir. Noktalı tek Türkçe kelime için
  `al.` → `al` kaydı aranır; sayılar ve bütün cümleler bu kuralla değiştirilmez.
- `refresh-feedback-speech.py`: aynı Emel anlatıcıyla dört hedef kayıt yenilendi;
  `al`, Türkçe cümlenin servis kelime sınırlarıyla ayrılan bölümüdür. Kısa tebrik
  tek kayıt; ChatGPT Voice veya yeni bir oyuncu sesi değildir. Manifest korunur.
- `generate-soft-effects.py`: dört yumuşak v2 ahşap/kâğıt/vurmalı WAV. Çalma
  kodu `fx-*-v2.wav` kullanır; eski dosyalar çalınmaz. Numerik temizlik, insanın
  ses kalitesini dinlediği anlamına gelmez.
- `world-ambience.js/css`: logo, menü, kartlar, başlıklar ve sayfa kenarlarında
  hareket; tıklamada sınırlı parçacıklar. Katman ada dışındadır, `pointer-events`
  kapalıdır. Pırpır korunur. Yazı sırasında dekor kapatılır; hareket tercihi ve
  azaltılmış hareket uygulanır. Opak kart arkasında kaybolmaması için katman öndedir.
- `celebration.js/css`: gerçek tam yolculuk bitişinde açılan macera kartı,
  tek tebrik kaydı, Özetime bak / Sonraki macera. Dokunma korumaları ve manuel
  devam korunur. Animasyon seyretmek veya kart açılması öğrenme kaydı üretmez.
- `mobile.css` ve `tests/mobile.spec.cjs`: 360/390/393/430 genişlik ve 844×390
  yatay görünüm; okunabilir metin, 44px hedefler, iOS düzenleyicide 16px, güvenli
  ekran alanları, kayan araç çubukları, dönünce yazı kilidi ve kart içi kaydırma.

Yerel WebKit 26.0 gerçek motoru çalıştırıldı; bağımlılıklar yalnız workspace'e
açıldı, sunucu/sistem uygulaması değiştirilmedi. WebKit testinde dokunma tap'i ve
pointer çizimi; Chromium'da CDP dokunma ve kaydırma jestleri kullanılır. Fiziksel
iPhone ve duyulan ses kalitesi ayrıca doğrulanmalıdır. Son kanıt `docs/QA.md` başında.

## 26 Ekim 2026 — sürüm 5.1 revizyonu

Kullanıcının son görsel tercihi: oyun ekranında sürüm numarası/etiketi gösterme.
Sağ üstteki v5.1 kaldırıldı. Test için `window.HARF_ADASI_VERSION` korunur;
teknik sürüm bilgisi çocuk arayüzüne geri eklenmez.

Kullanıcı sürüm 5'in tasarımını ve küçük banner üstündeki alıştırma yapısını
reddetti. Yeni kaynak `5.1.0`dır; önceki 5.0 canlı kanıtını bu sürümün kanıtı
olarak kullanma. Güncel yayın kaydı `docs/QA.md` başına eklenir.

- `src/home.css`: özgün ada üzerinde dört gerçek dokunma durağı; tek ana giriş,
  ayrı öğretmen listesi, altı eski oyun ve bilinen harflerin hızlı girişleri.
- `public/art/`: bu proje için üretilmiş beş sahne ve Pırpır'ın dört kareli saydam
  sprite atlası. `src/world-ambience.js/css`, `theme.css`: kanat çırpma, bulut,
  deniz, kelebek ve ışık hareketleri; yerel Nunito Sans yazı tipi.
- `src/story-scene.js/css`: sahne içinde güvenilir HTML etkileşim yuvası,
  gerçek parça sayısıyla köprü tahtaları, mektup/sulama animasyonları ve
  üç yazılmış hikâye. Görev/ipuçları hâlâ öğrenme denetleyicisine aittir.
- `src/learning.js`, `world-learning.css`: sorular dünya içinde, yazı defteri
  ayrı ve kaydırma korumalı; doğru nesneler yerlerine uçar. Ana giriş doğrudan
  hikâyeyi veya yarım görevi açar. Geçiş çocuğun Devam eylemini bekler.
- `planSession(...,{focusText,focusSkill,entryKind})`: bitirilen eski çalışmadan
  bağlantı, harita durağına özel giriş, geçmişe göre değişen kelime/görev sırası.
  `session.storyEpisode` 0..2 alanı tam tur sonrası döner; yarım tur değiştirmez.
  Laravel isteği bu alanı doğrular; ayrıca migration gerekmez.
- Mevcut Emel kayıt hattı yeniden çalıştı. 69 eksik sabit kayıt eklendi:
  578 anahtar / 448 aktif MP3; üç hikâye ve ilk paket için 77/77 hazır kayıt.
  ChatGPT Voice aktarımı yapılmadı. Özel öğretmen kelimeleri dışarı gönderilmedi.
  `scripts/complete-story-speech.py` yalnız depodaki sabit eksikleri tamamlar.

Hareketi durdurma, azaltılmış hareket, yalnız Türkçe ses, yetişkin yazı kontrolü
ve mevcut altı oyun korunur. Sürüm 5'in eski kompakt banner/grid CSS blokları
yenisiyle çakıştığı için kaldırıldı. Fiziksel iPad/WebKit ve insan dinlemesi
otomatik Chromium kontrollerinin yerine geçmez. Yeni VPS yayını varsayma.

## Geçerli kapsam

Kullanıcı mevcut altı bölümü koruyarak uygulamayı **Laravel** projesine dönüştürmemizi istedi. Adı Harf Adası kalır. Başlıca gerçek cihaz sorunları: iPad Safari'de yazarken sayfanın kayması, İngilizce cihaz sesinin `nine` kelimesini yanlış okuması ve daha iyi ses/görsel geri bildirim ihtiyacı.

Yalnızca `arslanserhat/harf-adasi` üzerinde çalış. Başlangıç dalı `main`; diğer depolarda veya mevcut e-Tahlil uygulamasında değişiklik yapma. Kaynak artık tek bir HTML içinde değildir; eski tek dosyalı sürümü yeniden kopyalama.

## Kaynak ve mimari

- Sürüm 5, mevcut `main` üzerindeki ada/hikâye çalışmalarını korur. Kullanıcının Morpa Kampüs 1. sınıf/Tomba örneği incelenerek özgün bir animasyonlu bölüm ve çocuğun gözlemlerine göre değişen öğrenme akışı eklendi; Morpa varlıkları kopyalanmadı. Dayanaklar ve sınırlar `docs/learning-design.md` içindedir.
- `src/learning-model.js`: Türkçe özel listeler, hece önerisi, işlenen harf filtresi, bağlı görev planı, beceri/harf gözlemleri ve aralıklı tekrar. Aynı gün tekrarları sonraki güne yayılan hatırlama sayılmaz; ipucu/hata ve yetişkin onayı dikkate alınır.
- `src/learning.js` / `learning.css`: öğretmen listeleri ve gelişim ekranı, farklı görev biçimleri, bağımsız hatırlama, yetişkinle yazı kontrolü, duraklatma ve yarım kalan yazıya dönüş. Ana giriş “Hikâyeli yolculuğum”. Altı serbest bölüm ayrıca korunur.
- `src/story-scene.js` / `story-scene.css`: Alparslan ve Kayıp Bahçe Mektubu; gerçek görev tamamlamalarına bağlı beş özgün SVG sahnesi. Hikâye dinlemek veya hareketi duraklatmak yanıt/ilerleme üretmez.
- `src/learning-sync.js`: `harf-adasi-learning-v1` yerel kaydı; Laravel'de revizyonlu `/api/learning` eşitlemesi. Sıfırlama revizyonunu koru; eski bir istek silinen gözlemleri geri getirmemeli. Tam sıfırlama öğretmen listelerini korur.
- `src/game.js`: mevcut altı bölümün oyun kuralları, manuel Devam ve ebeveyn onayı.
- `src/writing.js` / `writing.css`: tam ekrana sığan yazı alanı, Safari Touch Events koruması, kaydırma kilidi ve çıkışta eski kaydırmanın geri gelmesi. Çizim koordinatları SVG ekran matrisiyle dönüştürülür.
- `src/audio.js`: Howler, yerel Türkçe kayıtlar, yalnızca Türkçe cihaz sesi yedeği, ses/efekt ayarları.
- `src/visuals.js`: yerel Fluent 3D görseller ve erişilebilir arayüz dönüşümü.
- `src/progress-sync.js`: Laravel'de oturuma ait ilerleme ve CSRF ile tamamlama/sıfırlama; statik sürümde yerel kayıt.
- `src/adventures.js`: 1. sınıf için seçilen harflerle sınırlı, üç görevli dokuz kısa hikâye; gerçek hece kartları ve uygun hikâyeler arasında sıra ile ilerleme. Ana sayfadaki macera düğmesi bu akışı başlatır.
- `src/island.js` / `island.css`: yaşayan ada haritası ve üç farklı görsel oyun: hayvanı besleyip oynatma, harf/hece vagonlarını teslimata gönderme, taşlardan geçip sandık ödülünü adaya yerleştirme. Ana giriş “Adayı keşfet”; kısa hikâyeler de bitişte bu oyunlara bağlanır.
- `src/island-model.js`: üç temada altışar yazılmış görev, seçilen harflerle sınırlı hedef/seçenekler, az harf için sade görevler ve doğrulanmış tamamlanma anahtarlarından kalıcı ada durumu. `island` backend modu; hazine konumu veya seçilen hayvan tek tamamlanma anahtarının sonundadır, aynı görevi tekrarlamak ikinci ödül vermez. Sunucudan geri yükleme son deneme sırasını korur.
- `src/celebration.js` / `celebration.css`: başarılı adımda Türkçe kayıtlı “Tebrikler!” ve “Hazırsan devam edebilirsin.”, modal içinde konfeti ve yalnızca “Devam et” ile ilerleme. Çalışmaya dönmek veya Escape adımı ilerletmez. Sessiz ve azaltılmış hareket tercihleri korunur.
- `resources/views/game.blade.php`, `routes/web.php`, `app/`, `database/`: gerçek Laravel 13 backend.
- `public/audio`: 448 aktif Türkçe kayıt / 578 metin eşleştirmesi, dört özgün efekt. Eski kayıtlar korunur. Kullanıcının seçtiği Emel sesi kullanılır; harf/hece/kelime/sayı telaffuzlarının eski dosyaları değişmedi. Ana paket için `generate-speech.py`, üç hikâye için ardından `complete-story-speech.py` çalıştırılır.
- `public/illustrations`: 112 Microsoft Fluent 3D çizimi ve MIT lisansı.

PHP kilitli paketleri PHP 8.4.1+ ister; üretim Docker imajı FrankenPHP/PHP 8.5 kullanır. Node 22, Vite, Howler, canvas-confetti ve Lucide kullanılır. `.env`, gerçek anahtarlar, veritabanı ve vendor/build çıktıları Git'e eklenmez.

## Derleme ve kontroller

`npm run build` Pages için `dist/` üretir; `npm run build:laravel` Laravel için `public/build/` üretir. PHP giriş dosyası Pages artefaktından çıkarılır. `npm run dev` Laravel Vite entegrasyonunu, `npm run dev:static` statik arayüz geliştirmesini açar.

Yeni akış için `npm run test:unit`, derlemeden sonra `node tests/learning.spec.cjs` ve PHP `LearningStateTest` kullanılır. Kelime girişini, geçersiz satırları, hece düzenlemeyi, öğretilmemiş harfleri, çift `n` kartlarını, gerçek ses yokken yetişkin desteğini, ipucunun bağımsızlık puanı vermemesini, gerçek dokunmayla yazı/rotasyon/yenileme ve beş sahnenin ilerlemesini doğrula. Test başarısını insan tarafından ses dinleme, fiziksel iPad veya uzun dönem öğrenme pilotu olarak sunma.

`php artisan test`, `node tests/audio-unit.cjs`, `node tests/adventures-unit.cjs`, `npm run build && node tests/tablet.spec.cjs` komutlarını kullan. `TEST_VIEWPORT=768x1024`, `TEST_FILTER` ve `TEST_BASE_URL` incelemeyi sınırlayabilir. Gerçek dokunma testleri CDP girdi kullanır; uygulamaya doğru cevap/başarı durumu enjekte edilmez.

Ada için ayrıca `node tests/island-unit.cjs` ve derlemeden sonra `node tests/island.spec.cjs` çalıştır. Üç dünyada gerçek bir turu tamamla; yanlış seçim, çift `n` vagonu, `na` + `ne`, devam modalı, hazine konumu, yenileme, tek harfle oynama, sıfırlama ve çıkışta gecikmiş efektlerin durmasını denetle. Windows yerel PHP testinde uygulama anahtarı yoksa yalnız test işlemi için geçici rastgele `APP_KEY` kullan; üretim anahtarını değiştirme.

Çocuk 7 yaşında, 1. sınıfa yeni başladı. Ebeveyn ayarlarında öğretmenin işlediği harfler seçilir; maceralardaki hedefler ve yanlış seçenekler yalnızca bu harflerden oluşur. Altı serbest oyun korunur. `adventures` backend modu ayrıca kaydedilir; bir macerayı bitirmek okuma ustalığı veya el yazısı onayı anlamına gelmez. Yeni denemeler yeni tamamlanma kimliği ve başlangıç zamanı alır.

29 harfin büyük/küçük biçimleri, hece/kelime/cümle sırası, `anne/etti/inat`, okuma-resim, 0/10 sayma, `100` için ayrı sıfır kartları, çizim iptal/yeniden çizme, boş-yanlış çizim reddi, mola, ayarlar ve kayıt sınanmalı. `ı/i`, `I/İ`, `ç/ş/ğ/ö/ü` korunmalı. Serbest yazı otomatik tanınmaz; ebeveyn onayı açık kalmalı.

## Yayın ve doğruluk

26 Ekim 2026 09:23 UTC: sürüm 5 uygulama kodu `15ca41e` main'e gönderildi.
Pages workflow `40298881520` başarılı; gerçek
`https://arslanserhat.github.io/harf-adasi/` adresinde iki tablet görünümünde
sekiz görevlik iki tam tur doğrulandı. Canlı JS varlığı yerel derlemeyle aynı;
ayrıntılar ve hash `docs/QA.md` içindedir. 64 JS testi, 28 PHP testi / 205 assertion,
18 yeni öğrenme ve 32 eski bölüm tablet senaryosu geçti. Bu yayın statiktir;
Pages'te Laravel API veya sunucu kaydı çalışmaz. Sonraki belge güncellemesi
uygulama kodunu değiştirmez. VPS'nin yeni sürümle güncellendiğini varsayma.

Sürüm 5'in bu bulut oturumunda GitHub erişimi doğrulandı. Güncel ağ durumu yeniden
okundu ve SSH denemesi tekrar `Connection refused` verdi; önceki başka cihazdan
yapılmış VPS yayını bu yeni kodun orada yayımlandığı anlamına gelmez. Aynı SSH
ayarlarını kullanıcıya yeniden yaptırma. Yeni sürümün Pages ve VPS durumlarını
ayrı raporla. Kontroller `docs/QA.md`; doğal ses isteğinin envanteri ve erişim
gereksinimleri `docs/voice-plan.md` içindedir. Bu oturumda ücretli ses hizmeti veya
ChatGPT ses aktarımı başlatılmadı; eksik yeni kayıtları varmış gibi sunma.

Pages workflow'u yalnızca Vite'nin statik çıktısını yayımlar. PHP ve sunucu veritabanı GitHub Pages'te çalışmaz. Laravel VPS yayını için `docs/deploy.md` ve ayrı uygulama Compose servisini kullan; mevcut uygulamanın portlarını, veritabanını veya vhost'unu ezme.

Önceki bulut ortamında SSH engelliydi; kullanıcının mevcut bilgisayarından SSH bağlantısı kuruldu ve ayrı Harf Adası Laravel yayını yapıldı. e-Tahlil ve diğer uygulamalar bizim komutlarımızla yeniden başlatılmadı, verileri değiştirilmedi. Önceden sağlıksız olan Celery süreçlerinde Docker tarafından exit=1 sonrası yeniden başlatmalar görüldü; bunlar özel operasyon raporunda kayıtlıdır. Harf Adası'nın özel operasyon notlarında adres, ayrı port, sertifika yenilemesi ve yedek betikleri bulunur. Erişim anahtarlarını, özel ortam dosyalarını ve veritabanlarını depoya yazma. Her yeni yayını canlı testlerle ayrıca doğrula; eski yayın kanıtı yeni kodun yayımlandığını göstermez.

Workflow success, HTTP 200 veya tek görüntü tek başına oynanabilirlik kanıtı değildir. Canlı HTTPS adreste doğru yeni varlıkları ve en az bir tamamlanmış etkileşimli turu doğrula. Fiziksel iPad, WebKit ve duyulan ses kalitesi otomasyonla doğrulanmadıysa ayrı belirt. Kullanıcıya Türkçe yanıt ver.
