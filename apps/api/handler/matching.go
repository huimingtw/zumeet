package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/zumeet/api/middleware"
)

// MatchedListingCard is what a tenant sees when browsing listings.
type MatchedListingCard struct {
	ID                         string    `json:"id"`
	LocationID                 string    `json:"location_id"`
	Rent                       int       `json:"rent"`
	RoomType                   string    `json:"room_type"`
	AreaPing                   float64   `json:"area_ping"`
	AvailableFrom              time.Time `json:"available_from"`
	AllowPets                  bool      `json:"allow_pets"`
	AllowSubsidy               bool      `json:"allow_subsidy"`
	AllowTaxReceipt            bool      `json:"allow_tax_receipt"`
	AllowHouseholdRegistration bool      `json:"allow_household_registration"`
	AllowCooking               bool      `json:"allow_cooking"`
	HasParking                 bool      `json:"has_parking"`
	AllowSmoking               bool      `json:"allow_smoking"`
	Photos                     []string  `json:"photos"`
	InterestSent               bool      `json:"interest_sent"` // tenant already expressed interest
}

// MatchedTenantProfileCard is what a landlord sees when browsing tenant profiles.
type MatchedTenantProfileCard struct {
	ID                 string    `json:"id"`
	Name               string    `json:"name"`
	BudgetMin          int       `json:"budget_min"`
	BudgetMax          int       `json:"budget_max"`
	PreferredRoomTypes []string  `json:"preferred_room_types"`
	AvailableFrom      time.Time `json:"available_from"`
	MinLeaseMonths     int       `json:"min_lease_months"`
	HasPets            bool      `json:"has_pets"`
	NeedsSubsidy       bool      `json:"needs_subsidy"`
	NeedsTaxReceipt    bool      `json:"needs_tax_receipt"`
	NeedsParking       bool      `json:"needs_parking"`
	Smoking            bool      `json:"smoking"`
	Occupation         string    `json:"occupation"`
	InterestSent       bool      `json:"interest_sent"` // landlord already expressed interest
}

const defaultPageSize = 20
const maxPageSize = 100

