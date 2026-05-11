#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

require_file "$ENV_FILE"
require_env "POSTGRES_DB"
require_env "POSTGRES_USER"
require_env "POSTGRES_PASSWORD"
require_env "DATABASE_URL"
require_env "FRONTEND_URL"
require_env "NEXT_PUBLIC_WS_URL"

mkdir -p "$ROOT_DIR/ops/nginx/certs" "$ROOT_DIR/ops/nginx/acme"

if [[ ! -f "$ROOT_DIR/ops/nginx/certs/fullchain.pem" || ! -f "$ROOT_DIR/ops/nginx/certs/privkey.pem" ]]; then
  echo "TLS certs not found. Generating short-lived self-signed cert (replace with Let's Encrypt ASAP)."
  openssl req -x509 -nodes -newkey rsa:2048 -days 3 \
    -keyout "$ROOT_DIR/ops/nginx/certs/privkey.pem" \
    -out "$ROOT_DIR/ops/nginx/certs/fullchain.pem" \
    -subj "/CN=localhost" >/dev/null 2>&1
fi

compose up -d --build
compose exec -T backend npm --prefix backend run db:migrate:deploy
"$ROOT_DIR/ops/scripts/prod-healthcheck.sh"
