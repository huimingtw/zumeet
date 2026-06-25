package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

// Taiwan has no DST, so a fixed +8 offset is exactly correct and avoids a tzdata dependency.
var tzTaipei = time.FixedZone("Asia/Taipei", 8*3600)

// dbConn is satisfied by both *pgxpool.Pool and pgx.Tx, so slot helpers work inside or outside a tx.
type dbConn interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// ViewingAvailability is the landlord's per-listing 帶看 schedule (stored as JSONB on listings).
type ViewingAvailability struct {
	Enabled          bool                  `json:"enabled"`
	SlotMinutes      int                   `json:"slot_minutes"`
	SlotCapacity     int                   `json:"slot_capacity"` // groups per slot (團體帶看); 0 treated as 1
	Weekly           map[string][][]string `json:"weekly"`        // "0".."6" (0=Sunday) -> [["09:00","18:00"], ...]
	BookingRangeDays int                   `json:"booking_range_days"`
	Exceptions       []string              `json:"exceptions"` // "2006-01-02" dates, fully blocked
}

// capacity returns the effective per-slot capacity (minimum 1).
func (av ViewingAvailability) capacity() int {
	if av.SlotCapacity < 1 {
		return 1
	}
	return av.SlotCapacity
}

type viewingSlot struct {
	Start       time.Time `json:"start"`
	End         time.Time `json:"end"`
	BookedCount int       `json:"booked_count"`
	Capacity    int       `json:"capacity"`
}

// validateAvailability enforces sane bounds. Returns a user-facing message on failure.
func validateAvailability(av ViewingAvailability) string {
	if !av.Enabled {
		return "" // disabled config needs no further validation
	}
	if av.SlotMinutes < 15 || av.SlotMinutes > 240 {
		return "slot_minutes must be between 15 and 240"
	}
	if av.SlotCapacity < 0 || av.SlotCapacity > 20 {
		return "slot_capacity must be between 1 and 20"
	}
	if av.BookingRangeDays < 1 || av.BookingRangeDays > 60 {
		return "booking_range_days must be between 1 and 60"
	}
	for wd, windows := range av.Weekly {
		if n, err := strconv.Atoi(wd); err != nil || n < 0 || n > 6 {
			return "weekly keys must be \"0\"..\"6\""
		}
		for _, w := range windows {
			if len(w) != 2 {
				return "each weekly window must be [start, end]"
			}
			s, okS := parseHM(time.Now(), w[0])
			e, okE := parseHM(time.Now(), w[1])
			if !okS || !okE || !s.Before(e) {
				return "invalid time window: " + w[0] + "-" + w[1]
			}
		}
	}
	for _, ex := range av.Exceptions {
		if _, err := time.Parse("2006-01-02", ex); err != nil {
			return "invalid exception date: " + ex
		}
	}
	return ""
}

// parseHM builds a Taipei-local timestamp for "HH:MM" on the given day.
func parseHM(day time.Time, hm string) (time.Time, bool) {
	t, err := time.Parse("15:04", hm)
	if err != nil {
		return time.Time{}, false
	}
	d := day.In(tzTaipei)
	return time.Date(d.Year(), d.Month(), d.Day(), t.Hour(), t.Minute(), 0, 0, tzTaipei), true
}

// computeOpenSlots expands the weekly availability over [now, now+range] in Taipei time,
// dropping past slots, exception days, and slots already full (booked count >= capacity).
// Each returned slot carries its current booked count and capacity for display.
func computeOpenSlots(av ViewingAvailability, now time.Time, booked map[int64]int) []viewingSlot {
	if !av.Enabled || av.SlotMinutes <= 0 {
		return nil
	}
	cap := av.capacity()
	dur := time.Duration(av.SlotMinutes) * time.Minute
	nowT := now.In(tzTaipei)
	exc := make(map[string]bool, len(av.Exceptions))
	for _, e := range av.Exceptions {
		exc[e] = true
	}
	day0 := time.Date(nowT.Year(), nowT.Month(), nowT.Day(), 0, 0, 0, 0, tzTaipei)

	var out []viewingSlot
	for d := 0; d <= av.BookingRangeDays; d++ {
		day := day0.AddDate(0, 0, d)
		if exc[day.Format("2006-01-02")] {
			continue
		}
		for _, w := range av.Weekly[strconv.Itoa(int(day.Weekday()))] {
			ws, okS := parseHM(day, w[0])
			we, okE := parseHM(day, w[1])
			if !okS || !okE {
				continue
			}
			for s := ws; !s.Add(dur).After(we); s = s.Add(dur) {
				n := booked[s.Unix()]
				if !s.After(nowT) || n >= cap {
					continue
				}
				out = append(out, viewingSlot{Start: s, End: s.Add(dur), BookedCount: n, Capacity: cap})
			}
		}
	}
	return out
}

