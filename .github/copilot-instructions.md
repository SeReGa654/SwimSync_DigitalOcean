# SwimSync Copilot Instructions

## Build, test, and lint commands

Run from repository root unless noted.

| Task | Command |
|---|---|
| Install JS dependencies (workspace root) | `npm ci` |
| Install DOCX service dependencies | `pip install -r docx-service/requirements.txt` |
| Generate backend OpenAPI + shared contracts | `npm run contracts:generate` |
| Build backend + frontend | `npm run build` |
| Typecheck/lint backend | `npm --prefix backend run lint` |
| Typecheck/lint frontend | `npm --prefix frontend run lint` |
| Backend tests (all) | `npm --prefix backend run test:unit` |
| Frontend unit tests (all) | `npm --prefix frontend run test:unit` |
| Frontend E2E tests (all) | `npm --prefix frontend run test:e2e` |
| DOCX service tests (all) | `pytest docx-service/tests -q` |
| Frontend single unit test file | `npm --prefix frontend run test:unit -- tests/next-config.test.mjs` |
| Frontend single E2E spec | `npm --prefix frontend run test:e2e -- e2e/smoke.spec.ts` |
| DOCX single test function | `pytest docx-service/tests/test_docx_service.py::test_parse_zayvka_endpoint -q` |

Backend unit tests currently run through a single custom entrypoint (`backend/tests/run-tests.ts`) rather than a test framework with per-test selection.

## High-level architecture

- **Monorepo with 4 main parts**: NestJS backend (`backend`), Next.js frontend (`frontend`), Python FastAPI DOCX service (`docx-service`), and shared TS contracts (`shared-contracts`).
- **HTTP flow**: frontend calls relative `/api/*`; Next.js rewrites proxy to backend (`frontend/next.config.js`). Backend uses global prefix `/api` (`backend/src/main.ts`).
- **Auth and authorization model**: session cookie + CSRF cookie/header validation in backend global middleware, with role checks and competition ownership checks centralized in `backend/src/main.ts`.
- **DOCX export pipeline**: backend `ExportController` builds payloads from Prisma data and calls DOCX service either direct or queued based on `DOCX_USE_QUEUE`; queue mode polls DOCX job status and maps statuses for UI.
- **DOCX service queue backend**: FastAPI service supports in-memory queue or Redis-backed queue, idempotency keys, retry/dead-letter behavior, and download-by-job-id endpoints (`docx-service/main.py`).
- **Contract sharing**: backend OpenAPI is generated to `backend/openapi.json`; root script then generates `shared-contracts/src/generated/openapi.ts`, which frontend/backend import via `shared-contracts`.

## Key conventions in this repo

- **Backend error shape is standardized** via `HttpExceptionFilter` and includes `statusCode`, `code`, `message`, `timestamp`, `path`, and `requestId`.
- **Frontend API access goes through `frontend/src/lib/api.ts`**: always uses `credentials: 'include'`, adds `X-CSRF-Token` for mutating requests, and dispatches auth events (`swimsync:auth-changed`, `swimsync:auth-unauthorized`).
- **Feature flags are runtime data, not constants-only toggles**: keys are defined in `feature-flags.registry.ts`, persisted in Prisma `FeatureFlag`, and enforced server-side (for example DOCX queue export gating).
- **Operational checks in CI order matter**: clean environments run Prisma client generation and contract generation before typechecks/tests (`.github/workflows/ci.yml`).
- **Path aliases are workspace-local**: both frontend and backend use `@/*` to point at local `src/*`; backend additionally maps `shared-contracts` to `../shared-contracts/src/index.ts` in TS config.

## MCP server guidance

- **Playwright MCP** is the most relevant addition for this repo: use it for validating Next.js UI flows, reproducing frontend regressions, and working with `frontend/e2e` specs.
- **GitHub MCP (Actions/PRs/issues)** is useful for CI-driven tasks in this repo because workflows are actively used for CI, E2E, and security scanning.
