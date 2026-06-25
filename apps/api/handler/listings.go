package handler

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

const (
	maxListingPhotos  = 10
	maxPhotoSizeBytes = 5 * 1024 * 1024 // 5 MB
)

// ListingRequest is used for POST (create).
// Location is supplied as a (city, district) pair — the natural key of the
// locations table (UNIQUE (city, district)) — and resolved to a location_id.
type ListingRequest struct {
	City                       string    `json:"city" binding:"required"`
	District                   string    `json:"district" binding:"required"`
	Address                    string    `json:"address"`
	Name                       string    `json:"name"`
	Rent                       int       `json:"rent" binding:"required,min=1"`
	ManagementFee              int       `json:"management_fee"`
	RoomType                   string    `json:"room_type" binding:"required"`
	AreaPing                   float64   `json:"area_ping" binding:"required,min=1"`
	NumBedrooms                *int      `json:"num_bedrooms"`
	NumLivingRooms             *int      `json:"num_living_rooms"`
	NumBathrooms               *int      `json:"num_bathrooms"`
	NumBalconies               *int      `json:"num_balconies"`
	AvailableFrom              time.Time `json:"available_from" binding:"required"`
	MinLeaseMonths             int       `json:"min_lease_months" binding:"required,min=1"`
	AllowPets                  bool      `json:"allow_pets"`
	AllowSubsidy               bool      `json:"allow_subsidy"`
	AllowTaxReceipt            bool      `json:"allow_tax_receipt"`
	AllowHouseholdRegistration bool      `json:"allow_household_registration"`
	AllowCooking               bool      `json:"allow_cooking"`
	HasParking                 bool      `json:"has_parking"`
	AllowSmoking               bool      `json:"allow_smoking"`
	Description                string    `json:"description"`
	ContactInfo                string    `json:"contact_info" binding:"required"`
	ComplianceConfirmed        bool      `json:"compliance_confirmed"`
	// soft attributes; stored as-is (whitelist validation omitted in MVP)
	Attributes map[string]any `json:"attributes"`
}

// UpdateListingRequest is used for PUT (update). contact_info is optional —
// omitting or sending empty string keeps the existing stored value.
type UpdateListingRequest struct {
	City                       string    `json:"city" binding:"required"`
	District                   string    `json:"district" binding:"required"`
	Address                    string    `json:"address"`
	Name                       string    `json:"name"`
	Rent                       int       `json:"rent" binding:"required,min=1"`
	ManagementFee              int       `json:"management_fee"`
	RoomType                   string    `json:"room_type" binding:"required"`
	AreaPing                   float64   `json:"area_ping" binding:"required,min=1"`
	NumBedrooms                *int      `json:"num_bedrooms"`
	NumLivingRooms             *int      `json:"num_living_rooms"`
	NumBathrooms               *int      `json:"num_bathrooms"`
	NumBalconies               *int      `json:"num_balconies"`
	AvailableFrom              time.Time `json:"available_from" binding:"required"`
	MinLeaseMonths             int       `json:"min_lease_months" binding:"required,min=1"`
	AllowPets                  bool      `json:"allow_pets"`
	AllowSubsidy               bool      `json:"allow_subsidy"`
	AllowTaxReceipt            bool      `json:"allow_tax_receipt"`
	AllowHouseholdRegistration bool      `json:"allow_household_registration"`
	AllowCooking               bool      `json:"allow_cooking"`
	HasParking                 bool      `json:"has_parking"`
	AllowSmoking               bool      `json:"allow_smoking"`
	Description                string    `json:"description"`
	ContactInfo                string    `json:"contact_info"`
	Attributes                 map[string]any `json:"attributes"`
}

type PhotoDetail struct {
	ID        string `json:"id" db:"id"`
	PublicURL string `json:"public_url" db:"public_url"`
	Position  int    `json:"position" db:"position"`
}

