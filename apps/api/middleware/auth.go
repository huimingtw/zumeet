package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	AccessTokenCookie  = "zumeet_access"
	RefreshTokenCookie = "zumeet_refresh"
	AccessTokenTTL     = 15 * time.Minute
	RefreshTokenTTL    = 30 * 24 * time.Hour
)

const userIDCtxKey = "user_id"

type valueGetter interface {
	Get(any) (any, bool)
}

type Claims struct {
	UserID string   `json:"user_id"`
	Email  string   `json:"email"`
	Roles  []string `json:"roles"`
	jwt.RegisteredClaims
}

func GenerateAccessToken(secret []byte, userID, email string, roles []string) (string, error) {
	claims := &Claims{
		UserID: userID,
		Email:  email,
		Roles:  roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func ValidateAccessToken(secret []byte, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

// Auth validates the access token cookie, checks user status, and injects user_id into context.
// Responsibility: token validity + user active check only. Role authz happens in each handler via RequireRole.
func Auth(jwtSecret []byte, db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := c.Cookie(AccessTokenCookie)
		if err != nil || tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized", "code": "UNAUTHORIZED",
			})
			return
		}

		claims, err := ValidateAccessToken(jwtSecret, tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "token invalid or expired", "code": "TOKEN_INVALID",
			})
			return
		}

		var suspendedAt, deletedAt *time.Time
		err = db.QueryRow(c.Request.Context(),
			`SELECT suspended_at, deleted_at FROM users WHERE id = $1`,
			claims.UserID,
		).Scan(&suspendedAt, &deletedAt)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized", "code": "UNAUTHORIZED",
			})
			return
		}
		if deletedAt != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized", "code": "UNAUTHORIZED",
			})
			return
		}
		if suspendedAt != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "account suspended", "code": "ACCOUNT_SUSPENDED",
			})
			return
		}

		c.Set(userIDCtxKey, claims.UserID)
		c.Next()
	}
}

func UserIDFromContext(c valueGetter) (string, bool) {
	v, exists := c.Get(userIDCtxKey)
	if !exists {
		return "", false
	}
	id, ok := v.(string)
	return id, ok
}

func MustUserID(c valueGetter) string {
	id, _ := UserIDFromContext(c)
	return id
}
