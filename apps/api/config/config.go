package config

import (
	"os"
	"strconv"
)

type AppConfig struct {
	Port           string
	AppEnv         string
	DatabaseURL    string
	JWTSecret      string
	AdminJWTSecret string

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	GoogleTokenURL     string // overridable for test mock

	StorageEndpoint  string
	StoragePublicURL string
	StorageBucket    string
	StorageAccessKey string
	StorageSecretKey string
	StorageUseSSL    bool

	ResendAPIKey  string
	AdminFromEmail string
}

func Load() *AppConfig {
	return &AppConfig{
		Port:           getEnv("PORT", "8080"),
		AppEnv:         getEnv("APP_ENV", "development"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://zumeet:secret@localhost:5432/zumeet"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		AdminJWTSecret: getEnv("ADMIN_JWT_SECRET", ""),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),
		GoogleTokenURL:     getEnv("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token"),

		StorageEndpoint:  getEnv("STORAGE_ENDPOINT", "localhost:9000"),
		StoragePublicURL: getEnv("STORAGE_PUBLIC_URL", ""),
		StorageBucket:    getEnv("STORAGE_BUCKET", "zumeet"),
		StorageAccessKey: getEnv("STORAGE_ACCESS_KEY", "minioadmin"),
		StorageSecretKey: getEnv("STORAGE_SECRET_KEY", "minioadmin"),
		StorageUseSSL:    getEnvBool("STORAGE_USE_SSL", false),

		ResendAPIKey:   getEnv("RESEND_API_KEY", ""),
		AdminFromEmail: getEnv("ADMIN_FROM_EMAIL", "noreply@zumeet.tw"),
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return defaultVal
	}
	return b
}
