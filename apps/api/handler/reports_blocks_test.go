package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---- reports ----

func TestReport_Create(t *testing.T) {
	truncate(t)
	reporterID := seedUser(t, "rp-reporter@example.com", "tenant")
	reportedID := seedUser(t, "rp-reported@example.com", "landlord")
	cookie := validAccessCookie(t, reporterID, "rp-reporter@example.com", []string{"tenant"})

	w := postJSON(t, "/api/v1/reports", map[string]any{
		"reported_id": reportedID,
		"reason":      "spam listing",
	}, cookie)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["id"] == nil {
		t.Error("expected report id in response")
	}
}

func TestReport_SelfReport_Rejected(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "rp-self@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "rp-self@example.com", []string{"tenant"})

	w := postJSON(t, "/api/v1/reports", map[string]any{
		"reported_id": userID,
		"reason":      "test",
	}, cookie)
	if w.Code != http.StatusBadRequest {
		t.Errorf("self-report: expected 400, got %d", w.Code)
	}
}

// ---- blocks ----

func TestBlock_BlockAndUnblock(t *testing.T) {
	truncate(t)
	userA := seedUser(t, "bl-a@example.com", "tenant")
	userB := seedUser(t, "bl-b@example.com", "landlord")
	cookie := validAccessCookie(t, userA, "bl-a@example.com", []string{"tenant"})

	// block
	req := httptest.NewRequest("POST", "/api/v1/blocks/"+userB, nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("block: expected 204, got %d: %s", w.Code, w.Body.String())
	}

	// verify block in DB
	var exists bool
	testPool.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM blocks WHERE blocker_id=$1 AND blocked_id=$2 AND deleted_at IS NULL)`,
		userA, userB,
	).Scan(&exists)
	if !exists {
		t.Error("block row not found in DB")
	}

	// unblock
	req2 := httptest.NewRequest("DELETE", "/api/v1/blocks/"+userB, nil)
	req2.AddCookie(cookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	if w2.Code != http.StatusNoContent {
		t.Fatalf("unblock: expected 204, got %d: %s", w2.Code, w2.Body.String())
	}

	// block should be soft-deleted
	testPool.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM blocks WHERE blocker_id=$1 AND blocked_id=$2 AND deleted_at IS NULL)`,
		userA, userB,
	).Scan(&exists)
	if exists {
		t.Error("block should be removed after unblock")
	}
}

func TestBlock_SelfBlock_Rejected(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "bl-self@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "bl-self@example.com", []string{"tenant"})

	req := httptest.NewRequest("POST", "/api/v1/blocks/"+userID, nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("self-block: expected 400, got %d", w.Code)
	}
}

func TestBlock_IdempotentBlock(t *testing.T) {
	truncate(t)
	userA := seedUser(t, "bl-idem-a@example.com", "tenant")
	userB := seedUser(t, "bl-idem-b@example.com", "landlord")
	cookie := validAccessCookie(t, userA, "bl-idem-a@example.com", []string{"tenant"})

	// block twice
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("POST", "/api/v1/blocks/"+userB, nil)
		req.AddCookie(cookie)
		w := httptest.NewRecorder()
		testR.ServeHTTP(w, req)
		if w.Code != http.StatusNoContent {
			t.Errorf("block attempt %d: expected 204, got %d", i+1, w.Code)
		}
	}

	// still only one row
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM blocks WHERE blocker_id=$1 AND blocked_id=$2 AND deleted_at IS NULL`,
		userA, userB,
	).Scan(&count)
	if count != 1 {
		t.Errorf("expected 1 block row after double-block, got %d", count)
	}
}

func TestBlock_ExcludesFromMatchingList(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "bl-ll@example.com", "landlord")
	tenantID := seedUser(t, "bl-t@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	tCookie := validAccessCookie(t, tenantID, "bl-t@example.com", []string{"tenant"})

	// before block: listing appears
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp["items"].([]any)) != 1 {
		t.Fatalf("expected 1 listing before block, got %d", len(resp["items"].([]any)))
	}

	// block landlord
	req2 := httptest.NewRequest("POST", "/api/v1/blocks/"+landlordID, nil)
	req2.AddCookie(tCookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	if w2.Code != http.StatusNoContent {
		t.Fatalf("block: %d %s", w2.Code, w2.Body.String())
	}

	// after block: listing disappears
	req3 := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req3.AddCookie(tCookie)
	w3 := httptest.NewRecorder()
	testR.ServeHTTP(w3, req3)
	var resp3 map[string]any
	json.NewDecoder(w3.Body).Decode(&resp3)
	if len(resp3["items"].([]any)) != 0 {
		t.Errorf("expected 0 listings after block, got %d", len(resp3["items"].([]any)))
	}
}
