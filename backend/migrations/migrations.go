// Package migrations applies embedded SQL migrations in order.
// It uses Postgres advisory locking so concurrent API replicas
// never apply the same migration twice.
package migrations

import (
	"context"
	"embed"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed *.sql
var files embed.FS

// Apply runs all pending migrations inside the database.
func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	entries, err := files.ReadDir(".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire conn: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock(987654321)"); err != nil {
		return fmt.Errorf("advisory lock: %w", err)
	}
	defer conn.Exec(ctx, "SELECT pg_advisory_unlock(987654321)") //nolint:errcheck

	for _, name := range names {
		var applied bool
		err := conn.QueryRow(ctx,
			"SELECT TRUE FROM schema_migrations WHERE version = $1", name,
		).Scan(&applied)
		if err == nil && applied {
			continue
		}
		sql, err := files.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := conn.Exec(ctx,
			"INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", name,
		); err != nil {
			return fmt.Errorf("record %s: %w", name, err)
		}
	}
	return nil
}
