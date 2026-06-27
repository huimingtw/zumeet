package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/handler"
)

// registerMockOAuth seeds a test OAuth user and returns the code.
func registerMockOAuth(t *testing.T, sub, email, name string) string {
	t.Helper()
	code := "tc-" + ulid.Make().String()
	handler.RegisterTestOAuthUser(code, sub, email, name)
	return code
}

func jsonRequest(t *testing.T, method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	return w
}

func postJSON(t *testing.T, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	return jsonRequest(t, "POST", path, body, cookies...)
}

func patchJSON(t *testing.T, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	return jsonRequest(t, "PATCH", path, body, cookies...)
}

func deleteJSON(t *testing.T, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	return jsonRequest(t, "DELETE", path, body, cookies...)
}

// callbackState hits /api/v1/auth/google/callback and returns the "state" query param
// from the redirect URL (i.e. the signed onboarding state).
func callbackState(t *testing.T, code string) string {
	t.Helper()
	req := httptest.NewRequest("GET", "/api/v1/auth/google/callback?code="+code, nil)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusFound {
		t.Fatalf("callback: expected 302, got %d: %s", w.Code, w.Body.String())
	}
	loc := w.Header().Get("Location")
	u, err := url.Parse(loc)
	if err != nil {
		t.Fatalf("parse location %q: %v", loc, err)
	}
	return u.Query().Get("state")
}

func hasCookie(w *httptest.ResponseRecorder, name string) bool {
	for _, c := range w.Result().Cookies() {
		if c.Name == name {
			return true
		}
	}
	return false
}

// ---- tests ----

func TestOAuth_NewUser_OnboardingFlow(t *testing.T) {
	truncate(t)

	code := registerMockOAuth(t, "sub-new-001", "newuser@example.com", "New")
	state := callbackState(t, code)
	if state == "" {
		t.Fatal("expected onboarding state in redirect")
	}

	w := postJSON(t, "/api/v1/auth/onboarding", map[string]any{
		"role": "tenant", "accepted_tos": true, "oauth_state": state,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("onboarding: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify all three rows created atomically
	var users, roles, identities int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM users WHERE email='newuser@example.com' AND deleted_at IS NULL`,
	).Scan(&users)
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_roles ur JOIN users u ON u.id=ur.user_id
		 WHERE u.email='newuser@example.com' AND ur.role='tenant' AND ur.deleted_at IS NULL`,
	).Scan(&roles)
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM auth_identities ai JOIN users u ON u.id=ai.user_id
		 WHERE u.email='newuser@example.com' AND ai.provider='google' AND ai.deleted_at IS NULL`,
	).Scan(&identities)

	if users != 1 || roles != 1 || identities != 1 {
		t.Errorf("expected (1,1,1) rows, got users=%d roles=%d identities=%d", users, roles, identities)
	}
	if !hasCookie(w, "zumeet_access") {
		t.Error("expected access token cookie after onboarding")
	}
}

func TestOAuth_ExistingGoogleUser_DirectLogin(t *testing.T) {
	truncate(t)

	userID := ulid.Make().String()
	testPool.Exec(context.Background(),
		`INSERT INTO users (id, email, is_verified) VALUES ($1, 'existing@example.com', true)`, userID)
	testPool.Exec(context.Background(),
		`INSERT INTO user_roles (user_id, role) VALUES ($1, 'landlord')`, userID)
	testPool.Exec(context.Background(),
		`INSERT INTO auth_identities (id, user_id, provider, provider_uid) VALUES ($1, $2, 'google', 'sub-exist-001')`,
		ulid.Make().String(), userID)

	code := registerMockOAuth(t, "sub-exist-001", "existing@example.com", "Existing")
	req := httptest.NewRequest("GET", "/api/v1/auth/google/callback?code="+code, nil)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", w.Code)
	}
	// Should go to app root, not onboarding
	loc := w.Header().Get("Location")
	if strings.Contains(loc, "onboarding") {
		t.Errorf("existing user should not be redirected to onboarding, got: %s", loc)
	}
	if !hasCookie(w, "zumeet_access") {
		t.Error("expected access token cookie")
	}
}

func TestOAuth_AutoLink_SameEmail(t *testing.T) {
	truncate(t)

	userID := ulid.Make().String()
	testPool.Exec(context.Background(),
		`INSERT INTO users (id, email, is_verified) VALUES ($1, 'link@example.com', true)`, userID)
	testPool.Exec(context.Background(),
		`INSERT INTO user_roles (user_id, role) VALUES ($1, 'tenant')`, userID)

	code := registerMockOAuth(t, "sub-link-001", "link@example.com", "Link")
	req := httptest.NewRequest("GET", "/api/v1/auth/google/callback?code="+code, nil)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", w.Code)
	}
	// Should NOT go to onboarding
	if strings.Contains(w.Header().Get("Location"), "onboarding") {
		t.Error("auto-linked user should not go to onboarding")
	}

	// Google identity linked to existing user
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM auth_identities WHERE user_id=$1 AND provider='google' AND deleted_at IS NULL`, userID,
	).Scan(&count)
	if count != 1 {
		t.Errorf("expected google identity linked, got %d", count)
	}
}

func TestOnboarding_ToSRequired(t *testing.T) {
	truncate(t)
	code := registerMockOAuth(t, "sub-tos-001", "tos@example.com", "ToS")
	state := callbackState(t, code)

	w := postJSON(t, "/api/v1/auth/onboarding", map[string]any{
		"role": "tenant", "accepted_tos": false, "oauth_state": state,
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 without ToS, got %d", w.Code)
	}
}

func TestOnboarding_InvalidState(t *testing.T) {
	truncate(t)
	w := postJSON(t, "/api/v1/auth/onboarding", map[string]any{
		"role": "tenant", "accepted_tos": true, "oauth_state": "invalid.tampered",
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid state, got %d", w.Code)
	}
}

func TestOnboarding_Idempotent_ReplayProtection(t *testing.T) {
	truncate(t)

	code := registerMockOAuth(t, "sub-replay-001", "replay@example.com", "Replay")
	state := callbackState(t, code)

	// First onboarding
	w1 := postJSON(t, "/api/v1/auth/onboarding", map[string]any{
		"role": "tenant", "accepted_tos": true, "oauth_state": state,
	})
	if w1.Code != http.StatusOK {
		t.Fatalf("first onboarding failed: %d %s", w1.Code, w1.Body.String())
	}

	// Second onboarding with same state → should not create duplicate user
	w2 := postJSON(t, "/api/v1/auth/onboarding", map[string]any{
		"role": "tenant", "accepted_tos": true, "oauth_state": state,
	})
	if w2.Code != http.StatusOK {
		t.Fatalf("replay onboarding failed: %d %s", w2.Code, w2.Body.String())
	}

	// Only one user should exist
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM users WHERE email='replay@example.com' AND deleted_at IS NULL`,
	).Scan(&count)
	if count != 1 {
		t.Errorf("expected 1 user after replay, got %d", count)
	}
}
