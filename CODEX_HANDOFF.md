# Harf Adası — güncel devir notu

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
- `public/audio`: 379 aktif Türkçe kayıt / 509 metin eşleştirmesi, dört özgün efekt. Eski kayıtlar da korunur. Kullanıcının seçtiği Emel sesiyle 48 yönerge/kutlama (8 ada hareketi dahil) ve 10 hikâye girişi daha canlı konuşma dili ve okuma ritmiyle yeniden hazırlandı; harf/hece/kelime/sayı telaffuz kayıtları aynı kaldı. `scripts/generate-speech.py --profile warm-prompts` bu ayrımı korur.
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
