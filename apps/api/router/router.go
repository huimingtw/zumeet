package router

import (
	"github.com/gin-gonic/gin"
	"github.com/zumeet/api/config"
	"github.com/zumeet/api/handler"
)

func New(h *handler.Handler, cfg *config.AppConfig) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/healthz", h.HealthCheck)

	return r
}
