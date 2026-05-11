#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

require_file "$ENV_FILE"

git -C "$ROOT_DIR" fetch --all --tags
git -C "$ROOT_DIR" pull --ff-only
compose pull
compose up -d --build
compose exec -T backend npm --prefix backend run db:migrate:deploy
"$ROOT_DIR/ops/scripts/prod-healthcheck.sh"
