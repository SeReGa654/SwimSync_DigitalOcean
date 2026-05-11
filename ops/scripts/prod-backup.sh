#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

BACKUP_DIR="${1:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
require_file "$ENV_FILE"

POSTGRES_DUMP="$BACKUP_DIR/postgres-$TIMESTAMP.sql"
REDIS_DUMP="$BACKUP_DIR/redis-$TIMESTAMP.rdb"

compose exec -T postgres pg_dump -U "${POSTGRES_USER:-swimsync}" "${POSTGRES_DB:-swimsync}" > "$POSTGRES_DUMP"
compose exec -T redis redis-cli --rdb /data/dump.latest.rdb >/dev/null
compose cp redis:/data/dump.latest.rdb "$REDIS_DUMP"

echo "Backups created:"
echo "- $POSTGRES_DUMP"
echo "- $REDIS_DUMP"
