package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func decodeItems(t *testing.T, w *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var body struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return body.Items
}

func TestMatches_MutualContainsContactInfo(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "mx-ll1@example.com", "landlord")
	tenantID := seedUser(t, "mx-t1@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "mx-t1@example.com", []string{"tenant"})
	lCookie := validAccessCookie(t, landlordID, "mx-ll1@example.com", []string{"landlord"})

	// create mutual match
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	// tenant sees mutual match with landlord contact
	req := httptest.NewRequest("GET", "/api/v1/matches/mutual", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	matches := decodeItems(t, w)
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}
	if matches[0]["contact_info"] == "" || matches[0]["contact_info"] == nil {
		t.Error("expected contact_info in mutual match")
	}

	// profile-level match endpoint
	req2 := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/matches", nil)
	req2.AddCookie(tCookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	profileMatches := decodeItems(t, w2)
	if len(profileMatches) != 1 {
		t.Errorf("expected 1 profile match, got %d", len(profileMatches))
	}
}

func TestMatches_Incoming_NoContactInfo(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "mx-ll2@example.com", "landlord")
	tenantID := seedUser(t, "mx-t2@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// landlord expresses interest first
	lCookie := validAccessCookie(t, landlordID, "mx-ll2@example.com", []string{"landlord"})
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	// tenant checks incoming
	tCookie := validAccessCookie(t, tenantID, "mx-t2@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/matches/incoming", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	incoming := decodeItems(t, w)
	if len(incoming) != 1 {
		t.Fatalf("expected 1 incoming, got %d", len(incoming))
	}
	if _, ok := incoming[0]["contact_info"]; ok {
		t.Error("contact_info must not appear in incoming")
	}
	// profile-level check
	req2 := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/interests/incoming", nil)
	req2.AddCookie(tCookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	profileIncoming := decodeItems(t, w2)
	if len(profileIncoming) != 1 {
		t.Errorf("expected 1 profile incoming, got %d", len(profileIncoming))
	}
}

func TestMatches_Outgoing_NoContactInfo(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "mx-ll3@example.com", "landlord")
	tenantID := seedUser(t, "mx-t3@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// tenant expresses interest first
	tCookie := validAccessCookie(t, tenantID, "mx-t3@example.com", []string{"tenant"})
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)

	req := httptest.NewRequest("GET", "/api/v1/matches/outgoing", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	outgoing := decodeItems(t, w)
	if len(outgoing) != 1 {
		t.Fatalf("expected 1 outgoing, got %d", len(outgoing))
	}
	if _, ok := outgoing[0]["contact_info"]; ok {
		t.Error("contact_info must not appear in outgoing")
	}
}

func TestMatches_MutualHiddenAfterBlock(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "mx-ll4@example.com", "landlord")
	tenantID := seedUser(t, "mx-t4@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "mx-t4@example.com", []string{"tenant"})
	lCookie := validAccessCookie(t, landlordID, "mx-ll4@example.com", []string{"landlord"})

	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	// block after match
	testPool.Exec(t.Context(),
		`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, tenantID, landlordID)

	req := httptest.NewRequest("GET", "/api/v1/matches/mutual", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	matches := decodeItems(t, w)
	if len(matches) != 0 {
		t.Errorf("blocked match should be hidden, got %d matches", len(matches))
	}
}

func TestMatches_IncomingMovesToMutual(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "mx-ll5@example.com", "landlord")
	tenantID := seedUser(t, "mx-t5@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	lCookie := validAccessCookie(t, landlordID, "mx-ll5@example.com", []string{"landlord"})
	tCookie := validAccessCookie(t, tenantID, "mx-t5@example.com", []string{"tenant"})

	// landlord sends interest
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	// verify tenant sees it as incoming
	req := httptest.NewRequest("GET", "/api/v1/matches/incoming", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	incoming := decodeItems(t, w)
	if len(incoming) != 1 {
		t.Fatalf("expected 1 incoming before tenant responds, got %d", len(incoming))
	}

	// tenant responds → match
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)

	// now incoming should be empty, mutual should have 1
	req2 := httptest.NewRequest("GET", "/api/v1/matches/incoming", nil)
	req2.AddCookie(tCookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	incoming2 := decodeItems(t, w2)
	if len(incoming2) != 0 {
		t.Errorf("after match, incoming should be empty, got %d", len(incoming2))
	}

	req3 := httptest.NewRequest("GET", "/api/v1/matches/mutual", nil)
	req3.AddCookie(tCookie)
	w3 := httptest.NewRecorder()
	testR.ServeHTTP(w3, req3)
	mutual := decodeItems(t, w3)
	if len(mutual) != 1 {
		t.Errorf("expected 1 mutual after match, got %d", len(mutual))
	}
}
