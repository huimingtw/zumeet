package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/middleware"
)

// ---- response types ----

type MutualMatchResponse struct {
	MatchID         string    `json:"match_id"`
	TenantProfileID string    `json:"tenant_profile_id"`
	ProfileName     string    `json:"profile_name,omitempty"` // tenant-side
	ListingID       string    `json:"listing_id"`
	ContactInfo     string    `json:"contact_info"`
	MatchedAt       time.Time `json:"matched_at"`
	LocationID      string    `json:"location_id,omitempty"`
	Rent            int       `json:"rent,omitempty"`
	RoomType        string    `json:"room_type,omitempty"`
	AreaPing        float64   `json:"area_ping,omitempty"`
}

type IncomingInterestResponse struct {
	ID              string    `json:"id,omitempty"`
	TenantProfileID string    `json:"tenant_profile_id"`
	ProfileName     string    `json:"profile_name,omitempty"`
	ListingID       string    `json:"listing_id"`
	CreatedAt       time.Time `json:"created_at"`
	LocationID      string    `json:"location_id,omitempty"`
	Rent            int       `json:"rent,omitempty"`
	RoomType        string    `json:"room_type,omitempty"`
	AreaPing        float64   `json:"area_ping,omitempty"`
	BudgetMin       int       `json:"budget_min,omitempty"`
	BudgetMax       int       `json:"budget_max,omitempty"`
	InterestSent    bool      `json:"interest_sent"`
}

type OutgoingInterestResponse struct {
	ID                string    `json:"id,omitempty"`
	TenantProfileID   string    `json:"tenant_profile_id"`
	ProfileName       string    `json:"profile_name,omitempty"`
	TenantProfileName string    `json:"tenant_profile_name,omitempty"`
	ListingID         string    `json:"listing_id"`
	CreatedAt         time.Time `json:"created_at"`
	LocationID        string    `json:"location_id,omitempty"`
	Rent              int       `json:"rent,omitempty"`
	RoomType          string    `json:"room_type,omitempty"`
	AreaPing          float64   `json:"area_ping,omitempty"`
	BudgetMin         int       `json:"budget_min,omitempty"`
	BudgetMax         int       `json:"budget_max,omitempty"`
}

// ---- profile-level endpoints ----

