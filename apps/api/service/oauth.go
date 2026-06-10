package service

import "context"

type OAuthUser struct {
	ProviderUID string
	Email       string
	Name        string
	AvatarURL   string
}

type OAuthService interface {
	ExchangeToken(ctx context.Context, code string) (*OAuthUser, error)
}
