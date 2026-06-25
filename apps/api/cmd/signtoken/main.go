// Command signtoken offline-signs a dev access JWT for a user by email.
// No running server needed; reuses the real token signer so it never drifts.
//
//	JWT_SECRET=... go run ./cmd/signtoken user@example.com
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"

	"github.com/zumeet/api/config"
	"github.com/zumeet/api/middleware"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: signtoken <email>")
		os.Exit(1)
	}
	email := os.Args[1]

	cfg := config.Load()
	if cfg.JWTSecret == "" {
		fmt.Fprintln(os.Stderr, "JWT_SECRET is empty")
		os.Exit(1)
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "db connect:", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	var userID string
	var roles []string
	err = conn.QueryRow(ctx, `
		SELECT u.id, COALESCE(array_agg(r.role::text) FILTER (WHERE r.role IS NOT NULL), '{}')
		FROM users u
		LEFT JOIN user_roles r ON r.user_id = u.id AND r.deleted_at IS NULL
		WHERE u.email = $1 AND u.deleted_at IS NULL
		GROUP BY u.id`, email).Scan(&userID, &roles)
	if err != nil {
		fmt.Fprintln(os.Stderr, "no such user:", email)
		os.Exit(1)
	}

	token, err := middleware.GenerateAccessToken([]byte(cfg.JWTSecret), userID, email, roles)
	if err != nil {
		fmt.Fprintln(os.Stderr, "sign:", err)
		os.Exit(1)
	}
	fmt.Println(token)
}
