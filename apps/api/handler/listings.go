package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

const (
	maxListingPhotos   = 6
	maxPhotoSizeBytes  = 5 * 1024 * 1024 // 5 MB
)

// ListingRequest is used for POST and PUT.
type ListingRequest struct {
	LocationID                  string    `json:"location_id" binding:"required"`
	Rent                        int       `json:"rent" binding:"required,min=1"`
	RoomType                    string    `json:"room_type" binding:"required"`
	AreaPing                    float64   `json:"area_ping" binding:"required,min=1"`
	AvailableFrom               time.Time `json:"available_from" binding:"required"`
	MinLeaseMonths              int       `json:"min_lease_months" binding:"required,min=1"`
	AllowPets                   bool      `json:"allow_pets"`
	AllowSubsidy                bool      `json:"allow_subsidy"`
	AllowTaxReceipt             bool      `json:"allow_tax_receipt"`
	AllowHouseholdRegistration  bool      `json:"allow_household_registration"`
	AllowCooking                bool      `json:"allow_cooking"`
	HasParking                  bool      `json:"has_parking"`
	AllowSmoking                bool      `json:"allow_smoking"`
	ContactInfo                 string    `json:"contact_info" binding:"required"`
	ComplianceConfirmed         bool      `json:"compliance_confirmed"`
	// soft attributes; stored as-is (whitelist validation omitted in MVP)
	Attributes map[string]any `json:"attributes"`
}

type PhotoDetail struct {
	ID        string `json:"id"`
	PublicURL string `json:"public_url"`
	Position  int    `json:"position"`
}

type ListingResponse struct {
	ID                          string        `json:"id"`
	LandlordID                  string        `json:"landlord_id"`
	LocationID                  string        `json:"location_id"`
	Rent                        int           `json:"rent"`
	RoomType                    string        `json:"room_type"`
	AreaPing                    float64       `json:"area_ping"`
	AvailableFrom               time.Time     `json:"available_from"`
	MinLeaseMonths              int           `json:"min_lease_months"`
	AllowPets                   bool          `json:"allow_pets"`
	AllowSubsidy                bool          `json:"allow_subsidy"`
	AllowTaxReceipt             bool          `json:"allow_tax_receipt"`
	AllowHouseholdRegistration  bool          `json:"allow_household_registration"`
	AllowCooking                bool          `json:"allow_cooking"`
	HasParking                  bool          `json:"has_parking"`
	AllowSmoking                bool          `json:"allow_smoking"`
	Status                      string        `json:"status"`
	Photos                      []string      `json:"photos"`
	PhotoList                   []PhotoDetail `json:"photo_list"`
	CreatedAt                   time.Time     `json:"created_at"`
	UpdatedAt                   time.Time     `json:"updated_at"`
}