// loadAvailability reads and unmarshals a listing's viewing_availability.
func loadAvailability(ctx context.Context, q dbConn, listingID string) (ViewingAvailability, error) {
	var raw []byte
	err := q.QueryRow(ctx,
		`SELECT viewing_availability FROM listings WHERE id=$1 AND deleted_at IS NULL`, listingID,
	).Scan(&raw)
	if err != nil {
		return ViewingAvailability{}, err
	}
	var av ViewingAvailability
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &av); err != nil {
			return ViewingAvailability{}, err
		}
	}
	return av, nil
}

// bookedStarts returns, per slot start (unix seconds), the count of active viewings for a listing.
func bookedStarts(ctx context.Context, q dbConn, listingID string) (map[int64]int, error) {
	rows, err := q.Query(ctx, `
		SELECT starts_at FROM viewings
		WHERE listing_id=$1 AND deleted_at IS NULL AND status IN ('confirmed','completed')`,
		listingID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	booked := map[int64]int{}
	for rows.Next() {
		var t time.Time
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		booked[t.Unix()]++
	}
	return booked, rows.Err()
}

// validateOpenSlot checks that slotStart is an open, computable slot with spare capacity.
// Used as a pre-check; the authoritative capacity check is claimSlot under the advisory lock.
func validateOpenSlot(ctx context.Context, q dbConn, listingID string, slotStart time.Time) (time.Time, bool, error) {
	av, err := loadAvailability(ctx, q, listingID)
	if err != nil {
		return time.Time{}, false, err
	}
	booked, err := bookedStarts(ctx, q, listingID)
	if err != nil {
		return time.Time{}, false, err
	}
	for _, s := range computeOpenSlots(av, time.Now(), booked) {
		if s.Start.Equal(slotStart) {
			return s.End, true, nil
		}
	}
	return time.Time{}, false, nil
}

// claimSlot acquires a per-(listing, slot) advisory lock, then validates the slot is a real
// open slot with spare capacity. It returns the slot end time when the caller may book.
// The advisory lock serializes concurrent bookings so capacity is never exceeded — this is
// required now that no unique index caps one viewing per slot (capacity may be > 1).
func claimSlot(ctx context.Context, tx dbConn, listingID string, slotStart time.Time) (time.Time, bool, error) {
	if _, err := tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
		listingID, strconv.FormatInt(slotStart.Unix(), 10),
	); err != nil {
		return time.Time{}, false, err
	}
	return validateOpenSlot(ctx, tx, listingID, slotStart)
}

// ── HTTP handlers ───────────────────────────────────────────────

// GetViewingAvailability handles GET /api/v1/listings/:listingId/viewing-availability (landlord).
func (h *Handler) GetViewingAvailability(c *Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")
	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		respondForbidden(c, err)
		return
	}
	owner, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if owner != userID {
		respondForbidden(c, ErrForbidden)
		return
	}
	av, err := loadAvailability(c.Request.Context(), h.db, listingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, av)
}

// UpdateViewingAvailability handles PUT /api/v1/listings/:listingId/viewing-availability (landlord).
func (h *Handler) UpdateViewingAvailability(c *Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")
	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		respondForbidden(c, err)
		return
	}
	owner, err := h.listingOwner(c, listingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if owner != userID {
		respondForbidden(c, ErrForbidden)
		return
	}

	// Strict JSONB validation: reject unknown keys, then re-marshal the validated struct.
	var av ViewingAvailability
	dec := json.NewDecoder(c.Request.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&av); err != nil {
		respondFieldError(c, "viewing_availability", "invalid body: "+err.Error())
		return
	}
	if msg := validateAvailability(av); msg != "" {
		respondFieldError(c, "viewing_availability", msg)
		return
	}
	clean, err := json.Marshal(av)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if _, err := h.db.Exec(c.Request.Context(),
		`UPDATE listings SET viewing_availability=$1, updated_at=NOW() WHERE id=$2 AND deleted_at IS NULL`,
		clean, listingID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, av)
}

