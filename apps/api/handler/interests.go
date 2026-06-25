package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"github.com/zumeet/api/middleware"
)

type interestResult struct {
	Status      string `json:"status"`                 // "pending" | "matched"
	ContactInfo string `json:"contact_info,omitempty"` // only when matched
}

// ExpressInterestAsTenant handles POST /api/v1/tenant-profiles/:profileId/listings/:listingId/interest
func (h *Handler) ExpressInterestAsTenant(c *Context) {
	userID := middleware.MustUserID(c)
	profileID := c.Param("profileId")
	listingID := c.Param("listingId")

	if err := h.RequireRole(c.Request.Context(), userID, "tenant"); err != nil {
		respondForbidden(c, err)
		return
	}

	result, err := h.expressInterest(c, userID, profileID, listingID, "tenant")
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, err)
			return
		}
		var httpErr *httpError
		if errors.As(err, &httpErr) {
			c.JSON(httpErr.code, gin.H{"error": httpErr.msg, "code": httpErr.errCode})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ExpressInterestAsLandlord handles POST /api/v1/listings/:listingId/tenant-profiles/:profileId/interest
func (h *Handler) ExpressInterestAsLandlord(c *Context) {
	userID := middleware.MustUserID(c)
	listingID := c.Param("listingId")
	profileID := c.Param("profileId")

	if err := h.RequireRole(c.Request.Context(), userID, "landlord"); err != nil {
		respondForbidden(c, err)
		return
	}

	result, err := h.expressInterest(c, userID, profileID, listingID, "landlord")
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			respondForbidden(c, err)
			return
		}
		var httpErr *httpError
		if errors.As(err, &httpErr) {
			c.JSON(httpErr.code, gin.H{"error": httpErr.msg, "code": httpErr.errCode})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error", "code": "internal"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// expressInterest is the shared transaction for both tenant and landlord interest expressions.
// It serializes concurrent interest pairs via pg_advisory_xact_lock to prevent missed matches.
func (h *Handler) expressInterest(c *Context, userID, profileID, listingID, actorRole string) (*interestResult, error) {
	ctx := c.Request.Context()

	tx, err := h.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Serialize concurrent interests on the same (profile, listing) pair.
	// hashtext collision only causes occasional unnecessary serialization — correctness is unaffected.
	if _, err = tx.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
		profileID, listingID,
	); err != nil {
		return nil, err
	}

	// Verify profile exists, is active, and is owned by the right tenant.
	var tenantOwnerID string
	var profileActive bool
	err = tx.QueryRow(ctx,
		`SELECT tenant_id, is_active FROM tenant_profiles WHERE id=$1 AND deleted_at IS NULL`,
		profileID,
	).Scan(&tenantOwnerID, &profileActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &httpError{http.StatusNotFound, "profile not found", "not_found"}
		}
		return nil, err
	}
	if !profileActive {
		return nil, &httpError{http.StatusBadRequest, "profile is not active", "profile_inactive"}
	}

	// Role-specific ownership check.
	if actorRole == "tenant" && tenantOwnerID != userID {
		return nil, ErrForbidden
	}

	// Verify listing exists, is active, and (for landlord) is owned by the caller.
	var landlordOwnerID, listingStatusStr string
	err = tx.QueryRow(ctx,
		`SELECT landlord_id, status::text FROM listings WHERE id=$1 AND deleted_at IS NULL AND admin_removed_at IS NULL`,
		listingID,
	).Scan(&landlordOwnerID, &listingStatusStr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &httpError{http.StatusNotFound, "listing not found", "not_found"}
		}
		return nil, err
	}
	if listingStatusStr != "active" {
		return nil, &httpError{http.StatusBadRequest, "listing is not active", "listing_not_active"}
	}
	if actorRole == "landlord" && landlordOwnerID != userID {
		return nil, ErrForbidden
	}

	// Check blocks (user-level, either direction).
	var blocked bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM blocks
			WHERE deleted_at IS NULL AND (
				(blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)
			)
		)`, tenantOwnerID, landlordOwnerID,
	).Scan(&blocked)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, &httpError{http.StatusForbidden, "blocked", "blocked"}
	}

	// UPSERT the interest for the acting side. 帶看 slots are booked post-match, not here.
	interestID := ulid.Make().String()
	if _, err = tx.Exec(ctx, `
		INSERT INTO interests (id, tenant_profile_id, listing_id, actor_role, status)
		VALUES ($1, $2, $3, $4::interest_actor_role, 'active')
		ON CONFLICT (tenant_profile_id, listing_id, actor_role)
		DO UPDATE SET status='active', updated_at=NOW(), withdrawn_at=NULL`,
		interestID, profileID, listingID, actorRole,
	); err != nil {
		return nil, err
	}

	// Check whether the other side already has an active interest.
	var otherRole string
	if actorRole == "tenant" {
		otherRole = "landlord"
	} else {
		otherRole = "tenant"
	}
	var counterExists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM interests
			WHERE tenant_profile_id=$1 AND listing_id=$2
			  AND actor_role=$3::interest_actor_role
			  AND status='active' AND deleted_at IS NULL
		)`, profileID, listingID, otherRole,
	).Scan(&counterExists)
	if err != nil {
		return nil, err
	}

	if !counterExists {
		if err = tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &interestResult{Status: "pending"}, nil
	}

	// Both sides have active interest → create match.
	matchID := ulid.Make().String()
	if _, err = tx.Exec(ctx, `
		INSERT INTO matches (id, tenant_id, tenant_profile_id, landlord_id, listing_id)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (tenant_profile_id, listing_id) DO NOTHING`,
		matchID, tenantOwnerID, profileID, landlordOwnerID, listingID,
	); err != nil {
		return nil, err
	}

	// 帶看 is booked by the tenant after the match, from the matched page — not here.

	// Fetch the other side's contact info.
	var contactInfo string
	if actorRole == "tenant" {
		// tenant just matched → show landlord contact
		err = tx.QueryRow(ctx,
			`SELECT contact_info FROM listings WHERE id=$1`, listingID,
		).Scan(&contactInfo)
	} else {
		// landlord just matched → show tenant contact
		err = tx.QueryRow(ctx,
			`SELECT contact_info FROM tenant_profiles WHERE id=$1`, profileID,
		).Scan(&contactInfo)
	}
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &interestResult{Status: "matched", ContactInfo: contactInfo}, nil
}

// httpError is a sentinel error that carries HTTP status code and message.
type httpError struct {
	code    int
	msg     string
	errCode string
}

func (e *httpError) Error() string { return e.msg }
