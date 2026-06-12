package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

// ---- test fixtures ----

// activeListing creates a listing via API, uploads a photo, activates it, and returns its ID.
func activeListing(t *testing.T, landlordID, locationID string, rent int, allowPets, allowSmoking bool) string {
	t.Helper()
	cookie := validAccessCookie(t, landlordID, "ll@ll.com", []string{"landlord"})
	w := postJSON(t, "/api/v1/listings", map[string]any{
		"location_id":          locationID,
		"rent":                 rent,
		"room_type":            "suite",
		"area_ping":            12.0,
		"available_from":       time.Now().UTC().Format(time.RFC3339),
		"min_lease_months":     6,
		"allow_pets":           allowPets,
		"allow_subsidy":        true,
		"allow_tax_receipt":    true,
		"allow_household_registration": false,
		"allow_cooking":        true,
		"has_parking":          false,
		"allow_smoking":        allowSmoking,
		"contact_info":         "line:landlord",
		"compliance_confirmed": true,
	}, cookie)
	if w.Code != http.StatusCreated {
		t.Fatalf("create listing: %d %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	id := resp["id"].(string)

	uploadTestPhoto(t, id, cookie)
	patchJSON(t, "/api/v1/listings/"+id+"/status", map[string]any{"status": "active"}, cookie)
	return id
}

// activeTenantProfile creates an active tenant profile and returns its ID.
func activeTenantProfile(t *testing.T, tenantID, locationID string, budgetMin, budgetMax int, hasPets, smoking bool) string {
	t.Helper()
	cookie := validAccessCookie(t, tenantID, "tt@tt.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/tenant-profiles", map[string]any{
		"name":                 "test profile",
		"budget_min":           budgetMin,
		"budget_max":           budgetMax,
		"locations":            []string{locationID},
		"preferred_room_types": []string{"suite"},
		"available_from":       time.Now().UTC().Format(time.RFC3339),
		"min_lease_months":     6,
		"has_pets":             hasPets,
		"needs_subsidy":        false,
		"needs_tax_receipt":    false,
		"needs_household_registration": false,
		"needs_cooking":        false,
		"needs_parking":        false,
		"smoking":              smoking,
		"contact_info":         "line:tenant",
		"is_active":            true,
	}, cookie)
	if w.Code != http.StatusCreated {
		t.Fatalf("create tenant profile: %d %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	return resp["id"].(string)
}

// ---- matching predicate tests ----

func TestMatching_TenantBrowsesMatchingListing(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll1@example.com", "landlord")
	tenantID := seedUser(t, "m-t1@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	cookie := validAccessCookie(t, tenantID, "m-t1@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 1 {
		t.Errorf("expected 1 matching listing, got %d", len(items))
	}
	card := items[0].(map[string]any)
	if card["id"] != listingID {
		t.Errorf("unexpected listing id: %v", card["id"])
	}
	if _, ok := card["contact_info"]; ok {
		t.Error("contact_info must not appear in browse response")
	}
	if card["interest_sent"] != false {
		t.Errorf("expected interest_sent=false, got %v", card["interest_sent"])
	}
}

func TestMatching_RentOutOfRange_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll2@example.com", "landlord")
	tenantID := seedUser(t, "m-t2@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 35000, false, false) // rent too high
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	cookie := validAccessCookie(t, tenantID, "m-t2@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings (rent out of range), got %d", len(items))
	}
}

func TestMatching_PetConflict_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll3@example.com", "landlord")
	tenantID := seedUser(t, "m-t3@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false) // no pets allowed
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, true, false) // has pets

	cookie := validAccessCookie(t, tenantID, "m-t3@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings (pet conflict), got %d", len(items))
	}
}

func TestMatching_SmokingConflict_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll4@example.com", "landlord")
	tenantID := seedUser(t, "m-t4@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false) // no smoking
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, true) // smoker

	cookie := validAccessCookie(t, tenantID, "m-t4@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings (smoking conflict), got %d", len(items))
	}
}

func TestMatching_DraftListing_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll5@example.com", "landlord")
	tenantID := seedUser(t, "m-t5@example.com", "tenant")

	// create listing but don't activate (stays draft)
	lCookie := validAccessCookie(t, landlordID, "m-ll5@example.com", []string{"landlord"})
	w := postJSON(t, "/api/v1/listings", map[string]any{
		"location_id": "taipei-daan", "rent": 20000, "room_type": "suite",
		"area_ping": 12.0, "available_from": time.Now().UTC().Format(time.RFC3339),
		"min_lease_months": 6, "allow_smoking": false,
		"contact_info": "x", "compliance_confirmed": true,
	}, lCookie)
	if w.Code != http.StatusCreated {
		t.Fatalf("create draft listing: %d", w.Code)
	}

	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	cookie := validAccessCookie(t, tenantID, "m-t5@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	wR := httptest.NewRecorder()
	testR.ServeHTTP(wR, req)

	var resp map[string]any
	json.NewDecoder(wR.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings (draft not shown), got %d", len(items))
	}
}

