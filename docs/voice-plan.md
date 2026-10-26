# Ses kayıtları ve ChatGPT Voice isteğinin durumu

## Son geri bildirim düzeltmesi

Noktalı `al.` anahtarı bulunmadığı halde noktasız `al` kaydı vardı. İstemci artık
tam eşleşmeden sonra yalnız Türkçe tek kelimenin son noktalamasız kaydını arar.
`1.` veya bütün cümleler bu eşlemeye girmez. Bu gerçek bir kayıt seçimi hatasıydı;
bildirilen bütün telaffuz sorunlarının tek nedeni olduğu varsayılmaz.

`scripts/refresh-feedback-speech.py` aynı Emel sesiyle kısa ve yeni geri bildirim
kayıtlarını üretir; bütün manifesti sıfırlamaz. `al` kaydı `Anne nane al.` cümlesinin
WordBoundary zamanlarından alınır (0,765–1,480 saniye); hece tahminiyle kesilmez.
Eski ~6,8 saniyelik tebrik + devam zinciri tek 2,448 saniyelik tebrikle değişti.
Yolculuk kartının ayrı 4,968 saniyelik kaydı vardır. Bunlar yeni bir ses oyuncusu
veya ChatGPT Voice değildir; ses kalitesi insan tarafından dinlenmiş sayılmaz.

Güncel manifest 579 anahtar / 448 aktif MP3 içerir; gerekli 77 sabit metnin kaydı
korunur. Dört yeni v2 WAV efekti ayrı dosyalardır: ahşap dokunuş, yumuşak vurmalı
onay, kâğıt fırçalaması ve kısa akustik kutlama. `generate-soft-effects.py` yerel
üretir; eski nota dizisi kullanılmaz. Özel öğretmen kelimeleri dışarı gönderilmedi.

ChatGPT Voice sesini bu oturumdan dışa aktaramıyoruz veya aynı sesi API ile
kullanabildiğimizi varsayamıyoruz. Sürüm 5.1 kayıtlarında mevcut Türkçe
`tr-TR-EmelNeural` kullanıldı; bunlar ChatGPT sesli sohbet kayıtları değildir.

## Sürüm 5.1 kayıtları

Mevcut Edge TTS kayıt hattı yeniden denendi ve çalıştı. Önce zaten onaylı,
herkese açık selamlama yalnızca scratch dosyasına üretildi; ardından depodaki
sabit metinlerin eksik 69 kaydı tamamlandı. Yeni ücretli sağlayıcı, API anahtarı
veya çocuk kaydı kullanılmadı. Öğretmenin tarayıcıda girdiği kelimeler gönderilmedi.

- 578 metin anahtarı / 448 aktif MP3; dört WAV efekt ayrıca korunur.
- Üç özgün hikâyede 66 sabit anlatım/diyalog vardır.
- Hikâyeler ve ilk kelime/cümle paketi için gerekli 77 metnin tamamının hazır
  kaydı vardır. Envanterde eksik sayı 0.
- Hikâye kayıtları mevcut warm-prompts hattının +1% anlatım ritmini kullanır;
  eski öğrenme hedeflerinin kayıtları değiştirilmedi.
- Gerekli 77 dosyanın MP3 biçimi ve pozitif süresi ffprobe ile denetlendi.
  Bu, insan tarafından dinlenmiş ses kalitesi veya gerçek oyuncu kaydı değildir.

## Yeniden üretme

```sh
node scripts/speech-inventory.mjs > speech-inventory.json
python scripts/complete-story-speech.py --dry-run
python scripts/complete-story-speech.py
```

Envanter yalnızca depodaki sabit metinleri ve manifesti okur; ağ isteği yapmaz.
Tamamlama betiği mevcut Emel sesini/kayıtlarını korur ve yalnız eksikleri üretir.
Bütün dosyalar geçerli olmadan manifesti değiştirmez. Eski generate-speech.py ile
ana paket yeniden üretildiyse ardından bu tamamlama betiği çalıştırılarak üç
hikâye tekrar manifeste eklenir. TLS doğrulaması açık kalır.

## Dinamik kelimeler ve ses kalitesi

src/audio.js önce hazır dosyayı çalar. Yeni öğretmen kelimesinin kaydı yoksa
sadece gerçek Türkçe cihaz sesi kullanılır; Türkçe ses yoksa açık yetişkin
desteği gerekir. İngilizce ses yedeği yoktur. Hazır kayıt, cihaz sesi ve yetişkin
okuması birbirinin yerine bağımsız dinleme kanıtı olarak gösterilmez.

Daha doğal bir anlatıcıya geçiş için nine, nane, ı/i, soru cümlesi ve hikâye
diyaloğu içeren örneklerin insan tarafından dinlenip seçilmesi gerekir. Mevcut
sesi hızlandırmak, ChatGPT Voice isteğinin karşılanması değildir. Seçilen kayıtlar
manifest anahtarlarına bağlanabilir; dinamik kelimeler için ayrıca onaylı sunucu
hizmeti/önbellek gerekir. Anahtar tarayıcıya yazılmaz.

OpenAI'nin [Voice açıklaması](https://help.openai.com/en/articles/20001274-chatgpt-voice)
ve [ses üretimi API belgesi](https://developers.openai.com/api/docs/guides/text-to-speech)
ayrı iş akışları tanımlar; aynı ses varsayılamaz. Bu görevde ücretli OpenAI ses
üretimi veya çocuk sesi/kimliği aktarımı başlatılmadı.
