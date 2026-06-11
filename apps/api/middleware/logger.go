package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

const RequestIDHeader = "X-Request-Id"

// RequestID injects a request ID into the context and response header.
// Uses the incoming header value if present, otherwise generates a new 8-byte hex ID.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			raw := make([]byte, 8)
			_, _ = rand.Read(raw)
			id = hex.EncodeToString(raw)
		}
		c.Set("request_id", id)
		c.Header(RequestIDHeader, id)
		c.Next()
	}
}

// Logger logs each request with structured JSON fields.
// LevelKey is set to "severity" so GCP Cloud Logging maps log levels correctly.
func Logger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		status := c.Writer.Status()
		reqID, _ := c.Get("request_id")

		fields := []zap.Field{
			zap.String("request_id", reqID.(string)),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", status),
			zap.String("ip", c.ClientIP()),
			zap.Duration("latency", time.Since(start)),
			zap.Int("size", c.Writer.Size()),
		}

		switch {
		case status >= http.StatusInternalServerError:
			logger.Error("request", fields...)
		case status >= http.StatusBadRequest:
			logger.Warn("request", fields...)
		default:
			logger.Info("request", fields...)
		}
	}
}
