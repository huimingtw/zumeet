# Deployment History

## 2026-07-04 — First Production Deployment

### Architecture Diagram

```
                        ┌─────────────────────────────────────────────────────┐
                        │                   Cloudflare DNS                    │
                        │  api   CNAME → ghs.googlehosted.com  (DNS only)     │
                        │  app   CNAME → *.vercel-dns-017.com  (DNS only)     │
                        │  admin CNAME → *.vercel-dns-017.com  (DNS only)     │
                        └──────────┬───────────────┬───────────────┬──────────┘
                                   │               │               │
                         api.zumeet.tw     app.zumeet.tw   admin.zumeet.tw
                                   │               │               │
                    ┌──────────────▼──┐   ┌────────▼───────────────▼──┐
                    │  Google GFE     │   │         Vercel             │
                    │  (TLS term.)    │   │  (TLS + CDN + SSR)         │
                    └──────────┬──────┘   └────────┬───────────────┬──┘
                               │                   │               │
                    ┌──────────▼──────┐   ┌────────▼──┐   ┌───────▼──────┐
                    │  Cloud Run      │   │  apps/web  │   │  apps/admin  │
                    │  zumeet-api     │   │  Next.js   │   │  Vite SPA    │
                    │  asia-east1     │◄──│  (rewrites │   │              │
                    │  (Go + Gin)     │   │  /api/*)   │   │              │
                    └──────┬──────────┘   └───────────┘   └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
    ┌─────────▼──┐  ┌──────▼──────┐  ┌─▼────────────────┐
    │  Supabase  │  │  Supabase   │  │  GCP Secret      │
    │  Postgres  │  │  Storage    │  │  Manager         │
    │  (pgxpool) │  │  (S3-compat)│  │  (8 secrets)     │
    └────────────┘  └─────────────┘  └──────────────────┘
```

### Architecture

| Component | URL | Status |
|---|---|---|
| API (Cloud Run) | `https://zumeet-api-803504050180.asia-east1.run.app` | ✅ Running |
| Terraform state | `gs://zumeet-tf-state` | ✅ Created |
| Artifact Registry | `asia-east1-docker.pkg.dev/production-361903/zumeet` | ✅ Created |
| Secret Manager | 8 secrets in `production-361903` | ✅ Populated |
| Supabase DB | `db.ykcfalimegljmeyqvhop.supabase.co` | ✅ Created |
| Frontend (web) | Not yet deployed | ⏳ Pending |
| Admin SPA | Not yet deployed | ⏳ Pending |
| Custom domain DNS | Configured (see DNS section) | ✅ Done |
| Schema migration | Applied 2026-07-04 | ✅ Done |
| GitHub Actions CI | `build-api` / `deploy` still `if: false` | ⏳ Pending |

### Steps Completed

1. **Bootstrap** — Created GCS state bucket `zumeet-tf-state` via `infra/bootstrap/`
2. **Terraform apply** — Provisioned 26 GCP resources (Cloud Run, Artifact Registry, Secret Manager, IAM SAs)
3. **Secrets populated** — 8 secrets written to Secret Manager via `gcloud secrets versions add`
4. **Docker build** — Built `linux/amd64` image from `apps/api/` (first build failed: arm64, rebuilt with `--platform linux/amd64`)
5. **Image pushed** — `asia-east1-docker.pkg.dev/production-361903/zumeet/api:2d31ca3` + `:latest`
6. **Cloud Run deploy** — `gcloud run deploy zumeet-api` with real image + `--allow-unauthenticated`
7. **API verified** — `GET /api/v1/auth/google` returns 302 to Google OAuth with correct client_id ✅

### Issues Encountered

#### arm64 exec format error
- First Docker build ran on Mac (arm64), Cloud Run needs `linux/amd64`
- Fix: `docker build --platform linux/amd64 ...`

#### Terraform tainted Cloud Run service
- First `terraform apply` used `placeholder/image:latest` which failed to start
- Terraform marked the resource as tainted → destroyed and recreated on second apply
- Cloud Run service URL changed from `...-803504050180.asia-east1.run.app` to `...-il3hfljiyq-de.a.run.app`
- Fix: `gcloud run deploy --allow-unauthenticated` re-pinned both URLs to the same service

#### allUsers IAM binding missing
- First Terraform apply errored partway through, `google_cloud_run_v2_service_iam_member.public` was not created
- Result: all requests returned 403 unauthenticated
- Fix: re-ran `terraform apply` which applied the missing IAM binding

#### `/healthz` returns Google 404
- All API paths work (`/api/v1/*`), `/` returns Gin 404
- `/healthz` returns Google infrastructure-level 404 (no `x-request-id` header)
- Root cause: unknown — possibly Cloud Run infrastructure intercepts this path
- Impact: low — API is functional, use `/api/v1/auth/google` to verify health
- Workaround: health check via `/api/v1/auth/google` (returns 302 = app is up)

### Terraform State

