# Altı macera dünyası

Ana sayfadaki altı kısa katalog girişi, ayrı oynanışları olan altı dünyaya
dönüştürüldü. Önceki altı katalog “Serbest alıştırmalar” altında korunur;
sekiz görevli mektup hikâyesi ayrıca açılabilir. Ana giriş, yarım kalan macera
varsa ona döner; yoksa gözlenen becerilere uygun bir dünya önerir.

| Dünya | Bir turdaki işler |
| --- | --- |
| Fener Atölyesi | İşareti dinleyip seç, tabelaya yaz, başka işareti hazırla, ilk işareti örneksiz yeniden yaz. |
| Hece Ekspresi | İki yükün hece vagonlarını bağla, doğru durağı bul, eksik vagonu tamamla, ilk yükü tekrar hatırlayıp gönder. |
| Kelime Pazarı | İki siparişi dinle, harf etiketlerini hazırla, paketi teslim et, ilk kelimeyi sonradan kendin yaz. |
| Orman Dedektifi | Yazılı kelimenin resmini/anlamını bul, ipuçlarıyla doğru yolu seç, ilk ipucunu yeniden kullan. |
| Mektup Postanesi | Öğretmenin cümlesini kelimelerden kur, adresini bul, ikinci mesajdan sonra ilk mesajı yeniden tamamla. |
| Şenlik Bahçesi | Gerçek nesneleri topla, miktarı seç, eksik veya fazla nesneleri ekleyip çıkararak sepeti düzenle. |

Her tur altı gerçek cevap ve çocuğun açık Devam eylemleriyle tamamlanır.
Animasyon, geçen süre veya hatıra sayısı öğrenme kaydı üretmez. Aynı kelime,
başka görevlerden sonra tekrar gelir. Başarı kalıcı ustalık anlamına gelmez;
mevcut aralıklı hatırlama modeli sonraki günlerin gözlemlerini ayrıca tutar.

`quest-model.js` öğretmen listesini, yetişkinin düzenlediği heceleri ve okulda
işlenen harfleri kullanır. Bilinmeyen kelimelere anlam/cümle uydurulmaz. Anlam
veya cümle gerektiren dünyada gerekli içerik yoksa yetişkin listeyi tamamlar.
`recommendQuestKind()` gerçek saatle süresi gelen/zorlanılan beceriye öncelik
verir; mümkünse bitirilen dünyadan farklı ve kullanılabilir bir dünya açar.

Kelime sırası `learning-model.js` içindeki ortak `orderPracticeWords()` ile
belirlenir. Tamamlanan turlarda **hedef olarak** çalışılan kelimeler bütün
dünyalar arasında sayılır; seçenek olarak görünmek çalışılmış sayılmaz.
En az çalışılan kelimeler sıraya girer. Vadesi gelmiş/zorlanılmış bir kelime
ilk yeri alabilir; ikinci yer yine yeni veya az çalışılan kelimeye kalır.
Son turdaki veya son gözleminden on dakika geçmemiş kelime, sırf başka bir
becerisi zayıf diye hemen yeniden öncelik kazanmaz. Böylece ilk iki kelime
arasında gidip gelinmez. Aynı seçim kuralı sekiz görevli hikâyede de kullanılır.

Bir öğretmen listesi en fazla 100 kelimedir; başlangıçtaki sekiz örnek
kapasite sınırı değildir. Kelime macerası tur başına iki hedefi altı görevde
çalıştırır; sonraki turlar listenin kalanına geçer. Kelime başına uygun anlam
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

Sesler kullanıcı yönlendirmesiyle Pixabay'dan seçildi. Doğru cevapta miraclei
`sample_confirm_success03`, bitişte Universfield `Level Complete` kullanılır.
Dosyalar kaynak MP3'lerle aynı; çalışma sırasında ses düzeyi ayarlanır.
Piyano setine yedek dönüş yoktur. Lisans ve kaynaklar
`public/audio/LICENSE-pixabay-v4.txt` ve `pixabay-v4.sources.json` içindedir.
