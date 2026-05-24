#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <git-ref>" >&2
  exit 1
fi

ref="$1"
require_file "$ENV_FILE"

git -C "$ROOT_DIR" fetch --all --tags
git -C "$ROOT_DIR" checkout "$ref"
compose up -d --build
compose exec -T backend npm --prefix backend run db:migrate:deploy
compose exec -T backend npm --prefix backend run db:seed:prod
"$ROOT_DIR/ops/scripts/prod-healthcheck.sh"
