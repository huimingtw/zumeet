package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

func generateRefreshToken() (plain, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	plain = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	hash = hex.EncodeToString(sum[:])
	return plain, hash, nil
}

func hashToken(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}

func (h *Handler) setTokenCookies(c *Context, accessToken, refreshToken string) {
	domain := ""
	secure := false
	if h.cfg.AppEnv == "production" {
		domain = ".zumeet.tw"
		secure = true
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.AccessTokenCookie,
		Value:    accessToken,
		Path:     "/",
		Domain:   domain,
		MaxAge:   int(middleware.AccessTokenTTL.Seconds()),
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.RefreshTokenCookie,
		Value:    refreshToken,
		Path:     "/",
		Domain:   domain,
		MaxAge:   int(middleware.RefreshTokenTTL.Seconds()),
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) clearTokenCookies(c *Context) {
	domain := ""
	secure := false
	if h.cfg.AppEnv == "production" {
		domain = ".zumeet.tw"
		secure = true
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.AccessTokenCookie,
		Value:    "",
		Path:     "/",
		Domain:   domain,
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.RefreshTokenCookie,
		Value:    "",
		Path:     "/",
		Domain:   domain,
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// IssueTokenPair generates a new access + refresh token, stores the refresh token hash in DB,
// and sets httpOnly cookies on the response.
func (h *Handler) IssueTokenPair(c *Context, userID, email string, roles []string) error {
	accessToken, err := middleware.GenerateAccessToken([]byte(h.cfg.JWTSecret), userID, email, roles)
	if err != nil {
		return err
	}

	plain, hash, err := generateRefreshToken()
	if err != nil {
		return err
	}

	rtID := ulid.Make().String()
	expiresAt := time.Now().Add(middleware.RefreshTokenTTL)
	_, err = h.db.Exec(c.Request.Context(),
		`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
		rtID, userID, hash, expiresAt,
	)
	if err != nil {
		return err
	}

	h.setTokenCookies(c, accessToken, plain)
	return nil
}

// Logout revokes the current refresh token and clears cookies.
func (h *Handler) Logout(c *Context) {
	if refreshToken, err := c.Cookie(middleware.RefreshTokenCookie); err == nil && refreshToken != "" {
		hash := hashToken(refreshToken)
		// Ignore error: best-effort revocation
		h.db.Exec(c.Request.Context(),
			`UPDATE refresh_tokens SET revoked_at = NOW()
			 WHERE token_hash = $1 AND revoked_at IS NULL AND deleted_at IS NULL`,
			hash,
		)
	}
	h.clearTokenCookies(c)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Refresh rotates the refresh token and issues a new access token.
func (h *Handler) Refresh(c *Context) {
	refreshToken, err := c.Cookie(middleware.RefreshTokenCookie)
	if err != nil || refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token", "code": "UNAUTHORIZED"})
		return
	}

	hash := hashToken(refreshToken)

	var rtID, userID string
	var expiresAt time.Time
	var revokedAt *time.Time
	err = h.db.QueryRow(c.Request.Context(),
		`SELECT id, user_id, expires_at, revoked_at
		 FROM refresh_tokens
		 WHERE token_hash = $1 AND deleted_at IS NULL`,
		hash,
	).Scan(&rtID, &userID, &expiresAt, &revokedAt)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token", "code": "TOKEN_INVALID"})
		return
	}
	if revokedAt != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token revoked", "code": "TOKEN_REVOKED"})
		return
	}
	if time.Now().After(expiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token expired", "code": "TOKEN_EXPIRED"})
		return
	}

	var email string
	var suspendedAt, deletedAt *time.Time
	err = h.db.QueryRow(c.Request.Context(),
		`SELECT email, suspended_at, deleted_at FROM users WHERE id = $1`,
		userID,
	).Scan(&email, &suspendedAt, &deletedAt)
	if err != nil || deletedAt != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "UNAUTHORIZED"})
		return
	}
	if suspendedAt != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "account suspended", "code": "ACCOUNT_SUSPENDED"})
		return
	}

	db := h.orm.WithContext(c.Request.Context())
	var roles []string
	if err := db.Table("user_roles").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Pluck("role", &roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	// Revoke old refresh token then issue new pair (rotation)
	if _, err = h.db.Exec(c.Request.Context(),
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
		rtID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	if err := h.IssueTokenPair(c, userID, email, roles); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
