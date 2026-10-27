# Altı macera dünyası

Ana sayfadaki altı kısa katalog girişi, ayrı oynanışları olan altı dünyaya
dönüştürüldü. Önceki altı katalog “Serbest alıştırmalar” altında korunur;
sekiz görevli mektup hikâyesi ayrıca açılabilir. Ana giriş, yarım kalan macera
varsa ona döner; yoksa gözlenen becerilere uygun bir dünya önerir.

| Dünya | Bir turdaki işler |
| --- | --- |
| Fener Atölyesi | İşareti dinleyip seç, tabelaya yaz, başka işareti hazırla, ilk işareti örneksiz yeniden yaz. |
| Hece Ekspresi | Bağımsız öğretmen hecelerini dinle, harflerden kur ve taşı; kelime kaynağında gerçek hece vagonlarını birleştir. |
| Kelime Pazarı | İki siparişi dinle, harf etiketlerini hazırla, paketi teslim et, ilk kelimeyi sonradan kendin yaz. |
| Orman Dedektifi | Yazılı kelimenin resmini/anlamını bul, ipuçlarıyla doğru yolu seç, ilk ipucunu yeniden kullan. |
| Mektup Postanesi | Öğretmenin cümlesini kelimelerden kur, adresini bul, ikinci mesajdan sonra ilk mesajı yeniden tamamla. |
| Bahçe Şenliği | 0–10 havuzundan miktarlar seç; gerçek nesneleri topla, eksik veya fazla nesneleri düzenle. Sıfır da açık bir cevap gerektirir. |

Her tur altı gerçek cevap ve çocuğun açık Devam eylemleriyle tamamlanır.
Animasyon, geçen süre veya hatıra sayısı öğrenme kaydı üretmez. Aynı kelime,
başka görevlerden sonra tekrar gelir. Başarı kalıcı ustalık anlamına gelmez;
mevcut aralıklı hatırlama modeli sonraki günlerin gözlemlerini ayrıca tutar.

`quest-model.js` öğretmen listesini, yetişkinin düzenlediği heceleri ve okulda
işlenen harfleri kullanır. Bilinmeyen kelimelere anlam/cümle uydurulmaz. Anlam
veya cümle gerektiren dünyada gerekli içerik yoksa yetişkin listeyi tamamlar.
`recommendQuestKind()` gerçek saatle süresi gelen/zorlanılan beceriye öncelik
verir; mümkünse bitirilen dünyadan farklı ve kullanılabilir bir dünya açar.

Ortak sıra `content-selection.js` ve `learning-model.js` içindeki
`orderPracticeWords()` ile belirlenir. Harf, hece, kelime, cümle, sayı ve hazır
etkinlikler için ayrı havuzlar aynı kalıcı depoyu kullanır. Açılan görevin
**hedefi** kaydedilir; yanlış seçenekler havuzu tüketmez. Bu gösterim kaydı
duyma, doğru cevap, puan veya öğrenme kanıtı değildir. Tamamlamadan başka
oyuna geçmek sıra başına dönmez; aynı aşamanın yenilenmesi de iki kez sayılmaz.

Önce bu döngüde görülmemiş uygun öğeler, ardından en eski gösterimler gelir.
Yeni eklenen öğe eski yüksek sayaçları yakalamak için sürekli tekrarlanmaz;
bir kez öne geçip döngüye katılır. Sonlu havuz bitince farklı sırayla yeni
döngü başlar; tek öğelik havuzda sınırsız tekrarsızlık vaat edilmez. Tur
içindeki bilinçli hatırlama adımları korunur. Vadesi gelen/zorlanılan kelime
ilk yeri alabilir; ikinci yer yeni veya az karşılaşılan kelimeye kalır.
Son tur ve on dakikalık yakın karşılaşma koruması, aynı öğenin her turu
kaplamasını engeller. Sekiz görevli hikâye, serbest alıştırmalardaki “Sıradaki”
girişi, hazır kısa hikâyeler ve ada görevleri aynı geçmişi kullanır.

Bir öğretmen listesi en fazla 100 kelimedir; başlangıçtaki sekiz örnek
kapasite sınırı değildir. Kelime macerası tur başına iki hedefi altı görevde
çalıştırır; sonraki turlar listenin kalanına geçer. Öğretmen ayrıca kelime
zorunluluğu olmadan 29 harfe ve 100 bağımsız heceye kadar girebilir. Harf ve
heceler kelime alanına doldurulmaz. Hece girdisi Türkçe harf ve tek ünlülü
hece yapısıyla doğrulanır; rastgele anlamsız kelimeler üretilmez. Yetişkinin
eski kelime parçaları korunur, fakat geçerli hece olmayan parçalar Hece
Ekspresi hedefi olmaz. Kelime başına uygun anlam
veya cümle yoksa bu içerik uydurulmaz. Öğretilmemiş harfler ayrıca gösterilir.

