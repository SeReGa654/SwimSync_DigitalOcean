# SwimSync scripts & scenarios

Короткий довідник по всіх основних скриптах, сценаріях запуску та тестування.

## Де виконувати

- **Root** — у корені репозиторію `S:\swimsync_1.0`
- **Backend** — у `S:\swimsync_1.0\backend`
- **Frontend** — у `S:\swimsync_1.0\frontend`
- **DOCX service** — у `S:\swimsync_1.0\docx-service`
- **Docker host** — з кореня, через `docker compose ...`

## Root scripts (`package.json`)

| Script | Де запускати | Середовище | Для чого |
|---|---|---|---|
| `npm run dev` | Root | Local dev | Запускає backend + frontend паралельно |
| `npm run dev:backend` | Root | Local dev | Піднімає NestJS backend у режимі dev |
| `npm run dev:frontend` | Root | Local dev | Піднімає Next.js frontend у режимі dev |
| `npm run dev:docx` | Root | Local dev | Піднімає FastAPI DOCX service на `3012` |
| `npm run dev:docx:worker` | Root | Local dev | Запускає окремий DOCX worker |
| `npm run dev:full` | Root | Local dev | Backend + frontend + DOCX + Prisma Studio |
| `npm run build` | Root | CI / local verify | Збирає backend і frontend |
| `npm run build:backend` | Root | CI / local verify | Збирає backend |
| `npm run build:frontend` | Root | CI / local verify | Збирає frontend |
| `npm run setup` | Root | Local bootstrap | Встановлює deps, виконує db push і seed |
| `npm run db:push` | Root | Local DB | Prisma db push для backend |
| `npm run db:push:pg` | Root | Postgres DB | Делегує backend `db:push:pg` |
| `npm run db:generate:pg` | Root | Postgres DB | Генерує Prisma client для Postgres |
| `npm run db:migrate:dev` | Root | Local DB | Prisma migrate dev |
| `npm run db:migrate:deploy` | Root | Production DB | Prisma migrate deploy |
| `npm run db:migrate:status` | Root | Any DB | Перевірка статусу міграцій |
| `npm run db:seed` | Root | Local DB | Запуск seed для backend |
| `npm run db:studio` | Root | Local DB | Prisma Studio |
| `npm run infra:up` | Root | Infra | Піднімає PostgreSQL + Redis + Prometheus + Grafana |
| `npm run infra:down` | Root | Infra | Зупиняє інфраструктурний стек |
| `npm run app:up` | Root | Docker app | Піднімає app stack через `docker-compose.app.yml` |
| `npm run app:up:doppler` | Root | Docker app | Те саме, але через Doppler secrets |
| `npm run app:down` | Root | Docker app | Зупинка app stack |
| `npm run app:up:prod` | Root | Production | Піднімає production stack |
| `npm run app:down:prod` | Root | Production | Зупинка production stack |
| `npm run app:pull:prod` | Root | Production | Pull базових images для prod |
| `npm run app:logs:prod` | Root | Production | Логи production stack |
| `npm run prod:first-deploy` | Root | Production deploy | Перший bootstrap прод-інсталяції |
| `npm run prod:update` | Root | Production deploy | Оновлення production |
| `npm run prod:rollback -- <ref>` | Root | Production deploy | Rollback на вказаний git ref |
| `npm run prod:backup` | Root | Production ops | Backup PostgreSQL + Redis |
| `npm run prod:restore -- <pg.sql> <redis.rdb>` | Root | Production ops | Restore бекапів |
| `npm run prod:restart` | Root | Production ops | Restart stack або сервісу |
| `npm run prod:healthcheck` | Root | Production ops | Health/readiness/dependency checks |
| `npm run prod:certbot:renew` | Root | Production ops | Renew TLS cert + reload nginx |
| `npm run backend:openapi` | Root | CI / contracts | Генерує OpenAPI бекенда |
| `npm run contracts:generate` | Root | CI / contracts | Генерує shared OpenAPI types |
| `npm run test:quick` | Root | Local / CI smoke | Backend + frontend + DOCX tests |
| `npm run smoke:fullstack` | Root | Local / Docker | Повний smoke по стеку |
| `npm run smoke:named-application` | Root | Local / Docker | Smoke сценарію named application flow |
| `npm run test:docx` | Root | Test | Pytest для DOCX service |
| `npm run audit:prod` | Root | Security | Production dependency audit |
| `npm run test:load:api` | Root | Load test | k6 API load test |
| `npm run test:load:live` | Root | Load test | k6 live WS load test |
| `npm run backup:sqlite` | Root | Local backup | Backup SQLite |
| `npm run restore:sqlite` | Root | Local restore | Restore SQLite |
| `npm run backup:pg` | Root | Prod backup | Backup PostgreSQL |
| `npm run restore:pg` | Root | Prod restore | Restore PostgreSQL |
| `npm run drill:recovery` | Root | Recovery drill | Recovery drill сценарій |
| `npm run drill:recovery:schedule` | Root | Recovery ops | Планує recovery drill task |
| `npm run drill:recovery:unschedule` | Root | Recovery ops | Прибирає scheduled drill task |
| `npm run ops:check-migration-guardrails` | Root | CI / predeploy | Перевірка міграційних guardrails |
| `npm run ops:check-deploy-readiness` | Root | CI / predeploy | Перевірка готовності до деплою |
| `npm run ops:check-prod-env -- .env.production` | Root | CI / predeploy | Валідація prod env |

