#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

SERVICE="${1:-}"
require_file "$ENV_FILE"

if [[ -n "$SERVICE" ]]; then
  compose restart "$SERVICE"
else
  compose restart
fi

"$ROOT_DIR/ops/scripts/prod-healthcheck.sh"
