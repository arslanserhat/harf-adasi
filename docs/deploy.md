# Laravel sürümünü VPS'de yayımlama

Bu kurulum yalnızca Harf Adası içindir. Ayrı Compose proje adı, ayrı `harf-storage` volume'u ve yalnızca `127.0.0.1:8086` üzerinde açılan port kullanılır. Mevcut etahlil veya başka bir uygulamanın dosyaları, veritabanı, volume'ları ve Nginx vhost'u değiştirilmez.

## Erişim durumu

**27 Ekim 2026 güncel yerel ortam:** Kullanıcının Windows bilgisayarından
VPS'ye SSH erişimi sağlandı. Harf Adası `/srv/harf-adasi` altında, mevcut
`harf-adasi` Compose projesi ve `harf-adasi_harf-storage` volume'uyla çalışır.
Kaynak Compose'a ek olarak özel `/srv/harf-adasi-ops/compose.runtime.yaml`
kaynak sınırları kullanılır; bu üretim override'ını sonraki yayında koruyun.

**Ana adres: https://harfadasi.com.tr/**. Apex ve www A kayıtları doğru
VPS'yi gösterir. Harf'e ait ayrı Nginx vhost'u `127.0.0.1:8086` uygulamasına
gider; HTTP ve www ana HTTPS adresine yönlenir. Ayrı alan adı sertifikası
25 Ocak 2027'ye kadar geçerlidir ve `/etc/letsencrypt/live/harfadasi.com.tr/`
altındadır. Certbot webroot'u `/srv/harf-adasi-ops/acme`, zamanlayıcısı
`certbot.timer` ve Harf'e özel Nginx reload kancası etkinleştirildi. Yalnız
bu sertifikanın yenileme denemesi başarıyla geçti.

Eski IP/8446 erişimi korunmuştur. Üretim APP_KEY veya veritabanı yolu
değiştirilmez; kullanıcı açıkça izin vermeden yedek/veritabanı kopyası ya da
restore oluşturulmaz. Alan adına geçişte eski IP kökenindeki tarayıcı
çerezleri ve yerel kayıtlar otomatik taşınmaz.

**Tarihsel kayıt:** Önceki bir kullanıcı bilgisayarı oturumundan ayrı Harf
Adası Laravel yayını yapılmış ve canlı etkileşimli tur doğrulanmıştı. Sunucuya
özgü adres, port, sertifika yenilemesi ve yedekleme ayrıntıları özel operasyon
notlarında tutulur. Bu eski oturum ve özel notlar güncel executor'da erişilebilir
varsayılmaz. Dockerfile ve betiklerin bulunması tek başına yeni bir yayın
kanıtı değildir; aşağıdaki canlı doğrulamalar her güncellemede tekrarlanır.
Sunucuya ait özel erişim bilgileri depoda tutulmaz.

## Gereksinimler ve ilk kurulum

VPS'de Docker Engine, Docker Compose v2 ve `curl` bulunmalı. Harf Adası için yönetebildiğiniz ayrı bir alan adı ve HTTPS sertifikası hazırlayın. Aşağıdaki örnek alan adını gerçek alan adınızla değiştirin; alan adı veya sertifika sahipliği varsayılmaz.

Uygulamayı ayrı bir dizine alın:

```sh
git clone https://github.com/arslanserhat/harf-adasi.git /srv/harf-adasi
cd /srv/harf-adasi
cp .env.production.example .env.production
chmod 600 .env.production
```

`.env.production` içindeki `APP_URL` ve gerekirse `HARF_PORT` değerlerini düzenleyin. `APP_DEBUG=false`, `APP_ENV=production` ve HTTPS için `SESSION_SECURE_COOKIE=true` bırakın. Gerçek `.env.production` ve anahtarlar Git'e eklenmez.

```sh
docker compose --env-file .env.production build
./scripts/generate-app-key.sh
./scripts/deploy-vps.sh
```