type ListingResponse struct {
	ID                         string        `json:"id"`
	LandlordID                 string        `json:"landlord_id"`
	LocationID                 string        `json:"location_id"`
	Address                    string        `json:"address"`
	Name                       string        `json:"name"`
	Rent                       int           `json:"rent"`
	ManagementFee              int           `json:"management_fee"`
	RoomType                   string        `json:"room_type"`
	AreaPing                   float64       `json:"area_ping"`
	NumBedrooms                *int          `json:"num_bedrooms"`
	NumLivingRooms             *int          `json:"num_living_rooms"`
	NumBathrooms               *int          `json:"num_bathrooms"`
	NumBalconies               *int          `json:"num_balconies"`
	AvailableFrom              time.Time     `json:"available_from"`
	MinLeaseMonths             int           `json:"min_lease_months"`
	AllowPets                  bool          `json:"allow_pets"`
	AllowSubsidy               bool          `json:"allow_subsidy"`
	AllowTaxReceipt            bool          `json:"allow_tax_receipt"`
	AllowHouseholdRegistration bool          `json:"allow_household_registration"`
	AllowCooking               bool          `json:"allow_cooking"`
	HasParking                 bool          `json:"has_parking"`
	AllowSmoking               bool          `json:"allow_smoking"`
	Description                string        `json:"description"`
	Status                     string        `json:"status"`
	Photos                     []string      `json:"photos" db:"-"`
	PhotoList                  []PhotoDetail `json:"photo_list" db:"-"`
	Lat                        *float64      `json:"lat"`
	Lng                        *float64      `json:"lng"`
	CreatedAt                  time.Time     `json:"created_at"`
	UpdatedAt                  time.Time     `json:"updated_at"`
}

