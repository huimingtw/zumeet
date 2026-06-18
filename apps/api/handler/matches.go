package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/zumeet/api/middleware"
)

// ---- response types ----

type MutualMatchResponse struct {
	MatchID                    string    `json:"match_id" db:"match_id"`
	TenantProfileID            string    `json:"tenant_profile_id" db:"tenant_profile_id"`
	ProfileName                string    `json:"profile_name,omitempty" db:"profile_name"` // tenant-side
	ListingID                  string    `json:"listing_id" db:"listing_id"`
	ListingName                string    `json:"listing_name,omitempty" db:"listing_name"`
	ContactInfo                string    `json:"contact_info" db:"contact_info"`
	Address                    string    `json:"address,omitempty" db:"address"`
	MatchedAt                  time.Time `json:"matched_at" db:"matched_at"`
	LocationID                 string    `json:"location_id,omitempty" db:"location_id"`
	Rent                       int       `json:"rent,omitempty" db:"rent"`
	ManagementFee              int       `json:"management_fee" db:"management_fee"`
	RoomType                   string    `json:"room_type,omitempty" db:"room_type"`
	AreaPing                   float64   `json:"area_ping,omitempty" db:"area_ping"`
	NumBedrooms                *int      `json:"num_bedrooms,omitempty" db:"num_bedrooms"`
	NumLivingRooms             *int      `json:"num_living_rooms,omitempty" db:"num_living_rooms"`
	NumBathrooms               *int      `json:"num_bathrooms,omitempty" db:"num_bathrooms"`
	NumBalconies               *int      `json:"num_balconies,omitempty" db:"num_balconies"`
	AvailableFrom              time.Time `json:"available_from" db:"available_from"`
	AllowPets                  bool      `json:"allow_pets" db:"allow_pets"`
	AllowSubsidy               bool      `json:"allow_subsidy" db:"allow_subsidy"`
	AllowTaxReceipt            bool      `json:"allow_tax_receipt" db:"allow_tax_receipt"`
	AllowHouseholdRegistration bool      `json:"allow_household_registration" db:"allow_household_registration"`
	AllowCooking               bool      `json:"allow_cooking" db:"allow_cooking"`
	HasParking                 bool      `json:"has_parking" db:"has_parking"`
	AllowSmoking               bool      `json:"allow_smoking" db:"allow_smoking"`
	Description                string    `json:"description,omitempty" db:"description"`
	TenantOccupation           string    `json:"tenant_occupation,omitempty" db:"tenant_occupation"`
	TenantAge                  *int      `json:"tenant_age,omitempty" db:"tenant_age"`
	TenantHasPets              bool      `json:"tenant_has_pets" db:"tenant_has_pets"`
	TenantDescription          string    `json:"tenant_description,omitempty" db:"tenant_description"`
	Photos                     []string  `json:"photos" db:"-"`
}

type IncomingInterestResponse struct {
	ID                         string    `json:"id,omitempty" db:"id"`
	TenantProfileID            string    `json:"tenant_profile_id" db:"tenant_profile_id"`
	ProfileName                string    `json:"profile_name,omitempty" db:"profile_name"`
	ListingID                  string    `json:"listing_id" db:"listing_id"`
	ListingName                string    `json:"listing_name,omitempty" db:"listing_name"`
	CreatedAt                  time.Time `json:"created_at" db:"created_at"`
	LocationID                 string    `json:"location_id,omitempty" db:"location_id"`
	Rent                       int       `json:"rent,omitempty" db:"rent"`
	ManagementFee              int       `json:"management_fee" db:"management_fee"`
	RoomType                   string    `json:"room_type,omitempty" db:"room_type"`
	AreaPing                   float64   `json:"area_ping,omitempty" db:"area_ping"`
	NumBedrooms                *int      `json:"num_bedrooms,omitempty" db:"num_bedrooms"`
	NumLivingRooms             *int      `json:"num_living_rooms,omitempty" db:"num_living_rooms"`
	NumBathrooms               *int      `json:"num_bathrooms,omitempty" db:"num_bathrooms"`
	NumBalconies               *int      `json:"num_balconies,omitempty" db:"num_balconies"`
	AvailableFrom              time.Time `json:"available_from" db:"available_from"`
	AllowPets                  bool      `json:"allow_pets" db:"allow_pets"`
	AllowSubsidy               bool      `json:"allow_subsidy" db:"allow_subsidy"`
	AllowTaxReceipt            bool      `json:"allow_tax_receipt" db:"allow_tax_receipt"`
	AllowHouseholdRegistration bool      `json:"allow_household_registration" db:"allow_household_registration"`
	AllowCooking               bool      `json:"allow_cooking" db:"allow_cooking"`
	HasParking                 bool      `json:"has_parking" db:"has_parking"`
	AllowSmoking               bool      `json:"allow_smoking" db:"allow_smoking"`
	Description                string    `json:"description,omitempty" db:"description"`
	Address                    string    `json:"address,omitempty" db:"address"`
	TenantOccupation           string    `json:"tenant_occupation,omitempty" db:"tenant_occupation"`
	TenantAge                  *int      `json:"tenant_age,omitempty" db:"tenant_age"`
	TenantHasPets              bool      `json:"tenant_has_pets" db:"tenant_has_pets"`
	TenantDescription          string    `json:"tenant_description,omitempty" db:"tenant_description"`
	Photos                     []string  `json:"photos" db:"-"`
	InterestSent               bool      `json:"interest_sent" db:"interest_sent"`
}

