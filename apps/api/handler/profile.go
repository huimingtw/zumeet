package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/middleware"
)

type MeResponse struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	AvatarURL   string    `json:"avatar_url"`
	ContactInfo string    `json:"contact_info"` // owner-scoped (self); reused to prefill profile/listing forms
	Roles       []string  `json:"roles"`
	CreatedAt   time.Time `json:"created_at"`
}

// GetMe handles GET /api/v1/profile/me
func (h *Handler) GetMe(c *Context) {
	userID := middleware.MustUserID(c)

	var me MeResponse
	me.ID = userID
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT email, COALESCE(name, ''), COALESCE(avatar_url, ''), COALESCE(contact_info, ''), created_at
		 FROM users WHERE id=$1 AND deleted_at IS NULL`,
		userID,
	).Scan(&me.Email, &me.Name, &me.AvatarURL, &me.ContactInfo, &me.CreatedAt); err != nil {
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

type updateMeRequest struct {
	ContactInfo string `json:"contact_info"`
}

// UpdateMe handles PUT /api/v1/profile/me — sets the user-level contact_info
// (entered once at /account, reused by every profile/listing).
func (h *Handler) UpdateMe(c *Context) {
	userID := middleware.MustUserID(c)

	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "code": "invalid_request"})
		return
	}

	contact := strings.TrimSpace(req.ContactInfo)
	if _, err := h.db.Exec(c.Request.Context(),
		`UPDATE users SET contact_info=$1 WHERE id=$2 AND deleted_at IS NULL`,
		contact, userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"contact_info": contact})
}
