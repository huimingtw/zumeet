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

// ---- PUT /api/v1/profile/me (UpdateMe) sets user-level contact_info ----

func TestUpdateMe_SetsContactInfo(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "upd@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "upd@example.com", []string{"tenant"})

	w := jsonRequest(t, "PUT", "/api/v1/profile/me",
		map[string]any{"name": "  New Name  ", "contact_info": "  line:upd123  "}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("PUT /profile/me: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Echoed back trimmed.
	var put struct {
		Name        string `json:"name"`
		ContactInfo string `json:"contact_info"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &put); err != nil {
		t.Fatalf("decode put: %v", err)
	}
	if put.Name != "New Name" {
		t.Errorf("name should be trimmed: got %q", put.Name)
	}
	if put.ContactInfo != "line:upd123" {
		t.Errorf("contact_info should be trimmed: got %q", put.ContactInfo)
	}

	// GET /profile/me reflects the stored values.
	req := httptest.NewRequest("GET", "/api/v1/profile/me", nil)
	req.AddCookie(cookie)
	g := httptest.NewRecorder()
	testR.ServeHTTP(g, req)
	var me struct {
		Name        string `json:"name"`
		ContactInfo string `json:"contact_info"`
	}
	if err := json.Unmarshal(g.Body.Bytes(), &me); err != nil {
		t.Fatalf("decode get: %v", err)
	}
	if me.Name != "New Name" {
		t.Errorf("GET /profile/me name: got %q, want New Name", me.Name)
	}
	if me.ContactInfo != "line:upd123" {
		t.Errorf("GET /profile/me contact_info: got %q, want line:upd123", me.ContactInfo)
	}
}