## Backend scripts (`backend/package.json`)

| Script | Де запускати | Середовище | Для чого |
|---|---|---|---|
| `npm run build` | `backend` | CI / local verify | NestJS build |
| `npm run start` | `backend` | Local / container | Стандартний запуск NestJS |
| `npm run start:dev` | `backend` | Local dev | Dev server на ts-node |
| `npm run start:prod` | `backend` | Production/container | Запуск з `dist` |
| `npm run lint` | `backend` | CI / local verify | TypeScript noEmit check |
| `npm run typecheck` | `backend` | CI / local verify | TypeScript noEmit check |
| `npm run test:unit` | `backend` | Test | Backend unit tests |
| `npm run test:unit:coverage` | `backend` | Test | Unit tests + coverage threshold |
| `npm run test` | `backend` | Test | Typecheck + unit tests |
| `npm run smoke` | `backend` | Smoke | Backend smoke-check script |
| `npm run openapi:generate` | `backend` | CI / contracts | Генерує backend OpenAPI JSON |
| `npm run backfill:result-protocol-config` | `backend` | Data migration | Backfill config без змін |
| `npm run backfill:result-protocol-config:apply` | `backend` | Data migration | Backfill config з apply |
| `npm run bench:advanced-grouping` | `backend` | Benchmark | Бенчмарки advanced grouping |
| `npm run db:generate:pg` | `backend` | DB / production | Prisma generate |
| `npm run db:push:pg` | `backend` | DB / production | Prisma db push |
| `npm run db:migrate:dev` | `backend` | Local DB | Prisma migrate dev |
| `npm run db:migrate:deploy` | `backend` | Production DB | Prisma migrate deploy |
| `npm run db:status` | `backend` | Any DB | Prisma migrate status |
| `npm run db:seed:prod` | `backend` | Production DB | Seed production data |

## Frontend scripts (`frontend/package.json`)

| Script | Де запускати | Середовище | Для чого |
|---|---|---|---|
| `npm run dev` | `frontend` | Local dev | Next.js dev server |
| `npm run build` | `frontend` | CI / local verify | Production build |
| `npm run start` | `frontend` | Production/container | Запуск production build |
| `npm run lint` | `frontend` | CI / local verify | TypeScript noEmit check |
| `npm run typecheck` | `frontend` | CI / local verify | TypeScript noEmit check |
| `npm run test:unit` | `frontend` | Test | Node test suite |
| `npm run test:unit:coverage` | `frontend` | Test | Unit tests + coverage threshold |
| `npm run test:e2e` | `frontend` | Test / local browser | Playwright E2E |
| `npm run test` | `frontend` | Test | Typecheck + unit tests |

## DOCX service

У `docx-service` окремих npm-скриптів немає; запуск і тести йдуть напряму через Python.

