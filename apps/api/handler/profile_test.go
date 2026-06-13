package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

// ---- POST /api/v1/account/roles (AddRole) ----

func TestAddRole_AddsSecondRole(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "addrole@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "addrole@example.com", []string{"tenant"})

	w := postJSON(t, "/api/v1/account/roles", map[string]any{"role": "landlord"}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("add role: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Roles []string `json:"roles"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !slices.Contains(resp.Roles, "tenant") || !slices.Contains(resp.Roles, "landlord") {
		t.Errorf("expected both tenant and landlord, got %v", resp.Roles)
	}

	var count int
	testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM user_roles WHERE user_id=$1`, userID,
	).Scan(&count)
	if count != 2 {
		t.Errorf("expected 2 user_roles rows, got %d", count)
	}
}

func TestAddRole_InvalidRole_Rejected(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "addrole-bad@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "addrole-bad@example.com", []string{"tenant"})

	// "admin" is not a valid product role — must not be assignable via this endpoint.
	w := postJSON(t, "/api/v1/account/roles", map[string]any{"role": "admin"}, cookie)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid role: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	var count int
	testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM user_roles WHERE user_id=$1`, userID,
	).Scan(&count)
	if count != 1 {
		t.Errorf("invalid role must not be inserted; got %d rows", count)
	}
}

func TestAddRole_MissingRole_Rejected(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "addrole-missing@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "addrole-missing@example.com", []string{"tenant"})

	w := postJSON(t, "/api/v1/account/roles", map[string]any{}, cookie)
	if w.Code != http.StatusBadRequest {
		t.Errorf("missing role: expected 400, got %d", w.Code)
	}
}

func TestAddRole_Idempotent(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "addrole-idem@example.com", "tenant")
	cookie := validAccessCookie(t, userID, "addrole-idem@example.com", []string{"tenant"})

	w1 := postJSON(t, "/api/v1/account/roles", map[string]any{"role": "tenant"}, cookie)
	w2 := postJSON(t, "/api/v1/account/roles", map[string]any{"role": "tenant"}, cookie)
	if w1.Code != http.StatusOK || w2.Code != http.StatusOK {
		t.Fatalf("expected 200/200, got %d/%d", w1.Code, w2.Code)
	}

	var count int
	testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM user_roles WHERE user_id=$1 AND role='tenant'`, userID,
	).Scan(&count)
	if count != 1 {
		t.Errorf("ON CONFLICT DO NOTHING should keep a single row, got %d", count)
	}
}

func TestAddRole_Unauthenticated(t *testing.T) {
	truncate(t)
	w := postJSON(t, "/api/v1/account/roles", map[string]any{"role": "landlord"})
	if w.Code != http.StatusUnauthorized {
		t.Errorf("no cookie: expected 401, got %d", w.Code)
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
