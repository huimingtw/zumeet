package handler

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/service"
	"gorm.io/gorm"
)

// LocationInput is the city+district natural key used in create/update request bodies.
// The backend resolves it to a location_id via the locations table UNIQUE(city, district).
type LocationInput struct {
	City     string `json:"city" binding:"required"`
	District string `json:"district" binding:"required"`
}

var ErrForbidden = errors.New("forbidden")

type Handler struct {
	db      *pgxpool.Pool
	orm     *gorm.DB
	oauth   service.OAuthService
	storage service.StorageService
	email   service.EmailService
	cfg     *config.AppConfig
}

func New(
	db *pgxpool.Pool,
	orm *gorm.DB,
	oauth service.OAuthService,
	storage service.StorageService,
	email service.EmailService,
	cfg *config.AppConfig,
) *Handler {
	return &Handler{
		db:      db,
		orm:     orm,
		oauth:   oauth,
		storage: storage,
		email:   email,
		cfg:     cfg,
	}
}

func (h *Handler) DB() *pgxpool.Pool { return h.db }

func (h *Handler) ORM() *gorm.DB { return h.orm }

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
