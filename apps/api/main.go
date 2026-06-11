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

	"github.com/zumeet/api/config"
	"github.com/zumeet/api/db"
	"github.com/zumeet/api/handler"
	"github.com/zumeet/api/router"
)

func main() {
	cfg := config.Load()

	var logger *zap.Logger
	var err error
	if cfg.AppEnv == "production" {
		// GCP Cloud Logging: override LevelKey to "severity"
		zapCfg := zap.NewProductionConfig()
		zapCfg.EncoderConfig.MessageKey = "message"
		zapCfg.EncoderConfig.LevelKey = "severity"
		logger, err = zapCfg.Build()
	} else {
		logger, err = zap.NewDevelopment()
	}
	if err != nil {
		log.Fatalf("init logger: %v", err)
	}
	defer logger.Sync()

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("connect db", zap.Error(err))
	}
	defer pool.Close()

	h := handler.New(pool, nil, nil, nil, cfg)
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