// CreateListing handles POST /api/v1/listings
func (h *Handler) CreateListing(c *gin.Context) {
	userID := middleware.MustUserID(c)
	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, err)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	var req ListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_request"})
		return
	}
	if !req.ComplianceConfirmed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "compliance_confirmed must be true", "code": "compliance_required"})
		return
	}
	if !validRoomType(req.RoomType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room_type", "code": "invalid_room_type"})
		return
	}

	// verify location exists
	var locExists bool
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM locations WHERE id=$1)`, req.LocationID,
	).Scan(&locExists); err != nil || !locExists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid location_id", "code": "invalid_location"})
		return
	}

	id := ulid.Make().String()
	now := time.Now().UTC()

	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO listings (
			id, landlord_id, location_id, rent, room_type, area_ping,
			available_from, min_lease_months,
			allow_pets, allow_subsidy, allow_tax_receipt,
			allow_household_registration, allow_cooking, has_parking, allow_smoking,
			contact_info, compliance_confirmed_at, status, created_at, updated_at
		) VALUES (
			$1,$2,$3,$4,$5::room_type,$6,
			$7,$8,
			$9,$10,$11,
			$12,$13,$14,$15,
			$16,$17,'draft',$18,$18
		)`,
		id, userID, req.LocationID, req.Rent, req.RoomType, req.AreaPing,
		req.AvailableFrom, req.MinLeaseMonths,
		req.AllowPets, req.AllowSubsidy, req.AllowTaxReceipt,
		req.AllowHouseholdRegistration, req.AllowCooking, req.HasParking, req.AllowSmoking,
		// contact_info intentionally not logged
		req.ContactInfo, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create listing", "code": "internal"})
		return
	}

	resp, err := h.fetchListingResponse(c, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch listing", "code": "internal"})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

// GetListing handles GET /api/v1/listings/:listingId
func (h *Handler) GetListing(c *gin.Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")

	resp, err := h.fetchListingResponse(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if resp.LandlordID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// UpdateListing handles PUT /api/v1/listings/:listingId
func (h *Handler) UpdateListing(c *gin.Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, ErrForbidden)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	ownerID, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if ownerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}

	var req ListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_request"})
		return
	}
	if !validRoomType(req.RoomType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room_type", "code": "invalid_room_type"})
		return
	}

	var locExists bool
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM locations WHERE id=$1)`, req.LocationID,
	).Scan(&locExists); err != nil || !locExists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid location_id", "code": "invalid_location"})
		return
	}

	_, err = h.db.Exec(c.Request.Context(), `
		UPDATE listings SET
			location_id=$1, rent=$2, room_type=$3::room_type, area_ping=$4,
			available_from=$5, min_lease_months=$6,
			allow_pets=$7, allow_subsidy=$8, allow_tax_receipt=$9,
			allow_household_registration=$10, allow_cooking=$11, has_parking=$12, allow_smoking=$13,
			contact_info=$14, updated_at=NOW()
		WHERE id=$15 AND deleted_at IS NULL`,
		req.LocationID, req.Rent, req.RoomType, req.AreaPing,
		req.AvailableFrom, req.MinLeaseMonths,
		req.AllowPets, req.AllowSubsidy, req.AllowTaxReceipt,
		req.AllowHouseholdRegistration, req.AllowCooking, req.HasParking, req.AllowSmoking,
		req.ContactInfo, listingID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update listing", "code": "internal"})
		return
	}

	resp, err := h.fetchListingResponse(c, listingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch listing", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// UpdateListingStatus handles PATCH /api/v1/listings/:listingId/status
func (h *Handler) UpdateListingStatus(c *gin.Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, ErrForbidden)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	ownerID, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if ownerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_request"})
		return
	}

	switch body.Status {
	case "active":
		// verify preconditions: at least one active photo + compliance_confirmed_at
		var photoCount int
		var complianceOK bool
		err := h.db.QueryRow(c.Request.Context(), `
			SELECT
				(SELECT COUNT(*) FROM listing_photos WHERE listing_id=$1 AND deleted_at IS NULL),
				(compliance_confirmed_at IS NOT NULL)
			FROM listings WHERE id=$1 AND deleted_at IS NULL`,
			listingID,
		).Scan(&photoCount, &complianceOK)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}
		if photoCount == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "at least one photo required to publish", "code": "photo_required"})
			return
		}
		if !complianceOK {
			c.JSON(http.StatusBadRequest, gin.H{"error": "compliance confirmation required", "code": "compliance_required"})
			return
		}
		_, err = h.db.Exec(c.Request.Context(),
			`UPDATE listings SET status='active', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, listingID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status", "code": "internal"})
			return
		}

	case "paused":
		_, err = h.db.Exec(c.Request.Context(),
			`UPDATE listings SET status='paused', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, listingID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status", "code": "internal"})
			return
		}

	case "rented":
		tx, err := h.db.Begin(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}
		defer tx.Rollback(c.Request.Context())

		if _, err = tx.Exec(c.Request.Context(),
			`UPDATE listings SET status='rented', updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, listingID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status", "code": "internal"})
			return
		}
		// cascade: mark all active matches for this listing as listing_rented
		if _, err = tx.Exec(c.Request.Context(),
			`UPDATE matches SET status='listing_rented', updated_at=NOW()
			 WHERE listing_id=$1 AND status='active' AND deleted_at IS NULL`, listingID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update matches", "code": "internal"})
			return
		}
		if err = tx.Commit(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status; allowed: active, paused, rented", "code": "invalid_status"})
		return
	}

	resp, err := h.fetchListingResponse(c, listingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch listing", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// DeleteListing handles DELETE /api/v1/listings/:listingId
func (h *Handler) DeleteListing(c *gin.Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, ErrForbidden)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	ownerID, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if ownerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}

	_, err = h.db.Exec(c.Request.Context(),
		`UPDATE listings SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, listingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete listing", "code": "internal"})
		return
	}
	c.Status(http.StatusNoContent)
}

// UploadListingPhoto handles POST /api/v1/listings/:listingId/photos
func (h *Handler) UploadListingPhoto(c *gin.Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, ErrForbidden)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	ownerID, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if ownerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}

	// check active photo count
	var photoCount int
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT COUNT(*) FROM listing_photos WHERE listing_id=$1 AND deleted_at IS NULL`, listingID,
	).Scan(&photoCount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if photoCount >= maxListingPhotos {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("max %d photos per listing", maxListingPhotos), "code": "photo_limit"})
		return
	}

	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing photo file", "code": "missing_file"})
		return
	}
	defer file.Close()

	if header.Size > maxPhotoSizeBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 5MB)", "code": "file_too_large"})
		return
	}

	contentType := header.Header.Get("Content-Type")
	if !validImageContentType(contentType) {
		// fall back to extension check
		contentType = mimeFromFilename(header.Filename)
		if contentType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "only JPEG, PNG, WebP allowed", "code": "invalid_file_type"})
			return
		}
	}

	// next available position
	var position int
	if err := h.db.QueryRow(c.Request.Context(),
		`SELECT COALESCE(MAX(position),0)+1 FROM listing_photos WHERE listing_id=$1 AND deleted_at IS NULL`,
		listingID,
	).Scan(&position); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	key := fmt.Sprintf("listings/%s/%d_%s", listingID, time.Now().UnixMilli(), sanitizeFilename(header.Filename))
	publicURL, err := h.storage.Upload(c.Request.Context(), key, file, header.Size, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload photo", "code": "upload_failed"})
		return
	}

	photoID := ulid.Make().String()
	if _, err = h.db.Exec(c.Request.Context(),
		`INSERT INTO listing_photos (id, listing_id, storage_key, public_url, position)
		 VALUES ($1,$2,$3,$4,$5)`,
		photoID, listingID, key, publicURL, position,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save photo", "code": "internal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         photoID,
		"public_url": publicURL,
		"position":   position,
	})
}

