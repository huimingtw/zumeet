.PHONY: up down logs build test e2e api-test api-build api-run db-reset lint fmt token

# ── Local dev ─────────────────────────────────────────────────────────────────

up:
	docker compose up --build

up-d:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

# ── API (local, outside docker) ───────────────────────────────────────────────

api-run:
	cd apps/api && go run .

api-build:
	cd apps/api && go build -o bin/api .

db-test-up:
	docker compose up -d db
	docker compose exec db sh -c "until pg_isready -U zumeet -d zumeet; do sleep 1; done"
	docker compose exec db psql -U zumeet -d zumeet -tc "SELECT 1 FROM pg_database WHERE datname='zumeet_test'" | grep -q 1 \
		|| docker compose exec db psql -U zumeet -d postgres -c "CREATE DATABASE zumeet_test;"

api-test: db-test-up
	cd apps/api && go test ./... -v -count=1

api-test-short: db-test-up
	cd apps/api && go test ./... -short -count=1

# ── Code quality ──────────────────────────────────────────────────────────────

lint:
	cd apps/api && go vet ./...

fmt:
	cd apps/api && gofmt -l -w .

# ── E2E ───────────────────────────────────────────────────────────────────────

e2e:
	docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm e2e

# ── Database ──────────────────────────────────────────────────────────────────

db-shell:
	docker compose exec db psql -U zumeet -d zumeet

db-reset:
	docker compose down -v
	docker compose up -d db storage
	docker compose exec db sh -c "until pg_isready -U zumeet -d zumeet; do sleep 1; done"
	@echo "DB reset complete"

db-seed:
	docker compose exec db psql -U zumeet -d zumeet -f /docker-entrypoint-initdb.d/02_seed.sql

# ── Auth (dev) ────────────────────────────────────────────────────────────────

# make token EMAIL=foo@bar.com  → offline-signs a 15-min access JWT (no server needed).
# Reads JWT_SECRET from the running api container; db reached via host-mapped 5432.
token:
	@test -n "$(EMAIL)" || { echo "usage: make token EMAIL=user@example.com"; exit 1; }
	@cd apps/api && JWT_SECRET=$$(docker compose -f ../../docker-compose.yml exec -T api printenv JWT_SECRET) \
		go run ./cmd/signtoken "$(EMAIL)"

# ── Storage (MinIO) ───────────────────────────────────────────────────────────

minio-console:
	@echo "MinIO console: http://localhost:9001  (minioadmin / minioadmin)"
	open http://localhost:9001
