package handler

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
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
func (h *Handler) TestOAuthTokenEndpoint(c *gin.Context) {
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
func (h *Handler) TestOAuthUserInfoEndpoint(c *gin.Context) {
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
