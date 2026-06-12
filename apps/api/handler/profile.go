package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/middleware"
)

type MeResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Roles     []string  `json:"roles"`
	CreatedAt time.Time `json:"created_at"`
}

// GetMe handles GET /api/v1/profile/me
func (h *Handler) GetMe(c *Context) {
	userID := middleware.MustUserID(c)

	var me MeResponse
	me.ID = userID
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT email, created_at FROM users WHERE id=$1 AND deleted_at IS NULL`,
		userID,
	).Scan(&me.Email, &me.CreatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	db := h.orm.WithContext(c.Request.Context())
	me.Roles = []string{}
	if err := db.Table("user_roles").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Pluck("role", &me.Roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	c.JSON(http.StatusOK, me)
}
