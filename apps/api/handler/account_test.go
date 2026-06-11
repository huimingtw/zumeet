package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAccount_Delete_SoftDeletesAll(t *testing.T) {
	truncate(t)
	tenantID := seedUser(t, "del-t@example.com", "tenant")
	landlordID := seedUser(t, "del-ll@example.com", "landlord")

	// create data for tenant
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)

	tCookie := validAccessCookie(t, tenantID, "del-t@example.com", []string{"tenant"})
	lCookie := validAccessCookie(t, landlordID, "del-ll@example.com", []string{"landlord"})

	// create a match
	postJSON(t, "/api/v1/tenant-profiles/"+profileID+"/listings/"+listingID+"/interest", nil, tCookie)
	postJSON(t, "/api/v1/listings/"+listingID+"/tenant-profiles/"+profileID+"/interest", nil, lCookie)

	// delete tenant account
	req := httptest.NewRequest("DELETE", "/api/v1/account", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete account: expected 204, got %d: %s", w.Code, w.Body.String())
	}

	// user deleted
	var deletedAt *string
	testPool.QueryRow(context.Background(),
		`SELECT deleted_at::text FROM users WHERE id=$1`, tenantID,
	).Scan(&deletedAt)
	if deletedAt == nil {
		t.Error("user.deleted_at should be set after account deletion")
	}

	// profile deleted
	var profileDeletedAt *string
	testPool.QueryRow(context.Background(),
		`SELECT deleted_at::text FROM tenant_profiles WHERE id=$1`, profileID,
	).Scan(&profileDeletedAt)
	if profileDeletedAt == nil {
		t.Error("tenant_profile.deleted_at should be set after account deletion")
	}

	// match deleted
	var matchDeletedAt *string
	testPool.QueryRow(context.Background(),
		`SELECT deleted_at::text FROM matches WHERE tenant_profile_id=$1`, profileID,
	).Scan(&matchDeletedAt)
	if matchDeletedAt == nil {
		t.Error("match.deleted_at should be set after account deletion")
	}

	// all protected endpoints now return 401
	req2 := httptest.NewRequest("GET", "/api/v1/profile/me", nil)
	req2.AddCookie(tCookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("deleted user GET /profile/me: expected 401, got %d", w2.Code)
	}
}

func TestAccount_Delete_LandlordCleansListings(t *testing.T) {
	truncate(t)
	landlordID := seedUser(t, "del-ll2@example.com", "landlord")
	lCookie := validAccessCookie(t, landlordID, "del-ll2@example.com", []string{"landlord"})

	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)

	req := httptest.NewRequest("DELETE", "/api/v1/account", nil)
	req.AddCookie(lCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete account: expected 204, got %d", w.Code)
	}

	var deletedAt *string
	testPool.QueryRow(context.Background(),
		`SELECT deleted_at::text FROM listings WHERE id=$1`, listingID,
	).Scan(&deletedAt)
	if deletedAt == nil {
		t.Error("listing.deleted_at should be set after landlord account deletion")
	}
}

func TestAccount_Delete_ReportsPreserved(t *testing.T) {
	truncate(t)
	reporterID := seedUser(t, "del-reporter@example.com", "tenant")
	reportedID := seedUser(t, "del-reported@example.com", "landlord")
	cookie := validAccessCookie(t, reporterID, "del-reporter@example.com", []string{"tenant"})

	// reporter files a report
	postJSON(t, "/api/v1/reports", map[string]any{
		"reported_id": reportedID,
		"reason":      "suspicious",
	}, cookie)

	// reporter deletes account
	req := httptest.NewRequest("DELETE", "/api/v1/account", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", w.Code)
	}

	// report still exists (for audit)
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM reports WHERE reporter_id=$1`, reporterID,
	).Scan(&count)
	if count == 0 {
		t.Error("reports should be preserved after account deletion")
	}
}
