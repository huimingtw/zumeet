package db

import (
	"context"
	_ "embed"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	postgresdriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

//go:embed schema.sql
var schemaSQL string

//go:embed seed.sql
var seedSQL string

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return nil, fmt.Errorf("create pgxpool: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return pool, nil
}

func ConnectGorm(databaseURL string) (*gorm.DB, error) {
	gdb, err := gorm.Open(postgresdriver.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("create gorm db: %w", err)
	}

	sqlDB, err := gdb.DB()
	if err != nil {
		return nil, fmt.Errorf("unwrap gorm db: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping gorm db: %w", err)
	}

	return gdb, nil
}

// ConnectTest drops and recreates the test database, then applies schema and seed.
// This guarantees the schema is always current — no stale columns from previous runs.
// Uses TEST_DATABASE_URL env var; defaults to local zumeet_test.
func ConnectTest() (*pgxpool.Pool, error) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://zumeet:secret@localhost:5432/zumeet_test"
	}

	cfg, err := pgconn.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse test db url: %w", err)
	}
	dbName := cfg.Database

	// Connect to the postgres maintenance DB to drop/create the test DB.
	cfg.Database = "postgres"
	adminConn, err := pgconn.ConnectConfig(context.Background(), cfg)
	if err != nil {
		return nil, fmt.Errorf("pgconn connect to test db: %w", err)
	}
	if err := adminConn.Exec(context.Background(),
		fmt.Sprintf("DROP DATABASE IF EXISTS %q", dbName),
	).Close(); err != nil {
		adminConn.Close(context.Background())
		return nil, fmt.Errorf("drop test db: %w", err)
	}
	if err := adminConn.Exec(context.Background(),
		fmt.Sprintf("CREATE DATABASE %q", dbName),
	).Close(); err != nil {
		adminConn.Close(context.Background())
		return nil, fmt.Errorf("create test db: %w", err)
	}
	adminConn.Close(context.Background())

	// Apply schema + seed to the fresh database.
	appConn, err := pgconn.Connect(context.Background(), url)
	if err != nil {
		return nil, fmt.Errorf("pgconn connect to test db: %w", err)
	}
	if err := appConn.Exec(context.Background(), schemaSQL).Close(); err != nil {
		appConn.Close(context.Background())
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	if err := appConn.Exec(context.Background(), seedSQL).Close(); err != nil {
		appConn.Close(context.Background())
		return nil, fmt.Errorf("apply seed: %w", err)
	}
	appConn.Close(context.Background())

	return Connect(url)
}

func ConnectGormTest() (*gorm.DB, error) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://zumeet:secret@localhost:5432/zumeet_test"
	}
	return ConnectGorm(url)
}

// TruncateTables removes all user-generated data. Preserves locations (reference data).
func TruncateTables(pool *pgxpool.Pool) error {
	tables := strings.Join([]string{
		"admin_actions", "admin_login_tokens", "admins",
		"matches", "interests", "blocks", "reports",
		"listing_photos", "listings",
		"tenant_profile_locations", "tenant_profiles",
		"refresh_tokens", "auth_identities", "user_roles", "users",
	}, ", ")
	_, err := pool.Exec(context.Background(), "TRUNCATE TABLE "+tables+" CASCADE")
	return err
}
