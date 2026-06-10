package router

import (
	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/middleware"
)

func New(h *handler.Handler, cfg *config.AppConfig) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/healthz", h.HealthCheck)

	// Test-only: mock Google OAuth token + userinfo endpoints.
	// Guard ensures these routes are NEVER mounted in production.
	if cfg.AppEnv == "test" {
		r.POST("/test/oauth/google", h.TestOAuthTokenEndpoint)
		r.GET("/test/oauth/userinfo", h.TestOAuthUserInfoEndpoint)
	}

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.GET("/google", h.GoogleOAuthRedirect)
			auth.GET("/google/callback", h.GoogleOAuthCallback)
			auth.POST("/onboarding", h.Onboarding)
			auth.POST("/logout", h.Logout)
			auth.POST("/refresh", h.Refresh)
		}
	}

	// Protected routes — require valid access token
	protected := v1.Group("")
	protected.Use(middleware.Auth([]byte(cfg.JWTSecret), h.DB()))
	{
		tp := protected.Group("/tenant-profiles")
		{
			tp.GET("", h.ListTenantProfiles)
			tp.POST("", h.CreateTenantProfile)
			tp.GET("/:profileId", h.GetTenantProfile)
			tp.PUT("/:profileId", h.UpdateTenantProfile)
			tp.DELETE("/:profileId", h.DeleteTenantProfile)
			tp.PATCH("/:profileId/status", h.ToggleTenantProfileStatus)
		}
	}

	return r
}
