# Zumeet

Two-sided rental matching platform for tenants and landlords in Taiwan.

Tenants create up to 3 **tenant profiles** as independent demand cards. Landlords create **listings**. The system matches by hard conditions (budget, location, room type, move-in date, amenities). Contact info is revealed only after both sides express mutual interest in the same `tenant_profile ↔ listing` pair.

**Not a broker.** Zumeet does not verify truthfulness, guarantee quality, or participate in lease negotiation, payment, or dispute resolution.

---

## Architecture

| Layer | Stack | Domain |
|---|---|---|
| Frontend | Next.js 16, React 19, React Query v5, Tailwind v4 | `app.zumeet.tw` |
| Backend | Go 1.25, Gin, pgx/v5 (pgxpool) | `api.zumeet.tw` |
| Admin SPA | Vite 6, React 19, react-router-dom 7 | `admin.zumeet.tw` |
| Database | PostgreSQL 16 (Supabase) | — |
| Storage | S3-compatible (Supabase Storage / MinIO locally) | — |
| E2E | Playwright | — |

```
zumeet/
├── apps/
│   ├── web/        # Next.js frontend
│   ├── api/        # Go + Gin JSON API (user + admin)
│   ├── admin/      # Vite + React admin SPA
│   └── e2e/        # Playwright tests
├── infra/          # Terraform + nginx-dev.conf
├── docker-compose.yml
└── Makefile
```

---

## Local Development

### Prerequisites

- Docker + Docker Compose
- Go 1.25 (for running API outside Docker)
- A Google OAuth app (client ID + secret)
- An ngrok authtoken (for the OAuth callback tunnel)

### Quick start

Compose reads per-app env files. Create them, then start:

```bash
# apps/api/.env.local   — API secrets (JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, ...)
# apps/web/.env.local   — web env
# .env                  — root, holds NGROK_AUTHTOKEN for the tunnel

docker compose up
```

Services:

| Service | URL |
|---|---|
| Dev proxy (single origin) | http://localhost:8088 |
| Frontend | http://localhost:3000 |
| API | http://localhost:8080 |
| Admin SPA | http://localhost:3001 |
| MinIO console | http://localhost:9001 |
| ngrok inspector | http://localhost:4040 |
| PostgreSQL | localhost:5432 |

The `docker-compose.override.yml` is auto-merged and enables hot-reload for api, web, and admin.

**Google OAuth in local dev:** cookies, CORS, and the OAuth callback all need to live on one host, so compose runs an nginx single-origin proxy (`:8088`) plus an ngrok tunnel to it. The Google redirect URL must point at the ngrok domain. Hitting `:3000`/`:8080` directly works for everything *except* login.

### Environment variables (API)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | — |
| `APP_ENV` | `development` | `production` \| `development` \| `test` |
| `DATABASE_URL` | `postgres://zumeet:secret@localhost:5432/zumeet` | — |
| `JWT_SECRET` | — | **Required in prod** |
| `ADMIN_JWT_SECRET` | — | **Required in prod** |
| `GOOGLE_CLIENT_ID` | — | OAuth app |
| `GOOGLE_CLIENT_SECRET` | — | OAuth app |
| `GOOGLE_REDIRECT_URL` | `http://localhost:8080/api/v1/auth/google/callback` | — |
| `FRONTEND_URL` | `http://localhost:3000` | — |
| `ADMIN_FRONTEND_URL` | `http://localhost:3001` | — |
| `STORAGE_ENDPOINT` | `localhost:9000` | MinIO / S3 host |
| `STORAGE_PUBLIC_URL` | — | Public URL for serving photos |
| `STORAGE_BUCKET` | `zumeet` | — |
| `STORAGE_ACCESS_KEY` | `minioadmin` | — |
| `STORAGE_SECRET_KEY` | `minioadmin` | — |
| `STORAGE_USE_SSL` | `false` | Set `true` in prod |
| `RESEND_API_KEY` | — | Admin magic-link email |
| `ADMIN_FROM_EMAIL` | `noreply@zumeet.tw` | — |
| `GOOGLE_MAPS_API_KEY` | — | Server-side geocoding |
| `AUTH_PROVIDER` | `google` | `mock` allowed in dev/test only |
| `ENABLE_TEST_ENDPOINTS` | `false` | Never `true` in prod |

---

## Testing

Backend integration tests use a real PostgreSQL test database (`zumeet_test`). `make api-test` creates it automatically if missing.

Tests cover: auth/onboarding, role authorization, tenant profile CRUD, listing CRUD and status transitions, photo limits, matching predicate, block exclusion, interest transaction, advisory-lock concurrency, contact reveal, account deletion, and admin audit.

E2E (Playwright) tests are currently skipped in CI.

---

## Deployment

| Target | Service |
|---|---|
| `apps/web` | Vercel (`app.zumeet.tw`) |
| `apps/admin` | Vercel / static (`admin.zumeet.tw`) |
| `apps/api` | GCP Cloud Run, `asia-east1` (`api.zumeet.tw` + `admin.zumeet.tw`) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (S3-compatible) |
| Secrets | GCP Secret Manager |
| IaC | Terraform (`infra/`) |
| Rate limiting | Cloudflare WAF |

CI/CD is via GitHub Actions (`deploy.yml`). The `build-api` and `deploy` jobs are currently disabled (`if: false`).

---

## Key Product Rules

- `contact_info` is **never** returned before mutual match — not in browse, incoming, outgoing, card, list, or admin APIs.
- No verification, guarantee, or endorsement wording anywhere in the UI.
- No gender, sexuality, race, religion, or disability filters.
- Incoming and outgoing interest lists are never paywalled.
- Interest → match uses an **advisory lock** (`pg_advisory_xact_lock`) in application code. No DB triggers.
- JWT roles are UI hints only. Backend always re-queries DB for authorization.
w