- Backend: `gs://zumeet-tf-state/terraform/state`
- Workspace: `default` (= production)
- Key resources:
  - `google_cloud_run_v2_service.api`
  - `google_artifact_registry_repository.zumeet`
  - `google_secret_manager_secret.secrets[*]` (8 secrets)
  - `google_service_account.cloud_run` → `zumeet-cloud-run@production-361903.iam.gserviceaccount.com`
  - `google_service_account.github_actions` → `zumeet-github-actions@production-361903.iam.gserviceaccount.com`

### Secrets in GCP Secret Manager

| Secret | Version | Notes |
|---|---|---|
| `DATABASE_URL` | 1 | Supabase postgres URI |
| `JWT_SECRET` | 1 | 48-byte base64 |
| `ADMIN_JWT_SECRET` | 1 | 48-byte base64 |
| `GOOGLE_CLIENT_ID` | 1 | OAuth client `803504050180-cct0b5mr18g60pi1dri9jj02q2r5nt31` |
| `GOOGLE_CLIENT_SECRET` | 1 | From GCP Console OAuth 2.0 credentials |
| `RESEND_API_KEY` | 1 | Resend dashboard |
| `STORAGE_ACCESS_KEY` | 1 | Supabase S3 access key |
| `STORAGE_SECRET_KEY` | 1 | Supabase S3 secret key |

### Vercel Environment Variables

| Var | Value | Notes |
|---|---|---|
| `API_UPSTREAM` | `https://api.zumeet.tw` | Server-side Next.js rewrite target |
| `NEXT_PUBLIC_API_URL` | `https://api.zumeet.tw` | Client-side axios base URL |

**Issue fixed 2026-07-04:** Both vars were originally set to `https://zumeet-api-803504050180.asia-east1.run.app`. After `api.zumeet.tw` custom domain + TLS cert was ready, updated both to use the custom domain. Without this fix, auth cookies set on `api.zumeet.tw` were not sent to `*.run.app` (different domain), causing 401s after OAuth callback.

### Missing env vars (not yet in Cloud Run)

| Var | Value | Notes |
|---|---|---|
| `STORAGE_ENDPOINT` | `https://ykcfalimegljmeyqvhop.supabase.co/storage/v1/s3` | Supabase S3 endpoint |
| `STORAGE_BUCKET` | TBD | Bucket name in Supabase Storage |
| `GOOGLE_MAPS_API_KEY` | From GCP Console (server key `445a3402-...`) | Not in Terraform secrets — needs to be added |

### Next Steps

1. **Schema migration** — Connect to Supabase and apply `apps/api/db/schema.sql`
2. **Storage config** — Add `STORAGE_ENDPOINT` and `STORAGE_BUCKET` env vars to Cloud Run
3. **GOOGLE_MAPS_API_KEY** — Add to Secret Manager and Cloud Run
4. **Supabase Storage bucket** — Create bucket in Supabase Storage dashboard
5. **End-to-end OAuth test** — In progress (schema migrated, env vars fixed, testing login flow)
6. **CI/CD** — Create GitHub Actions SA key, set `GCP_SA_KEY` + `GCP_PROJECT_ID` secrets, enable `build-api` / `deploy` jobs

### DNS Configuration

| Subdomain | Type | Target | Proxy |
|---|---|---|---|
| `api` | CNAME | `ghs.googlehosted.com` | DNS only |
| `app` | CNAME | `c08f2184ee297153.vercel-dns-017.com` | DNS only |
| `admin` | CNAME | `39dc56204a2d6b58.vercel-dns-017.com` | DNS only |

**Cloud Run domain mapping:** `api.zumeet.tw` → `zumeet-api` (region: asia-east1)
- TLS cert auto-provisioned by Google (created 2026-07-04, status: pending ~15 min)
- `ghs.googlehosted.com` is required target (not `*.run.app`) for cert to be issued

**Domain ownership verification:** `zumeet.tw` verified in Google Search Console via DNS TXT (added automatically by Cloudflare integration).

#### SSL 525 issue (Vercel)
- Cloudflare orange cloud + Vercel → 525 SSL handshake failure
- Fix: switch `app` and `admin` to DNS only with Vercel-specific CNAME targets

#### Cloud Run cert mismatch
- `*.run.app` cert does not cover `api.zumeet.tw`
- Fix: Cloud Run domain mapping → `ghs.googlehosted.com` CNAME

### Commands Reference

```bash
# Rebuild and deploy API (from repo root)
docker build --platform linux/amd64 \
  -t asia-east1-docker.pkg.dev/production-361903/zumeet/api:$(git rev-parse --short HEAD) \
  -t asia-east1-docker.pkg.dev/production-361903/zumeet/api:latest \
  apps/api/
docker push asia-east1-docker.pkg.dev/production-361903/zumeet/api:$(git rev-parse --short HEAD)
gcloud run deploy zumeet-api \
  --image asia-east1-docker.pkg.dev/production-361903/zumeet/api:$(git rev-parse --short HEAD) \
  --region asia-east1 --project production-361903 --quiet

# View Cloud Run logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="zumeet-api"' \
  --project=production-361903 --limit=50

# Update a secret value
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME \
  --data-file=- --project=production-361903

# Terraform
cd infra
terraform workspace select default
terraform plan -var project_id=production-361903 -var api_image=IMAGE:TAG
terraform apply -var project_id=production-361903 -var api_image=IMAGE:TAG
```