type OutgoingInterestResponse struct {
	ID                         string    `json:"id,omitempty" db:"id"`
	TenantProfileID            string    `json:"tenant_profile_id" db:"tenant_profile_id"`
	ProfileName                string    `json:"profile_name,omitempty" db:"profile_name"`
	TenantProfileName          string    `json:"tenant_profile_name,omitempty" db:"tenant_profile_name"`
	ListingID                  string    `json:"listing_id" db:"listing_id"`
	ListingName                string    `json:"listing_name,omitempty" db:"listing_name"`
	CreatedAt                  time.Time `json:"created_at" db:"created_at"`
	LocationID                 string    `json:"location_id,omitempty" db:"location_id"`
	Rent                       int       `json:"rent,omitempty" db:"rent"`
	ManagementFee              int       `json:"management_fee" db:"management_fee"`
	RoomType                   string    `json:"room_type,omitempty" db:"room_type"`
	AreaPing                   float64   `json:"area_ping,omitempty" db:"area_ping"`
	NumBedrooms                *int      `json:"num_bedrooms,omitempty" db:"num_bedrooms"`
	NumLivingRooms             *int      `json:"num_living_rooms,omitempty" db:"num_living_rooms"`
	NumBathrooms               *int      `json:"num_bathrooms,omitempty" db:"num_bathrooms"`
	NumBalconies               *int      `json:"num_balconies,omitempty" db:"num_balconies"`
	AvailableFrom              time.Time `json:"available_from" db:"available_from"`
	AllowPets                  bool      `json:"allow_pets" db:"allow_pets"`
	AllowSubsidy               bool      `json:"allow_subsidy" db:"allow_subsidy"`
	AllowTaxReceipt            bool      `json:"allow_tax_receipt" db:"allow_tax_receipt"`
	AllowHouseholdRegistration bool      `json:"allow_household_registration" db:"allow_household_registration"`
	AllowCooking               bool      `json:"allow_cooking" db:"allow_cooking"`
	HasParking                 bool      `json:"has_parking" db:"has_parking"`
	AllowSmoking               bool      `json:"allow_smoking" db:"allow_smoking"`
	Description                string    `json:"description,omitempty" db:"description"`
	Address                    string    `json:"address,omitempty" db:"address"`
	TenantOccupation           string    `json:"tenant_occupation,omitempty" db:"tenant_occupation"`
	TenantAge                  *int      `json:"tenant_age,omitempty" db:"tenant_age"`
	TenantHasPets              bool      `json:"tenant_has_pets" db:"tenant_has_pets"`
	TenantDescription          string    `json:"tenant_description,omitempty" db:"tenant_description"`
	Photos                     []string  `json:"photos" db:"-"`
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

	rows, err := h.db.Query(c.Request.Context(), `
		SELECT m.id AS match_id, m.tenant_profile_id, m.listing_id,
		       tp.name AS profile_name, COALESCE(l.name, '') AS listing_name,
		       l.contact_info, COALESCE(l.address, '') AS address, m.matched_at,
		       l.location_id, l.rent, l.management_fee, l.room_type::text AS room_type, l.area_ping,
		       l.num_bedrooms, l.num_living_rooms, l.num_bathrooms, l.num_balconies,
		       l.available_from, l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
		       l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
		       COALESCE(l.description, '') AS description,
		       COALESCE(tp.occupation, '') AS tenant_occupation,
		       tp.age AS tenant_age,
		       tp.has_pets AS tenant_has_pets,
		       COALESCE(tp.description, '') AS tenant_description
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
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[MutualMatchResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	for i := range result {
		result[i].Photos = h.listingPhotos(c.Request.Context(), result[i].ListingID)
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
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, i.listing_id,
		       COALESCE(l.name, '') AS listing_name, i.created_at,
		       l.location_id, l.rent, l.management_fee, l.room_type::text AS room_type, l.area_ping,
		       l.num_bedrooms, l.num_living_rooms, l.num_bathrooms, l.num_balconies,
		       l.available_from, l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
		       l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
		       COALESCE(l.description, '') AS description,
		       COALESCE(tp.occupation, '') AS tenant_occupation,
		       tp.age AS tenant_age,
		       tp.has_pets AS tenant_has_pets,
		       COALESCE(tp.description, '') AS tenant_description,
		       COALESCE(l.address, '') AS address,
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
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[IncomingInterestResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	for i := range result {
		result[i].Photos = h.listingPhotos(c.Request.Context(), result[i].ListingID)
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
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, tp.name AS tenant_profile_name,
		       i.listing_id, COALESCE(l.name, '') AS listing_name, i.created_at,
		       l.location_id, l.rent, l.management_fee, l.room_type::text AS room_type, l.area_ping,
		       l.num_bedrooms, l.num_living_rooms, l.num_bathrooms, l.num_balconies,
		       l.available_from, l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
		       l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
		       COALESCE(l.description, '') AS description,
		       COALESCE(tp.occupation, '') AS tenant_occupation,
		       tp.age AS tenant_age,
		       tp.has_pets AS tenant_has_pets,
		       COALESCE(tp.description, '') AS tenant_description,
		       COALESCE(l.address, '') AS address
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
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[OutgoingInterestResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	for i := range result {
		result[i].Photos = h.listingPhotos(c.Request.Context(), result[i].ListingID)
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// ---- cross-profile/listing aggregated endpoints ----

// GetAllMutualMatches handles GET /api/v1/matches/mutual
func (h *Handler) GetAllMutualMatches(c *Context) {
	userID := middleware.MustUserID(c)

	// Works for both tenant and landlord
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT m.id AS match_id, m.tenant_profile_id, m.listing_id,
		       tp.name AS profile_name, COALESCE(l.name, '') AS listing_name,
		       CASE WHEN m.tenant_id = $1 THEN l.contact_info
		            ELSE tp.contact_info END AS contact_info,
		       COALESCE(l.address, '') AS address,
		       m.matched_at,
		       l.location_id, l.rent, l.management_fee, l.room_type::text AS room_type, l.area_ping,
		       l.num_bedrooms, l.num_living_rooms, l.num_bathrooms, l.num_balconies,
		       l.available_from, l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
		       l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
		       COALESCE(l.description, '') AS description,
		       COALESCE(tp.occupation, '') AS tenant_occupation,
		       tp.age AS tenant_age,
		       tp.has_pets AS tenant_has_pets,
		       COALESCE(tp.description, '') AS tenant_description
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
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[MutualMatchResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	for i := range result {
		result[i].Photos = h.listingPhotos(c.Request.Context(), result[i].ListingID)
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// GetAllIncomingInterests handles GET /api/v1/matches/incoming
func (h *Handler) GetAllIncomingInterests(c *Context) {
	userID := middleware.MustUserID(c)

	// Incoming for tenant: landlord expressed interest, tenant hasn't
	// Incoming for landlord: tenant expressed interest, landlord hasn't
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, i.listing_id,
		       COALESCE(l.name, '') AS listing_name, i.created_at,
		       l.location_id, l.rent, l.management_fee, l.room_type::text AS room_type, l.area_ping,
		       l.num_bedrooms, l.num_living_rooms, l.num_bathrooms, l.num_balconies,
		       l.available_from, l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
		       l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
		       COALESCE(l.description, '') AS description,
		       COALESCE(tp.occupation, '') AS tenant_occupation,
		       tp.age AS tenant_age,
		       tp.has_pets AS tenant_has_pets,
		       COALESCE(tp.description, '') AS tenant_description,
		       COALESCE(l.address, '') AS address,
		       false AS interest_sent
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
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[IncomingInterestResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	for i := range result {
		result[i].Photos = h.listingPhotos(c.Request.Context(), result[i].ListingID)
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// GetAllOutgoingInterests handles GET /api/v1/matches/outgoing
func (h *Handler) GetAllOutgoingInterests(c *Context) {
	userID := middleware.MustUserID(c)

	rows, err := h.db.Query(c.Request.Context(), `
		SELECT l.id, i.tenant_profile_id, tp.name AS profile_name, tp.name AS tenant_profile_name,
		       i.listing_id, COALESCE(l.name, '') AS listing_name, i.created_at,
		       l.location_id, l.rent, l.management_fee, l.room_type::text AS room_type, l.area_ping,
		       l.num_bedrooms, l.num_living_rooms, l.num_bathrooms, l.num_balconies,
		       l.available_from, l.allow_pets, l.allow_subsidy, l.allow_tax_receipt,
		       l.allow_household_registration, l.allow_cooking, l.has_parking, l.allow_smoking,
		       COALESCE(l.description, '') AS description,
		       COALESCE(tp.occupation, '') AS tenant_occupation,
		       tp.age AS tenant_age,
		       tp.has_pets AS tenant_has_pets,
		       COALESCE(tp.description, '') AS tenant_description,
		       COALESCE(l.address, '') AS address
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
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[OutgoingInterestResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	for i := range result {
		result[i].Photos = h.listingPhotos(c.Request.Context(), result[i].ListingID)
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}
