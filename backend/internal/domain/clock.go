package domain

import (
	"context"
	"time"
)

type clockKey struct{}

// WithNow freezes the business clock for one request. Security token validity
// remains tied to the database clock, which cannot be overridden by clients.
func WithNow(ctx context.Context, now time.Time) context.Context {
	return context.WithValue(ctx, clockKey{}, now)
}
func Now(ctx context.Context) time.Time {
	if now, ok := ctx.Value(clockKey{}).(time.Time); ok {
		return now
	}
	return time.Now()
}
