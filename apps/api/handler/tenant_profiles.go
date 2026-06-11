package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

const maxTenantProfiles = 3

// TenantProfileRequest is used for both POST and PUT.
type TenantProfileRequest struct {
	Name                        string    `json:"name" binding:"required"`
	BudgetMin                   int       `json:"budget_min" binding:"required,min=1"`
	BudgetMax                   int       `json:"budget_max" binding:"required,min=1"`
	Locations                   []string  `json:"locations" binding:"required,min=1"` // location IDs
	PreferredRoomTypes          []string  `json:"preferred_room_types" binding:"required,min=1"`
	AvailableFrom               time.Time `json:"available_from" binding:"required"`
	MinLeaseMonths              int       `json:"min_lease_months" binding:"required,min=1"`
	MinAreaPing                 *float64  `json:"min_area_ping"`
	HasPets                     bool      `json:"has_pets"`
	PetDescription              string    `json:"pet_description"`
	NeedsSubsidy                bool      `json:"needs_subsidy"`
	NeedsTaxReceipt             bool      `json:"needs_tax_receipt"`
	NeedsHouseholdRegistration  bool      `json:"needs_household_registration"`
	NeedsCooking                bool      `json:"needs_cooking"`
	NeedsParking                bool      `json:"needs_parking"`
	Smoking                     bool      `json:"smoking"`
	Occupation                  string    `json:"occupation"`
	ContactInfo                 string    `json:"contact_info" binding:"required"`
	IsActive                    bool      `json:"is_active"`
}

type TenantProfileResponse struct {
	ID                          string    `json:"id"`
	TenantID                    string    `json:"tenant_id"`
	Name                        string    `json:"name"`
	BudgetMin                   int       `json:"budget_min"`
	BudgetMax                   int       `json:"budget_max"`
	Locations                   []string  `json:"locations"`
	PreferredRoomTypes          []string  `json:"preferred_room_types"`
	AvailableFrom               time.Time `json:"available_from"`
	MinLeaseMonths              int       `json:"min_lease_months"`
	MinAreaPing                 *float64  `json:"min_area_ping"`
	HasPets                     bool      `json:"has_pets"`
	PetDescription              string    `json:"pet_description"`
	NeedsSubsidy                bool      `json:"needs_subsidy"`
	NeedsTaxReceipt             bool      `json:"needs_tax_receipt"`
	NeedsHouseholdRegistration  bool      `json:"needs_household_registration"`
	NeedsCooking                bool      `json:"needs_cooking"`
	NeedsParking                bool      `json:"needs_parking"`
	Smoking                     bool      `json:"smoking"`
	Occupation                  string    `json:"occupation"`
	IsActive                    bool      `json:"is_active"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
	// ContactInfo intentionally omitted — only returned after mutual match
}

// ListTenantProfiles GET /api/v1/tenant-profiles
func (h *Handler) ListTenantProfiles(c *gin.Context) {
	userID := middleware.MustUserID(c)
	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}

	rows, err := h.db.Query(c.Request.Context(),
		`SELECT id, tenant_id, name, budget_min, budget_max,
		        preferred_room_types, available_from, min_lease_months, min_area_ping,
		        has_pets, pet_description, needs_subsidy, needs_tax_receipt,
		        needs_household_registration, needs_cooking, needs_parking, smoking,
		        occupation, is_active, created_at, updated_at
		 FROM tenant_profiles
		 WHERE tenant_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	defer rows.Close()

	profiles := []TenantProfileResponse{}
	for rows.Next() {
		p, err := scanProfile(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
			return
		}
		p.Locations = h.loadProfileLocations(c, p.ID)
		profiles = append(profiles, p)
	}
	c.JSON(http.StatusOK, profiles)
}

