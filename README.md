# 🏊 SwimSync

Automated swimming competition management system — from entry import and heat seeding to results entry, finalization, rankings, and DOCX protocol generation.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-%3E%3D3.10-3776AB?logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## 🏗️ Overview

SwimSync replaces fragmented competition operations (Excel sheets, paper protocols, duplicate data entry, weak role boundaries) with a structured digital workflow. The platform supports Admin, Secretary, and Operator roles with explicit access control and validation. The main flow covers entry import, seeding, result entry, finalization, and DOCX protocol generation. The backend and frontend are combined in a monorepo, while DOCX processing is handled by a dedicated Python microservice. Operational visibility is built in through audit logs, dependency health checks, and Prometheus-compatible metrics.

## 🧩 Architecture

| Service | Technology | Role |
|---|---|---|
| Backend API | NestJS 11, Prisma, SQLite/PostgreSQL, Socket.IO, Redis adapter | Core business logic, REST API, auth/roles/CSRF, seeding/results/finalization, metrics/audit |
| Frontend UI | Next.js 15 (App Router), React 19, TypeScript, React Query | Admin/Secretary/Operator interfaces, workflow execution, API/WebSocket client |
| DOCX Service | FastAPI, Uvicorn, python-docx, Redis | DOCX parsing/generation and async job pipeline (`queued`/`processing`/`done`/`failed`) |
| Shared Contracts | TypeScript package + generated OpenAPI types | Shared API contracts between backend and frontend |
| Infra & Ops | Docker Compose, Prometheus, Grafana, k6, PowerShell scripts | Local infra, observability, load testing, backup/restore and recovery drills |

## ✨ Key Features

- DOCX Job Pipeline — submit/status/download, states queued/processing/done/failed, retry, failure reason shown in UI
- Secretary Results Module — per-heat entry, batch-save, optimistic locking (version conflict detection), autosave drafts
- Results Finalization — place calculation, tie handling, WA points, automatic Ukrainian Sport Rank (ФПУ) validation for both 50m (LCM) and 25m (SCM) pools, and athlete profile updates
- Out of Competition (ПК / Поза конкурсом) Mode — support for `isOutOfCompetition` flag per event entry. Out-of-competition athletes are seeded in heats, their results are recorded in history, and they can execute normatives or personal records, but they do not compete for places or medals, and do not affect regular standings or team points.
- Entry Import — parse CSV/XLSX/DOCX with preview/confirm, grouped validation warnings/errors, bulk gender/rank edits
- Operational Observability — audit log with requestId, health/dependencies, Prometheus metrics endpoint, operator screen
- Feature Flags (Admin only) — centralized toggles for risky capabilities with backend enforcement and audit trail
- Account Lifecycle & Access Governance — self-service registration requests for admin/secretary, admin approval workflow, activation/deactivation, password reset, and per-user session revocation

## 🛠️ Tech Stack

| Area | Stack | Notes |
|---|---|---|
| Monorepo & tooling | npm workspaces, TypeScript `~5.8`, Node.js `>=18`, Python `>=3.10` | Unified scripts from root `package.json` |
| Backend API | NestJS `11`, Prisma `6`, Swagger/OpenAPI | REST + WebSocket backend with generated API contracts |
| Data layer | SQLite (default), PostgreSQL (production/infra), Prisma ORM | Same domain model across local/prod DBs |
| Realtime & queue infra | Socket.IO, `@socket.io/redis-adapter`, Redis | Live updates and cross-instance pub/sub |
| Frontend | Next.js `15` (App Router), React `19`, `@tanstack/react-query` `5`, Tailwind CSS `4` | Operator/Admin/Secretary UI with typed API client |
| DOCX microservice | FastAPI `>=0.111`, Uvicorn `>=0.30`, python-docx `>=1.1`, httpx, redis | DOCX parse/export with sync or queued execution |
| Testing & quality | Node test runner, Playwright, pytest, c8 | Unit + E2E + Python service coverage |
| Observability & ops | prom-client, Prometheus, Grafana, k6, Docker Compose, PowerShell scripts | Metrics, dashboards, load tests, backup/recovery scripts |
| Shared contracts | `shared-contracts`, `openapi-typescript` | Backend OpenAPI -> generated TS types for frontend/backend |

