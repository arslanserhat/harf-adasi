# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY src ./src
COPY public ./public
COPY resources ./resources
COPY vite.config.js index.html .nojekyll ./
RUN npm run build:laravel

FROM composer:2 AS dependencies
WORKDIR /app
COPY composer.json composer.lock ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    --mount=type=secret,id=ca_bundle,required=false \
    if [ -s /run/secrets/ca_bundle ]; then export COMPOSER_CAFILE=/run/secrets/ca_bundle; \
    elif [ -s /run/secrets/proxy_ca ]; then export COMPOSER_CAFILE=/run/secrets/proxy_ca; fi; \
    composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress
COPY app ./app
COPY database ./database
RUN composer dump-autoload --no-dev --classmap-authoritative --no-scripts --no-interaction

FROM dunglas/frankenphp:1-php8.5 AS application
WORKDIR /app
RUN --mount=type=secret,id=ca_bundle,required=false \
    --mount=type=secret,id=proxy_ca,required=false \
    set -eu; \
    if [ -s /run/secrets/ca_bundle ]; then \
      export CURL_CA_BUNDLE=/run/secrets/ca_bundle SSL_CERT_FILE=/run/secrets/ca_bundle; \
    elif [ -s /run/secrets/proxy_ca ]; then \
      export CURL_CA_BUNDLE=/run/secrets/proxy_ca SSL_CERT_FILE=/run/secrets/proxy_ca; \
    fi; \
    if [ -n "${SSL_CERT_FILE:-}" ] && [ -d /etc/apt/apt.conf.d ]; then \
      printf 'Acquire::https::CaInfo "%s";\n' "$SSL_CERT_FILE" > /etc/apt/apt.conf.d/99-harf-build-ca; \
    fi; \
    install-php-extensions pdo_sqlite opcache; \
    rm -f /etc/apt/apt.conf.d/99-harf-build-ca

ENV APP_ENV=production \
    APP_DEBUG=false \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/app/storage/app/harf-adasi.sqlite \
    CACHE_STORE=file \
    QUEUE_CONNECTION=sync \
    LOG_CHANNEL=stderr \
    XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

COPY app ./app
COPY bootstrap ./bootstrap
COPY config ./config
COPY database/migrations ./database/migrations
COPY resources ./resources
COPY routes ./routes
COPY public ./public
COPY artisan composer.json composer.lock ./
COPY --from=dependencies /app/vendor ./vendor
COPY --from=frontend /app/public/build ./public/build
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/entrypoint.sh /usr/local/bin/harf-entrypoint

RUN mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
      storage/framework/views storage/logs bootstrap/cache /config /data \
    && chmod -R a+rX /app \
    && chown -R www-data:www-data storage bootstrap/cache /config /data \
    && chmod 0644 /etc/caddy/Caddyfile \
    && chmod 0755 /usr/local/bin/harf-entrypoint \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

USER www-data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD php -r 'exit(@file_get_contents("http://127.0.0.1/healthz") === false ? 1 : 0);'

ENTRYPOINT ["/usr/local/bin/harf-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
