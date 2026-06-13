package handler_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"os"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/config"
	appdb "github.com/zumeet/api/db"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/middleware"
	"github.com/zumeet/api/router"
)

var (
	testPool *pgxpool.Pool
	testH    *handler.Handler
	testR    *gin.Engine
	testCfg  *config.AppConfig
)

const testJWTSecret = "test-jwt-secret-32-bytes-minimum!!"

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	testCfg = &config.AppConfig{
		AppEnv:         "test",
		JWTSecret:      testJWTSecret,
		AdminJWTSecret: "test-admin-jwt-secret-32-bytes!!!",
	}

	var err error
	testPool, err = appdb.ConnectTest()
	if err != nil {
		log.Fatalf("connect test db: %v\nEnsure zumeet_test db exists: docker compose exec db psql -U zumeet postgres -c \"CREATE DATABASE zumeet_test;\"", err)
	}
	defer testPool.Close()

	testH = handler.New(testPool, &handler.MockOAuthService{}, &noopStorage{}, &noopEmail{}, testCfg)
	testR = router.New(testH, testCfg, zap.NewNop())

	if err := appdb.TruncateTables(testPool); err != nil {
		log.Fatalf("truncate: %v", err)
	}

	os.Exit(m.Run())
}

func truncate(t *testing.T) {
	t.Helper()
	if err := appdb.TruncateTables(testPool); err != nil {
		t.Fatalf("truncate: %v", err)
	}
}

// seedUser inserts a user + optional role, returns userID.
func seedUser(t *testing.T, email, role string) string {
	t.Helper()
	userID := ulid.Make().String()
	_, err := testPool.Exec(context.Background(),
		`INSERT INTO users (id, email, is_verified) VALUES ($1, $2, true)`,
		userID, email,
	)
	if err != nil {
		t.Fatalf("seed user %s: %v", email, err)
	}
	if role != "" {
		_, err = testPool.Exec(context.Background(),
			`INSERT INTO user_roles (user_id, role) VALUES ($1, $2::user_role)`,
			userID, role,
		)
		if err != nil {
			t.Fatalf("seed user_role: %v", err)
		}
	}
	return userID
}

// validAccessCookie returns an httpOnly cookie with a fresh access token.
func validAccessCookie(t *testing.T, userID, email string, roles []string) *http.Cookie {
	t.Helper()
	token, err := middleware.GenerateAccessToken([]byte(testJWTSecret), userID, email, roles)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return &http.Cookie{Name: middleware.AccessTokenCookie, Value: token}
}

// expiredAccessCookie returns a cookie with an already-expired access token.
func expiredAccessCookie(t *testing.T, userID string) *http.Cookie {
	t.Helper()
	claims := &middleware.Claims{
		UserID: userID,
		Email:  "x@x.com",
		Roles:  nil,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("build expired token: %v", err)
	}
	return &http.Cookie{Name: middleware.AccessTokenCookie, Value: token}
}

// seedRefreshToken inserts a refresh_token row; returns plaintext token.
func seedRefreshToken(t *testing.T, userID string, expiresAt time.Time, revoked bool) string {
	t.Helper()
	plain := ulid.Make().String() + ulid.Make().String() // 52-char random string
	sum := sha256.Sum256([]byte(plain))
	hash := hex.EncodeToString(sum[:])

	var revokedAt *time.Time
	if revoked {
		now := time.Now()
		revokedAt = &now
	}
	_, err := testPool.Exec(context.Background(),
		`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		ulid.Make().String(), userID, hash, expiresAt, revokedAt,
	)
	if err != nil {
		t.Fatalf("seed refresh token: %v", err)
	}
	return plain
}

// buildProtectedRouter creates a minimal router with Auth middleware for middleware tests.
func buildProtectedRouter() *gin.Engine {
	r := gin.New()
	r.Use(middleware.Auth([]byte(testJWTSecret), testPool))
	r.GET("/protected", func(c *gin.Context) {
		userID := middleware.MustUserID(c)
		c.JSON(http.StatusOK, gin.H{"user_id": userID})
	})
	return r
}

// testCityDistrict maps legacy test location slugs to city+district natural keys.
// Falls back to 台北市/大安區 for unknown or empty slugs.
func testCityDistrict(slug string) (city, district string) {
	switch slug {
	case "taipei-zhongshan":
		return "台北市", "中山區"
	default: // "taipei-daan" and anything else
		return "台北市", "大安區"
	}
}

// ---- noop service implementations ----

type noopStorage struct{}

func (n *noopStorage) Upload(_ context.Context, key string, _ io.Reader, _ int64, _ string) (string, error) {
	return "https://storage.example.com/" + key, nil
}

func (n *noopStorage) Delete(_ context.Context, _ string) error { return nil }

type noopEmail struct{}

func (n *noopEmail) Send(_ context.Context, _, _, _ string) error { return nil }