// DeleteListingPhoto handles DELETE /api/v1/listings/:listingId/photos/:photoId
func (h *Handler) DeleteListingPhoto(c *gin.Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")
	photoID := c.Param("photoId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, ErrForbidden)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	ownerID, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if ownerID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}

	var storageKey string
	err = h.db.QueryRow(c.Request.Context(),
		`SELECT storage_key FROM listing_photos
		 WHERE id=$1 AND listing_id=$2 AND deleted_at IS NULL`,
		photoID, listingID,
	).Scan(&storageKey)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "photo not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	// soft-delete the DB row first
	if _, err = h.db.Exec(c.Request.Context(),
		`UPDATE listing_photos SET deleted_at=NOW() WHERE id=$1`, photoID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	// best-effort purge from storage; don't fail the request if storage delete fails
	_ = h.storage.Delete(c.Request.Context(), storageKey)

	c.Status(http.StatusNoContent)
}

// ListLandlordListings handles GET /api/v1/listings (landlord's own listings)
func (h *Handler) ListLandlordListings(c *gin.Context) {
	userID := middleware.MustUserID(c)

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, ErrForbidden)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}

	rows, err := h.db.Query(c.Request.Context(),
		`SELECT id FROM listings WHERE landlord_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
			return
		}
		ids = append(ids, id)
	}

	result := make([]ListingResponse, 0, len(ids))
	for _, id := range ids {
		resp, err := h.fetchListingResponse(c, id)
		if err != nil {
			continue
		}
		result = append(result, *resp)
	}
	c.JSON(http.StatusOK, result)
}

// ---- helpers ----

func (h *Handler) listingOwner(c *gin.Context, listingID string) (string, error) {
	var ownerID string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT landlord_id FROM listings WHERE id=$1 AND deleted_at IS NULL`,
		listingID,
	).Scan(&ownerID)
	return ownerID, err
}

func (h *Handler) fetchListingResponse(c *gin.Context, id string) (*ListingResponse, error) {
	var r ListingResponse
	err := h.db.QueryRow(c.Request.Context(), `
		SELECT id, landlord_id, location_id, rent, room_type::text, area_ping,
		       available_from, min_lease_months,
		       allow_pets, allow_subsidy, allow_tax_receipt,
		       allow_household_registration, allow_cooking, has_parking, allow_smoking,
		       status::text, created_at, updated_at
		FROM listings
		WHERE id=$1 AND deleted_at IS NULL`,
		id,
	).Scan(
		&r.ID, &r.LandlordID, &r.LocationID, &r.Rent, &r.RoomType, &r.AreaPing,
		&r.AvailableFrom, &r.MinLeaseMonths,
		&r.AllowPets, &r.AllowSubsidy, &r.AllowTaxReceipt,
		&r.AllowHouseholdRegistration, &r.AllowCooking, &r.HasParking, &r.AllowSmoking,
		&r.Status, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// attach active photos
	rows, err := h.db.Query(c.Request.Context(),
		`SELECT id, public_url, position FROM listing_photos
		 WHERE listing_id=$1 AND deleted_at IS NULL ORDER BY position`,
		id,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	r.Photos = []string{}
	r.PhotoList = []PhotoDetail{}
	for rows.Next() {
		var pd PhotoDetail
		if err := rows.Scan(&pd.ID, &pd.PublicURL, &pd.Position); err != nil {
			return nil, err
		}
		r.Photos = append(r.Photos, pd.PublicURL)
		r.PhotoList = append(r.PhotoList, pd)
	}

	return &r, nil
}

func validRoomType(rt string) bool {
	switch rt {
	case "suite", "shared", "whole_floor":
		return true
	}
	return false
}

func validImageContentType(ct string) bool {
	switch ct {
	case "image/jpeg", "image/png", "image/webp":
		return true
	}
	return false
}

func mimeFromFilename(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".jpg") || strings.HasSuffix(lower, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(lower, ".png"):
		return "image/png"
	case strings.HasSuffix(lower, ".webp"):
		return "image/webp"
	}
	return ""
}

func sanitizeFilename(name string) string {
	// keep only alphanumeric, dot, dash, underscore
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') ||
			r == '.' || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return b.String()
}

