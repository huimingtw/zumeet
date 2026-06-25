package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

// ---- POST /api/v1/account/roles (removed — role switching disabled) ----

func TestAddRole_RouteRemoved(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "addrole@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "addrole@example.com", []string{"tenant"})

	w := postJSON(t, "/api/v1/account/roles", map[string]any{"role": "landlord"}, cookie)
	if w.Code != http.StatusNotFound {
		t.Fatalf("role switch must be disabled: expected 404, got %d", w.Code)
	}
}

// ---- GET /api/v1/profile/me (GetMe) ----

func TestGetMe_ReturnsIdentityAndRoles(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "me@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "me@example.com", []string{"tenant"})

	req := httptest.NewRequest("GET", "/api/v1/profile/me", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /profile/me: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		ID        string   `json:"id"`
		Email     string   `json:"email"`
		Roles     []string `json:"roles"`
		CreatedAt string   `json:"created_at"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.ID != userID {
		t.Errorf("id: expected %s, got %s", userID, resp.ID)
	}
	if resp.Email != "me@example.com" {
		t.Errorf("email: expected me@example.com, got %s", resp.Email)
	}
	if !slices.Contains(resp.Roles, "tenant") {
		t.Errorf("roles: expected tenant, got %v", resp.Roles)
	}
	if resp.CreatedAt == "" {
		t.Error("created_at should be populated")
	}
}
