package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type requestIDCtxKey struct{}

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
		ctx := context.WithValue(c.Request.Context(), requestIDCtxKey{}, id)
		c.Request = c.Request.WithContext(ctx)
		c.Header(RequestIDHeader, id)
		c.Next()
	}
}

// RequestIDFromContext extracts the request ID injected by the RequestID middleware.
func RequestIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(requestIDCtxKey{}).(string)
	return v
}

// Logger logs each request with structured JSON fields.
// LevelKey is set to "severity" so GCP Cloud Logging maps log levels correctly.
func Logger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		status := c.Writer.Status()
		reqID, _ := c.Get("request_id")
		handlerCaller := ""
		if value, ok := c.Get("hcaller"); ok {
			handlerCaller, _ = value.(string)
		}
		userID, _ := UserIDFromContext(c)

		fields := []zap.Field{
			zap.String("request_id", reqID.(string)),
			zap.String("user_id", userID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.String("route", c.FullPath()),
			zap.String("handler", c.HandlerName()),
			zap.String("hcaller", handlerCaller),
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
