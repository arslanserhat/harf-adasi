#!/bin/sh
set -eu

harf_project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$harf_project_dir"

if [ ! -f .env.production ]; then
    cat >&2 <<'TEXT'
Harf Adası production configuration is missing.
Run these steps in THIS application's directory on the VPS:
  cp .env.production.example .env.production
  chmod 600 .env.production
Set APP_URL to your own HTTPS domain, then build the image and generate its key:
  docker compose --env-file .env.production build
  ./scripts/generate-app-key.sh
Then run ./scripts/deploy-vps.sh again.
Do not paste passwords, APP_KEY, or SSH private keys into chat.
TEXT
    exit 2
fi

docker compose version >/dev/null
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build
docker compose --env-file .env.production up --detach --wait --wait-timeout 180

harf_app_address=$(docker compose --env-file .env.production port app 80)
curl --fail --silent --show-error "http://$harf_app_address/healthz"
printf '\nHarf Adası is healthy on %s. Verify its HTTPS vhost and a complete game round before announcing publication.\n' "$harf_app_address"