// CreateTenantProfile POST /api/v1/tenant-profiles
func (h *Handler) CreateTenantProfile(c *gin.Context) {
	userID := middleware.MustUserID(c)
	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}

	var req TenantProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "BAD_REQUEST"})
		return
	}
	if err := validateProfileRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "BAD_REQUEST"})
		return
	}

	// Enforce 3-profile limit
	var count int
	h.db.QueryRow(c.Request.Context(),
		`SELECT COUNT(*) FROM tenant_profiles WHERE tenant_id = $1 AND deleted_at IS NULL`,
		userID,
	).Scan(&count)
	if count >= maxTenantProfiles {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 3 tenant profiles allowed", "code": "PROFILE_LIMIT_REACHED"})
		return
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	profileID := ulid.Make().String()
	// New profiles are created active by default so users can browse listings immediately.
	// Use PATCH /:profileId/status to toggle is_active after creation.
	_, err = tx.Exec(c.Request.Context(),
		`INSERT INTO tenant_profiles (
			id, tenant_id, name, budget_min, budget_max, preferred_room_types,
			available_from, min_lease_months, min_area_ping,
			has_pets, pet_description, needs_subsidy, needs_tax_receipt,
			needs_household_registration, needs_cooking, needs_parking, smoking,
			occupation, contact_info, is_active
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
		profileID, userID, req.Name, req.BudgetMin, req.BudgetMax, req.PreferredRoomTypes,
		req.AvailableFrom, req.MinLeaseMonths, req.MinAreaPing,
		req.HasPets, req.PetDescription, req.NeedsSubsidy, req.NeedsTaxReceipt,
		req.NeedsHouseholdRegistration, req.NeedsCooking, req.NeedsParking, req.Smoking,
		req.Occupation, req.ContactInfo, true,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	if err := insertProfileLocations(c, tx, profileID, req.Locations); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid location id", "code": "INVALID_LOCATION"})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	// Return created profile
	p, err := h.loadProfile(c, profileID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	c.JSON(http.StatusCreated, p)
}

// GetTenantProfile GET /api/v1/tenant-profiles/:profileId
func (h *Handler) GetTenantProfile(c *gin.Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	p, err := h.loadProfile(c, profileID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "NOT_FOUND"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		}
		return
	}
	c.JSON(http.StatusOK, p)
}

// UpdateTenantProfile PUT /api/v1/tenant-profiles/:profileId
func (h *Handler) UpdateTenantProfile(c *gin.Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.assertProfileOwner(c, profileID, userID); err != nil {
		return
	}

	var req TenantProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "BAD_REQUEST"})
		return
	}
	if err := validateProfileRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "BAD_REQUEST"})
		return
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	_, err = tx.Exec(c.Request.Context(),
		`UPDATE tenant_profiles SET
			name=$1, budget_min=$2, budget_max=$3, preferred_room_types=$4,
			available_from=$5, min_lease_months=$6, min_area_ping=$7,
			has_pets=$8, pet_description=$9, needs_subsidy=$10, needs_tax_receipt=$11,
			needs_household_registration=$12, needs_cooking=$13, needs_parking=$14,
			smoking=$15, occupation=$16, contact_info=$17, updated_at=NOW()
		 WHERE id=$18 AND tenant_id=$19 AND deleted_at IS NULL`,
		req.Name, req.BudgetMin, req.BudgetMax, req.PreferredRoomTypes,
		req.AvailableFrom, req.MinLeaseMonths, req.MinAreaPing,
		req.HasPets, req.PetDescription, req.NeedsSubsidy, req.NeedsTaxReceipt,
		req.NeedsHouseholdRegistration, req.NeedsCooking, req.NeedsParking,
		req.Smoking, req.Occupation, req.ContactInfo,
		profileID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	// Replace locations: soft-delete old, insert new
	if _, err = tx.Exec(c.Request.Context(),
		`UPDATE tenant_profile_locations SET deleted_at=NOW()
		 WHERE tenant_profile_id=$1 AND deleted_at IS NULL`, profileID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	if err := insertProfileLocations(c, tx, profileID, req.Locations); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid location id", "code": "INVALID_LOCATION"})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}

	p, err := h.loadProfile(c, profileID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// DeleteTenantProfile DELETE /api/v1/tenant-profiles/:profileId
func (h *Handler) DeleteTenantProfile(c *gin.Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.assertProfileOwner(c, profileID, userID); err != nil {
		return
	}

	_, err := h.db.Exec(c.Request.Context(),
		`UPDATE tenant_profiles SET deleted_at=NOW(), updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		profileID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ToggleTenantProfileStatus PATCH /api/v1/tenant-profiles/:profileId/status
func (h *Handler) ToggleTenantProfileStatus(c *gin.Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")

	if err := h.assertProfileOwner(c, profileID, userID); err != nil {
		return
	}

	var body struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "BAD_REQUEST"})
		return
	}

	_, err := h.db.Exec(c.Request.Context(),
		`UPDATE tenant_profiles SET is_active=$1, updated_at=NOW()
		 WHERE id=$2 AND tenant_id=$3 AND deleted_at IS NULL`,
		body.IsActive, profileID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"is_active": body.IsActive})
}

