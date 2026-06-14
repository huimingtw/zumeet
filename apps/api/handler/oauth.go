package handler

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
)

const oauthStateMaxAge = 10 * time.Minute

// oauthStateClaims is the payload carried in the signed state parameter.
type oauthStateClaims struct {
	ProviderUID string    `json:"uid"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	ExpiresAt   time.Time `json:"exp"`
}

func (h *Handler) signOAuthState(claims oauthStateClaims) (string, error) {
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(h.cfg.JWTSecret))
	mac.Write([]byte(encoded))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return encoded + "." + sig, nil
}

func (h *Handler) verifyOAuthState(state string) (*oauthStateClaims, error) {
	parts := strings.SplitN(state, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid state format")
	}
	encoded, sig := parts[0], parts[1]

	mac := hmac.New(sha256.New, []byte(h.cfg.JWTSecret))
	mac.Write([]byte(encoded))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return nil, fmt.Errorf("invalid state signature")
	}

	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode state: %w", err)
	}
	var claims oauthStateClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("parse state: %w", err)
	}
	if time.Now().After(claims.ExpiresAt) {
		return nil, fmt.Errorf("state expired")
	}
	return &claims, nil
}

// GoogleOAuthRedirect redirects the browser to the OAuth provider's authorization URL.
func (h *Handler) GoogleOAuthRedirect(c *Context) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	nonce := base64.RawURLEncoding.EncodeToString(b)
	c.Redirect(http.StatusFound, h.oauth.GetAuthorizationURL(nonce))
}

// GoogleOAuthCallback handles the Google OAuth callback.
//
// Flow:
//  1. Exchange code → OAuthUser (Google uid + email)
//  2. Lookup auth_identities (google, sub) → existing user → issue tokens
//  3. Lookup users.email (auto-link) → add identity → issue tokens
//  4. New user → sign short-lived state → redirect to onboarding
func (h *Handler) GoogleOAuthCallback(c *Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code", "code": "BAD_REQUEST"})
		return
	}

	oauthUser, err := h.oauth.ExchangeToken(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "oauth exchange failed", "code": "OAUTH_ERROR"})
		return
	}

	// 1. Check existing Google identity
	var userID string
	err = h.db.QueryRow(c.Request.Context(),
		`SELECT user_id FROM auth_identities
		 WHERE provider = 'google' AND provider_uid = $1 AND deleted_at IS NULL`,
		oauthUser.ProviderUID,
	).Scan(&userID)
	if err == nil {
		// Existing Google user — issue tokens and redirect
		if err := h.loginUser(c, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
			return
		}
		c.Redirect(http.StatusFound, h.frontendURL("/"))
		return
	}

	// 2. Auto-link: same email exists (Google email is pre-verified)
	var existingUserID string
	err = h.db.QueryRow(c.Request.Context(),
		`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
		oauthUser.Email,
	).Scan(&existingUserID)
	if err == nil {
		// Add Google identity to existing account
		_, err = h.db.Exec(c.Request.Context(),
			`INSERT INTO auth_identities (id, user_id, provider, provider_uid)
			 VALUES ($1, $2, 'google', $3)
			 ON CONFLICT (provider, provider_uid) DO NOTHING`,
			ulid.Make().String(), existingUserID, oauthUser.ProviderUID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
			return
		}
		if err := h.loginUser(c, existingUserID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
			return
		}
		c.Redirect(http.StatusFound, h.frontendURL("/"))
		return
	}

	// 3. New user — carry identity in signed state, redirect to onboarding
	state, err := h.signOAuthState(oauthStateClaims{
		ProviderUID: oauthUser.ProviderUID,
		Email:       oauthUser.Email,
		Name:        oauthUser.Name,
		ExpiresAt:   time.Now().Add(oauthStateMaxAge),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	c.Redirect(http.StatusFound, h.frontendURL("/onboarding?state="+url.QueryEscape(state)))
}

// OnboardingRequest is the body for POST /api/v1/auth/onboarding.
type OnboardingRequest struct {
	Role        string `json:"role"        binding:"required"`
	AcceptedToS bool   `json:"accepted_tos"` // validated manually: bool zero-value breaks binding:"required"
	OAuthState  string `json:"oauth_state"  binding:"required"`
}

// Onboarding creates user + user_role + auth_identity in a single transaction.
func (h *Handler) Onboarding(c *Context) {
	var req OnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "BAD_REQUEST"})
		return
	}
	if !req.AcceptedToS {
		c.JSON(http.StatusBadRequest, gin.H{"error": "must accept terms of service", "code": "TOS_REQUIRED"})
		return
	}
	if req.Role != "tenant" && req.Role != "landlord" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role", "code": "BAD_REQUEST"})
		return
	}

	claims, err := h.verifyOAuthState(req.OAuthState)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired oauth state", "code": "STATE_INVALID"})
		return
	}

	// Check if this Google identity was already registered (replay protection)
	var existing string
	err = h.db.QueryRow(c.Request.Context(),
		`SELECT user_id FROM auth_identities
		 WHERE provider = 'google' AND provider_uid = $1 AND deleted_at IS NULL`,
		claims.ProviderUID,
	).Scan(&existing)
	if err == nil {
		// Already registered — just issue tokens
		if err := h.loginUser(c, existing); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	// Create users + user_roles + auth_identities in one transaction
	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	userID := ulid.Make().String()
	if _, err = tx.Exec(c.Request.Context(),
		`INSERT INTO users (id, email, is_verified) VALUES ($1, $2, true)`,
		userID, claims.Email,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	if _, err = tx.Exec(c.Request.Context(),
		`INSERT INTO user_roles (user_id, role) VALUES ($1, $2::user_role)`,
		userID, req.Role,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	if _, err = tx.Exec(c.Request.Context(),
		`INSERT INTO auth_identities (id, user_id, provider, provider_uid)
		 VALUES ($1, $2, 'google', $3)`,
		ulid.Make().String(), userID, claims.ProviderUID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	if err := h.loginUser(c, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// loginUser loads user info, builds JWT roles, and issues a token pair.
func (h *Handler) loginUser(c *Context, userID string) error {
	var email string
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	).Scan(&email); err != nil {
		return err
	}

	roles, err := h.userRoles(c.Request.Context(), userID)
	if err != nil {
		return err
	}

	return h.IssueTokenPair(c, userID, email, roles)
}

func (h *Handler) frontendURL(path string) string {
	if h.cfg.AppEnv == "production" {
		return "https://app.zumeet.tw" + path
	}
	return "http://localhost:3000" + path
}
