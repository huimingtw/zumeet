package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// seedTenantProfile inserts a tenant_profile with one location (台北市/大安區).
// Returns the profile ID.
func seedTenantProfile(t *testing.T, tenantID, name string, isActive bool) string {
	t.Helper()
	w := postJSON(t, "/api/v1/tenant-profiles", map[string]any{
		"name":                 name,
		"budget_min":           10000,
		"budget_max":           25000,
		"locations":            []map[string]any{{"city": "台北市", "district": "大安區"}},
		"preferred_room_types": []string{"suite"},
		"available_from":       time.Now().UTC().Format(time.RFC3339),
		"min_lease_months":     6,
		"has_pets":             false,
		"needs_subsidy":        false,
		"needs_tax_receipt":    false,
		"smoking":              false,
		"contact_info":         "line:test123",
		"is_active":            isActive,
	}, validAccessCookie(t, tenantID, "t@t.com", []string{"tenant"}))

	if w.Code != http.StatusCreated {
		t.Fatalf("seed profile %q failed: %d %s", name, w.Code, w.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	return resp["id"].(string)
}

// ---- tests ----

func TestTenantProfile_CreateAndList(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-list@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-list@example.com", []string{"tenant"})

	// Create one profile
	w := postJSON(t, "/api/v1/tenant-profiles", map[string]any{
		"name":                 "台北套房",
		"budget_min":           15000,
		"budget_max":           25000,
		"locations":            []map[string]any{{"city": "台北市", "district": "大安區"}, {"city": "台北市", "district": "中山區"}},
		"preferred_room_types": []string{"suite"},
		"available_from":       time.Now().UTC().Format(time.RFC3339),
		"min_lease_months":     6,
		"has_pets":             false,
		"needs_subsidy":        false,
		"needs_tax_receipt":    false,
		"smoking":              false,
		"contact_info":         "line:abc123",
		"is_active":            true,
	}, cookie)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var created map[string]any
	json.NewDecoder(w.Body).Decode(&created)
	if created["name"] != "台北套房" {
		t.Errorf("unexpected name: %v", created["name"])
	}
	// contact_info must NOT be in response
	if _, ok := created["contact_info"]; ok {
		t.Error("contact_info must not appear in profile response")
	}

	// List
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles", nil)
	req.AddCookie(cookie)
	wl := httptest.NewRecorder()
	testR.ServeHTTP(wl, req)
	if wl.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", wl.Code)
	}
	var list []map[string]any
	json.NewDecoder(wl.Body).Decode(&list)
	if len(list) != 1 {
		t.Errorf("expected 1 profile, got %d", len(list))
	}
}

func TestTenantProfile_ListAndGetHandlesNullableOptionalText(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-nullable@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-nullable@example.com", []string{"tenant"})
	profileID := "01TESTNULLPROFILE000000000"

	_, err := testPool.Exec(context.Background(),
		`INSERT INTO tenant_profiles (
			id, tenant_id, name, budget_min, budget_max, preferred_room_types,
			available_from, min_lease_months, has_pets, needs_subsidy,
			needs_tax_receipt, smoking, contact_info
		) VALUES (
			$1, $2, 'Nullable Optional Text', 10000, 20000,
			ARRAY['suite']::room_type[], NOW(), 6, false, false,
			false, false, 'line:null'
		)`,
		profileID, userID,
	)
	if err != nil {
		t.Fatalf("insert nullable profile: %v", err)
	}
	_, err = testPool.Exec(context.Background(),
		`INSERT INTO tenant_profile_locations (tenant_profile_id, location_id)
		 VALUES ($1, '01-0102')`,
		profileID,
	)
	if err != nil {
		t.Fatalf("insert profile location: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("list nullable profile: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var list []map[string]any
	if err := json.NewDecoder(w.Body).Decode(&list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if list[0]["pet_description"] != "" || list[0]["occupation"] != "" {
		t.Fatalf("expected nullable text fields to be empty strings, got %#v", list[0])
	}

	req = httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID, nil)
	req.AddCookie(cookie)
	w = httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("get nullable profile: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got map[string]any
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decode get: %v", err)
	}
	if got["pet_description"] != "" || got["occupation"] != "" {
		t.Fatalf("expected nullable text fields to be empty strings, got %#v", got)
	}
}

func TestTenantProfile_MaxThreeProfiles(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-max@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-max@example.com", []string{"tenant"})

	body := func(n int) map[string]any {
		return map[string]any{
			"name":       fmt.Sprintf("Profile %d", n),
			"budget_min": 10000, "budget_max": 20000,
			"locations":            []map[string]any{{"city": "台北市", "district": "大安區"}},
			"preferred_room_types": []string{"suite"},
			"available_from":       time.Now().UTC().Format(time.RFC3339),
			"min_lease_months":     3,
			"has_pets":             false, "needs_subsidy": false,
			"needs_tax_receipt": false, "smoking": false,
			"contact_info": "tel:0900000000", "is_active": true,
		}
	}

	for i := 1; i <= 3; i++ {
		w := postJSON(t, "/api/v1/tenant-profiles", body(i), cookie)
		if w.Code != http.StatusCreated {
			t.Fatalf("profile %d: expected 201, got %d", i, w.Code)
		}
	}

	// 4th profile must be rejected
	w := postJSON(t, "/api/v1/tenant-profiles", body(4), cookie)
	if w.Code != http.StatusBadRequest {
		t.Errorf("4th profile: expected 400, got %d", w.Code)
	}
}

func TestTenantProfile_OwnershipCheck(t *testing.T) {
	truncate(t)
	owner := seedUser(t, "tp-owner@example.com", "tenant")
	other := seedUser(t, "tp-other@example.com", "tenant")
	ownerCookie := validAccessCookie(t, owner, "tp-owner@example.com", []string{"tenant"})
	otherCookie := validAccessCookie(t, other, "tp-other@example.com", []string{"tenant"})

	profileID := seedTenantProfile(t, owner, "Owner Profile", true)

	// Other user cannot GET
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID, nil)
	req.AddCookie(otherCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound && w.Code != http.StatusForbidden {
		t.Errorf("other user GET: expected 403/404, got %d", w.Code)
	}

	// Other user cannot DELETE
	req2 := httptest.NewRequest("DELETE", "/api/v1/tenant-profiles/"+profileID, nil)
	req2.AddCookie(otherCookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	if w2.Code != http.StatusForbidden && w2.Code != http.StatusNotFound {
		t.Errorf("other user DELETE: expected 403/404, got %d", w2.Code)
	}

	// Owner can GET
	req3 := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID, nil)
	req3.AddCookie(ownerCookie)
	w3 := httptest.NewRecorder()
	testR.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Errorf("owner GET: expected 200, got %d", w3.Code)
	}
}

func TestTenantProfile_BudgetValidation(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-budget@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-budget@example.com", []string{"tenant"})

	w := postJSON(t, "/api/v1/tenant-profiles", map[string]any{
		"name":       "Bad Budget",
		"budget_min": 30000, "budget_max": 10000, // min > max
		"locations":            []map[string]any{{"city": "台北市", "district": "大安區"}},
		"preferred_room_types": []string{"suite"},
		"available_from":       time.Now().UTC().Format(time.RFC3339),
		"min_lease_months":     3,
		"has_pets":             false, "needs_subsidy": false,
		"needs_tax_receipt": false, "smoking": false,
		"contact_info": "tel:0900000000", "is_active": true,
	}, cookie)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for budget_min > budget_max, got %d", w.Code)
	}
}

func TestTenantProfile_StatusToggle(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-status@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-status@example.com", []string{"tenant"})
	profileID := seedTenantProfile(t, userID, "Status Test", true)

	w := patchJSON(t, "/api/v1/tenant-profiles/"+profileID+"/status", map[string]any{
		"is_active": false,
	}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("toggle: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var isActive bool
	testPool.QueryRow(context.Background(),
		`SELECT is_active FROM tenant_profiles WHERE id=$1`, profileID,
	).Scan(&isActive)
	if isActive {
		t.Error("expected profile to be inactive after toggle")
	}
}

func TestTenantProfile_Delete_CascadesLocations(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-del@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-del@example.com", []string{"tenant"})
	profileID := seedTenantProfile(t, userID, "To Delete", true)

	req := httptest.NewRequest("DELETE", "/api/v1/tenant-profiles/"+profileID, nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", w.Code)
	}

	// Profile should be gone from list
	req2 := httptest.NewRequest("GET", "/api/v1/tenant-profiles", nil)
	req2.AddCookie(cookie)
	w2 := httptest.NewRecorder()
	testR.ServeHTTP(w2, req2)
	var list []any
	json.NewDecoder(w2.Body).Decode(&list)
	if len(list) != 0 {
		t.Errorf("expected 0 profiles after delete, got %d", len(list))
	}
}

func TestTenantProfile_LandlordCannotCreate(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-landlord@example.com", "landlord")
	cookie := validAccessCookie(t, userID, "tp-landlord@example.com", []string{"landlord"})

	w := postJSON(t, "/api/v1/tenant-profiles", map[string]any{
		"name": "X", "budget_min": 1, "budget_max": 2,
		"locations": []map[string]any{{"city": "台北市", "district": "大安區"}}, "preferred_room_types": []string{"suite"},
		"available_from": time.Now().UTC().Format(time.RFC3339), "min_lease_months": 1,
		"has_pets": false, "needs_subsidy": false, "needs_tax_receipt": false, "smoking": false,
		"contact_info": "x", "is_active": true,
	}, cookie)
	if w.Code != http.StatusForbidden {
		t.Errorf("landlord creating tenant profile: expected 403, got %d", w.Code)
	}
}

func TestTenantProfile_ContactInfoNotExposed(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "tp-ci@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "tp-ci@example.com", []string{"tenant"})
	profileID := seedTenantProfile(t, userID, "CI Test", true)

	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID, nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if _, ok := resp["contact_info"]; ok {
		t.Error("contact_info must not appear in GET /tenant-profiles/:id response")
	}
}
