package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// enableViewing turns on a wide-open 帶看 schedule (every weekday 00:00–23:30, 30-min slots)
// with the given per-slot capacity (團體帶看).
func enableViewing(t *testing.T, landlordID, listingID string, capacity int) {
	t.Helper()
	cookie := validAccessCookie(t, landlordID, "ll@ll.com", []string{"landlord"})
	weekly := map[string][][]string{}
	for d := 0; d < 7; d++ {
		weekly[itoa(d)] = [][]string{{"00:00", "23:30"}}
	}
	w := jsonRequest(t, "PUT", "/api/v1/listings/"+listingID+"/viewing-availability", map[string]any{
		"enabled":            true,
		"slot_minutes":       30,
		"slot_capacity":      capacity,
		"weekly":             weekly,
		"booking_range_days": 14,
		"exceptions":         []string{},
	}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("set availability: %d %s", w.Code, w.Body.String())
	}
}

func itoa(d int) string { return string(rune('0' + d)) }

// firstOpenSlot returns the earliest open slot start (RFC3339) for a listing.
func firstOpenSlot(t *testing.T, userID, listingID string) string {
	t.Helper()
	cookie := validAccessCookie(t, userID, "x@x.com", []string{"tenant"})
	w := jsonRequest(t, "GET", "/api/v1/listings/"+listingID+"/viewing-slots", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("get slots: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Slots []struct {
			Start string `json:"start"`
		} `json:"slots"`
	}
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp.Slots) == 0 {
		t.Fatal("expected at least one open slot")
	}
	return resp.Slots[0].Start
}

func listViewings(t *testing.T, userID, email, role string) []map[string]any {
	t.Helper()
	cookie := validAccessCookie(t, userID, email, []string{role})
	w := jsonRequest(t, "GET", "/api/v1/viewings?role="+role, nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("list viewings: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Items []map[string]any `json:"items"`
	}
	json.NewDecoder(w.Body).Decode(&resp)
	return resp.Items
}

// matchPair drives tenant-interest → landlord-reciprocate → mutual match (no 帶看 slot).
func matchPair(t *testing.T, tenantID, tEmail, landlordID, lEmail, profileID, listingID string) {
	t.Helper()
	tCookie := validAccessCookie(t, tenantID, tEmail, []string{"tenant"})
	if w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie); w.Code != http.StatusOK {
		t.Fatalf("tenant interest: %d %s", w.Code, w.Body.String())
	}
	lCookie := validAccessCookie(t, landlordID, lEmail, []string{"landlord"})
	w := postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "matched" {
		t.Fatalf("expected matched, got %v", resp["status"])
	}
}

// mutualMatchID returns the tenant's match_id for a given listing.
func mutualMatchID(t *testing.T, tenantID, email, listingID string) string {
	t.Helper()
	cookie := validAccessCookie(t, tenantID, email, []string{"tenant"})
	w := jsonRequest(t, "GET", "/api/v1/matches/mutual?limit=50", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("mutual matches: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Items []struct {
			MatchID   string `json:"match_id"`
			ListingID string `json:"listing_id"`
		} `json:"items"`
	}
	json.NewDecoder(w.Body).Decode(&resp)
	for _, m := range resp.Items {
		if m.ListingID == listingID {
			return m.MatchID
		}
	}
	t.Fatalf("no mutual match for listing %s", listingID)
	return ""
}

// bookViewing books a slot for the tenant's match on a listing.
func bookViewing(t *testing.T, tenantID, email, listingID, slot string) *httptest.ResponseRecorder {
	t.Helper()
	matchID := mutualMatchID(t, tenantID, email, listingID)
	cookie := validAccessCookie(t, tenantID, email, []string{"tenant"})
	return postJSON(t, "/api/v1/viewings", map[string]any{"match_id": matchID, "starts_at": slot}, cookie)
}

// matchAndBook does the full happy path: match, enable capacity-1 viewing, book the first slot.
func matchAndBook(t *testing.T, tenantID, tEmail, landlordID, lEmail, profileID, listingID string) string {
	t.Helper()
	matchPair(t, tenantID, tEmail, landlordID, lEmail, profileID, listingID)
	enableViewing(t, landlordID, listingID, 1)
	slot := firstOpenSlot(t, tenantID, listingID)
	if w := bookViewing(t, tenantID, tEmail, listingID, slot); w.Code != http.StatusCreated {
		t.Fatalf("book viewing: %d %s", w.Code, w.Body.String())
	}
	return slot
}

