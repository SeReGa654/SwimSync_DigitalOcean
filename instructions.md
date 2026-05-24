# Операційні інструкції

## Pre-Deploy Checklist

### Local Environment Setup
```bash
npm install
pip install -r docx-service/requirements.txt
npm run setup                 # Initializes SQLite + seed data
npm run build                 # Builds backend + frontend
npm run test:quick            # Unit + E2E tests (should all pass)
npm run audit:prod            # Security audit (should be clean)
```

### Full-Stack Local Verification
```bash
npm run app:up                # Starts Docker stack (backend + frontend + docx + postgres + redis)
npm run smoke:fullstack       # Runs comprehensive smoke test
```

## Перед прод-деплоєм

1. **Підготувати `.env.production`** з реальними секретами:
   - `DATABASE_URL` — PostgreSQL connection string
   - `AUTH_BOOTSTRAP_ADMIN_PASSWORD` — Initial admin password
   - `FRONTEND_URL` — Public domain (e.g., `https://swimsync.example.com`)
   - Redis, DOCX service, other service URLs

2. **Перевірити готовність:**
   ```bash
   npm run ops:check-prod-env -- .env.production
   npm run ops:check-deploy-readiness
   npm run ops:check-migration-guardrails
   ```

3. **Виконати деплой:**
   - Первинний: `npm run prod:first-deploy`
   - Оновлення: `npm run prod:update`
   - Rollback: `npm run prod:rollback -- <git-ref>`

## Після деплою

1. **Перевірити health:**
   ```bash
   npm run prod:healthcheck
   ```

2. **Переконатися, що система готова:**
   - Health check повинен повернути `status: "ready"`
   - Нормативи заповнені: `GET /api/ua-sport-ranks?poolLength=50` → non-empty array
   - Admin account accessible: login with bootstrap credentials
   - Live scoreboard public: `GET /competitions/:id/live` → 200 OK (no auth required)

3. **Create first admin user if bootstrap was used:**
   - Change bootstrap admin password immediately
   - Create additional admins as needed via UI

## Операційні сценарії

### Backup & Restore
```bash
# Full backup (PostgreSQL + Redis)
npm run prod:backup

# Restore from backup
npm run prod:restore -- <pg.sql> <redis.rdb>
```

### Monitor & Logs
```bash
npm run prod:healthcheck      # Health, readiness, dependencies
npm run prod:logs             # Tail Docker logs
npm run app:logs:prod         # Production stack logs
```

### Restart Stack
```bash
npm run prod:restart
```

## Для подальшого security hardening

1. **Моніторити security advisories:**
   ```bash
   npm run audit:prod  # Run regularly, especially before updates
   ```

2. **TLS certificate renewal** (if using Let's Encrypt):
   ```bash
   npm run prod:certbot:renew
   ```

3. **При оновленні залежностей:**
   - `npm update`
   - `npm run build && npm run test:quick`
   - `npm run audit:prod`
   - Commit, tag, deploy

4. **Rotate secrets regularly:**
   - Admin passwords
   - Database credentials
   - Redis passwords
   - JWT secrets (if using)
