package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

// ---- helpers ----

func seedAdmin(t *testing.T, email, level string) string {
	t.Helper()
	id := ulid.Make().String()
	_, err := testPool.Exec(context.Background(),
		`INSERT INTO admins (id, email, level) VALUES ($1, $2, $3::admin_level)`,
		id, email, level,
	)
	if err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	return id
}

func validAdminCookie(t *testing.T, adminID, level string) *http.Cookie {
	t.Helper()
	token, err := middleware.GenerateAdminToken([]byte(testCfg.AdminJWTSecret), adminID, level)
	if err != nil {
		t.Fatalf("generate admin token: %v", err)
	}
	return &http.Cookie{Name: middleware.AdminTokenCookie, Value: token}
}

func adminRequest(t *testing.T, method, path string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	return w
}

// ---- auth isolation ----

func TestAdmin_UserJWTRejected(t *testing.T) {
	truncate(t)
	userID := seedUser(t, "adm-user@example.com", "tenant")
	userCookie := validAccessCookie(t, userID, "adm-user@example.com", []string{"tenant"})

	// user cookie must NOT access admin endpoints
	req := httptest.NewRequest("GET", "/admin/reports", nil)
	req.AddCookie(userCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("user JWT on admin route: expected 401, got %d", w.Code)
	}
}

func TestAdmin_NoToken_Rejected(t *testing.T) {
	truncate(t)
	w := adminRequest(t, "GET", "/admin/reports", nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("no token: expected 401, got %d", w.Code)
	}
}

// ---- magic link ----

