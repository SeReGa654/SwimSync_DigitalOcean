#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

require_file "$ENV_FILE"
require_env "APP_DOMAIN"
require_env "LETSENCRYPT_EMAIL"

set -a
source "$ENV_FILE"
set +a

mkdir -p "$ROOT_DIR/ops/nginx/certs" "$ROOT_DIR/ops/nginx/acme"

docker run --rm \
  -v "$ROOT_DIR/ops/nginx/certs:/etc/letsencrypt" \
  -v "$ROOT_DIR/ops/nginx/acme:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$APP_DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email --non-interactive

cp "$ROOT_DIR/ops/nginx/certs/live/$APP_DOMAIN/fullchain.pem" "$ROOT_DIR/ops/nginx/certs/fullchain.pem"
cp "$ROOT_DIR/ops/nginx/certs/live/$APP_DOMAIN/privkey.pem" "$ROOT_DIR/ops/nginx/certs/privkey.pem"
compose restart nginx
