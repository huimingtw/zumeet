package handler_test

import (
	"encoding/json"
	"net/http"
	"sync"
	"testing"
)

func TestInterest_TenantPending(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll1@example.com", "landlord")
	tenantID := seedUser(t, "int-t1@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "int-t1@example.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "pending" {
		t.Errorf("expected status=pending, got %v", resp["status"])
	}
	if _, ok := resp["contact_info"]; ok {
		t.Error("contact_info must not appear in pending response")
	}
}

func TestInterest_LandlordPending(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll2@example.com", "landlord")
	tenantID := seedUser(t, "int-t2@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	lCookie := validAccessCookie(t, landlordID, "int-ll2@example.com", []string{"landlord"})
	w := postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "pending" {
		t.Errorf("expected status=pending, got %v", resp["status"])
	}
}

func TestInterest_TenantFirstThenLandlord_Matched(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll3@example.com", "landlord")
	tenantID := seedUser(t, "int-t3@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// tenant first
	tCookie := validAccessCookie(t, tenantID, "int-t3@example.com", []string{"tenant"})
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)

	// landlord responds
	lCookie := validAccessCookie(t, landlordID, "int-ll3@example.com", []string{"landlord"})
	w := postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "matched" {
		t.Errorf("expected status=matched, got %v", resp["status"])
	}
	// landlord sees tenant contact info
	if resp["contact_info"] == nil || resp["contact_info"] == "" {
		t.Error("expected contact_info in matched response for landlord")
	}
}

func TestInterest_LandlordFirstThenTenant_Matched(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll4@example.com", "landlord")
	tenantID := seedUser(t, "int-t4@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// landlord first
	lCookie := validAccessCookie(t, landlordID, "int-ll4@example.com", []string{"landlord"})
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	// tenant responds
	tCookie := validAccessCookie(t, tenantID, "int-t4@example.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "matched" {
		t.Errorf("expected status=matched, got %v", resp["status"])
	}
	// tenant sees landlord contact info
	if resp["contact_info"] == nil || resp["contact_info"] == "" {
		t.Error("expected contact_info in matched response for tenant")
	}
}

func TestInterest_Concurrent_ExactlyOneMatch(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll5@example.com", "landlord")
	tenantID := seedUser(t, "int-t5@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "int-t5@example.com", []string{"tenant"})
	lCookie := validAccessCookie(t, landlordID, "int-ll5@example.com", []string{"landlord"})

	var wg sync.WaitGroup
	results := make([]map[string]any, 2)

	wg.Add(2)
	go func() {
		defer wg.Done()
		w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
		json.NewDecoder(w.Body).Decode(&results[0])
	}()
	go func() {
		defer wg.Done()
		w := postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)
		json.NewDecoder(w.Body).Decode(&results[1])
	}()
	wg.Wait()

	matchCount := 0
	for _, r := range results {
		if r["status"] == "matched" {
			matchCount++
		}
	}
	// At least one side must see "matched"; both may see it depending on timing.
	// Most importantly, exactly one match row must exist in DB.
	if matchCount == 0 {
		t.Error("expected at least one matched result from concurrent interest")
	}

	var dbMatchCount int
	testPool.QueryRow(t.Context(),
		`SELECT COUNT(*) FROM matches WHERE tenant_profile_id=$1 AND listing_id=$2`,
		profileID, listingID,
	).Scan(&dbMatchCount)
	if dbMatchCount != 1 {
		t.Errorf("expected exactly 1 match row, got %d", dbMatchCount)
	}
}

func TestInterest_WrongOwner_Rejected(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll6@example.com", "landlord")
	tenantID := seedUser(t, "int-t6@example.com", "tenant")
	otherTenantID := seedUser(t, "int-ot6@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// other tenant tries to express interest using tenantID's profile
	otherCookie := validAccessCookie(t, otherTenantID, "int-ot6@example.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, otherCookie)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInterest_BlockedPair_Rejected(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll7@example.com", "landlord")
	tenantID := seedUser(t, "int-t7@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// tenant blocks landlord (direct DB insert; blocks API is Stage 12)
	testPool.Exec(t.Context(),
		`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, tenantID, landlordID)

	tCookie := validAccessCookie(t, tenantID, "int-t7@example.com", []string{"tenant"})
	w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusForbidden {
		t.Errorf("blocked pair interest: expected 403, got %d", w.Code)
	}
}

func TestWithdraw_Tenant_PreventsMatch(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "wd-ll1@example.com", "landlord")
	tenantID := seedUser(t, "wd-t1@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "wd-t1@example.com", []string{"tenant"})
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)

	// tenant withdraws before landlord reciprocates
	w := deleteJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusOK {
		t.Fatalf("withdraw: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var status string
	testPool.QueryRow(t.Context(),
		`SELECT status FROM interests WHERE tenant_profile_id=$1 AND listing_id=$2 AND actor_role='tenant'`,
		profileID, listingID,
	).Scan(&status)
	if status != "withdrawn" {
		t.Errorf("expected status=withdrawn, got %q", status)
	}

	// landlord now expresses interest — must NOT match, since tenant withdrew
	lCookie := validAccessCookie(t, landlordID, "wd-ll1@example.com", []string{"landlord"})
	lw := postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)
	var resp map[string]any
	json.NewDecoder(lw.Body).Decode(&resp)
	if resp["status"] != "pending" {
		t.Errorf("expected pending after counterpart withdrew, got %v", resp["status"])
	}
}

func TestWithdraw_AfterMatch_Conflict(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "wd-ll2@example.com", "landlord")
	tenantID := seedUser(t, "wd-t2@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "wd-t2@example.com", []string{"tenant"})
	lCookie := validAccessCookie(t, landlordID, "wd-ll2@example.com", []string{"landlord"})
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	w := deleteJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusConflict {
		t.Errorf("withdraw after match: expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestWithdraw_WrongOwner_Rejected(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "wd-ll3@example.com", "landlord")
	tenantID := seedUser(t, "wd-t3@example.com", "tenant")
	otherTenantID := seedUser(t, "wd-ot3@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	otherCookie := validAccessCookie(t, otherTenantID, "wd-ot3@example.com", []string{"tenant"})
	w := deleteJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, otherCookie)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestWithdraw_Idempotent(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "wd-ll4@example.com", "landlord")
	tenantID := seedUser(t, "wd-t4@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "wd-t4@example.com", []string{"tenant"})
	// withdraw without ever expressing interest — no-op, still 200
	w := deleteJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusOK {
		t.Errorf("withdraw with no interest: expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInterest_IdempotentRe_Expression(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "int-ll8@example.com", "landlord")
	tenantID := seedUser(t, "int-t8@example.com", "tenant")

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "int-t8@example.com", []string{"tenant"})
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	// Express interest again — should be idempotent
	w := postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	if w.Code != http.StatusOK {
		t.Errorf("re-expression: expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