## 📁 Project Structure

```txt
swimsync_1.0/
├─ backend/                  # NestJS API, Prisma schema, business modules, tests
├─ frontend/                 # Next.js app (admin/secretary/operator/logs/competitions)
├─ docx-service/             # FastAPI DOCX parsing/generation + queue endpoints
├─ shared-contracts/         # Shared TS contracts + generated OpenAPI types
├─ ops/                      # Infra and operations scripts (k6, backups, recovery, monitoring)
├─ docs/                     # Project documentation and screenshots
├─ docker-compose.infra.yml  # PostgreSQL, Redis, Prometheus, Grafana
└─ package.json              # Workspace orchestration scripts
```

## 🚀 Getting Started

1. Install Node.js dependencies from repo root.

```bash
npm install
```

2. Install DOCX service Python dependencies.

```bash
pip install -r docx-service/requirements.txt
```

3. Initialize local SQLite database and seed data.

```bash
npm run setup
```

4. (Optional) Start infrastructure services (PostgreSQL, Redis, Prometheus, Grafana).

```bash
npm run infra:up
```

5. Start all services together, or run each service separately.

```bash
npm run dev:full
# or:
npm run dev:backend
npm run dev:frontend
npm run dev:docx
```

6. **(Recommended) Run all tests to verify setup**.

```bash
npm run test:quick              # Unit + E2E tests (should all pass)
npm run smoke:fullstack         # Full-stack smoke test (Docker required)
```

7. (Optional) Start the application stack via Docker Compose (backend + frontend + docx + postgres + redis).

```bash
npm run app:up
```

7. (Recommended) Run the Docker stack with Doppler-managed secrets.

```bash
doppler secrets download --no-file --format env > .env.docker
npm run app:up:doppler
```

8. Run test suites.

```bash
npm --prefix backend run test
npm --prefix frontend run test
npm run test:docx
```

## 📋 Testing & Quality Assurance

### Running Tests

**Quick test suite** (recommended before commits):
```bash
npm run test:quick              # Backend unit + Frontend + E2E + DOCX service
```

**Individual test suites:**
```bash
npm --prefix backend run test:unit          # Backend unit tests only
npm --prefix frontend run test              # Frontend unit + typecheck
npm --prefix frontend run test:e2e          # Playwright E2E tests
npm run test:docx                           # DOCX service pytest
```

**Full-stack verification** (requires Docker):
```bash
npm run app:up                              # Start full stack
npm run smoke:fullstack                     # Run comprehensive smoke test
```

### Security Audit

```bash
npm run audit:prod              # Check for high/critical vulnerabilities
```

Currently: ✅ **0 critical, 0 high vulnerabilities**

---

## 🔒 Security & Access Control

SwimSync enforces **strict role-based access control**:

| Role | Permissions | Scope |
|---|---|---|
| **Admin** | System config, normatives, feature flags, user management | System-wide |
| **Secretary** | Manage own competitions, import athletes, entry & results | Own competitions |
| **Operator** | Heat seeding, live results viewing | Assigned competitions |
| **Public (Guest)** | View public normatives, live scoreboard | Read-only |

### Security Features

✅ Role enforcement on all protected endpoints  
✅ Athlete database scoped by creator (no cross-secretary data leakage)  
✅ CSRF protection (X-CSRF-Token header validation)  
✅ Session cookie httpOnly + SameSite=Lax  
✅ Audit log with request ID for all mutations  
✅ No hardcoded secrets; all environment-based  
✅ No localhost URLs in production builds  
✅ TypeScript strict mode enforced  

---

## ⚙️ Environment Variables

<details>
<summary>Backend</summary>

