package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const googleAuthBaseURL = "https://accounts.google.com/o/oauth2/v2/auth"
const googleScope = "openid email profile"

type GoogleOAuthService struct {
	clientID     string
	clientSecret string
	redirectURL  string
	tokenURL     string // injectable for tests
	userInfoURL  string
	httpClient   *http.Client
}

func NewGoogleOAuthService(clientID, clientSecret, redirectURL, tokenURL string) *GoogleOAuthService {
	if tokenURL == "" {
		tokenURL = "https://oauth2.googleapis.com/token"
	}
	// In test mode the token URL is the internal mock server.
	// Derive the userinfo URL from the same base so both calls hit the mock.
	userInfoURL := "https://www.googleapis.com/oauth2/v3/userinfo"
	if tokenURL != "https://oauth2.googleapis.com/token" {
		// Replace path only, keep scheme+host from tokenURL
		base := tokenURL[:len(tokenURL)-len("/test/oauth/google")]
		userInfoURL = base + "/test/oauth/userinfo"
	}
	return &GoogleOAuthService{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURL:  redirectURL,
		tokenURL:     tokenURL,
		userInfoURL:  userInfoURL,
		httpClient:   http.DefaultClient,
	}
}

func (g *GoogleOAuthService) GetAuthorizationURL(state string) string {
	params := url.Values{}
	params.Set("client_id", g.clientID)
	params.Set("redirect_uri", g.redirectURL)
	params.Set("response_type", "code")
	params.Set("scope", googleScope)
	params.Set("state", state)
	params.Set("access_type", "online")
	return googleAuthBaseURL + "?" + params.Encode()
}

func (g *GoogleOAuthService) ExchangeToken(ctx context.Context, code string) (*OAuthUser, error) {
	// Exchange authorization code for access token
	params := url.Values{}
	params.Set("code", code)
	params.Set("client_id", g.clientID)
	params.Set("client_secret", g.clientSecret)
	params.Set("redirect_uri", g.redirectURL)
	params.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, "POST", g.tokenURL,
		strings.NewReader(params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read token response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed (%d): %s", resp.StatusCode, body)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("parse token response: %w", err)
	}
	if tokenResp.Error != "" {
		return nil, fmt.Errorf("token error: %s", tokenResp.Error)
	}

	// Fetch user info
	return g.fetchUserInfo(ctx, tokenResp.AccessToken)
}

func (g *GoogleOAuthService) fetchUserInfo(ctx context.Context, accessToken string) (*OAuthUser, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", g.userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request: %w", err)
	}
	defer resp.Body.Close()

	var info struct {
		Sub   string `json:"sub"`   // Google's stable user ID
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("parse userinfo: %w", err)
	}

	return &OAuthUser{
		ProviderUID: info.Sub,
		Email:       info.Email,
		Name:        info.Name,
	}, nil
}