func TestMatching_BlockedUser_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll6@example.com", "landlord")
	tenantID := seedUser(t, "m-t6@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// tenant blocks landlord
	_, err := testPool.Exec(context.Background(),
		`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`,
		tenantID, landlordID,
	)
	if err != nil {
		t.Fatalf("block: %v", err)
	}

	cookie := validAccessCookie(t, tenantID, "m-t6@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings after block, got %d", len(items))
	}
}

func TestMatching_InactiveProfile_Rejected(t *testing.T) {
	truncate(t)
	tenantID := seedUser(t, "m-t7@example.com", "tenant")
	cookie := validAccessCookie(t, tenantID, "m-t7@example.com", []string{"tenant"})

	// create inactive profile
	w := postJSON(t, "/api/v1/tenant-profiles", map[string]any{
		"name": "inactive", "budget_min": 10000, "budget_max": 20000,
		"locations": []string{"taipei-daan"}, "preferred_room_types": []string{"suite"},
		"available_from": time.Now().UTC().Format(time.RFC3339), "min_lease_months": 3,
		"has_pets": false, "needs_subsidy": false, "needs_tax_receipt": false, "smoking": false,
		"contact_info": "x", "is_active": false,
	}, cookie)
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	profileID := resp["id"].(string)

	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	wR := httptest.NewRecorder()
	testR.ServeHTTP(wR, req)
	if wR.Code != http.StatusBadRequest {
		t.Errorf("inactive profile: expected 400, got %d", wR.Code)
	}
}

func TestMatching_LandlordBrowsesTenantProfiles(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll8@example.com", "landlord")
	tenantID := seedUser(t, "m-t8@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	cookie := validAccessCookie(t, landlordID, "m-ll8@example.com", []string{"landlord"})
	req := httptest.NewRequest("GET", "/api/v1/listings/"+listingID+"/tenant-profiles", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 1 {
		t.Errorf("expected 1 matching tenant profile, got %d", len(items))
	}
	card := items[0].(map[string]any)
	if _, ok := card["contact_info"]; ok {
		t.Error("contact_info must not appear in browse response")
	}
}

func TestMatching_LocationMismatch_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll9@example.com", "landlord")
	tenantID := seedUser(t, "m-t9@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-zhongshan", 15000, 25000, false, false) // different district

	cookie := validAccessCookie(t, tenantID, "m-t9@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings (location mismatch), got %d", len(items))
	}
}

func TestMatching_SuspendedLandlord_Excluded(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "m-ll10@example.com", "landlord")
	tenantID := seedUser(t, "m-t10@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// suspend landlord
	testPool.Exec(context.Background(),
		`UPDATE users SET suspended_at=NOW() WHERE id=$1`, landlordID)

	cookie := validAccessCookie(t, tenantID, "m-t10@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 0 {
		t.Errorf("expected 0 listings (suspended landlord), got %d", len(items))
	}
}

func TestMatching_Pagination(t *testing.T) {
	truncate(t)
	tenantID := seedUser(t, "m-page-t@example.com", "tenant")

	// create 3 landlords + 3 listings
	for i := 0; i < 3; i++ {
		llID := seedUser(t, "m-page-ll"+strconv.Itoa(i)+"@example.com", "landlord")
		activeListing(t, llID, "taipei-daan", 20000, false, false)
	}
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	cookie := validAccessCookie(t, tenantID, "m-page-t@example.com", []string{"tenant"})

	// first page: limit=2
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings?limit=2", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	items := resp["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("expected 2 items on first page, got %d", len(items))
	}
	nextCursor := resp["next_cursor"].(string)
	if nextCursor == "" {
		t.Fatal("expected non-empty next_cursor")
	}

	// second page
	req2 := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings?limit=2&cursor="+nextCursor, nil)
	req2.AddCookie(cookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)

	var resp2 map[string]any
	json.NewDecoder(w2.Body).Decode(&resp2)
	items2 := resp2["items"].([]any)
	if len(items2) != 1 {
		t.Errorf("expected 1 item on second page, got %d", len(items2))
	}
}
