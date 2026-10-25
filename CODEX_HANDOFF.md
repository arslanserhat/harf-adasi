# Harf Adası — Codex devir notu

## Görev ve kapsam
Türkçe okuma, yazma ve sayı alıştırmaları içeren mevcut oyunu iPad/tablet tarayıcısında bir HTTPS adresinden oynanabilir hale getir. Öncelik yeni bir tasarım veya baştan yazım değil, mevcut oyunun gerçek tarayıcıda çalışması ve GitHub Pages yayınının doğrulanmasıdır. Kullanıcı dosya indirmek, bilgisayar açmak veya Replit kullanmak istemiyor.

Yalnızca `arslanserhat/harf-adasi` deposunda çalış. Başlangıç dalı `main`. `pytest` ve diğer depolarda değişiklik yapma. Mevcut oyunu incelemeden daha küçük bir demo ile değiştirme; gereksiz framework, veritabanı, üyelik, ücretli hizmet veya sunucu ekleme.

## Doğrulanmış aktarım durumu (25 Ekim 2026)
- `main` kökünde `index.html` ve `.nojekyll` mevcut.
- Aktarılan `index.html`: 56.310 bayt; Git blob SHA `5f5b9ec70643fe89aabaf8c021e415db87e6b3a1`.
- `.github/workflows/oyunu-aktar.yml` tek seferlik aktarım için eklendi. Aktarım çalışması `40226833182` başarıyla tamamlandı. Bu bir YAYIN workflow'u değildir.
- Aktarım kaynak commit'i, eski `pytest` deposundaki `256623d4373b541cfd06b2dcdf516114a512c4c1` idi; dosya artık yeni depoda bulunduğundan tekrar oradan kopyalamaya gerek yok.
- Aktarım workflow'u dosyanın Git blob özetini ve gömülü JavaScript sözdizimini denetledi. Bunlar etkileşim testlerinin veya başarılı canlı yayının kanıtı değildir.
- Bu devir sırasında yeni deponun canlı sitesi doğrulanmadı. Önceki test ve yayın iddialarını yeni tarayıcı testlerinin yerine koyma.
- Gelecekteki düzeltmelerin eski dosya ile ezilmemesi için aktarım workflow'unu gözden geçir; oyun dosyasının bütünlüğünü teyit ettikten sonra bu depodaki geçici aktarım workflow'unun kaldırılmasını değişikliklerine dahil et.

## Korunacak işlevler
29 Türkçe harfin büyük/küçük biçimleri, harf eşleştirme ve iz sürerek çizme, hece/kelime oluşturma, okuma-resim eşleştirme, cümle sıralama, rakam çizme, nesne sayma ve 0–100 sayı etkinlikleri. Sevimli karakterler, büyük dokunma alanları, kısa yönergeler, çıkartma/ilerleme kaydı ve mola akışı korunmalı. Tamamlanan görevin ardından çocuk Devam'a basmadan kendiliğinden sonraki göreve geçilmemeli. Yanlış yanıtta cezalandırıcı mesaj olmamalı. Serbest yazı otomatik olarak güvenilir şekilde tanınmıyorsa ebeveyn kontrolü açıkça belirtilmeli; çizilmiş herhangi bir şekle otomatik doğru deme.

## Uygulama ve test sırası
1. Tüm `index.html` içeriğini ve workflow'u oku. Gerçek işlevleri ve eksikleri belirle; yalnızca dosya adlarına veya ana ekran görüntüsüne dayanma.
2. Yerel HTTP sunucusunda çalıştır. Konsol hataları, başlatma, düğmeler, sekmeler ve gezinmeyi denetle.
3. Kullanılabilir tarayıcı otomasyonuyla Chromium ve mümkünse WebKit'te; dokunmatik giriş ve 768×1024 / 1024×768 tablet görünümlerinde dene. WebKit veya fiziksel iPad testi yapılamadıysa bunu ayrı belirt.
4. En az şu akışları çalıştır: ana ekran → harf seç → doğru/yanlış eşleştirme → çizimi tamamla → Devam; kelime kartlarıyla `anne`, `etti`, `inat`; hece oluşturma; okuma-resim eşleştirme; cümle sıralama; 0 ve 10 nesne sayma; `100` için iki sıfırı ayrı kartlardan kullanma; rakam çizme; mola/devam; ebeveyn ayarları; yenileme sonrası ilerleme.
5. `ı/i`, `I/İ`, `ç/ş/ğ/ö/ü` ayrımını ve tekrarlanan harfleri kontrol et. Boş/yanlış çizimin başarı sayılmamasını, doğru çizimde takılmamasını, dokunma sırasında sayfanın çizim yerine kaymamasını ve yeniden çizme/geri alma akışlarını sınayarak düzelt.
6. Türkçe seslendirmeyi kullanıcı etkileşimiyle başlat. Ses motoru yoksa veya depolama engelliyse oyun açılmaya ve oynanmaya devam etmeli. Sesin otomasyon testinde duyulduğunu kanıtlayamıyorsan duyulduğunu iddia etme.

## GitHub Pages yayını
Mevcut yayın ayarlarını incele. Basit statik yayın için `main` dalının kökü kullanılabilir; Actions gerekiyorsa yalnızca yayınlanacak dosyaları artefakta koyan ayrı ve uygun bir Pages workflow'u kur. Proje alt yolu `/harf-adasi/` ile göreli bağlantıları ve varlıkları test et.

Pages ayarlarını yönetme yetkisi varsa mevcut kullanıcı isteği kapsamında yayını tamamla. Yetki yoksa bunu denemeden varsayma; gerçek engeli ve kullanıcının yapması gereken tek ayar adımını açıkça bildir. Yetki sınırını atlatma, sohbetten parola veya erişim anahtarı isteme, ücretsiz kapsam dışında işlem başlatma. Gerekliyse değişiklikleri ayrı bir dal ve PR olarak sun; izinsiz force-push, geçmiş silme veya başka depo değişikliği yapma.

## Teslim ölçütü
- Değişen dosyaları ve test komutları/sonuçlarını bildir; çalıştırılmayan testleri ayrı yaz.
- Yayının tamamlandığını deployment kaydıyla VE gerçek HTTPS sayfasının doğru oyun içeriğini sunduğunu kontrol ederek doğrula.
- Canlı sayfada en az bir etkileşimli oyun turunu dene; HTTP 200, tek ekran görüntüsü veya workflow success tek başına yeterli değildir.
- Doğrulanmamış/tahmini URL'yi hazır oyun bağlantısı diye sunma. Yapılamayan bir adım varsa mevcut durumu ve somut engeli belirt.
- Son kullanıcıya Türkçe cevap ver. Hedef teslim: tablette açılan oyun adresi, kısa kullanım bilgisi ve dürüst test özeti.
