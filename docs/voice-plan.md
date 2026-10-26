# Ses envanteri ve doğal ses geçişi

Kullanıcı sesli sohbet sesini oyunda kullanmak istiyor. Bu oturumda ChatGPT Voice
sesini dışa aktarma, aynı sesi API'ye eşleme veya yeni bir ücretli ses üretimi
başlatma aracı/erişimi yoktur. Mevcut sesi hızlandırmak bu isteği karşılamaz.

## Mevcut yapı

- `src/audio.js`: Howler ile önceden üretilmiş dosya; kayıt yoksa gerçek Türkçe
  cihaz sesi; Türkçe ses de yoksa yazılı yönerge ve açık yetişkin desteği.
- `public/audio/manifest.json`: **509 metin anahtarı / 379 aktif MP3**, yaklaşık
  5,47 MB; ses `tr-TR-EmelNeural`. Dört özgün WAV efekt ayrıca bulunur.
- `scripts/generate-speech.py`: geliştirme zamanında Edge TTS kullanır. Bu araç,
  ChatGPT Voice kaydı veya doğal ses seçiminin onayı değildir.
- Sabit içerikler: harf adları, heceler, kelimeler, sayılar, cümleler ve hikâye
  anlatımları. Yeni bölümün özgün 22 anlatım/diyalog metni kaynakta tanımlıdır.
- Dinamik içerikler: yetişkinin eklediği kelimeler ve cümleler. Bunlar toplu ses
  üretimi için dış bir servise otomatik gönderilmez.

Güncel, salt okunur envanteri üretmek için:

```sh
node scripts/speech-inventory.mjs > speech-inventory.json
```

Betik yalnızca depodaki sabit metinleri okur; çocuk kaydı, tarayıcı depolaması,
ortam anahtarı veya kişisel ses dosyası okumaz. Ağ isteği yapmaz. Eksik yeni bölüm
kayıtlarını açıkça listeler. Bu sürümde eksik kayıtlar sessizce tamamlandı sayılmaz.

## Uygulanabilir geçiş

1. Aynı kısa Türkçe örnekler için onaylı kaynaktan 2–3 aday ses hazırlanır.
   `nine`, `nane`, `ı/i`, soru cümlesi ve hikâye diyaloğu birlikte dinlenir.
2. Yetişkin bir sesi seçtikten sonra sabit metinler topluca kayıt dosyalarına
   dönüştürülür. Harf adı ve harf sesi ayrı öğretim içerikleridir; hız değiştirme
   harf sesi doğrulaması yerine geçmez.
3. Dinlenmiş kayıtlar mevcut manifest anahtarlarına bağlanır; oyun motorunun
   yeniden yazılması gerekmez. Yeni paket tamamlanana kadar mevcut kayıtlar korunur.
4. Dinamik kelimeler için ayrıca onaylı sunucu hizmeti ve önbellek gerekir. Anahtar
   tarayıcıya yazılmaz; çocuk sesi veya kimliği bu iş için gerekli değildir.

OpenAI'nin [Voice açıklaması](https://help.openai.com/en/articles/20001274-chatgpt-voice)
ile [ses üretimi API belgesi](https://developers.openai.com/api/docs/guides/text-to-speech)
farklı ses seçenekleri ve iş akışları tanımlar; aynı ses eşlemesi varsayılamaz.
26 Ekim 2026'da incelenen API belgesi eski Speech API modelleri için 6 Ocak 2027
kapanış duyurusu ve Realtime'a geçiş notu içeriyor. Yeni bir sağlayıcı entegrasyonu
yapılırken o gün desteklenen model/iş akışı yeniden doğrulanmalıdır.

Bu görevde yeni ücretli üretim yapılmadı, API anahtarı istenmedi ve yeni bir ses
modeline çocuk verisi gönderilmedi. Ses kalitesinin insan tarafından dinlenmesi
ve ChatGPT Voice ile aynılık bu otomatik testlerle doğrulanmış değildir.
