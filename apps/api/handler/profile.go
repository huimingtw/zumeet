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

// AddRoleRequest is the body for POST /api/v1/account/roles.
type AddRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// AddRole handles POST /api/v1/account/roles — adds a second role to the current user.
func (h *Handler) AddRole(c *Context) {
	userID := middleware.MustUserID(c)
	var req AddRoleRequest
	if !bindJSON(c, &req) {
		return
	}
	if req.Role != "tenant" && req.Role != "landlord" {
		respondFieldError(c, "role", "身分不是有效選項")
		return
	}
	if _, err := h.db.Exec(c.Request.Context(),
		`INSERT INTO user_roles (user_id, role) VALUES ($1, $2::user_role) ON CONFLICT DO NOTHING`,
		userID, req.Role,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	roles, err := h.userRoles(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"roles": roles})
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

	roles, err := h.userRoles(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	me.Roles = roles

	c.JSON(http.StatusOK, me)
}
