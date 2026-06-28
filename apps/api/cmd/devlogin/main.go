// Command devlogin logs you into the local web app as an existing user by email:
// it mints a dev access JWT (same signer as prod, so it never drifts), serves a
// one-shot page that sets the httpOnly cookie, and opens it in Chrome. The cookie
// is host-only for "localhost", so it applies to the Next dev server on :3000.
//
//	JWT_SECRET=... go run ./cmd/devlogin user@example.com
//
// ponytail: dev-only. Guarded against non-localhost DBs so it can't mint prod sessions.
package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/zumeet/api/config"
	"github.com/zumeet/api/middleware"
)

const appURL = "http://localhost:3000"

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: devlogin <email>")
		os.Exit(1)
	}
	email := os.Args[1]

	cfg := config.Load()
	if cfg.JWTSecret == "" {
		fmt.Fprintln(os.Stderr, "JWT_SECRET is empty")
		os.Exit(1)
	}
	if !strings.Contains(cfg.DatabaseURL, "localhost") && !strings.Contains(cfg.DatabaseURL, "127.0.0.1") {
		fmt.Fprintln(os.Stderr, "refusing to run against a non-localhost DATABASE_URL")
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

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintln(os.Stderr, "listen:", err)
		os.Exit(1)
	}
	// Use "localhost", not the listener's 127.0.0.1: the cookie is host-only and must
	// land under the same host as the web app (localhost:3000), or :3000 won't see it.
	loginURL := fmt.Sprintf("http://localhost:%d/", ln.Addr().(*net.TCPAddr).Port)

	done := make(chan struct{})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     middleware.AccessTokenCookie,
			Value:    token,
			Path:     "/",
			MaxAge:   int(middleware.AccessTokenTTL.Seconds()),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
		http.Redirect(w, r, appURL, http.StatusFound)
		close(done)
	})

	go http.Serve(ln, nil)

	fmt.Printf("logged in as %s (%s) — opening Chrome…\n", email, userID)
	if err := exec.Command("open", "-a", "Google Chrome", loginURL).Run(); err != nil {
		fmt.Fprintf(os.Stderr, "open Chrome failed (%v); visit manually: %s\n", err, loginURL)
	}
	<-done
	// ponytail: let the redirect+Set-Cookie response flush to Chrome before we exit
	// and kill the listener, or Chrome gets ERR_CONNECTION_REFUSED on this port.
	time.Sleep(300 * time.Millisecond)
}