| Variable | Description |
|---|---|
| `BACKEND_PORT` | Backend HTTP port (default `3001`) |
| `TRUST_PROXY_HOPS` | Number of trusted reverse-proxy hops (set `1` behind nginx) |
| `FRONTEND_URL` | Allowed frontend origins (CSV, default `http://localhost:3000`) |
| `DOCX_SERVICE_URL` | DOCX service base URL (default `http://localhost:3012`) |
| `DOCX_REQUEST_TIMEOUT_MS` | Timeout for DOCX requests from backend |
| `DOCX_USE_QUEUE` | Enable queue-based DOCX export flow |
| `DOCX_QUEUE_POLL_INTERVAL_MS` | Poll interval when checking DOCX job status |
| `REDIS_URL` | Redis connection URL |
| `RATE_LIMIT_WINDOW_MS` | Global rate limit window |
| `RATE_LIMIT_MAX` | Global max requests per window |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | Max login attempts per window |
| `EXPORT_RATE_LIMIT_MAX` | Max export requests per window |
| `ADMIN_COOKIE_NAME` | Admin auth cookie name |
| `ADMIN_COOKIE_MAX_AGE_MS` | Admin cookie max age |
| `ADMIN_COOKIE_PATH` | Admin cookie path |
| `AUTH_ROLE_COOKIE_NAME` | Cookie name for resolved auth role |
| `CSRF_COOKIE_NAME` | CSRF cookie name |
| `ADMIN_COOKIE_SAME_SITE` | Cookie SameSite policy (`lax`/`strict`/`none`) |
| `ADMIN_COOKIE_SECURE` | Secure cookie flag |
| `AUTH_BOOTSTRAP_ADMIN_USERNAME` | Bootstrap admin username |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | Bootstrap admin password |
| `DATABASE_URL` | PostgreSQL connection URL |

</details>

<details>
<summary>Frontend</summary>

| Variable | Description |
|---|---|
| `BACKEND_API_URL` | Backend base URL used by `next.config.js` rewrites |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for live updates |
| `NEXT_DIST_DIR` | Next.js build output directory (`.next-prod` in build scripts) |

</details>

<details>
<summary>Deployment / TLS</summary>

| Variable | Description |
|---|---|
| `APP_DOMAIN` | Public domain used for DNS and TLS issuance |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt certificate lifecycle |

</details>

<details>
<summary>DOCX Service</summary>

| Variable | Description |
|---|---|
| `LOG_LEVEL` | Logging level |
| `DOCX_JOB_TTL_SEC` | Job metadata/result TTL |
| `DOCX_JOB_MAX_RETRIES` | Max retries for failed jobs |
| `DOCX_INTERNAL_WORKER` | Enable internal worker loop |
| `DOCX_REDIS_URL` | Redis URL for queue storage (falls back to `REDIS_URL`) |
| `DOCX_REDIS_QUEUE_KEY` | Redis key for queue list |
| `DOCX_REDIS_DEAD_LETTER_KEY` | Redis key for dead-letter list |
| `DOCX_REDIS_JOB_PREFIX` | Redis key prefix for job payload/status |
| `DOCX_REDIS_IDEMP_PREFIX` | Redis key prefix for idempotency mapping |
| `CORS_ALLOW_ORIGINS` | Allowed CORS origins (CSV) |

