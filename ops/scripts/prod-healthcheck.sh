#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prod-common.sh"

require_file "$ENV_FILE"
compose ps
compose exec -T backend node -e "fetch('http://127.0.0.1:3001/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
compose exec -T docx-service python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3012/health').status==200 else 1)"
curl -fsS http://127.0.0.1/healthz >/dev/null
echo "Production health checks passed."