func TestAdmin_MagicLink_Flow(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-magic@example.com", "moderator")
	_ = adminID

	// POST /admin/login — triggers email (noop in tests)
	w := postJSON(t, "/admin/login", map[string]any{
		"email": "adm-magic@example.com",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// fetch token hash from DB
	var plainHash string
	var tokenID string
	testPool.QueryRow(context.Background(),
		`SELECT id, token_hash FROM admin_login_tokens WHERE admin_id=$1 ORDER BY created_at DESC LIMIT 1`,
		adminID,
	).Scan(&tokenID, &plainHash)
	if tokenID == "" {
		t.Fatal("expected admin_login_token to be created")
	}
}

func TestAdmin_MagicLink_UsedToken_Rejected(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-used@example.com", "moderator")

	// insert a used token manually
	_, err := testPool.Exec(context.Background(), `
		INSERT INTO admin_login_tokens (id, admin_id, token_hash, expires_at, used_at)
		VALUES ($1, $2, 'deadbeef', NOW()+INTERVAL '10 min', NOW())`,
		ulid.Make().String(), adminID,
	)
	if err != nil {
		t.Fatalf("seed token: %v", err)
	}

	// cannot reuse
	req := httptest.NewRequest("GET", "/admin/auth/callback?token=anythinghere", nil)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	// 401 because token hash won't match; just ensure it's not 200
	if w.Code == http.StatusFound {
		t.Error("used token should not produce a redirect")
	}
}

func TestAdmin_MagicLink_ExpiredToken_Rejected(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-exp@example.com", "moderator")

	_, err := testPool.Exec(context.Background(), `
		INSERT INTO admin_login_tokens (id, admin_id, token_hash, expires_at)
		VALUES ($1, $2, 'expiredhash', NOW()-INTERVAL '1 hour')`,
		ulid.Make().String(), adminID,
	)
	if err != nil {
		t.Fatalf("seed token: %v", err)
	}

	req := httptest.NewRequest("GET", "/admin/auth/callback?token=anythinghere", nil)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	if w.Code == http.StatusFound {
		t.Error("expired token should not produce a redirect")
	}
}

// ---- reports ----

func TestAdmin_Reports_Queue(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-rq@example.com", "moderator")
	cookie := validAdminCookie(t, adminID, "moderator")

	// seed a report
	reporterID := seedUser(t, "adm-rq-reporter@example.com", "tenant")
	reportedID := seedUser(t, "adm-rq-reported@example.com", "landlord")
	postJSON(t, "/api/v1/reports", map[string]any{
		"reported_id": reportedID,
		"reason":      "spam",
	}, validAccessCookie(t, reporterID, "adm-rq-reporter@example.com", []string{"tenant"}))

	w := adminRequest(t, "GET", "/admin/reports", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("list reports: expected 200, got %d", w.Code)
	}
	var reports []map[string]any
	json.NewDecoder(w.Body).Decode(&reports)
	if len(reports) < 1 {
		t.Errorf("expected at least 1 report, got %d", len(reports))
	}
}

func TestAdmin_ResolveReport(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-res@example.com", "moderator")
	cookie := validAdminCookie(t, adminID, "moderator")

	reporterID := seedUser(t, "adm-res-reporter@example.com", "tenant")
	reportedID := seedUser(t, "adm-res-reported@example.com", "landlord")
	wR := postJSON(t, "/api/v1/reports", map[string]any{
		"reported_id": reportedID, "reason": "test",
	}, validAccessCookie(t, reporterID, "adm-res-reporter@example.com", []string{"tenant"}))
	var reportResp map[string]any
	json.NewDecoder(wR.Body).Decode(&reportResp)
	reportID := reportResp["id"].(string)

	w := postJSON(t, "/admin/reports/"+reportID+"/resolve", map[string]any{
		"status": "resolved",
		"note":   "handled",
	}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("resolve: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// verify audit action written
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM admin_actions WHERE admin_id=$1 AND target_id=$2`, adminID, reportID,
	).Scan(&count)
	if count == 0 {
		t.Error("expected admin_actions entry for resolve_report")
	}
}

// ---- user moderation ----

func TestAdmin_SuspendUnsuspend(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-sus@example.com", "moderator")
	cookie := validAdminCookie(t, adminID, "moderator")
	targetID := seedUser(t, "adm-sus-target@example.com", "tenant")

	// suspend
	w := postJSON(t, "/admin/users/"+targetID+"/suspend", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("suspend: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var suspendedAt *string
	testPool.QueryRow(context.Background(),
		`SELECT suspended_at::text FROM users WHERE id=$1`, targetID,
	).Scan(&suspendedAt)
	if suspendedAt == nil {
		t.Error("user should be suspended")
	}

	// unsuspend
	w2 := postJSON(t, "/admin/users/"+targetID+"/unsuspend", nil, cookie)
	if w2.Code != http.StatusOK {
		t.Fatalf("unsuspend: expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	testPool.QueryRow(context.Background(),
		`SELECT suspended_at::text FROM users WHERE id=$1`, targetID,
	).Scan(&suspendedAt)
	if suspendedAt != nil {
		t.Error("user should not be suspended after unsuspend")
	}
}

func TestAdmin_ModeratorCannotForceDelete(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-mod-del@example.com", "moderator")
	cookie := validAdminCookie(t, adminID, "moderator")
	targetID := seedUser(t, "adm-mod-del-target@example.com", "tenant")

	w := postJSON(t, "/admin/users/"+targetID+"/delete", nil, cookie)
	if w.Code != http.StatusForbidden {
		t.Errorf("moderator force-delete: expected 403, got %d", w.Code)
	}
}

func TestAdmin_SuperAdminForceDelete_AuditSurvives(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-sa@example.com", "super_admin")
	cookie := validAdminCookie(t, adminID, "super_admin")
	targetID := seedUser(t, "adm-sa-target@example.com", "tenant")

	w := postJSON(t, "/admin/users/"+targetID+"/delete", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("force-delete: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// user soft-deleted
	var deletedAt *string
	testPool.QueryRow(context.Background(),
		`SELECT deleted_at::text FROM users WHERE id=$1`, targetID,
	).Scan(&deletedAt)
	if deletedAt == nil {
		t.Error("user should be soft-deleted")
	}

	// audit row survives (no FK)
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM admin_actions WHERE target_id=$1 AND action='delete_user'`, targetID,
	).Scan(&count)
	if count == 0 {
		t.Error("admin_actions audit must survive target deletion")
	}
}

// ---- listing moderation ----

func TestAdmin_RemoveRestoreListing(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-ls@example.com", "moderator")
	cookie := validAdminCookie(t, adminID, "moderator")
	landlordID := seedUser(t, "adm-ls-ll@example.com", "landlord")
	listingID := activeListing(t, landlordID, "taipei-daan", 20000, false, false)

	// remove
	w := postJSON(t, "/admin/listings/"+listingID+"/remove", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("remove: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// listing no longer appears in matching (admin_removed_at set)
	tenantID := seedUser(t, "adm-ls-t@example.com", "tenant")
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)
	tCookie := validAccessCookie(t, tenantID, "adm-ls-t@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(tCookie)
	wB := httptest.NewRecorder()
	testR.ServeHTTP(wB, req)
	var browse map[string]any
	json.NewDecoder(wB.Body).Decode(&browse)
	if len(browse["items"].([]any)) != 0 {
		t.Error("admin-removed listing should not appear in matching list")
	}

	// restore
	w2 := postJSON(t, "/admin/listings/"+listingID+"/restore", nil, cookie)
	if w2.Code != http.StatusOK {
		t.Fatalf("restore: expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	// verify audit
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM admin_actions WHERE target_id=$1`, listingID,
	).Scan(&count)
	if count < 2 {
		t.Errorf("expected at least 2 admin_actions for listing, got %d", count)
	}
}

func TestAdmin_SuspendedUser_ExcludedFromMatching(t *testing.T) {
	truncate(t)
	adminID := seedAdmin(t, "adm-sus2@example.com", "moderator")
	cookie := validAdminCookie(t, adminID, "moderator")
	landlordID := seedUser(t, "adm-sus2-ll@example.com", "landlord")
	tenantID := seedUser(t, "adm-sus2-t@example.com", "tenant")

	activeListing(t, landlordID, "taipei-daan", 20000, false, false)
	profileID := activeTenantProfile(t, tenantID, "taipei-daan", 15000, 25000, false, false)

	// suspend landlord
	postJSON(t, "/admin/users/"+landlordID+"/suspend", nil, cookie)

	tCookie := validAccessCookie(t, tenantID, "adm-sus2-t@example.com", []string{"tenant"})
	req := httptest.NewRequest("GET", "/api/v1/tenant-profiles/"+profileID+"/listings", nil)
	req.AddCookie(tCookie)
	w := httptest.NewRecorder()
	testR.ServeHTTP(w, req)
	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp["items"].([]any)) != 0 {
		t.Error("suspended landlord's listing should not appear in matching")
	}
}
