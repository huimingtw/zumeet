package handler

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/service"
	"go.uber.org/zap"
)

// LocationInput is the city+district natural key used in create/update request bodies.
// The backend resolves it to a location_id via the locations table UNIQUE(city, district).
type LocationInput struct {
	City     string `json:"city" binding:"required"`
	District string `json:"district" binding:"required"`
}

var ErrForbidden = errors.New("forbidden")

type Handler struct {
	db       *pgxpool.Pool
	oauth    service.OAuthService
	storage  service.StorageService
	email    service.EmailService
	geocoder service.GeocodingService
	cfg      *config.AppConfig
	logger   *zap.Logger
}

func New(
	db *pgxpool.Pool,
	oauth service.OAuthService,
	storage service.StorageService,
	email service.EmailService,
	geocoder service.GeocodingService,
	cfg *config.AppConfig,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		db:       db,
		oauth:    oauth,
		storage:  storage,
		email:    email,
		geocoder: geocoder,
		cfg:      cfg,
		logger:   logger,
	}
}

func (h *Handler) DB() *pgxpool.Pool { return h.db }

// userRoles returns the active role names for a user (DB is the source of truth, never JWT).
func (h *Handler) userRoles(ctx context.Context, userID string) ([]string, error) {
	rows, err := h.db.Query(ctx,
		`SELECT role::text FROM user_roles WHERE user_id = $1 AND deleted_at IS NULL`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// RequireRole checks DB (never JWT) to verify the user has the given role.
// Use this in every endpoint that requires a specific role — not the JWT payload.
func (h *Handler) RequireRole(ctx context.Context, userID string, role string) error {
	var exists bool
	err := h.db.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM user_roles
			WHERE user_id = $1 AND role = $2::user_role AND deleted_at IS NULL
		)`,
		userID, role,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrForbidden
	}
	return nil
}

// requireRole is the guard form of RequireRole: it checks the DB and, on failure,
// writes the forbidden/500 response and returns false. Call sites collapse to
//
//	if !h.requireRole(c, userID, "landlord") { return }
func (h *Handler) requireRole(c *Context, userID, role string) bool {
	if err := h.RequireRole(c.Request.Context(), userID, role); err != nil {
		respondForbidden(c, err)
		return false
	}
	return true
}
