# Laravel ilerleme API'si

Oyun aynı ön yüzü iki yayında kullanır. GitHub Pages sürümü tarayıcı kaydını kullanır. Laravel sürümünde sayfadaki `harf-backend=laravel` ve `csrf-token` meta etiketleri aynı kökendeki sunucu kaydını etkinleştirir.

Sunucu, tarayıcıyı şifreli Laravel oturum çereziyle ayırır. Çocuk adı veya e-posta adresi istenmez. İstemciden profil kimliği alınmaz. Oturumun örnek ayardaki süresi 30 gündür; çerezler silinirse eski anonim sunucu kaydına erişim yeniden kurulmaz. Bu model cihazlar arası üyelik/senkronizasyon sağlamaz. Yeni öğrenme kaydı, kelime listelerini ve kaldığı yerden devam etmek için sınırlı yazı çizgilerini de içerir; bu kayıt veritabanında şifrelenir. Çizgiler bir görüntü veya çalıştırılabilir SVG dosyası değil, doğrulanan sayısal `M/L` yol verileridir.

## İstekler

`GET /api/progress`, yalnızca mevcut tarayıcının `completed_items`, `totals` ve altı bölüm ile macera/ada modlarına ait `by_mode` özetini döndürür. Yanıt özel ve önbelleksizdir.

`POST /api/sessions` için JSON örneği:

```json
{
  "completion_id": "b4bd847e-292d-4bf9-8e09-2b1c1c3e6d48",
  "mode": "words",
  "item_key": "word:anne",
  "duration_seconds": 42,
  "writing_reviewed": true
}
```

- `completion_id`: alıştırma bitince bir kez üretilen UUID. Ağ tekrarlarında aynı değer kullanılır; aynı olay ikinci kez kaydedilmez veya değiştirilmez.
- `mode`: `letters`, `syllables`, `words`, `reading`, `sentences`, `numbers`, `adventures`, `island`.
- `item_key`: mevcut oyunun `type:key` değeri. Örneğin `digit:0`, `count:0` ve `number:0` farklı alıştırmalardır.
- `duration_seconds`: 0–3600 arasında tam sayı.
- `writing_reviewed`: ebeveynin açık onayı varsa `true`; yazı değerlendirmesi olmayan etkinlikte `null`. Bu alan otomatik el yazısı doğruluğu veya puanı değildir.

Yeni kayıt `201`, aynı olayın tekrarı `200` döndürür. Aynı alıştırmanın farklı zamanda tekrar yapılması yeni çalışma sayılır; ayrı tamamlanan alıştırma/çıkartma sayısını çoğaltmaz.

`DELETE /api/progress`, mevcut tarayıcının tamamlamalarını ve öğrenme kaydını sıfırlar; `reset: true` ve `learning_revision` döndürür. Ön yüzdeki mevcut ikinci sıfırlama onayından sonra çağrılır. İstemci öğretmen listelerini koruyarak yeni revizyonla geri kaydeder; gözlemler ve yarım oturum temizlenir.

## Uyarlanan öğrenme kaydı

`GET /api/learning` yalnızca bu oturumun `{state, revision, reset_revision}` yanıtını
döndürür. İlk kullanımda `state: null`, iki revizyon da `0` gelir. Yanıtlar
`private, no-store` kullanır.

`PUT /api/learning`, `{state: <version:1 snapshot>, base_revision: <integer>}` kabul
eder. State; listeler, seçili liste, en fazla 500 gözlem, kelime/harf bazında beceri
özetleri ve yarım kalan oturumdan oluşur. En fazla 20 liste, liste başına 100 kelime,
toplam 1000 kelime ve 512 KiB istek kabul edilir. Türkçe kelimeler, hecelerin
birleşimi, oturum görevleri, sonuçlar ve yazı çizgileri doğrulanır. Kimlik alanları
ve HTML kabul edilmez. State modeli `src/learning-model.js` içinde tanımlıdır.
`state.session.storyEpisode` isteğe bağlı `0..2` tamsayısıdır; eski kayıtlar `0`
ile açılır. Bölüm, görev sırası ve yazı taslağı birlikte geri yüklenir.

İlk kayıt `201`, güncelleme `200` ile `{saved:true, state, revision, reset_revision}` döndürür.
Revizyon tek bir koşullu veritabanı güncellemesiyle artar. Eski `base_revision`
gönderilirse `409` ile güncel `{saved:false, conflict:true, state, revision, reset_revision}` gelir.
İstemci ayrı gözlem kimliklerini birleştirip tekrarlar; aynı gözlem iki kez sayılmaz.

`DELETE /api/learning` yalnızca öğrenme kaydını sıfırlar; eski tamamlamalara ve
çıkartmalara dokunmaz. `{reset:true,revision,reset_revision}` döndürür. Sıfırlama revizyonu tutulur:
gecikmiş eski bir PUT, silinen gözlemleri yeniden oluşturamaz. Eski revizyonla
gelen istemci `state:null` çatışmasını aldığında eski kaydı yeniden yüklememelidir.
Son sıfırlamanın `reset_revision` değeri sonraki normal kayıtlarda da korunur.
İstemcinin bildiği revizyondan yeniyse, sunucudaki anlık kayıt esas alınır;
öğretmen listeleri geri kaydedilmiş olsa bile eski gözlemler birleştirilmez.

Bu endpointler uygulama içi anonim kayıt içindir; dışarıdan profil kimliği almaz,
çocukların hesapları arasında ilerleme taşımaz ve bağımsız bir değerlendirme hizmeti değildir.

Yazan/silen istekler normal Laravel `web` oturum ve CSRF korumasını kullanır. `X-CSRF-TOKEN` başlığı sayfadaki meta etiketten alınır; çerezler aynı kökene gönderilir. Tokenlar kaynak koduna veya depoya yazılmaz. Geçersiz veri `422`, eksik/uyumsuz CSRF `419`, aşırı istek `429` döndürür.

`GET /healthz`, yalnızca uygulamanın çalıştığını gösteren `status` ve `application` alanlarını döndürür; yapılandırma veya gizli değer yayımlamaz.
