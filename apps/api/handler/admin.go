package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

const adminMagicLinkTTL = 15 * time.Minute

// ---- auth ----

// AdminLoginRequest handles POST /login (admin subdomain)
func (h *Handler) AdminLogin(c *Context) {
	var req struct {
		Email string `json:"email" form:"email"`
	}
	// accept both JSON and form (html form POST)
	_ = c.ShouldBind(&req)

	// always return same message to prevent email enumeration
	msg := gin.H{"message": "若此信箱為管理員，連結已寄出"}

	if req.Email == "" {
		c.JSON(http.StatusOK, msg)
		return
	}

	var adminID, level string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT id, level::text FROM admins WHERE email=$1`, req.Email,
	).Scan(&adminID, &level)
	if err != nil {
		// email not found — return same response to avoid enumeration
		c.JSON(http.StatusOK, msg)
		return
	}

	// generate 32-byte random token
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	plainToken := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(plainToken))
	tokenHash := hex.EncodeToString(sum[:])

	tokenID := ulid.Make().String()
	expiresAt := time.Now().Add(adminMagicLinkTTL)

	if _, err = h.db.Exec(c.Request.Context(),
		`INSERT INTO admin_login_tokens (id, admin_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)`,
		tokenID, adminID, tokenHash, expiresAt,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// build callback URL — use request host to support local dev
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	callbackURL := fmt.Sprintf("%s://%s/auth/callback?token=%s", scheme, c.Request.Host, plainToken)

	// send magic link (token plain-text only in email, not logged)
	subject := "Zumeet 管理員登入連結"
	body := fmt.Sprintf(`<p>點擊以下連結登入（15 分鐘內有效，僅可使用一次）：</p><p><a href="%s">%s</a></p>`, callbackURL, callbackURL)
	_ = h.email.Send(c.Request.Context(), req.Email, subject, body)

	c.JSON(http.StatusOK, msg)
}

// AdminAuthCallback handles GET /auth/callback?token=
func (h *Handler) AdminAuthCallback(c *Context) {
	plainToken := c.Query("token")
	if plainToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing token"})
		return
	}

	sum := sha256.Sum256([]byte(plainToken))
	tokenHash := hex.EncodeToString(sum[:])

	var tokenID, adminID string
	var expiresAt time.Time
	var usedAt *time.Time

	err := h.db.QueryRow(c.Request.Context(),
		`SELECT t.id, t.admin_id, t.expires_at, t.used_at
		 FROM admin_login_tokens t
		 WHERE t.token_hash=$1`, tokenHash,
	).Scan(&tokenID, &adminID, &expiresAt, &usedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if usedAt != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token already used"})
		return
	}
	if time.Now().After(expiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
		return
	}

	// mark token used
	if _, err = h.db.Exec(c.Request.Context(),
		`UPDATE admin_login_tokens SET used_at=NOW() WHERE id=$1`, tokenID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// fetch admin level
	var level string
	if err = h.db.QueryRow(c.Request.Context(),
		`SELECT level::text FROM admins WHERE id=$1`, adminID,
	).Scan(&level); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	token, err := middleware.GenerateAdminToken([]byte(h.cfg.AdminJWTSecret), adminID, level)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.AdminTokenCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	c.Redirect(http.StatusFound, "/reports")
}

// AdminLogout handles POST /logout
func (h *Handler) AdminLogout(c *Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.AdminTokenCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// ---- helpers ----

func (h *Handler) requireAdmin(c *Context, minLevel string) bool {
	level := middleware.AdminLevelFromContext(c)
	if minLevel == "super_admin" && level != "super_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "super_admin required", "code": "forbidden"})
		return false
	}
	return true
}

func notePtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ---- reports queue ----

// AdminListReports handles GET /reports
func (h *Handler) AdminListReports(c *Context) {
	status := c.DefaultQuery("status", "pending")

	type reportRow struct {
		ID         string    `json:"id"`
		ReporterID string    `json:"reporter_id"`
		ReportedID string    `json:"reported_id"`
		ListingID  *string   `json:"listing_id"`
		Reason     string    `json:"reason"`
		Status     string    `json:"status"`
		CreatedAt  time.Time `json:"created_at"`
	}
	db := h.orm.WithContext(c.Request.Context())
	result := make([]reportRow, 0)
	if err := db.Raw(`
		SELECT id, reporter_id, reported_id, listing_id, reason, status::text AS status, created_at
		FROM reports
		WHERE status=$1::report_status AND deleted_at IS NULL
		ORDER BY created_at ASC
		LIMIT 50`, status,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// AdminResolveReport handles POST /reports/:reportId/resolve
func (h *Handler) AdminResolveReport(c *Context) {
	adminID := middleware.MustAdminID(c)
	reportID := c.Param("reportId")

	var req struct {
		Status string `json:"status" binding:"required"` // resolved | dismissed
		Note   string `json:"note"`
	}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status != "resolved" && req.Status != "dismissed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be resolved or dismissed"})
		return
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	result, err := tx.Exec(c.Request.Context(), `
		UPDATE reports
		SET status=$1::report_status, handled_by=$2, handled_at=NOW(), resolution_note=$3
		WHERE id=$4 AND deleted_at IS NULL`,
		req.Status, adminID, notePtr(req.Note), reportID,
	)
	if err != nil || result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	actionType := "resolve_report"
	if req.Status == "dismissed" {
		actionType = "dismiss_report"
	}
	id := ulid.Make().String()
	tx.Exec(c.Request.Context(),
		`INSERT INTO admin_actions (id, admin_id, action, target_type, target_id, note)
		 VALUES ($1,$2,$3::admin_action_type,'report',$4,$5)`,
		id, adminID, actionType, reportID, notePtr(req.Note),
	)

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": req.Status})
}

// ---- user actions ----

// AdminGetUser handles GET /users/:userId
func (h *Handler) AdminGetUser(c *Context) {
	targetID := c.Param("userId")

	var email string
	var suspendedAt *time.Time
	var deletedAt *time.Time
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT email, suspended_at, deleted_at FROM users WHERE id=$1`, targetID,
	).Scan(&email, &suspendedAt, &deletedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// listings count (no contact_info)
	var listingCount int
	h.db.QueryRow(c.Request.Context(),
		`SELECT COUNT(*) FROM listings WHERE landlord_id=$1 AND deleted_at IS NULL`, targetID,
	).Scan(&listingCount)

	// profile count
	var profileCount int
	h.db.QueryRow(c.Request.Context(),
		`SELECT COUNT(*) FROM tenant_profiles WHERE tenant_id=$1 AND deleted_at IS NULL`, targetID,
	).Scan(&profileCount)

	c.JSON(http.StatusOK, gin.H{
		"id":            targetID,
		"email":         email,
		"suspended_at":  suspendedAt,
		"deleted_at":    deletedAt,
		"listing_count": listingCount,
		"profile_count": profileCount,
	})
}

