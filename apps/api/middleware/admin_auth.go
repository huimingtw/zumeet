package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const AdminTokenCookie = "zumeet_admin"

type AdminClaims struct {
	AdminID string `json:"admin_id"`
	Level   string `json:"level"`
	jwt.RegisteredClaims
}

func GenerateAdminToken(secret []byte, adminID, level string) (string, error) {
	claims := &AdminClaims{
		AdminID: adminID,
		Level:   level,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(3 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func ValidateAdminToken(secret []byte, tokenStr string) (*AdminClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AdminClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*AdminClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

// AdminAuth validates the admin JWT cookie and injects admin_id + level into gin context.
func AdminAuth(adminJWTSecret []byte, db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Cookie(AdminTokenCookie)
		if err != nil || cookie == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "unauthorized"})
			return
		}

		claims, err := ValidateAdminToken(adminJWTSecret, cookie)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token", "code": "invalid_token"})
			return
		}

		// verify admin still exists and is not deleted
		var level string
		err = db.QueryRow(c.Request.Context(),
			`SELECT level::text FROM admins WHERE id=$1`, claims.AdminID,
		).Scan(&level)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "unauthorized"})
			return
		}

		c.Set("admin_id", claims.AdminID)
		c.Set("admin_level", level)
		c.Next()
	}
}

func AdminIDFromContext(c *gin.Context) (string, bool) {
	v, ok := c.Get("admin_id")
	if !ok {
		return "", false
	}
	id, ok := v.(string)
	return id, ok
}

func MustAdminID(c *gin.Context) string {
	id, ok := AdminIDFromContext(c)
	if !ok {
		panic("admin_id not in context")
	}
	return id
}

func AdminLevelFromContext(c *gin.Context) string {
	v, _ := c.Get("admin_level")
	s, _ := v.(string)
	return s
}
