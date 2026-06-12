package handler

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/service"
)

// testOAuthUsers holds mock Google identities; keyed by authorization code.
// Only used when APP_ENV=test.
var (
	testOAuthMu    sync.RWMutex
	testOAuthUsers = map[string]testOAuthUser{}
)

type testOAuthUser struct {
	Sub   string
	Email string
	Name  string
}

// RegisterTestOAuthUser seeds a mock OAuth identity reachable via ExchangeToken.
func RegisterTestOAuthUser(code, sub, email, name string) {
	testOAuthMu.Lock()
	defer testOAuthMu.Unlock()
	testOAuthUsers[code] = testOAuthUser{Sub: sub, Email: email, Name: name}
}

// MockOAuthService implements service.OAuthService for tests.
// ExchangeToken looks up the code in testOAuthUsers — no HTTP call to Google.
type MockOAuthService struct{}

func (m *MockOAuthService) ExchangeToken(_ context.Context, code string) (*service.OAuthUser, error) {
	testOAuthMu.RLock()
	u, ok := testOAuthUsers[code]
	testOAuthMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown test oauth code: %s", code)
	}
	return &service.OAuthUser{
		ProviderUID: u.Sub,
		Email:       u.Email,
		Name:        u.Name,
	}, nil
}

// TestOAuthTokenEndpoint mimics Google's token endpoint (POST /test/oauth/google).
// Only mounted when APP_ENV=test.
func (h *Handler) TestOAuthTokenEndpoint(c *Context) {
	code := c.PostForm("code")
	testOAuthMu.RLock()
	_, ok := testOAuthUsers[code]
	testOAuthMu.RUnlock()
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown code"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"access_token": code, "token_type": "Bearer"})
}

// TestOAuthUserInfoEndpoint mimics Google's userinfo endpoint.
// Only mounted when APP_ENV=test.
func (h *Handler) TestOAuthUserInfoEndpoint(c *Context) {
	auth := c.GetHeader("Authorization")
	if len(auth) < 8 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}
	token := auth[7:]
	testOAuthMu.RLock()
	u, ok := testOAuthUsers[token]
	testOAuthMu.RUnlock()
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unknown token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sub": u.Sub, "email": u.Email, "name": u.Name})
}

// TestSeedSession creates a fully onboarded user and issues JWT cookies.
// POST /test/auth/seed  body: {"email":"...","role":"tenant|landlord"}
// Only mounted when APP_ENV=test.
func (h *Handler) TestSeedSession(c *Context) {
	var req struct {
		Email string `json:"email" binding:"required"`
		Role  string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role != "tenant" && req.Role != "landlord" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be tenant or landlord"})
		return
	}

	ctx := c.Request.Context()
	// upsert user
	userID := ""
	err := h.db.QueryRow(ctx,
		`SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL`, req.Email,
	).Scan(&userID)
	if err != nil {
		// create new user
		userID = ulid.Make().String()
		_, err = h.db.Exec(ctx,
			`INSERT INTO users (id, email, is_verified) VALUES ($1, $2, true)`, userID, req.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = h.db.Exec(ctx,
			`INSERT INTO user_roles (user_id, role) VALUES ($1, $2::user_role)
			 ON CONFLICT DO NOTHING`, userID, req.Role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.IssueTokenPair(c, userID, req.Email, []string{req.Role}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user_id": userID})
}