// AdminSuspendUser handles POST /users/:userId/suspend
func (h *Handler) AdminSuspendUser(c *Context) {
	adminID := middleware.MustAdminID(c)
	targetID := c.Param("userId")

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	result, err := tx.Exec(c.Request.Context(),
		`UPDATE users SET suspended_at=NOW() WHERE id=$1 AND deleted_at IS NULL AND suspended_at IS NULL`,
		targetID,
	)
	if err != nil || result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found or already suspended"})
		return
	}

	id := ulid.Make().String()
	tx.Exec(c.Request.Context(),
		`INSERT INTO admin_actions (id, admin_id, action, target_type, target_id)
		 VALUES ($1,$2,'suspend_user','user',$3)`,
		id, adminID, targetID,
	)

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "suspended"})
}

// AdminUnsuspendUser handles POST /users/:userId/unsuspend
func (h *Handler) AdminUnsuspendUser(c *Context) {
	adminID := middleware.MustAdminID(c)
	targetID := c.Param("userId")

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	result, err := tx.Exec(c.Request.Context(),
		`UPDATE users SET suspended_at=NULL WHERE id=$1 AND deleted_at IS NULL AND suspended_at IS NOT NULL`,
		targetID,
	)
	if err != nil || result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found or not suspended"})
		return
	}

	id := ulid.Make().String()
	tx.Exec(c.Request.Context(),
		`INSERT INTO admin_actions (id, admin_id, action, target_type, target_id)
		 VALUES ($1,$2,'unsuspend_user','user',$3)`,
		id, adminID, targetID,
	)

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "active"})
}