// GetViewingSlots handles GET /api/v1/listings/:listingId/viewing-slots (tenant picker).
// Returns open slots only; never any contact/address.
func (h *Handler) GetViewingSlots(c *Context) {
	listingID := c.Param("listingId")
	var listingActive bool
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT status='active' FROM listings WHERE id=$1 AND deleted_at IS NULL AND admin_removed_at IS NULL`,
		listingID,
	).Scan(&listingActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "listing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	av, err := loadAvailability(c.Request.Context(), h.db, listingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	booked, err := bookedStarts(c.Request.Context(), h.db, listingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	slots := computeOpenSlots(av, time.Now(), booked)
	if slots == nil {
		slots = []viewingSlot{}
	}
	c.JSON(http.StatusOK, gin.H{"enabled": av.Enabled, "slot_minutes": av.SlotMinutes, "slots": slots})
}

// BookViewing handles POST /api/v1/viewings (tenant books an open slot after a mutual match).
// No new disclosure path: it only creates the viewing; contact/address are still revealed
// solely through the active match in ListViewings.
func (h *Handler) BookViewing(c *Context) {
	userID := middleware.MustUserID(c)
	var body struct {
		MatchID  string    `json:"match_id" binding:"required"`
		StartsAt time.Time `json:"starts_at" binding:"required"`
	}
	if !bindJSON(c, &body) {
		return
	}

	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer tx.Rollback(ctx)

	// Match must exist, be active, and belong to the calling tenant.
	var tenantID, profileID, landlordID, listingID, matchStatus string
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, tenant_profile_id, landlord_id, listing_id, status::text
		FROM matches WHERE id=$1 AND deleted_at IS NULL`,
		body.MatchID,
	).Scan(&tenantID, &profileID, &landlordID, &listingID, &matchStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "match not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if tenantID != userID {
		respondForbidden(c, ErrForbidden)
		return
	}
	if matchStatus != "active" {
		respondFieldError(c, "match_id", "match is not active")
		return
	}

	end, ok, err := claimSlot(ctx, tx, listingID, body.StartsAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if !ok {
		c.JSON(http.StatusConflict, gin.H{"error": "selected slot is full or unavailable", "code": "slot_full"})
		return
	}

	// idx_viewings_match_active keeps a match from booking twice; a no-op insert means
	// this match already has an active viewing (reschedule, don't double-book).
	viewingID := ulid.Make().String()
	tag, err := tx.Exec(ctx, `
		INSERT INTO viewings (id, tenant_id, tenant_profile_id, landlord_id, listing_id, match_id, starts_at, ends_at, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
		ON CONFLICT (match_id) WHERE deleted_at IS NULL AND status IN ('confirmed','completed')
		DO NOTHING`,
		viewingID, tenantID, profileID, landlordID, listingID, body.MatchID, body.StartsAt, end,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "this match already has a viewing", "code": "already_booked"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": viewingID, "starts_at": body.StartsAt, "ends_at": end})
}

// ViewingResponse is the row shape for the viewing list. contact_info/address are
// populated only when the underlying match is still active (no new disclosure path).
type ViewingResponse struct {
	ID              string    `json:"id" db:"id"`
	TenantProfileID string    `json:"tenant_profile_id" db:"tenant_profile_id"`
	ListingID       string    `json:"listing_id" db:"listing_id"`
	ProfileName     string    `json:"profile_name" db:"profile_name"`
	ListingName     string    `json:"listing_name" db:"listing_name"`
	StartsAt        time.Time `json:"starts_at" db:"starts_at"`
	EndsAt          time.Time `json:"ends_at" db:"ends_at"`
	Status          string    `json:"status" db:"status"`
	Attendance      string    `json:"attendance" db:"attendance"`
	LandlordNotes   string    `json:"landlord_notes" db:"landlord_notes"`
	ContactInfo     string    `json:"contact_info" db:"contact_info"`
	Address         string    `json:"address" db:"address"`
	LocationID      string    `json:"location_id" db:"location_id"`
	Rent            int       `json:"rent" db:"rent"`
	RoomType        string    `json:"room_type" db:"room_type"`
}

// ListViewings handles GET /api/v1/viewings?role=&status=
func (h *Handler) ListViewings(c *Context) {
	userID := middleware.MustUserID(c)
	role := c.Query("role")     // "tenant" | "landlord" | ""(both)
	status := c.Query("status") // optional viewing_status filter

	sideClause := "(v.tenant_id=$1 OR v.landlord_id=$1)"
	switch role {
	case "tenant":
		sideClause = "v.tenant_id=$1"
	case "landlord":
		sideClause = "v.landlord_id=$1"
	}

	args := []any{userID}
	statusClause := ""
	if status != "" {
		args = append(args, status)
		statusClause = " AND v.status=$2::viewing_status"
	}

	rows, err := h.db.Query(c.Request.Context(), `
		SELECT v.id, v.tenant_profile_id, v.listing_id,
		       tp.name AS profile_name, COALESCE(l.name, '') AS listing_name,
		       v.starts_at, v.ends_at, v.status::text AS status,
		       COALESCE(v.attendance::text, '') AS attendance,
		       COALESCE(v.landlord_notes, '') AS landlord_notes,
		       CASE WHEN m.status='active'
		            THEN (CASE WHEN v.tenant_id=$1 THEN l.contact_info ELSE tp.contact_info END)
		            ELSE '' END AS contact_info,
		       CASE WHEN m.status='active' THEN COALESCE(l.address, '') ELSE '' END AS address,
		       l.location_id, l.rent, l.room_type::text AS room_type
		FROM viewings v
		JOIN listings l ON l.id = v.listing_id
		JOIN tenant_profiles tp ON tp.id = v.tenant_profile_id
		LEFT JOIN matches m ON m.id = v.match_id AND m.deleted_at IS NULL
		WHERE `+sideClause+statusClause+`
		  AND v.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM blocks b
		      WHERE b.deleted_at IS NULL AND (
		          (b.blocker_id = v.tenant_id AND b.blocked_id = v.landlord_id) OR
		          (b.blocker_id = v.landlord_id AND b.blocked_id = v.tenant_id)
		      )
		  )
		ORDER BY v.starts_at DESC`,
		args...,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	result, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[ViewingResponse])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result, "next_cursor": ""})
}

