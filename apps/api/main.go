package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/zumeet/api/config"
	"github.com/zumeet/api/db"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/router"
	"github.com/zumeet/api/service"
)

func main() {
	cfg := config.Load()

	// Safety guards: fail fast rather than silently misconfigure production.
	if cfg.AppEnv == "production" && cfg.EnableTestEndpoints {
		log.Fatal("FATAL: ENABLE_TEST_ENDPOINTS must not be true in production")
	}
	if cfg.AppEnv == "production" && cfg.AuthProvider == "mock" {
		log.Fatal("FATAL: AUTH_PROVIDER=mock is not permitted in production")
	}

	var logger *zap.Logger
	var err error
	if cfg.AppEnv == "production" {
		// GCP Cloud Logging: override LevelKey to "severity"
		zapCfg := zap.NewProductionConfig()
		zapCfg.EncoderConfig.MessageKey = "message"
		zapCfg.EncoderConfig.LevelKey = "severity"
		zapCfg.EncoderConfig.CallerKey = "caller"
		zapCfg.EncoderConfig.EncodeCaller = zapcore.ShortCallerEncoder
		logger, err = zapCfg.Build(zap.AddCaller())
	} else {
		zapCfg := zap.NewDevelopmentConfig()
		zapCfg.EncoderConfig.CallerKey = "caller"
		zapCfg.EncoderConfig.EncodeCaller = zapcore.ShortCallerEncoder
		// DevelopmentConfig stack-traces from Warn up, so every 4xx (e.g. a 401
		// refresh) dumps a trace. Pin to Error like production — keep 5xx traces only.
		logger, err = zapCfg.Build(zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	}
	if err != nil {
		log.Fatalf("init logger: %v", err)
	}
	defer logger.Sync()

	pool, err := db.Connect(cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("connect db", zap.Error(err))
	}
	defer pool.Close()

	var oauthSvc service.OAuthService
	if cfg.AuthProvider == "mock" {
		oauthSvc = &handler.MockOAuthService{}
	} else {
		oauthSvc = service.NewGoogleOAuthService(
			cfg.GoogleClientID,
			cfg.GoogleClientSecret,
			cfg.GoogleRedirectURL,
			cfg.GoogleTokenURL,
		)
	}

	storageSvc, err := service.NewMinioStorageService(
		cfg.StorageEndpoint,
		cfg.StoragePublicURL,
		cfg.StorageAccessKey,
		cfg.StorageSecretKey,
		cfg.StorageBucket,
		cfg.StorageUseSSL,
	)
	if err != nil {
		logger.Fatal("init storage", zap.Error(err))
	}

	var emailSvc service.EmailService
	if cfg.ResendAPIKey != "" {
		emailSvc = service.NewResendEmailService(cfg.ResendAPIKey, cfg.AdminFromEmail)
	} else {
		emailSvc = &service.NoopEmailService{}
	}

	var geocoder service.GeocodingService
	if cfg.GoogleMapsAPIKey != "" {
		geocoder = service.NewCachedGeocodingService(
			service.NewGoogleGeocodingService(cfg.GoogleMapsAPIKey),
			pool,
		)
	} else {
		geocoder = service.NoopGeocodingService{}
	}

	h := handler.New(pool, oauthSvc, storageSvc, emailSvc, geocoder, cfg)
	r := router.New(h, cfg, logger)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("listen", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("shutdown error", zap.Error(err))
	}
	pool.Close()
}