// BrowseListingsForProfile handles GET /api/v1/tenant-profiles/:profileId/listings
func (h *Handler) BrowseListingsForProfile(c *Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}

	// verify profile ownership + active
	var tenantOwnerID string
	var isActive bool
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT tenant_id, is_active FROM tenant_profiles WHERE id=$1 AND deleted_at IS NULL`,
		profileID,
	).Scan(&tenantOwnerID, &isActive)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if tenantOwnerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}
	if !isActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "profile is not active", "code": "profile_inactive"})
		return
	}

	cursor, limit := parseCursorParams(c)

	query := `
		SELECT
			l.id, l.location_id, l.rent, l.room_type::text, l.area_ping,
			l.available_from,
			l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
			l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
			EXISTS(
				SELECT 1 FROM interests i
				WHERE i.tenant_profile_id = $1
				  AND i.listing_id = l.id
				  AND i.actor_role = 'tenant'
				  AND i.status = 'active'
				  AND i.deleted_at IS NULL
			) AS interest_sent
		FROM listings l
		JOIN tenant_profiles tp ON tp.id = $1
		WHERE
			-- matching predicate
			l.rent BETWEEN tp.budget_min AND tp.budget_max
			AND EXISTS (
				SELECT 1 FROM tenant_profile_locations tpl
				WHERE tpl.tenant_profile_id = tp.id
				  AND tpl.location_id = l.location_id
				  AND tpl.deleted_at IS NULL
			)
			AND l.room_type = ANY(tp.preferred_room_types)
			AND ABS(
				EXTRACT(EPOCH FROM date_trunc('day', l.available_from))
				- EXTRACT(EPOCH FROM date_trunc('day', tp.available_from))
			) <= 604800  -- 7 days in seconds
			AND (tp.min_area_ping IS NULL OR l.area_ping >= tp.min_area_ping)
			AND (tp.has_pets = false OR l.allow_pets = true)
			AND (tp.needs_subsidy = false OR l.allow_subsidy = true)
			AND (tp.needs_tax_receipt = false OR l.allow_tax_receipt = true)
			AND (tp.needs_household_registration = false OR l.allow_household_registration = true)
			AND (tp.needs_cooking = false OR l.allow_cooking = true)
			AND (tp.needs_parking = false OR l.has_parking = true)
			AND (tp.smoking = false OR l.allow_smoking = true)
			-- status guards
			AND tp.is_active = true
			AND l.status = 'active'
			AND l.deleted_at IS NULL
			AND l.admin_removed_at IS NULL
			-- suspension guards
			AND NOT EXISTS (SELECT 1 FROM users lu WHERE lu.id = l.landlord_id AND lu.suspended_at IS NOT NULL AND lu.deleted_at IS NULL)
			AND NOT EXISTS (SELECT 1 FROM users tu WHERE tu.id = tp.tenant_id    AND tu.suspended_at IS NOT NULL AND tu.deleted_at IS NULL)
			-- block exclusion (user-level, both directions)
			AND l.landlord_id NOT IN (
				SELECT blocked_id  FROM blocks WHERE blocker_id = tp.tenant_id   AND deleted_at IS NULL
				UNION ALL
				SELECT blocker_id  FROM blocks WHERE blocked_id  = tp.tenant_id  AND deleted_at IS NULL
			)
			-- cursor pagination
			AND ($2::text = '' OR l.id < $2)
		ORDER BY l.id DESC
		LIMIT $3`

	rows, err := h.db.Query(c.Request.Context(), query, profileID, cursor, limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer rows.Close()

	cards := make([]MatchedListingCard, 0)
	for rows.Next() {
		var card MatchedListingCard
		if err := rows.Scan(
			&card.ID, &card.LocationID, &card.Rent, &card.RoomType, &card.AreaPing,
			&card.AvailableFrom,
			&card.AllowPets, &card.AllowSubsidy, &card.AllowTaxReceipt,
			&card.AllowHouseholdRegistration, &card.AllowCooking, &card.HasParking, &card.AllowSmoking,
			&card.InterestSent,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}
		card.Photos = h.listingPhotos(c.Request.Context(), card.ID)
		cards = append(cards, card)
	}

	var nextCursor string
	if len(cards) > limit {
		cards = cards[:limit]
		nextCursor = cards[len(cards)-1].ID
	}

	c.JSON(http.StatusOK, gin.H{
		"items":       cards,
		"next_cursor": nextCursor,
	})
}

// BrowseTenantProfilesForListing handles GET /api/v1/listings/:listingId/tenant-profiles
func (h *Handler) BrowseTenantProfilesForListing(c *Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		respondForbidden(c, err)
		return
	}

	// verify listing ownership + active
	var landlordOwnerID, listingStatus string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT landlord_id, status::text FROM listings WHERE id=$1 AND deleted_at IS NULL`,
		listingID,
	).Scan(&landlordOwnerID, &listingStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if landlordOwnerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}
	if listingStatus != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "listing is not active", "code": "listing_not_active"})
		return
	}

	cursor, limit := parseCursorParams(c)

	query := `
		SELECT
			tp.id, tp.name, tp.budget_min, tp.budget_max, tp.preferred_room_types,
			tp.available_from, tp.min_lease_months,
			tp.has_pets, tp.needs_subsidy, tp.needs_tax_receipt,
			tp.needs_parking, tp.smoking, COALESCE(tp.occupation, ''),
			EXISTS(
				SELECT 1 FROM interests i
				WHERE i.tenant_profile_id = tp.id
				  AND i.listing_id = $1
				  AND i.actor_role = 'landlord'
				  AND i.status = 'active'
				  AND i.deleted_at IS NULL
			) AS interest_sent
		FROM tenant_profiles tp
		JOIN listings l ON l.id = $1
		WHERE
			-- matching predicate
			l.rent BETWEEN tp.budget_min AND tp.budget_max
			AND EXISTS (
				SELECT 1 FROM tenant_profile_locations tpl
				WHERE tpl.tenant_profile_id = tp.id
				  AND tpl.location_id = l.location_id
				  AND tpl.deleted_at IS NULL
			)
			AND l.room_type = ANY(tp.preferred_room_types)
			AND ABS(
				EXTRACT(EPOCH FROM date_trunc('day', l.available_from))
				- EXTRACT(EPOCH FROM date_trunc('day', tp.available_from))
			) <= 604800
			AND (tp.min_area_ping IS NULL OR l.area_ping >= tp.min_area_ping)
			AND (tp.has_pets = false OR l.allow_pets = true)
			AND (tp.needs_subsidy = false OR l.allow_subsidy = true)
			AND (tp.needs_tax_receipt = false OR l.allow_tax_receipt = true)
			AND (tp.needs_household_registration = false OR l.allow_household_registration = true)
			AND (tp.needs_cooking = false OR l.allow_cooking = true)
			AND (tp.needs_parking = false OR l.has_parking = true)
			AND (tp.smoking = false OR l.allow_smoking = true)
			-- status guards
			AND tp.is_active = true
			AND l.status = 'active'
			AND l.deleted_at IS NULL
			AND l.admin_removed_at IS NULL
			AND tp.deleted_at IS NULL
			-- suspension guards
			AND NOT EXISTS (SELECT 1 FROM users lu WHERE lu.id = l.landlord_id AND lu.suspended_at IS NOT NULL AND lu.deleted_at IS NULL)
			AND NOT EXISTS (SELECT 1 FROM users tu WHERE tu.id = tp.tenant_id    AND tu.suspended_at IS NOT NULL AND tu.deleted_at IS NULL)
			-- block exclusion
			AND tp.tenant_id NOT IN (
				SELECT blocked_id  FROM blocks WHERE blocker_id = l.landlord_id AND deleted_at IS NULL
				UNION ALL
				SELECT blocker_id  FROM blocks WHERE blocked_id  = l.landlord_id AND deleted_at IS NULL
			)
			-- cursor pagination
			AND ($2::text = '' OR tp.id < $2)
		ORDER BY tp.id DESC
		LIMIT $3`

	rows, err := h.db.Query(c.Request.Context(), query, listingID, cursor, limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer rows.Close()

	cards := make([]MatchedTenantProfileCard, 0)
	for rows.Next() {
		var card MatchedTenantProfileCard
		if err := rows.Scan(
			&card.ID, &card.Name, &card.BudgetMin, &card.BudgetMax, &card.PreferredRoomTypes,
			&card.AvailableFrom, &card.MinLeaseMonths,
			&card.HasPets, &card.NeedsSubsidy, &card.NeedsTaxReceipt,
			&card.NeedsParking, &card.Smoking, &card.Occupation,
			&card.InterestSent,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}
		cards = append(cards, card)
	}

	var nextCursor string
	if len(cards) > limit {
		cards = cards[:limit]
		nextCursor = cards[len(cards)-1].ID
	}

	c.JSON(http.StatusOK, gin.H{
		"items":       cards,
		"next_cursor": nextCursor,
	})
}

// ---- helpers ----

func parseCursorParams(c *Context) (cursor string, limit int) {
	cursor = c.Query("cursor")
	limit = defaultPageSize
	if s := c.Query("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			if n > maxPageSize {
				n = maxPageSize
			}
			limit = n
		}
	}
	return
}

func (h *Handler) listingPhotos(ctx context.Context, listingID string) []string {
	rows, err := h.db.Query(ctx,
		`SELECT public_url FROM listing_photos
		 WHERE listing_id=$1 AND deleted_at IS NULL ORDER BY position`,
		listingID,
	)
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	var urls []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err == nil {
			urls = append(urls, u)
		}
	}
	if urls == nil {
		return []string{}
	}
	return urls
}

// formatCursor is a placeholder; ULID ordering used directly
var _ = fmt.Sprintf
