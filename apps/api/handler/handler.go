package handler

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zumeet/api/service"
)

type Handler struct {
	db      *pgxpool.Pool
	oauth   service.OAuthService
	storage service.StorageService
	email   service.EmailService
}

func New(
	db *pgxpool.Pool,
	oauth service.OAuthService,
	storage service.StorageService,
	email service.EmailService,
) *Handler {
	return &Handler{
		db:      db,
		oauth:   oauth,
		storage: storage,
		email:   email,
	}
}
