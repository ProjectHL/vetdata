// Package seeds installs optional development fixtures, never production credentials.
package seeds

import (
	"context"
	"embed"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed *.sql
var files embed.FS

func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	tx, e := pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(987654322)"); e != nil {
		return e
	}
	entries, e := files.ReadDir(".")
	if e != nil {
		return e
	}
	for _, entry := range entries {
		b, e := files.ReadFile(entry.Name())
		if e != nil {
			return e
		}
		if _, e = tx.Exec(ctx, string(b)); e != nil {
			return fmt.Errorf("seed %s: %w", entry.Name(), e)
		}
	}
	return tx.Commit(ctx)
}