</details>

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev:full` | Start backend, frontend, DOCX service, and Prisma Studio concurrently |
| `npm run dev:backend` | Start NestJS backend only (port `3001`) |
| `npm run dev:frontend` | Start Next.js frontend only (port `3000`) |
| `npm run dev:docx` | Start DOCX FastAPI service only (port `3012`) |
| `npm run setup` | Install deps, push SQLite schema, and run seed |
| `npm run infra:up` | Start Docker Compose infra services |
| `npm run infra:down` | Stop Docker Compose infra services |
| `npm run app:up` | Start app stack via `docker-compose.app.yml` (build + run) |
| `npm run app:up:doppler` | Start app stack through `doppler run` with secrets injected from Doppler |
| `npm run app:down` | Stop app stack started from `docker-compose.app.yml` |
| `npm run app:up:prod` | Start production stack via `docker-compose.production.yml` + `.env.production` |
| `npm run app:down:prod` | Stop production stack |
| `npm run app:pull:prod` | Pull latest container base images for production stack |
| `npm run app:logs:prod` | Tail production stack logs |
| `npm run prod:first-deploy` | Automated first production bootstrap (build + migrate + seed + health checks) |
| `npm run prod:update` | Pull, rebuild, migrate, seed, and validate production rollout |
| `npm run prod:rollback -- <git-ref>` | Roll back to a specific git ref, run migrate+seed, and validate health |
| `npm run prod:backup -- [dir]` | Create PostgreSQL and Redis backups |
| `npm run prod:restore -- <postgres.sql> <redis.rdb>` | Restore PostgreSQL and Redis backups |
| `npm run prod:restart -- [service]` | Restart full stack or a single production service |
| `npm run prod:healthcheck` | Run end-to-end production health checks |
| `npm run prod:certbot:renew` | Issue/renew Let's Encrypt cert and reload nginx |
| `npm --prefix backend run test` | Run backend typecheck + unit tests |
| `npm --prefix frontend run test` | Run frontend typecheck + unit tests |
| `npm run test:docx` | Run DOCX service pytest suite |
| `npm run audit:prod` | Run blocking production dependency audit with allowlist for unresolved advisories |
| `npm run ops:check-deploy-readiness` | Validate production deployment files and required settings |
| `npm run ops:check-prod-env -- .env.production` | Validate production env file security/consistency |
| `npm run backup:sqlite` | Run SQLite backup PowerShell script |
| `npm run restore:sqlite` | Run SQLite restore PowerShell script |
| `npm run backup:pg` | Run PostgreSQL backup PowerShell script |
| `npm run restore:pg` | Run PostgreSQL restore PowerShell script |
| `npm run drill:recovery` | Run recovery drill PowerShell script |

## 🔌 API & WebSocket

The backend exposes REST endpoints under `/api` and Swagger docs under `/docs`, while the frontend proxies API requests through Next.js rewrites. Live competition updates are delivered over Socket.IO, with Redis adapter support for multi-instance pub/sub.

### Auth account-management API (new)

- `POST /api/auth/register` — create pending account request (requires admin approval before login)
- `GET /api/auth/users` — list all users with approval/activity/session counters (admin)
- `PATCH /api/auth/users/:userId/approve` — approve registration (admin)
- `PATCH /api/auth/users/:userId/activate` / `PATCH /api/auth/users/:userId/deactivate` — toggle account state (admin)
- `PATCH /api/auth/users/:userId/reset-password` — reset password and revoke active sessions (admin)
- `GET /api/auth/users/:userId/sessions` and `DELETE /api/auth/users/:userId/sessions/:sessionId` — session control for any user (admin)

### Result protocol configuration API

- `GET /api/competitions/:id/result-protocol-config`
- `PATCH /api/competitions/:id/result-protocol-config`
- `GET /api/competitions/protocol-defaults/me`
- `PATCH /api/competitions/protocol-defaults/me`
- `GET /api/competitions/:id/result-protocol-presets`
- `POST /api/competitions/:id/result-protocol-presets`
- `PATCH /api/competitions/:id/result-protocol-presets/:presetId`
- `DELETE /api/competitions/:id/result-protocol-presets/:presetId`
- `POST /api/competitions/:id/result-protocol-presets/:presetId/apply`

Result protocol RBAC matrix:

| Action | admin | secretary | operator |
|---|---|---|---|
| View protocol config | ✅ | ✅ (own competitions) | ✅ (own competitions) |
| Save protocol config | ✅ | ✅ (own competitions) | ❌ |
| List/apply presets | ✅ | ✅ (shared + own) | ❌ |
| Create private preset | ✅ | ✅ | ❌ |
| Create shared preset | ✅ | ❌ | ❌ |
| Update/delete preset | ✅ | ✅ (own only) | ❌ |
| Change preset shared toggle | ✅ | ❌ | ❌ |

### Backfill existing competitions to materialized protocol config

For historical competitions that still use legacy runtime fallback:

0. Ensure DB schema is synced before backfill (for local/dev DBs): `npm --prefix backend run db:push:pg`
1. Run dry-run: `npm --prefix backend run backfill:result-protocol-config`
2. Apply changes: `npm --prefix backend run backfill:result-protocol-config:apply`
3. Re-run dry-run to verify idempotency (`updated=0` expected after successful apply)

Latest local validation snapshot (dry-run -> apply -> dry-run):

- `checked=1; eligible=0; skippedInvalidPreference=0; updated=0`
- Idempotency check passed locally (`updated=0` after apply)

Rollback approach:

- Restore DB from backup/snapshot taken before apply.
- Re-run apply safely after fixes (script is idempotent for already materialized records).
- If script reports schema drift (`P2022`), sync schema first and retry.

### Prisma migration policy for non-empty databases

Use one migration path per environment to avoid `P3005`/schema drift surprises:

| Environment | Allowed path | Notes |
|---|---|---|
| local/dev | `db:push:pg` (fast iteration) **or** `db:migrate:dev` | Keep local schema aligned before running backfill/tests. |
| staging | `db:migrate:deploy` | If DB is pre-filled and unbaselined, create/apply baseline migration first. |
| production | `db:migrate:deploy` only | `db push` is prohibited. |

Baseline procedure for a non-empty staging/prod DB:

1. Generate migration SQL from current Prisma schema and mark it as baseline for the existing DB state.
2. Mark baseline migration as applied in the target DB.
3. Run `npm --prefix backend run db:status` and ensure migration state is consistent.
4. Only then run `npm --prefix backend run db:migrate:deploy` for next schema changes.

Preflight checks before deploy:

1. Verify `DATABASE_URL` points to the correct environment.
2. Run `npm --prefix backend run db:status`.
3. If Prisma returns `P2022`, align DB schema (apply missing migration or sync in non-prod), then re-run status.
4. If Prisma returns `P3005`, do not run deploy migrations until baseline is applied.

CI/ops guardrails:

- CI runs `npm run ops:check-migration-guardrails`.
- Any release/deploy workflow containing `db push` fails policy checks.
- Release/deploy workflows must include `migrate deploy`.

### Advanced grouping benchmark

- Run default benchmark: `npm --prefix backend run bench:advanced-grouping`
- Custom size example: `npm --prefix backend run bench:advanced-grouping -- --entries=50000 --groups=12 --runs=15`
- Output includes `avgMs`, `p50Ms`, `p95Ms`, `maxMs` for baseline/SLA tracking.

Latest local baseline:

| Dataset | avgMs | p50Ms | p95Ms | maxMs |
|---|---:|---:|---:|---:|
| entries=10000, groups=8, runs=10 | 7.72 | 6.02 | 17.85 | 17.85 |
| entries=50000, groups=12, runs=15 | 48.74 | 46.67 | 75.12 | 75.12 |

`advancedGrouping` (v1) supports two-level rules:

- fields: `ageGroupId | region | club | gender`
- operators: `EQ | IN | CONTAINS`
- logical operators: `AND | OR`
- nested level: group + subgroup blocks

Example `PATCH /api/competitions/:id/result-protocol-config` payload:

```json
{
  "format": "MIXED",
  "mixedFormatPrimaryAgeGroupId": 11,
  "mixedFormatSecondaryAgeGroupIds": [12, 13],
  "advancedGrouping": {
    "enabled": true,
    "includeUnmatched": true,
    "unmatchedGroupName": "Інші",
    "groups": [
      {
        "name": "Київські клуби",
        "operator": "AND",
        "conditions": [
          { "field": "region", "operator": "EQ", "value": "Київ" }
        ],
        "subgroups": [
          {
            "operator": "OR",
            "conditions": [
              { "field": "club", "operator": "CONTAINS", "value": "Dynamo" },
              { "field": "club", "operator": "CONTAINS", "value": "Start" }
            ]
          }
        ]
      }
    ]
  }
}
```

Example `POST /api/competitions/:id/result-protocol-presets` payload:

```json
{
  "name": "Kyiv mixed",
  "isShared": true,
  "config": {
    "format": "COMBINED",
    "mixedFormatPrimaryAgeGroupId": null,
    "mixedFormatSecondaryAgeGroupIds": [],
    "advancedGrouping": null
  }
}
```

Protocol presets RBAC matrix:

| Action | Admin | Secretary |
|---|---|---|
| View presets | all | own + shared |
| Apply preset | all | own + shared |
| Create preset | private/shared | private only |
| Update preset | any | own only (without shared toggle) |
| Delete preset | any | own only |

## 📊 Observability

- Audit trail with request-level `requestId`
- Health endpoints including dependency readiness checks
- Prometheus-compatible metrics endpoint
- Operator screen in frontend for dependency and metrics visibility
- Prometheus + Grafana stack via `docker-compose.infra.yml`

## 🚩 Feature Flags (Admin)

Feature flags are controlled **only in the Admin tab** (`/admin`). The backend is the source of truth, so disabling a flag blocks the corresponding backend behavior even if UI is stale.

Implemented flags:

| Flag key | Effect when disabled |
|---|---|
| `ff.export.docx.queue` | Blocks DOCX queue job submission (`/api/export/docx-jobs/*`) |
| `ff.live.scoreboard.ws` | Disables Socket.IO `results:updated` broadcasts |
| `ff.import.bulk-edit` | Blocks bulk-edit confirmation flow in import (`bulkEditApplied=true`) |
| `ff.secretary.heat-draft-autosave` | Disables heat draft autosave in secretary flow |

Admin API:

- `GET /api/feature-flags`
- `GET /api/feature-flags/effective`
- `GET /api/feature-flags/:key`
- `PATCH /api/feature-flags/:key` with body `{ "enabled": boolean }`

All feature flag updates are recorded in audit logs with action `FEATURE_FLAG_UPDATED`.

### Rollback playbook (without redeploy)

1. Open `/admin` and log in as admin.
2. In **Feature Flags**, turn off the problematic capability (kill switch).
3. Re-check affected flow (e.g., DOCX export or live updates).
4. Inspect `/logs` using requestId if needed.
5. Re-enable flag after fix verification.

## 🚢 Production deployment (Ubuntu VPS / DigitalOcean)

### System requirements

- Ubuntu 22.04+ (x86_64)
- 2 vCPU / 4 GB RAM minimum (recommended: 4 vCPU / 8 GB RAM)
- 30+ GB SSD
- Docker Engine + Docker Compose plugin
- DNS A-record pointing to server public IP
- TLS certificates in `ops/nginx/certs/` (`prod:first-deploy` can generate temporary self-signed cert; replace with Let's Encrypt)

### Production files

- `docker-compose.production.yml` — isolated production topology (nginx + frontend + backend + docx + postgres + redis)
- `.env.production.example` — template for production environment
- `ops/nginx/swimsync.conf` — reverse proxy, websocket, and health routes

### First-time deployment steps

1. Install Docker and Compose plugin.
2. Clone repository on the server.
3. Prepare environment file:
   - `cp .env.production.example .env.production`
   - set strong secrets (`POSTGRES_PASSWORD`, `AUTH_BOOTSTRAP_ADMIN_PASSWORD`)
   - set domain URLs (`FRONTEND_URL`, `NEXT_PUBLIC_WS_URL`)
4. Make deployment scripts executable:
   - `chmod +x ops/scripts/prod-*.sh ops/scripts/prod-common.sh`
5. Validate deployment files:
   - `npm run ops:check-deploy-readiness`
   - `npm run ops:check-prod-env -- .env.production`
   - `docker compose -f docker-compose.production.yml --env-file .env.production config -q`
6. Run first deployment:
   - `npm run prod:first-deploy`
7. Replace temporary cert with Let's Encrypt:
   - `npm run prod:certbot:renew`
8. Verify health:
   - `npm run prod:healthcheck`

### HTTPS + SSL readiness

1. Configure DNS `A` record for `APP_DOMAIN` to Droplet public IP.
2. Allow ports 80/443 in cloud firewall and host UFW.
3. Run `npm run prod:certbot:renew`.
4. Add renewal cron:
   - `0 3 * * * cd /opt/swimsync && npm run prod:certbot:renew >> /var/log/swimsync-certbot.log 2>&1`
5. Verify TLS:
   - `openssl s_client -connect <your-domain>:443 -servername <your-domain> -brief`

Nginx performs HTTP -> HTTPS redirect and supports secure websocket proxy on `/socket.io/`.

### DNS setup steps

1. `A` record: `<your-domain> -> <droplet-ip>`.
2. Propagation check: `dig +short <your-domain>`.
3. HTTP reachability check: `curl -I http://<your-domain>`.
4. HTTPS check after cert issuance: `curl -I https://<your-domain>`.

### Update deployment

1. `npm run prod:update`
2. `npm run app:logs:prod`

### Rollback deployment

1. `npm run prod:rollback -- <previous-tag-or-commit>`
2. If DB rollback is required:
   - `npm run prod:restore -- <postgres.sql> <redis.rdb>`
3. `npm run prod:healthcheck`

### Backup and restore flow

1. Run backup:
   - `npm run prod:backup -- /opt/swimsync/backups`
2. Verify backup files exist and are non-empty.
3. Restore using:
   - `npm run prod:restore -- /opt/swimsync/backups/postgres-<ts>.sql /opt/swimsync/backups/redis-<ts>.rdb`

### Restart commands

- Full stack: `npm run prod:restart`
- Single service: `npm run prod:restart -- backend`

### Manual interventions still required

- DNS setup for domain/subdomain.
- TLS issuance/renewal process (certbot or managed certs) and certificate rotation.
- External backup retention policy (off-server object storage).
- Firewall hardening (allow only 22/80/443; block direct DB/Redis exposure).

### Host hardening recommendations

- UFW baseline:
  - `sudo ufw default deny incoming`
  - `sudo ufw default allow outgoing`
  - `sudo ufw allow 22/tcp`
  - `sudo ufw allow 80/tcp`
  - `sudo ufw allow 443/tcp`
  - `sudo ufw enable`
- Install fail2ban:
  - `sudo apt-get update && sudo apt-get install -y fail2ban`
  - enable `sshd` jail and monitor `/var/log/auth.log`
- Low-memory VPS:
  - create 2G swap, set `vm.swappiness=10`
  - avoid concurrent image builds and backup tasks
- Docker cleanup strategy:
  - `docker system prune -f --volumes` in maintenance windows only
  - always create backup before prune

### Runtime diagnostics cheat-sheet

- Containers status: `docker compose -f docker-compose.production.yml --env-file .env.production ps`
- Live logs: `npm run app:logs:prod`
- Resource pressure: `docker stats`
- Host CPU/RAM/disk:
  - `uptime`
  - `free -h`
  - `df -h`
- Dependency diagnostics:
  - `curl -f https://<your-domain>/api/health/ready`
  - `curl -f https://<your-domain>/api/health/dependencies`
- Emergency recovery:
  1. `npm run prod:backup -- /opt/swimsync/backups`
  2. `npm run prod:rollback -- <known-good-ref>`
  3. `npm run prod:healthcheck`
  4. if still degraded: restore DB/cache backups and restart services

### Zero-downtime recommendations

- Run at least two backend/frontend replicas behind external load balancer before critical releases.
- Use blue/green or canary promotion with health checks on `/api/health/ready`.
- Run migration preflight (`db:status`) before every release and keep DB snapshot for rollback.

## 📄 License

MIT
