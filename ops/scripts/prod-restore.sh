#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <postgres.sql> <redis.rdb>" >&2
  exit 1
fi

POSTGRES_FILE="$1"
REDIS_FILE="$2"
require_file "$ENV_FILE"
require_file "$POSTGRES_FILE"
require_file "$REDIS_FILE"

compose exec -T postgres psql -U "${POSTGRES_USER:-swimsync}" -d "${POSTGRES_DB:-swimsync}" < "$POSTGRES_FILE"
compose cp "$REDIS_FILE" redis:/data/dump.rdb
compose restart redis
"$ROOT_DIR/ops/scripts/prod-healthcheck.sh"
