// Package testutil creates disposable databases only on the explicit test server.
package testutil

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vetdata/api/internal/domain"
	"os"
	"testing"
	"time"
)

func Database(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("REQUIRE_INTEGRATION") == "1" {
			t.Fatal("TEST_DATABASE_URL required")
		}
		t.Skip("set TEST_DATABASE_URL to run integration tests")
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "vetdata_test" {
		t.Fatal("TEST_DATABASE_URL must target vetdata_test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	name := "vd_test_" + domain.UUID()[:8]
	identifier := pgx.Identifier{name}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+identifier); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg2 := cfg.Copy()
	cfg2.ConnConfig.Database = name
	pool, err := pgxpool.NewWithConfig(ctx, cfg2)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		cleanup, c := context.WithTimeout(context.Background(), 20*time.Second)
		defer c()
		if _, err := admin.Exec(cleanup, "DROP DATABASE "+identifier+" WITH (FORCE)"); err != nil {
			t.Error(err)
		}
		admin.Close()
	})
	return pool
}
