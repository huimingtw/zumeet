package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

// CreateReport handles POST /api/v1/reports
func (h *Handler) CreateReport(c *gin.Context) {
	userID := middleware.MustUserID(c)

	var req struct {
		ReportedID string `json:"reported_id" binding:"required"`
		ListingID  string `json:"listing_id"`
		Reason     string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_request"})
		return
	}
	if req.ReportedID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot report yourself", "code": "self_report"})
		return
	}

	// verify reported user exists
	var reportedExists bool
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND deleted_at IS NULL)`, req.ReportedID,
	).Scan(&reportedExists); err != nil || !reportedExists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reported user not found", "code": "user_not_found"})
		return
	}

	// if listing_id provided, verify it exists
	if req.ListingID != "" {
		var listingExists bool
		if err := h.db.QueryRow(c.Request.Context(),
			`SELECT EXISTS(SELECT 1 FROM listings WHERE id=$1 AND deleted_at IS NULL)`, req.ListingID,
		).Scan(&listingExists); err != nil || !listingExists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "listing not found", "code": "listing_not_found"})
			return
		}
	}

	id := ulid.Make().String()
	var listingIDPtr *string
	if req.ListingID != "" {
		listingIDPtr = &req.ListingID
	}

	if _, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO reports (id, reporter_id, reported_id, listing_id, reason)
		VALUES ($1, $2, $3, $4, $5)`,
		id, userID, req.ReportedID, listingIDPtr, req.Reason,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create report", "code": "internal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// BlockUser handles POST /api/v1/blocks/:userId
func (h *Handler) BlockUser(c *gin.Context) {
	userID := middleware.MustUserID(c)
	targetID := c.Param("userId")

	if targetID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot block yourself", "code": "self_block"})
		return
	}

	// verify target exists
	var targetExists bool
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND deleted_at IS NULL)`, targetID,
	).Scan(&targetExists); err != nil || !targetExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found", "code": "user_not_found"})
		return
	}

	// UPSERT: restore if previously soft-deleted, or insert new
	if _, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO blocks (blocker_id, blocked_id)
		VALUES ($1, $2)
		ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET deleted_at = NULL`,
		userID, targetID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to block user", "code": "internal"})
		return
	}

	c.Status(http.StatusNoContent)
}

// UnblockUser handles DELETE /api/v1/blocks/:userId
func (h *Handler) UnblockUser(c *gin.Context) {
	userID := middleware.MustUserID(c)
	targetID := c.Param("userId")

	result, err := h.db.Exec(c.Request.Context(), `
		UPDATE blocks SET deleted_at = NOW()
		WHERE blocker_id=$1 AND blocked_id=$2 AND deleted_at IS NULL`,
		userID, targetID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if result.RowsAffected() == 0 {
		// idempotent: block didn't exist, that's fine
	}
	c.Status(http.StatusNoContent)
}

// DeleteAccount handles DELETE /api/v1/account
func (h *Handler) DeleteAccount(c *gin.Context) {
	userID := middleware.MustUserID(c)

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	tables := []struct {
		table  string
		column string
	}{
		{"tenant_profile_locations", "tenant_profile_id"},
		{"interests", "tenant_profile_id"},
		{"matches", "tenant_id"},
		{"matches", "landlord_id"},
		{"blocks", "blocker_id"},
		{"blocks", "blocked_id"},
		{"refresh_tokens", "user_id"},
		{"auth_identities", "user_id"},
		{"user_roles", "user_id"},
	}

	// soft-delete tenant_profiles (cascade locations/interests via the loop)
	if _, err = tx.Exec(c.Request.Context(),
		`UPDATE tenant_profiles SET deleted_at=NOW() WHERE tenant_id=$1 AND deleted_at IS NULL`, userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	// soft-delete listing_photos and listings
	if _, err = tx.Exec(c.Request.Context(),
		`UPDATE listing_photos SET deleted_at=NOW()
		 WHERE listing_id IN (SELECT id FROM listings WHERE landlord_id=$1 AND deleted_at IS NULL)
		   AND deleted_at IS NULL`, userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if _, err = tx.Exec(c.Request.Context(),
		`UPDATE listings SET deleted_at=NOW() WHERE landlord_id=$1 AND deleted_at IS NULL`, userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	for _, t := range tables {
		q := `UPDATE ` + t.table + ` SET deleted_at=NOW() WHERE ` + t.column + `=$1 AND deleted_at IS NULL`
		if _, err = tx.Exec(c.Request.Context(), q, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}
	}

	// soft-delete the user last
	if _, err = tx.Exec(c.Request.Context(),
		`UPDATE users SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	// clear auth cookies
	h.clearTokenCookies(c)
	c.Status(http.StatusNoContent)
}