func TestViewing_BookCreatesConfirmedViewing(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll1@example.com", "landlord")
	tenantID := seedUser(t, "vw-t1@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	matchAndBook(t, tenantID, "vw-t1@example.com", landlordID, "vw-ll1@example.com", profileID, listingID)

	// Tenant sees the confirmed viewing with landlord contact revealed (match is active).
	items := listViewings(t, tenantID, "vw-t1@example.com", "tenant")
	if len(items) != 1 {
		t.Fatalf("expected 1 viewing, got %d", len(items))
	}
	if items[0]["status"] != "confirmed" {
		t.Errorf("expected status confirmed, got %v", items[0]["status"])
	}
	if items[0]["contact_info"] == "" {
		t.Error("expected contact_info revealed for active match")
	}
}

func TestViewing_MatchAloneCreatesNoViewing(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll4@example.com", "landlord")
	tenantID := seedUser(t, "vw-t4@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// Matching no longer auto-creates a viewing; the tenant must book one explicitly.
	matchPair(t, tenantID, "vw-t4@example.com", landlordID, "vw-ll4@example.com", profileID, listingID)
	if len(listViewings(t, tenantID, "vw-t4@example.com", "tenant")) != 0 {
		t.Error("no viewing should exist until the tenant books one")
	}
}

func TestViewing_BookedSlotCountAndCapacity(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll9@example.com", "landlord")
	tenantID := seedUser(t, "vw-t9@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	matchPair(t, tenantID, "vw-t9@example.com", landlordID, "vw-ll9@example.com", profileID, listingID)
	enableViewing(t, landlordID, listingID, 2)
	slot := firstOpenSlot(t, tenantID, listingID)
	if w := bookViewing(t, tenantID, "vw-t9@example.com", listingID, slot); w.Code != http.StatusCreated {
		t.Fatalf("book: %d %s", w.Code, w.Body.String())
	}

	// With capacity 2 and one booking, the slot is still offered with booked_count=1.
	cookie := validAccessCookie(t, tenantID, "vw-t9@example.com", []string{"tenant"})
	w := jsonRequest(t, "GET", "/api/v1/listings/"+listingID+"/viewing-slots", nil, cookie)
	var resp struct {
		Slots []struct {
			Start       string `json:"start"`
			BookedCount int    `json:"booked_count"`
			Capacity    int    `json:"capacity"`
		} `json:"slots"`
	}
	json.NewDecoder(w.Body).Decode(&resp)
	var found bool
	for _, s := range resp.Slots {
		if s.Start == slot {
			found = true
			if s.BookedCount != 1 || s.Capacity != 2 {
				t.Errorf("expected booked_count=1 capacity=2, got %d/%d", s.BookedCount, s.Capacity)
			}
		}
	}
	if !found {
		t.Error("slot with spare capacity must still be offered")
	}
}

func TestViewing_SlotFullWhenCapacityReached(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll10@example.com", "landlord")
	t1 := seedUser(t, "vw-t10a@example.com", "tenant")
	t2 := seedUser(t, "vw-t10b@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	p1 := activeTenantProfile(t, t1, "taipei-daan", 15000, 25000, false, false)
	p2 := activeTenantProfile(t, t2, "taipei-daan", 15000, 25000, false, false)

	matchPair(t, t1, "vw-t10a@example.com", landlordID, "vw-ll10@example.com", p1, listingID)
	matchPair(t, t2, "vw-t10b@example.com", landlordID, "vw-ll10@example.com", p2, listingID)
	enableViewing(t, landlordID, listingID, 1)

	slot := firstOpenSlot(t, t1, listingID)
	if w := bookViewing(t, t1, "vw-t10a@example.com", listingID, slot); w.Code != http.StatusCreated {
		t.Fatalf("first booking: %d %s", w.Code, w.Body.String())
	}
	// Capacity 1 is now full; the second tenant booking the same slot is rejected.
	w := bookViewing(t, t2, "vw-t10b@example.com", listingID, slot)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 slot_full, got %d %s", w.Code, w.Body.String())
	}
}

func TestViewing_DoubleBookSameMatchBlocked(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll11@example.com", "landlord")
	tenantID := seedUser(t, "vw-t11@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	matchPair(t, tenantID, "vw-t11@example.com", landlordID, "vw-ll11@example.com", profileID, listingID)
	enableViewing(t, landlordID, listingID, 5)

	cookie := validAccessCookie(t, tenantID, "vw-t11@example.com", []string{"tenant"})
	w := jsonRequest(t, "GET", "/api/v1/listings/"+listingID+"/viewing-slots", nil, cookie)
	var resp struct {
		Slots []struct {
			Start string `json:"start"`
		} `json:"slots"`
	}
	json.NewDecoder(w.Body).Decode(&resp)

	if w := bookViewing(t, tenantID, "vw-t11@example.com", listingID, resp.Slots[0].Start); w.Code != http.StatusCreated {
		t.Fatalf("first booking: %d %s", w.Code, w.Body.String())
	}
	// Same match booking a different open slot must be blocked (one viewing per match).
	if w := bookViewing(t, tenantID, "vw-t11@example.com", listingID, resp.Slots[1].Start); w.Code != http.StatusConflict {
		t.Fatalf("expected 409 for double booking, got %d %s", w.Code, w.Body.String())
	}
}

func TestViewing_BookForeignMatchForbidden(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll12@example.com", "landlord")
	tenantID := seedUser(t, "vw-t12@example.com", "tenant")
	stranger := seedUser(t, "vw-t12x@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	matchPair(t, tenantID, "vw-t12@example.com", landlordID, "vw-ll12@example.com", profileID, listingID)
	enableViewing(t, landlordID, listingID, 1)
	matchID := mutualMatchID(t, tenantID, "vw-t12@example.com", listingID)
	slot := firstOpenSlot(t, tenantID, listingID)

	// A different tenant must not book someone else's match.
	cookie := validAccessCookie(t, stranger, "vw-t12x@example.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/viewings", map[string]any{"match_id": matchID, "starts_at": slot}, cookie)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d %s", w.Code, w.Body.String())
	}
}

func TestViewing_InvalidSlotRejected(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll3@example.com", "landlord")
	tenantID := seedUser(t, "vw-t3@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	matchPair(t, tenantID, "vw-t3@example.com", landlordID, "vw-ll3@example.com", profileID, listingID)
	enableViewing(t, landlordID, listingID, 1)

	// A slot far outside the booking range / not aligned must be rejected at booking.
	w := bookViewing(t, tenantID, "vw-t3@example.com", listingID, "2099-01-01T03:17:00Z")
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 for invalid slot, got %d %s", w.Code, w.Body.String())
	}
}

func TestViewing_Attendance(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll5@example.com", "landlord")
	tenantID := seedUser(t, "vw-t5@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	matchAndBook(t, tenantID, "vw-t5@example.com", landlordID, "vw-ll5@example.com", profileID, listingID)

	viewingID := listViewings(t, landlordID, "vw-ll5@example.com", "landlord")[0]["id"].(string)
	lCookie := validAccessCookie(t, landlordID, "vw-ll5@example.com", []string{"landlord"})
	w := postJSON(t, "/api/v1/viewings/"+viewingID+"/attendance", map[string]any{"attendance": "attended"}, lCookie)
	if w.Code != http.StatusNoContent {
		t.Fatalf("attendance: %d %s", w.Code, w.Body.String())
	}
	items := listViewings(t, landlordID, "vw-ll5@example.com", "landlord")
	if items[0]["status"] != "completed" || items[0]["attendance"] != "attended" {
		t.Errorf("expected completed/attended, got %v/%v", items[0]["status"], items[0]["attendance"])
	}
}

func TestViewing_TenantCancel(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll6@example.com", "landlord")
	tenantID := seedUser(t, "vw-t6@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	matchAndBook(t, tenantID, "vw-t6@example.com", landlordID, "vw-ll6@example.com", profileID, listingID)

	viewingID := listViewings(t, tenantID, "vw-t6@example.com", "tenant")[0]["id"].(string)
	tCookie := validAccessCookie(t, tenantID, "vw-t6@example.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/viewings/"+viewingID+"/cancel", nil, tCookie)
	if w.Code != http.StatusNoContent {
		t.Fatalf("cancel: %d %s", w.Code, w.Body.String())
	}
	if listViewings(t, tenantID, "vw-t6@example.com", "tenant")[0]["status"] != "cancelled" {
		t.Error("expected status cancelled")
	}
}

func TestViewing_RentedCancelsAndHidesContact(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll7@example.com", "landlord")
	tenantID := seedUser(t, "vw-t7@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	matchAndBook(t, tenantID, "vw-t7@example.com", landlordID, "vw-ll7@example.com", profileID, listingID)

	lCookie := validAccessCookie(t, landlordID, "vw-ll7@example.com", []string{"landlord"})
	patchJSON(t, "/api/v1/listings/"+listingID+"/status", map[string]any{"status": "rented"}, lCookie)

	items := listViewings(t, tenantID, "vw-t7@example.com", "tenant")
	if items[0]["status"] != "cancelled_landlord" {
		t.Errorf("expected cancelled_landlord after rented, got %v", items[0]["status"])
	}
	// Match is no longer active → contact must be hidden again.
	if items[0]["contact_info"] != "" {
		t.Error("contact_info must be hidden once the match is no longer active")
	}
}

func TestViewing_AccountDeletionRemovesViewings(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "vw-ll8@example.com", "landlord")
	tenantID := seedUser(t, "vw-t8@example.com", "tenant")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	matchAndBook(t, tenantID, "vw-t8@example.com", landlordID, "vw-ll8@example.com", profileID, listingID)

	tCookie := validAccessCookie(t, tenantID, "vw-t8@example.com", []string{"tenant"})
	if w := jsonRequest(t, "DELETE", "/api/v1/account", nil, tCookie); w.Code != http.StatusNoContent {
		t.Fatalf("delete account: %d %s", w.Code, w.Body.String())
	}
	// Landlord must no longer see the viewing.
	if len(listViewings(t, landlordID, "vw-ll8@example.com", "landlord")) != 0 {
		t.Error("viewing should disappear after tenant account deletion")
	}
	// Sanity: the row is soft-deleted.
	var n int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM viewings WHERE deleted_at IS NULL AND listing_id=$1`, listingID).Scan(&n)
	if n != 0 {
		t.Errorf("expected 0 active viewings, got %d", n)
	}
}