Anahtar üretim betiği `APP_KEY` değerini doğrudan özel ayar dosyasına yazar, ekrana basmaz ve mevcut anahtarı değiştirmez. Anahtarı sonraki yayımlarda koruyun; değiştirmek mevcut şifreli oturumları geçersiz kılar.

Uygulama FrankenPHP/Caddy ile gerçek PHP HTTP sunucusu olarak çalışır; `artisan serve` üretim sunucusu olarak kullanılmaz. Runtime `www-data` kullanıcısıdır. Compose, yalnızca bu container'ın ağ ad alanında düşük porta bağlanmasına izin verir. Başlangıçta SQLite dosyası kalıcı storage içinde oluşturulur, Laravel migration'ları ve cache hazırlığı çalışır. Başarısız migration veya eksik anahtar uygulamayı sağlıklı göstermeden başlatmayı durdurur.

## HTTPS reverse proxy

`deploy/nginx.example`, mevcut Nginx'e eklenecek **yeni** vhost için bir şablondur. `harf.example.com` ve sertifika yollarını değiştirin. Örneği mevcut bir uygulamanın vhost'unun üstüne kopyalamayın. Yapılandırmayı `nginx -t` ile doğrulamadan yeniden yüklemeyin.

Laravel'in HTTPS başlıklarını doğru yorumlaması için `.env.production` içindeki `TRUSTED_PROXIES` değerine gerçek reverse-proxy/Docker gateway adresini yazın. Gateway'i görmek için:

```sh
docker network inspect harf-adasi_default --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
```

Wildcard yerine bu belirli adresi kullanın. Ayar değişince `./scripts/deploy-vps.sh` container'ı yeni ortamla oluşturur. Standart portu değiştirirseniz Nginx `proxy_pass` değerini de aynı uygulamanın yeni portuna göre düzenleyin.

## Güncelleme ve doğrulama

Bu uygulamanın dizininde:

```sh
git pull --ff-only
./scripts/deploy-vps.sh
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=80 app
```

Healthcheck PHP HTTP yanıtını kontrol eder. Yayın tamamlandı demeden ayrıca gerçek HTTPS adresini tablette açın; çizim, ses, kalıcı ilerleme ve en az bir tamamlanmış oyun turunu doğrulayın. Yerel PHP feature ve tarayıcı testlerinin sonuçları ile VPS/canlı testlerini ayrı raporlayın.

Veritabanı ve oturumlar `harf-storage` volume'u içinde `/app/storage` altında kalır. Güncelleme betiği volume silmez ve `down --volumes` çalıştırmaz. Yedekleri bu volume'dan alın; kaynak kodu yedeği veritabanı yedeği değildir.

## Yönetilen çalışma ortamında image build'i

Bu bölüm, proxy CA kullanan geliştirme ortamı içindir; normal VPS build'i için gerekmez. Docker'ın mevcut proxy ve registry yapılandırması korunur. CA'lar yalnızca BuildKit secret mount olarak kullanılır; image'a kopyalanmaz ve TLS doğrulaması kapatılmaz.

```sh
docker build \
  --secret id=proxy_ca,src="$NODE_EXTRA_CA_CERTS" \
  --secret id=ca_bundle,src=/etc/ssl/certs/ca-certificates.crt \
  -t harf-adasi:local .
```

Compose için `deploy/compose.build-proxy.yaml` override'ı da kullanılabilir:

```sh
HARF_PROXY_CA_FILE="$NODE_EXTRA_CA_CERTS" \
HARF_CA_BUNDLE_FILE=/etc/ssl/certs/ca-certificates.crt \
docker compose --env-file .env.production \
  -f compose.yaml -f deploy/compose.build-proxy.yaml build
```

Bu değişkenler yalnızca sağlanan CA dosyalarının yolları olmalıdır. Sertifikalar, ortam değişkenleri veya erişim anahtarları image katmanlarına, build argümanlarına ya da depoya yazılmaz.