// GetProfileMatches handles GET /api/v1/tenant-profiles/:profileId/matches
func (h *Handler) GetProfileMatches(c *Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}
	if err := h.assertProfileOwner(c, profileID, userID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "not_found"})
		return
	}

	db := h.orm.WithContext(c.Request.Context())
	result := make([]MutualMatchResponse, 0)
	if err := db.Raw(`
		SELECT m.id AS match_id, m.tenant_profile_id, m.listing_id,
		       tp.name AS profile_name, l.contact_info, m.matched_at,
		       l.location_id, l.rent, l.room_type::text AS room_type, l.area_ping
		FROM matches m
		JOIN listings l ON l.id = m.listing_id
		JOIN tenant_profiles tp ON tp.id = m.tenant_profile_id
		WHERE m.tenant_profile_id = $1
		  AND m.status = 'active'
		  AND m.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM blocks b
		      WHERE b.deleted_at IS NULL AND (
		          (b.blocker_id = m.tenant_id AND b.blocked_id = m.landlord_id) OR
		          (b.blocker_id = m.landlord_id AND b.blocked_id = m.tenant_id)
		      )
		  )
		ORDER BY m.matched_at DESC`,
		profileID,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// GetProfileIncomingInterests handles GET /api/v1/tenant-profiles/:profileId/interests/incoming
func (h *Handler) GetProfileIncomingInterests(c *Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}
	if err := h.assertProfileOwner(c, profileID, userID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "not_found"})
		return
	}

	// incoming = landlord has active interest, tenant has NOT yet responded
	db := h.orm.WithContext(c.Request.Context())
	result := make([]IncomingInterestResponse, 0)
	if err := db.Raw(`
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, i.listing_id, i.created_at,
		       l.location_id, l.rent, l.room_type::text AS room_type, l.area_ping,
		       false AS interest_sent
		FROM interests i
		JOIN listings l ON l.id = i.listing_id
		JOIN tenant_profiles tp ON tp.id = i.tenant_profile_id
		WHERE i.tenant_profile_id = $1
		  AND i.actor_role = 'landlord'
		  AND i.status = 'active'
		  AND i.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM interests ti
		      WHERE ti.tenant_profile_id = i.tenant_profile_id
		        AND ti.listing_id = i.listing_id
		        AND ti.actor_role = 'tenant'
		        AND ti.status = 'active'
		        AND ti.deleted_at IS NULL
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM blocks b
		      WHERE b.deleted_at IS NULL AND (
		          (b.blocker_id = $2 AND b.blocked_id = l.landlord_id) OR
		          (b.blocker_id = l.landlord_id AND b.blocked_id = $2)
		      )
		  )
		ORDER BY i.created_at DESC`,
		profileID, userID,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// GetProfileOutgoingInterests handles GET /api/v1/tenant-profiles/:profileId/interests/outgoing
func (h *Handler) GetProfileOutgoingInterests(c *Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}
	if err := h.assertProfileOwner(c, profileID, userID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "not_found"})
		return
	}

	// outgoing = tenant has active interest, landlord has NOT yet responded
	db := h.orm.WithContext(c.Request.Context())
	result := make([]OutgoingInterestResponse, 0)
	if err := db.Raw(`
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, tp.name AS tenant_profile_name,
		       i.listing_id, i.created_at,
		       l.location_id, l.rent, l.room_type::text AS room_type, l.area_ping
		FROM interests i
		JOIN listings l ON l.id = i.listing_id
		JOIN tenant_profiles tp ON tp.id = i.tenant_profile_id
		WHERE i.tenant_profile_id = $1
		  AND i.actor_role = 'tenant'
		  AND i.status = 'active'
		  AND i.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM interests li
		      WHERE li.tenant_profile_id = i.tenant_profile_id
		        AND li.listing_id = i.listing_id
		        AND li.actor_role = 'landlord'
		        AND li.status = 'active'
		        AND li.deleted_at IS NULL
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM blocks b
		      WHERE b.deleted_at IS NULL AND (
		          (b.blocker_id = $2 AND b.blocked_id = l.landlord_id) OR
		          (b.blocker_id = l.landlord_id AND b.blocked_id = $2)
		      )
		  )
		ORDER BY i.created_at DESC`,
		profileID, userID,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// ---- cross-profile/listing aggregated endpoints ----

// GetAllMutualMatches handles GET /api/v1/matches/mutual
func (h *Handler) GetAllMutualMatches(c *Context) {
	userID := middleware.MustUserID(c)

	// Works for both tenant and landlord
	db := h.orm.WithContext(c.Request.Context())
	result := make([]MutualMatchResponse, 0)
	if err := db.Raw(`
		SELECT m.id AS match_id, m.tenant_profile_id, m.listing_id,
		       tp.name AS profile_name,
		       CASE WHEN m.tenant_id = $1 THEN l.contact_info
		            ELSE tp.contact_info END AS contact_info,
		       m.matched_at,
		       l.location_id, l.rent, l.room_type::text AS room_type, l.area_ping
		FROM matches m
		JOIN listings l ON l.id = m.listing_id
		JOIN tenant_profiles tp ON tp.id = m.tenant_profile_id
		WHERE (m.tenant_id = $1 OR m.landlord_id = $1)
		  AND m.status = 'active'
		  AND m.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM blocks b
		      WHERE b.deleted_at IS NULL AND (
		          (b.blocker_id = m.tenant_id AND b.blocked_id = m.landlord_id) OR
		          (b.blocker_id = m.landlord_id AND b.blocked_id = m.tenant_id)
		      )
		  )
		ORDER BY m.matched_at DESC`,
		userID,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// GetAllIncomingInterests handles GET /api/v1/matches/incoming
func (h *Handler) GetAllIncomingInterests(c *Context) {
	userID := middleware.MustUserID(c)

	// Incoming for tenant: landlord expressed interest, tenant hasn't
	// Incoming for landlord: tenant expressed interest, landlord hasn't
	db := h.orm.WithContext(c.Request.Context())
	result := make([]IncomingInterestResponse, 0)
	if err := db.Raw(`
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, i.listing_id, i.created_at,
		       l.location_id, l.rent, l.room_type::text AS room_type, l.area_ping,
		       tp.budget_min, tp.budget_max, false AS interest_sent
		FROM interests i
		JOIN listings l ON l.id = i.listing_id
		JOIN tenant_profiles tp ON tp.id = i.tenant_profile_id
		WHERE (
		    -- tenant view: landlord sent, tenant hasn't
		    (tp.tenant_id = $1 AND i.actor_role = 'landlord' AND NOT EXISTS (
		        SELECT 1 FROM interests c
		        WHERE c.tenant_profile_id = i.tenant_profile_id AND c.listing_id = i.listing_id
		          AND c.actor_role = 'tenant' AND c.status = 'active' AND c.deleted_at IS NULL
		    ))
		    OR
		    -- landlord view: tenant sent, landlord hasn't
		    (l.landlord_id = $1 AND i.actor_role = 'tenant' AND NOT EXISTS (
		        SELECT 1 FROM interests c
		        WHERE c.tenant_profile_id = i.tenant_profile_id AND c.listing_id = i.listing_id
		          AND c.actor_role = 'landlord' AND c.status = 'active' AND c.deleted_at IS NULL
		    ))
		)
		AND i.status = 'active'
		AND i.deleted_at IS NULL
		AND NOT EXISTS (
		    SELECT 1 FROM blocks b
		    WHERE b.deleted_at IS NULL AND (
		        (b.blocker_id = tp.tenant_id AND b.blocked_id = l.landlord_id) OR
		        (b.blocker_id = l.landlord_id AND b.blocked_id = tp.tenant_id)
		    )
		)
		ORDER BY i.created_at DESC`,
		userID,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// GetAllOutgoingInterests handles GET /api/v1/matches/outgoing
func (h *Handler) GetAllOutgoingInterests(c *Context) {
	userID := middleware.MustUserID(c)

	db := h.orm.WithContext(c.Request.Context())
	result := make([]OutgoingInterestResponse, 0)
	if err := db.Raw(`
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, tp.name AS tenant_profile_name,
		       i.listing_id, i.created_at,
		       l.location_id, l.rent, l.room_type::text AS room_type, l.area_ping,
		       tp.budget_min, tp.budget_max
		FROM interests i
		JOIN listings l ON l.id = i.listing_id
		JOIN tenant_profiles tp ON tp.id = i.tenant_profile_id
		WHERE (
		    -- tenant view: tenant sent, landlord hasn't responded
		    (tp.tenant_id = $1 AND i.actor_role = 'tenant' AND NOT EXISTS (
		        SELECT 1 FROM interests c
		        WHERE c.tenant_profile_id = i.tenant_profile_id AND c.listing_id = i.listing_id
		          AND c.actor_role = 'landlord' AND c.status = 'active' AND c.deleted_at IS NULL
		    ))
		    OR
		    -- landlord view: landlord sent, tenant hasn't responded
		    (l.landlord_id = $1 AND i.actor_role = 'landlord' AND NOT EXISTS (
		        SELECT 1 FROM interests c
		        WHERE c.tenant_profile_id = i.tenant_profile_id AND c.listing_id = i.listing_id
		          AND c.actor_role = 'tenant' AND c.status = 'active' AND c.deleted_at IS NULL
		    ))
		)
		AND i.status = 'active'
		AND i.deleted_at IS NULL
		AND NOT EXISTS (
		    SELECT 1 FROM blocks b
		    WHERE b.deleted_at IS NULL AND (
		        (b.blocker_id = tp.tenant_id AND b.blocked_id = l.landlord_id) OR
		        (b.blocker_id = l.landlord_id AND b.blocked_id = tp.tenant_id)
		    )
		)
		ORDER BY i.created_at DESC`,
		userID,
	).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}