`teacher-library.js/css` aktif listenin hecelerini, kelimelerini, anlamlarını
ve yetişkinin yazdığı cümlelerini serbest alıştırmalarda ilk sıraya getirir.
Listenin `starter` kimliğiyle düzenlenmiş olması özel kelimeleri yok saymaz.
Eski hazır kartlar, açıkça ayrı ve başlangıçta kapalı standart kütüphanededir.
Öğretmen listesi boşken kendiliğinden bu hazır kelimelere geçilmez. Eski kısa
hikâyeler ve ada görevleri hazır içerik olarak korunur; bunların yanında
öğretmen kelimeleriyle değişen dünyaya geçiş sunulur.

`quests.js` sahne etkileşimlerini ve manuel devamı yönetir. Hata/ipucu sayıları
olaylara fark olarak yazılır; bir yanlış ve ardından doğru cevap iki hata
sayılmaz. Yazı SVG üzerinde alınır, yetişkin onayı gerekir; otomatik el yazısı
tanıma yapılmaz. Yazı alanının koruması yalnız onu oluşturan bileşence kapatılır.
Değişmeyen listede yarım tur ve çizim geri gelir; kelime/hece/cümle veya
işlenen harfler değişirse eski planın yanıtları yeni kelimelere taşınmaz,
güncel listeyle yeni tur hazırlanır ve çocuğa kısa bir bilgi gösterilir.

`quest-scenes.js` ve `quests.css` doğru yerleştirilen parçalardan vagon, paket,
tabela, yol taşı, mektup veya bitki oluşturur. Yeni altı arka plan, bu proje
için üretilmiş özgün görsellerdir. Hareket durdurma ve azaltılmış hareket
uygulanır. Telefon oyuncusu cevabı ve Devam düğmesini kullanılabilir ekranda
tutar; yazıda kaydırma kilidi korunur.

Macera geçmişi ve yarım tur `harf-adasi-quests-v1` yerel kaydında saklanır.
Eksik cevap dizileri/tutarsız doğru bayrakları tamamlanma üretmez. Gerçek harf
ve kelime gözlemleri mevcut öğrenme deposuna kaydedilir; Laravel sürümünde
onun mevcut eşitlemesini kullanır. Sayılar okuma/yazma gözlemi sayılmaz.
Macera konumu ve sayısal geçmiş için yeni bir sunucu uç noktası eklenmedi.
Tam sıfırlama öğretmen listelerini koruyarak bu macera geçmişini de temizler.
`harf-adasi-content-v1` gösterim sırasını ayrıca saklar; eski gerçek gözlemler
ve tamamlanmalar bir kez başlangıç verisi olabilir. Eski yarım plana yalnız
güncel havuz metadata'sı eklenir; çizim ve cevaplar korunur, geçmiş gösterim
uydurulmaz. İçerik sırası bu tarayıcıya aittir. Öğretmen harf/hece alanları
Laravel'in mevcut öğrenme durumuna dahildir; seçim deposu ayrı yerel kayıttır.

Çocuk hitapları `child-profile.js` üzerinden seçili yerel profilden gelir;
ad yoksa karşılama nötrdür. Mevcut projede hesapla giriş bulunmaz; profil
yalnız bu cihazdaki görünür hitabı değiştirir, mevcut anonim ilerleme ve
öğretmen listeleri ortaktır. Gerçek öğretmen hedefleri ad değiştirme işlemine
katılmaz. Kişisel ad ses metinlerine veya ağ isteklerine eklenmez. Eski
kayıtlı anlatım sabit karakter adını söyleyebilir; ses kişiselleştirilmiş değildir.

Sesler kullanıcı yönlendirmesiyle Pixabay'dan seçildi. Doğru cevapta miraclei
`sample_confirm_success03`, bitişte Universfield `Level Complete` kullanılır.
Dosyalar kaynak MP3'lerle aynı; çalışma sırasında ses düzeyi ayarlanır.
Piyano setine yedek dönüş yoktur. Lisans ve kaynaklar
`public/audio/LICENSE-pixabay-v4.txt` ve `pixabay-v4.sources.json` içindedir.
