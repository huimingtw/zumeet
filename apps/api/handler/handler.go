package handler

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/service"
)

var ErrForbidden = errors.New("forbidden")

type Handler struct {
	db      *pgxpool.Pool
	oauth   service.OAuthService
	storage service.StorageService
	email   service.EmailService
	cfg     *config.AppConfig
}

func New(
	db *pgxpool.Pool,
	oauth service.OAuthService,
	storage service.StorageService,
	email service.EmailService,
	cfg *config.AppConfig,
) *Handler {
	return &Handler{
		db:      db,
		oauth:   oauth,
		storage: storage,
		email:   email,
		cfg:     cfg,
	}
}

func (h *Handler) DB() *pgxpool.Pool { return h.db }

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
