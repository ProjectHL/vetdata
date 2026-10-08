// Package db opens the Postgres connection pool.
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New opens a pgx connection pool and verifies it.
func New(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}