// AdminDeleteUser handles POST /users/:userId/delete (super_admin only)
func (h *Handler) AdminDeleteUser(c *Context) {
	adminID := middleware.MustAdminID(c)
	if !h.requireAdmin(c, "super_admin") {
		return
	}
	targetID := c.Param("userId")

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	// soft-delete cascade (same logic as user self-deletion)
	stmts := []string{
		`UPDATE tenant_profiles SET deleted_at=NOW() WHERE tenant_id=$1 AND deleted_at IS NULL`,
		`UPDATE listing_photos SET deleted_at=NOW() WHERE listing_id IN (SELECT id FROM listings WHERE landlord_id=$1 AND deleted_at IS NULL) AND deleted_at IS NULL`,
		`UPDATE listings SET deleted_at=NOW() WHERE landlord_id=$1 AND deleted_at IS NULL`,
		`UPDATE interests SET deleted_at=NOW() WHERE tenant_profile_id IN (SELECT id FROM tenant_profiles WHERE tenant_id=$1) AND deleted_at IS NULL`,
		`UPDATE matches SET deleted_at=NOW() WHERE tenant_id=$1 AND deleted_at IS NULL`,
		`UPDATE matches SET deleted_at=NOW() WHERE landlord_id=$1 AND deleted_at IS NULL`,
		`UPDATE blocks SET deleted_at=NOW() WHERE blocker_id=$1 AND deleted_at IS NULL`,
		`UPDATE blocks SET deleted_at=NOW() WHERE blocked_id=$1 AND deleted_at IS NULL`,
		`UPDATE refresh_tokens SET deleted_at=NOW() WHERE user_id=$1 AND deleted_at IS NULL`,
		`UPDATE auth_identities SET deleted_at=NOW() WHERE user_id=$1 AND deleted_at IS NULL`,
		`UPDATE user_roles SET deleted_at=NOW() WHERE user_id=$1 AND deleted_at IS NULL`,
		`UPDATE users SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`,
	}
	for _, stmt := range stmts {
		if _, err = tx.Exec(c.Request.Context(), stmt, targetID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
	}

	// audit — intentionally no FK; survives target deletion
	id := ulid.Make().String()
	tx.Exec(c.Request.Context(),
		`INSERT INTO admin_actions (id, admin_id, action, target_type, target_id)
		 VALUES ($1,$2,'delete_user','user',$3)`,
		id, adminID, targetID,
	)

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ---- listing actions ----

// AdminRemoveListing handles POST /listings/:listingId/remove
func (h *Handler) AdminRemoveListing(c *Context) {
	adminID := middleware.MustAdminID(c)
	listingID := c.Param("listingId")

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	result, err := tx.Exec(c.Request.Context(),
		`UPDATE listings SET admin_removed_at=NOW() WHERE id=$1 AND deleted_at IS NULL AND admin_removed_at IS NULL`,
		listingID,
	)
	if err != nil || result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "listing not found or already removed"})
		return
	}

	id := ulid.Make().String()
	tx.Exec(c.Request.Context(),
		`INSERT INTO admin_actions (id, admin_id, action, target_type, target_id)
		 VALUES ($1,$2,'remove_listing','listing',$3)`,
		id, adminID, listingID,
	)

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

// AdminRestoreListing handles POST /listings/:listingId/restore
func (h *Handler) AdminRestoreListing(c *Context) {
	adminID := middleware.MustAdminID(c)
	listingID := c.Param("listingId")

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	result, err := tx.Exec(c.Request.Context(),
		`UPDATE listings SET admin_removed_at=NULL WHERE id=$1 AND deleted_at IS NULL AND admin_removed_at IS NOT NULL`,
		listingID,
	)
	if err != nil || result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "listing not found or not removed"})
		return
	}

	id := ulid.Make().String()
	tx.Exec(c.Request.Context(),
		`INSERT INTO admin_actions (id, admin_id, action, target_type, target_id)
		 VALUES ($1,$2,'restore_listing','listing',$3)`,
		id, adminID, listingID,
	)

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "restored"})
}

// AdminListActions handles GET /actions
func (h *Handler) AdminListActions(c *Context) {
	type actionRow struct {
		ID         string    `json:"id"`
		AdminID    string    `json:"admin_id"`
		Action     string    `json:"action"`
		TargetType string    `json:"target_type"`
		TargetID   string    `json:"target_id"`
		Note       *string   `json:"note"`
		CreatedAt  time.Time `json:"created_at"`
	}
	db := h.orm.WithContext(c.Request.Context())
	result := make([]actionRow, 0)
	if err := db.Raw(`
		SELECT id, admin_id, action::text AS action, target_type, target_id, note, created_at
		FROM admin_actions
		ORDER BY created_at DESC
		LIMIT 100`,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, result)
}