// ---- helpers ----

func validateProfileRequest(req *TenantProfileRequest) error {
	if req.BudgetMin > req.BudgetMax {
		return errors.New("budget_min must be <= budget_max")
	}
	if req.MinAreaPing != nil && *req.MinAreaPing <= 0 {
		return errors.New("min_area_ping must be > 0")
	}
	return nil
}

type profileScanner interface {
	Scan(dest ...any) error
}

func scanProfile(s profileScanner) (TenantProfileResponse, error) {
	var p TenantProfileResponse
	err := s.Scan(
		&p.ID, &p.TenantID, &p.Name, &p.BudgetMin, &p.BudgetMax,
		&p.PreferredRoomTypes, &p.AvailableFrom, &p.MinLeaseMonths, &p.MinAreaPing,
		&p.HasPets, &p.PetDescription, &p.NeedsSubsidy, &p.NeedsTaxReceipt,
		&p.NeedsHouseholdRegistration, &p.NeedsCooking, &p.NeedsParking, &p.Smoking,
		&p.Occupation, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, err
}

func (h *Handler) loadProfile(c *gin.Context, profileID, tenantID string) (TenantProfileResponse, error) {
	row := h.db.QueryRow(c.Request.Context(),
		`SELECT id, tenant_id, name, budget_min, budget_max,
		        preferred_room_types, available_from, min_lease_months, min_area_ping,
		        has_pets, pet_description, needs_subsidy, needs_tax_receipt,
		        needs_household_registration, needs_cooking, needs_parking, smoking,
		        occupation, is_active, created_at, updated_at
		 FROM tenant_profiles
		 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		profileID, tenantID,
	)
	p, err := scanProfile(row)
	if err != nil {
		return p, err
	}
	p.Locations = h.loadProfileLocations(c, profileID)
	return p, nil
}

func (h *Handler) loadProfileLocations(c *gin.Context, profileID string) []string {
	rows, err := h.db.Query(c.Request.Context(),
		`SELECT location_id FROM tenant_profile_locations
		 WHERE tenant_profile_id=$1 AND deleted_at IS NULL`,
		profileID,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var locs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			locs = append(locs, id)
		}
	}
	return locs
}

func insertProfileLocations(c *gin.Context, tx pgx.Tx, profileID string, locationIDs []string) error {
	for _, locID := range locationIDs {
		if _, err := tx.Exec(c.Request.Context(),
			`INSERT INTO tenant_profile_locations (tenant_profile_id, location_id)
			 VALUES ($1, $2)
			 ON CONFLICT (tenant_profile_id, location_id) DO UPDATE SET deleted_at = NULL`,
			profileID, locID,
		); err != nil {
			return err
		}
	}
	return nil
}

func (h *Handler) assertProfileOwner(c *gin.Context, profileID, userID string) error {
	var ownerID string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT tenant_id FROM tenant_profiles WHERE id=$1 AND deleted_at IS NULL`,
		profileID,
	).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "NOT_FOUND"})
		return err
	}
	if ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "code": "FORBIDDEN"})
		return ErrForbidden
	}
	return nil
}

func respondForbidden(c *gin.Context, err error) {
	if errors.Is(err, ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "code": "FORBIDDEN"})
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
}
