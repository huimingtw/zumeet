package handler_test

import (
	"net/http"
	"testing"
	"time"
)

// TestListing_Create_Httpexpect demonstrates the httpexpect + Binder style.
// Functionally equivalent to TestListing_Create in listings_test.go.
func TestListing_Create_Httpexpect(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "e-ls@example.com", "landlord")
	cookie := validAccessCookie(t, userID, "e-ls@example.com", []string{"landlord"})

	e := newExpectWithCookie(t, cookie)
	obj := e.POST("/api/v1/listings").
		WithJSON(map[string]any{
			"city":                 "台北市",
			"district":             "大安區",
			"rent":                 25000,
			"room_type":            "suite",
			"area_ping":            12.5,
			"available_from":       time.Now().UTC().Format(time.RFC3339),
			"min_lease_months":     6,
			"allow_pets":           true,
			"allow_subsidy":        false,
			"allow_tax_receipt":    true,
			"allow_smoking":        false,
			"contact_info":         "line:test",
			"compliance_confirmed": true,
		}).
		Expect().
		Status(http.StatusCreated).
		JSON().Object()

	obj.Value("status").String().IsEqual("draft")
	obj.Value("room_type").String().IsEqual("suite")
	obj.NotContainsKey("contact_info")
}

// TestTenantProfile_Create_Httpexpect demonstrates httpexpect for tenant profile creation.
func TestTenantProfile_Create_Httpexpect(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "e-tp@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "e-tp@example.com", []string{"tenant"})

	e := newExpectWithCookie(t, cookie)
	obj := e.POST("/api/v1/tenant-profiles").
		WithJSON(map[string]any{
			"name":                          "測試需求卡",
			"budget_min":                    10000,
			"budget_max":                    25000,
			"locations":              []map[string]any{{"city": "台北市", "district": "大安區"}},
			"preferred_room_types":    []string{"suite"},
			"available_from":          time.Now().UTC().Format(time.RFC3339),
			"min_lease_months":        6,
			"has_pets":                false,
			"needs_subsidy":           false,
			"needs_tax_receipt":       false,
			"smoking":                 false,
			"contact_info":            "Line: httpexpect-test",
			"is_active":               true,
		}).
		Expect().
		Status(http.StatusCreated).
		JSON().Object()

	obj.Value("name").String().IsEqual("測試需求卡")
	obj.Value("is_active").Boolean().IsTrue()
	obj.NotContainsKey("contact_info")
}
