// Package migrations applies embedded SQL migrations in order.
// It uses Postgres advisory locking so concurrent API replicas
// never apply the same migration twice.
package migrations

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed *.sql
var files embed.FS

// Apply runs all pending migrations inside the database.
func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	return applyFS(ctx, pool, files)
}

// The lock, schema changes and migration ledger share one transaction. A
// failed startup never leaves a migration applied without its ledger entry.
func applyFS(ctx context.Context, pool *pgxpool.Pool, source fs.FS) error {
	entries, err := fs.ReadDir(source, ".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("acquire conn: %w", err)
	}
	defer tx.Rollback(context.Background())

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(987654321)"); err != nil {
		return fmt.Errorf("advisory lock: %w", err)
	}
	if _, err := tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("bootstrap ledger: %w", err)
	}

	for _, name := range names {
		var applied bool
		err := tx.QueryRow(ctx,
			"SELECT TRUE FROM schema_migrations WHERE version = $1", name,
		).Scan(&applied)
		if err == nil && applied {
			continue
		}
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("read version %s: %w", name, err)
		}
		sql, err := fs.ReadFile(source, name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx,
			"INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", name,
		); err != nil {
			return fmt.Errorf("record %s: %w", name, err)
		}
	}
	return tx.Commit(ctx)
}