| Команда | Де запускати | Середовище | Для чого |
|---|---|---|---|
| `pip install -r docx-service/requirements.txt` | Root або `docx-service` | Bootstrap | Встановити Python deps |
| `py -m uvicorn main:app --host 0.0.0.0 --port 3012 --reload` | `docx-service` | Local dev | Запуск DOCX API |
| `py worker.py` | `docx-service` | Local / queue worker | DOCX worker |
| `pytest docx-service/tests -q` | Root | Test | Pytest для DOCX service |

## Ops scripts (`ops/scripts`)

> Деякі файли — допоміжні і не запускаються вручну, а викликаються root-скриптами.

| File | Де запускати | Середовище | Для чого |
|---|---|---|---|
| `ops/scripts/prod-common.sh` | Не запускати напряму | Helper | Спільні функції для prod-скриптів |
| `ops/scripts/prod-first-deploy.sh` | Root | Production | Перший деплой |
| `ops/scripts/prod-update.sh` | Root | Production | Оновлення production |
| `ops/scripts/prod-rollback.sh` | Root | Production | Rollback production |
| `ops/scripts/prod-backup.sh` | Root | Production | Бекап прод-даних |
| `ops/scripts/prod-restore.sh` | Root | Production | Restore prod-даних |
| `ops/scripts/prod-restart.sh` | Root | Production | Restart stack |
| `ops/scripts/prod-healthcheck.sh` | Root | Production | Health checks |
| `ops/scripts/prod-certbot-renew.sh` | Root | Production | Renew TLS cert |
| `ops/scripts/check-deploy-readiness.mjs` | Root | CI / predeploy | Readiness check |
| `ops/scripts/check-prod-env.mjs` | Root | CI / predeploy | Validate prod env |
| `ops/scripts/check-migration-guardrails.mjs` | Root | CI / predeploy | Migrations safety check |
| `ops/scripts/audit-prod-deps.mjs` | Root | Security | Production dependency audit |
| `ops/scripts/smoke-fullstack.mjs` | Root | Local / Docker | Full-stack smoke |
| `ops/scripts/smoke-named-application-flow.mjs` | Root | Local / Docker | Named application smoke |
| `ops/scripts/backup-sqlite.ps1` | Root | Local backup | SQLite backup |
| `ops/scripts/restore-sqlite.ps1` | Root | Local restore | SQLite restore |
| `ops/scripts/backup-postgres.ps1` | Root | Production backup | PostgreSQL backup |
| `ops/scripts/restore-postgres.ps1` | Root | Production restore | PostgreSQL restore |
| `ops/scripts/drill-recovery.ps1` | Root | Recovery drill | Recovery drill |
| `ops/scripts/register-recovery-drill-task.ps1` | Root | Recovery ops | Schedule drill task |
| `ops/scripts/unregister-recovery-drill-task.ps1` | Root | Recovery ops | Unschedule drill task |

## Рекомендовані сценарії

### 1) Перший локальний запуск
```bash
npm install
pip install -r docx-service/requirements.txt
npm run setup
```

### 2) Локальна розробка
```bash
npm run dev
```

Якщо потрібен повний стек:
```bash
npm run dev:full
```

### 3) Docker app stack
```bash
npm run app:up
```

### 4) Production deploy
```bash
npm run ops:check-deploy-readiness
npm run ops:check-prod-env -- .env.production
npm run prod:first-deploy
```

Для оновлення:
```bash
npm run prod:update
```

### 5) Перевірка після змін
```bash
npm run build
npm run test:quick
npm run smoke:fullstack
```

### 6) Security / quality
```bash
npm run audit:prod
npm run ops:check-migration-guardrails
```

### 7) Backup / restore
```bash
npm run backup:pg
npm run restore:pg -- <postgres.sql> <redis.rdb>
```

### 8) DOCX service
```bash
cd docx-service
py -m uvicorn main:app --host 0.0.0.0 --port 3012 --reload
```

## Практичні примітки

- Для **local dev** найчастіше достатньо `npm run dev`.
- Для **browser-visible changes** після правок у frontend краще робити `npm --prefix frontend run build` або `npm run app:up`.
- Для **production** не пропускайте `ops:check-deploy-readiness` і `ops:check-prod-env`.
- Для **тестів**:
  - backend: `npm --prefix backend run test`
  - frontend: `npm --prefix frontend run test`
  - e2e: `npm --prefix frontend run test:e2e`
  - DOCX: `pytest docx-service/tests -q`