// SetViewingAttendance handles POST /api/v1/viewings/:viewingId/attendance (landlord).
func (h *Handler) SetViewingAttendance(c *Context) {
	userID := middleware.MustUserID(c)
	viewingID := c.Param("viewingId")
	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		respondForbidden(c, err)
		return
	}
	var body struct {
		Attendance string `json:"attendance" binding:"required"`
	}
	if !bindJSON(c, &body) {
		return
	}
	if body.Attendance != "attended" && body.Attendance != "absent" {
		respondFieldError(c, "attendance", "attendance must be attended or absent")
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `
		UPDATE viewings SET attendance=$1::viewing_attendance, status='completed', updated_at=NOW()
		WHERE id=$2 AND landlord_id=$3 AND deleted_at IS NULL AND status IN ('confirmed','completed')`,
		body.Attendance, viewingID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "viewing not found or not updatable", "code": "not_found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// CancelViewing handles POST /api/v1/viewings/:viewingId/cancel (either side).
func (h *Handler) CancelViewing(c *Context) {
	userID := middleware.MustUserID(c)
	viewingID := c.Param("viewingId")

	var tenantID, landlordID, status string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT tenant_id, landlord_id, status::text FROM viewings WHERE id=$1 AND deleted_at IS NULL`,
		viewingID,
	).Scan(&tenantID, &landlordID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "viewing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if userID != tenantID && userID != landlordID {
		respondForbidden(c, ErrForbidden)
		return
	}
	if status != "confirmed" {
		respondFieldError(c, "status", "only confirmed viewings can be cancelled")
		return
	}
	newStatus := "cancelled"
	if userID == landlordID {
		newStatus = "cancelled_landlord"
	}
	if _, err := h.db.Exec(c.Request.Context(),
		`UPDATE viewings SET status=$1::viewing_status, updated_at=NOW() WHERE id=$2 AND deleted_at IS NULL`,
		newStatus, viewingID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RescheduleViewing handles POST /api/v1/viewings/:viewingId/reschedule (either side).
func (h *Handler) RescheduleViewing(c *Context) {
	userID := middleware.MustUserID(c)
	viewingID := c.Param("viewingId")

	var body struct {
		StartsAt time.Time `json:"starts_at" binding:"required"`
	}
	if !bindJSON(c, &body) {
		return
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	var tenantID, landlordID, listingID, status string
	err = tx.QueryRow(c.Request.Context(),
		`SELECT tenant_id, landlord_id, listing_id, status::text FROM viewings
		 WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
		viewingID,
	).Scan(&tenantID, &landlordID, &listingID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "viewing not found", "code": "not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if userID != tenantID && userID != landlordID {
		respondForbidden(c, ErrForbidden)
		return
	}
	if status != "confirmed" {
		respondFieldError(c, "status", "only confirmed viewings can be rescheduled")
		return
	}

	end, ok, err := claimSlot(c.Request.Context(), tx, listingID, body.StartsAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if !ok {
		respondFieldError(c, "starts_at", "selected slot is not available")
		return
	}
	if _, err := tx.Exec(c.Request.Context(),
		`UPDATE viewings SET starts_at=$1, ends_at=$2, updated_at=NOW() WHERE id=$3 AND deleted_at IS NULL`,
		body.StartsAt, end, viewingID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": viewingID, "starts_at": body.StartsAt, "ends_at": end})
}