// CreateListing handles POST /api/v1/listings
func (h *Handler) CreateListing(c *Context) {
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
	if !bindJSON(c, &req) {
		return
	}
	if !req.ComplianceConfirmed {
		respondFieldError(c, "compliance_confirmed", "請勾選合規自我聲明")
		return
	}
	if !validRoomType(req.RoomType) {
		respondFieldError(c, "room_type", "房型不是有效選項")
		return
	}
	if req.Rent > 999999 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "租金不得超過 999,999 元", "code": "invalid_rent"})
		return
	}
	if req.AreaPing >= 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "坪數不得超過 999.99", "code": "invalid_area_ping"})
		return
	}
	if req.ManagementFee < 0 || req.ManagementFee > 999999 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "管理費需介於 0 ~ 999,999 元", "code": "invalid_management_fee"})
		return
	}
	if req.RoomType == "whole_floor" {
		if req.NumBedrooms == nil || req.NumLivingRooms == nil || req.NumBathrooms == nil || req.NumBalconies == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "整層房型必須填寫房廳衛陽台數量", "code": "missing_whole_floor_fields"})
			return
		}
	}

	// resolve (city, district) -> location_id
	locationID, err := h.resolveLocationID(c.Request.Context(), req.City, req.District)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid location", "code": "invalid_location"})
		return
	}

	var latPtr, lngPtr *float64
	if addr := strings.TrimSpace(req.Address); addr != "" {
		if lat, lng, gerr := h.geocoder.Geocode(c.Request.Context(), addr); gerr == nil {
			latPtr = &lat
			lngPtr = &lng
		} else {
			log.Printf("geocode failed (listing create): %v", gerr)
		}
	}

	id := ulid.Make().String()
	now := time.Now().UTC()

	_, err = h.db.Exec(c.Request.Context(), `
		INSERT INTO listings (
			id, landlord_id, location_id, address, name, rent, management_fee, room_type, area_ping,
			num_bedrooms, num_living_rooms, num_bathrooms, num_balconies,
			available_from, min_lease_months,
			allow_pets, allow_subsidy, allow_tax_receipt,
			allow_household_registration, allow_cooking, has_parking, allow_smoking,
			description, contact_info, lat, lng,
			compliance_confirmed_at, status, created_at, updated_at
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8::room_type,$9,
			$10,$11,$12,$13,
			$14,$15,
			$16,$17,$18,
			$19,$20,$21,$22,
			$23,$24,$25,$26,
			$27,'draft',$28,$28
		)`,
		id, userID, locationID, strings.TrimSpace(req.Address), req.Name, req.Rent, req.ManagementFee, req.RoomType, req.AreaPing,
		req.NumBedrooms, req.NumLivingRooms, req.NumBathrooms, req.NumBalconies,
		req.AvailableFrom, req.MinLeaseMonths,
		req.AllowPets, req.AllowSubsidy, req.AllowTaxReceipt,
		req.AllowHouseholdRegistration, req.AllowCooking, req.HasParking, req.AllowSmoking,
		req.Description,
		// contact_info intentionally not logged
		req.ContactInfo, latPtr, lngPtr, now, now,
	)
	if err != nil {
		log.Printf("CreateListing db error: %v", err)
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
func (h *Handler) GetListing(c *Context) {
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
func (h *Handler) UpdateListing(c *Context) {
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

	var req UpdateListingRequest
	if !bindJSON(c, &req) {
		return
	}
	if !validRoomType(req.RoomType) {
		respondFieldError(c, "room_type", "房型不是有效選項")
		return
	}
	if req.Rent > 999999 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "租金不得超過 999,999 元", "code": "invalid_rent"})
		return
	}
	if req.AreaPing >= 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "坪數不得超過 999.99", "code": "invalid_area_ping"})
		return
	}
	if req.ManagementFee < 0 || req.ManagementFee > 999999 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "管理費需介於 0 ~ 999,999 元", "code": "invalid_management_fee"})
		return
	}
	if req.RoomType == "whole_floor" {
		if req.NumBedrooms == nil || req.NumLivingRooms == nil || req.NumBathrooms == nil || req.NumBalconies == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "整層房型必須填寫房廳衛陽台數量", "code": "missing_whole_floor_fields"})
			return
		}
	}

	locationID, err := h.resolveLocationID(c.Request.Context(), req.City, req.District)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid location", "code": "invalid_location"})
		return
	}

	address := strings.TrimSpace(req.Address)
	var latPtr, lngPtr *float64
	if address != "" {
		if lat, lng, gerr := h.geocoder.Geocode(c.Request.Context(), address); gerr == nil {
			latPtr = &lat
			lngPtr = &lng
		} else {
			log.Printf("geocode failed (listing update): %v", gerr)
		}
	}

	// contact_info is optional on update: keep existing value when not provided.
	var contactInfoExpr string
	var args []any
	args = append(args,
		locationID, address, req.Name, req.Rent, req.ManagementFee, req.RoomType, req.AreaPing,
		req.NumBedrooms, req.NumLivingRooms, req.NumBathrooms, req.NumBalconies,
		req.AvailableFrom, req.MinLeaseMonths,
		req.AllowPets, req.AllowSubsidy, req.AllowTaxReceipt,
		req.AllowHouseholdRegistration, req.AllowCooking, req.HasParking, req.AllowSmoking,
		req.Description, latPtr, lngPtr,
	)
	if req.ContactInfo != "" {
		args = append(args, req.ContactInfo)
		contactInfoExpr = fmt.Sprintf("contact_info=$%d,", len(args))
	}
	args = append(args, listingID)
	idxLast := len(args)

	_, err = h.db.Exec(c.Request.Context(), fmt.Sprintf(`
		UPDATE listings SET
			location_id=$1, address=$2, name=$3, rent=$4, management_fee=$5, room_type=$6::room_type, area_ping=$7,
			num_bedrooms=$8, num_living_rooms=$9, num_bathrooms=$10, num_balconies=$11,
			available_from=$12, min_lease_months=$13,
			allow_pets=$14, allow_subsidy=$15, allow_tax_receipt=$16,
			allow_household_registration=$17, allow_cooking=$18, has_parking=$19, allow_smoking=$20,
			description=$21, lat=$22, lng=$23, %s updated_at=NOW()
		WHERE id=$%d AND deleted_at IS NULL`, contactInfoExpr, idxLast),
		args...,
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
func (h *Handler) UpdateListingStatus(c *Context) {
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
	if !bindJSON(c, &body) {
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
		// cascade: cancel any still-confirmed viewings for this listing
		if _, err = tx.Exec(c.Request.Context(),
			`UPDATE viewings SET status='cancelled_landlord', updated_at=NOW()
			 WHERE listing_id=$1 AND status='confirmed' AND deleted_at IS NULL`, listingID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update viewings", "code": "internal"})
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
func (h *Handler) DeleteListing(c *Context) {
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
func (h *Handler) UploadListingPhoto(c *Context) {
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
func (h *Handler) DeleteListingPhoto(c *Context) {
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

// ReorderListingPhotos handles PATCH /api/v1/listings/:listingId/photos/order
// Body: { "photo_ids": ["<id>", "<id>", ...] } — desired order, 1-indexed positions assigned by array order.
func (h *Handler) ReorderListingPhotos(c *Context) {
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

	var req struct {
		PhotoIDs []string `json:"photo_ids" binding:"required"`
	}
	if !bindJSON(c, &req) {
		return
	}

	// validate: no duplicates, matches set of active photos for this listing
	seen := make(map[string]struct{}, len(req.PhotoIDs))
	for _, id := range req.PhotoIDs {
		if _, dup := seen[id]; dup {
			c.JSON(http.StatusBadRequest, gin.H{"error": "duplicate photo id", "code": "invalid_order"})
			return
		}
		seen[id] = struct{}{}
	}

	rows, err := h.db.Query(c.Request.Context(),
		`SELECT id FROM listing_photos WHERE listing_id=$1 AND deleted_at IS NULL`,
		listingID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	existing, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if len(existing) != len(req.PhotoIDs) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo set mismatch", "code": "invalid_order"})
		return
	}
	for _, id := range existing {
		if _, ok := seen[id]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "photo set mismatch", "code": "invalid_order"})
			return
		}
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	// Two-step to avoid colliding with UNIQUE (listing_id, position) WHERE deleted_at IS NULL:
	// 1) park all rows in negative positions, 2) set final positions.
	if _, err := tx.Exec(c.Request.Context(),
		`UPDATE listing_photos SET position = -position
		 WHERE listing_id=$1 AND deleted_at IS NULL`,
		listingID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	positions := make([]int32, len(req.PhotoIDs))
	for i := range req.PhotoIDs {
		positions[i] = int32(i + 1)
	}
	if _, err := tx.Exec(c.Request.Context(),
		`UPDATE listing_photos AS lp
		 SET position = v.pos
		 FROM (SELECT unnest($2::text[]) AS id, unnest($3::int[]) AS pos) AS v
		 WHERE lp.id = v.id AND lp.listing_id = $1 AND lp.deleted_at IS NULL`,
		listingID, req.PhotoIDs, positions,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListLandlordListings handles GET /api/v1/listings (landlord's own listings)
func (h *Handler) ListLandlordListings(c *Context) {
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
		`SELECT id FROM listings WHERE landlord_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
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

// resolveLocationID maps a (city, district) pair to its location id.
// (city, district) is the natural key of the locations table (UNIQUE constraint).
func (h *Handler) resolveLocationID(ctx context.Context, city, district string) (string, error) {
	var id string
	err := h.db.QueryRow(ctx,
		`SELECT id FROM locations WHERE city=$1 AND district=$2`, city, district,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("location not found: city=%q district=%q", city, district)
	}
	return id, nil
}

// resolveLocationIDs resolves a slice of LocationInput to location ids.
func (h *Handler) resolveLocationIDs(ctx context.Context, inputs []LocationInput) ([]string, error) {
	ids := make([]string, 0, len(inputs))
	for _, loc := range inputs {
		id, err := h.resolveLocationID(ctx, loc.City, loc.District)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (h *Handler) listingOwner(c *Context, listingID string) (string, error) {
	var ownerID string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT landlord_id FROM listings WHERE id=$1 AND deleted_at IS NULL`,
		listingID,
	).Scan(&ownerID)
	return ownerID, err
}

func (h *Handler) fetchListingResponse(c *Context, id string) (*ListingResponse, error) {
	var r ListingResponse
	err := h.db.QueryRow(c.Request.Context(), `
		SELECT id, landlord_id, location_id, COALESCE(address, ''), COALESCE(name, ''),
		       rent, management_fee, room_type::text, area_ping,
		       num_bedrooms, num_living_rooms, num_bathrooms, num_balconies,
		       available_from, min_lease_months,
		       allow_pets, allow_subsidy, allow_tax_receipt,
		       allow_household_registration, allow_cooking, has_parking, allow_smoking,
		       COALESCE(description, ''), status::text, lat, lng, created_at, updated_at
		FROM listings
		WHERE id=$1 AND deleted_at IS NULL`,
		id,
	).Scan(
		&r.ID, &r.LandlordID, &r.LocationID, &r.Address, &r.Name,
		&r.Rent, &r.ManagementFee, &r.RoomType, &r.AreaPing,
		&r.NumBedrooms, &r.NumLivingRooms, &r.NumBathrooms, &r.NumBalconies,
		&r.AvailableFrom, &r.MinLeaseMonths,
		&r.AllowPets, &r.AllowSubsidy, &r.AllowTaxReceipt,
		&r.AllowHouseholdRegistration, &r.AllowCooking, &r.HasParking, &r.AllowSmoking,
		&r.Description, &r.Status, &r.Lat, &r.Lng, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	photoRows, err := h.db.Query(c.Request.Context(),
		`SELECT id, public_url, position FROM listing_photos
		 WHERE listing_id = $1 AND deleted_at IS NULL ORDER BY position`,
		id,
	)
	if err != nil {
		return nil, err
	}
	photos, err := pgx.CollectRows(photoRows, pgx.RowToStructByNameLax[PhotoDetail])
	if err != nil {
		return nil, err
	}
	r.PhotoList = photos
	r.Photos = make([]string, 0, len(photos))
	for _, p := range photos {
		r.Photos = append(r.Photos, p.PublicURL)
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
