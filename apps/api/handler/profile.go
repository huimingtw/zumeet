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
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url"`
	Roles     []string  `json:"roles"`
	CreatedAt time.Time `json:"created_at"`
}

// GetMe handles GET /api/v1/profile/me
func (h *Handler) GetMe(c *Context) {
	userID := middleware.MustUserID(c)

	var me MeResponse
	me.ID = userID
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT email, COALESCE(name, ''), COALESCE(avatar_url, ''), created_at
		 FROM users WHERE id=$1 AND deleted_at IS NULL`,
		userID,
	).Scan(&me.Email, &me.Name, &me.AvatarURL, &me.CreatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	roles, err := h.userRoles(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	me.Roles = roles

	c.JSON(http.StatusOK, me)
}
