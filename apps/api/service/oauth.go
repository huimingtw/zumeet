package service

import "context"

type OAuthUser struct {
	ProviderUID string
	Email       string
	Name        string
	AvatarURL   string
}

type OAuthService interface {
	// GetAuthorizationURL returns the provider's authorization redirect URL
	// with the given state parameter embedded.
	GetAuthorizationURL(state string) string
	ExchangeToken(ctx context.Context, code string) (*OAuthUser, error)
}
