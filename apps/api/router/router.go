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

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/logout", h.Logout)
			auth.POST("/refresh", h.Refresh)
		}
	}

	// Protected routes (require valid access token)
	protected := v1.Group("")
	protected.Use(middleware.Auth([]byte(cfg.JWTSecret), h.DB()))
	{
		// Populated in subsequent stages
		_ = protected
	}

	return r
}
