// Command api is the VetData API HTTP server.
// Startup sequence: load env config (fail fast) → open the database pool →
// apply pending migrations in-process → serve HTTP. The server never starts
// against a half-migrated or unreachable database.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/vetdata/api/internal/config"
	"github.com/vetdata/api/internal/db"
	"github.com/vetdata/api/internal/handler"
	"github.com/vetdata/api/internal/notifications"
	"github.com/vetdata/api/migrations"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config load failed", "error", err)
		os.Exit(1)
	}

	ctx, stopApp := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stopApp()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := migrations.Apply(ctx, pool); err != nil {
		logger.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	var sender notifications.Sender
	if cfg.SMTPAddr != "" {
		sender = notifications.SMTP{Addr: cfg.SMTPAddr, From: cfg.SMTPFrom, User: cfg.SMTPUser, Password: cfg.SMTPPassword, AllowPlain: cfg.SMTPAllowPlain}
	}
	mail, err := notifications.New(pool, cfg.OutboxKey, sender)
	if err != nil {
		logger.Error("notification config invalid", "error", err)
		os.Exit(1)
	}
	go func() {
		tick := time.NewTicker(time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				if _, err := mail.DeliverOne(ctx); err != nil && ctx.Err() == nil {
					logger.Error("notification delivery failed", "error", err)
				}
			}
		}
	}()
	mux := handler.NewWithOptions(pool, logger, handler.Options{Origin: cfg.Origin, SecureCookies: cfg.SecureCookies, Mail: mail, StatusRules: cfg.StatusRules})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           mux,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("api listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}
