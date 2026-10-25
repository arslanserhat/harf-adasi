#!/bin/sh
set -eu
umask 027

if [ -z "${APP_KEY:-}" ]; then
    echo 'APP_KEY is missing. Configure .env.production using scripts/generate-app-key.sh before starting.' >&2
    exit 1
fi

if [ "${DB_CONNECTION:-sqlite}" != 'sqlite' ]; then
    echo 'This image is configured for SQLite. Use a separately configured image for another database driver.' >&2
    exit 1
fi

case "${DB_DATABASE:-/app/storage/app/harf-adasi.sqlite}" in
    /app/storage/*) ;;
    *) echo 'DB_DATABASE must remain inside persistent /app/storage.' >&2; exit 1 ;;
esac

mkdir -p /app/storage/app/public /app/storage/framework/cache/data \
    /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs \
    /app/bootstrap/cache
touch "${DB_DATABASE:-/app/storage/app/harf-adasi.sqlite}"

php artisan config:cache --no-interaction
php artisan migrate --force --no-interaction
php artisan view:cache --no-interaction

exec "$@"
