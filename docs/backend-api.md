# Laravel ilerleme API'si

Oyun aynı ön yüzü iki yayında kullanır. GitHub Pages sürümü tarayıcı kaydını kullanır. Laravel sürümünde sayfadaki `harf-backend=laravel` ve `csrf-token` meta etiketleri aynı kökendeki sunucu kaydını etkinleştirir.

Sunucu, tarayıcıyı şifreli Laravel oturum çereziyle ayırır. Çocuk adı, e-posta adresi veya çizilen el yazısı gönderilmez. İstemciden profil kimliği alınmaz. Oturumun örnek ayardaki süresi 30 gündür; çerezler silinirse eski anonim sunucu kaydına erişim yeniden kurulmaz. Bu model cihazlar arası üyelik/senkronizasyon sağlamaz.

## İstekler

`GET /api/progress`, yalnızca mevcut tarayıcının `completed_items`, `totals` ve altı bölüme ait `by_mode` özetini döndürür. Yanıt özel ve önbelleksizdir.

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
- `mode`: `letters`, `syllables`, `words`, `reading`, `sentences`, `numbers`.
- `item_key`: mevcut oyunun `type:key` değeri. Örneğin `digit:0`, `count:0` ve `number:0` farklı alıştırmalardır.
- `duration_seconds`: 0–3600 arasında tam sayı.
- `writing_reviewed`: ebeveynin açık onayı varsa `true`; yazı değerlendirmesi olmayan etkinlikte `null`. Bu alan otomatik el yazısı doğruluğu veya puanı değildir.

Yeni kayıt `201`, aynı olayın tekrarı `200` döndürür. Aynı alıştırmanın farklı zamanda tekrar yapılması yeni çalışma sayılır; ayrı tamamlanan alıştırma/çıkartma sayısını çoğaltmaz.

`DELETE /api/progress`, mevcut tarayıcının kayıtlarını sıfırlar. Ön yüzdeki mevcut ikinci sıfırlama onayından sonra çağrılmalıdır.

Yazan/silen istekler normal Laravel `web` oturum ve CSRF korumasını kullanır. `X-CSRF-TOKEN` başlığı sayfadaki meta etiketten alınır; çerezler aynı kökene gönderilir. Tokenlar kaynak koduna veya depoya yazılmaz. Geçersiz veri `422`, eksik/uyumsuz CSRF `419`, aşırı istek `429` döndürür.

`GET /healthz`, yalnızca uygulamanın çalıştığını gösteren `status` ve `application` alanlarını döndürür; yapılandırma veya gizli değer yayımlamaz.
