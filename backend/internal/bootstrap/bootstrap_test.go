package bootstrap

import (
	"context"
	"github.com/vetdata/api/internal/testutil"
	"github.com/vetdata/api/migrations"
	"github.com/vetdata/api/seeds"
	"golang.org/x/crypto/bcrypt"
	"testing"
)

func TestBootstrapDoesNotResetCredentialsOrElevateExistingUser(t *testing.T) {
	pool := testutil.Database(t)
	ctx := context.Background()
	if e := migrations.Apply(ctx, pool); e != nil {
		t.Fatal(e)
	}
	if e := seeds.Apply(ctx, pool); e != nil {
		t.Fatal(e)
	}
	in := Input{ClinicID: "660e8400-e29b-41d4-a716-446655440002", Name: "Local Admin", Email: "local@example.test", Password: "First-password-123"}
	id, e := Apply(ctx, pool, in)
	if e != nil {
		t.Fatal(e)
	}
	in.Password = "Second-password-123"
	again, e := Apply(ctx, pool, in)
	if e != nil || again != id {
		t.Fatal(again, e)
	}
	var hash string
	if e = pool.QueryRow(ctx, "SELECT password_hash FROM users WHERE id=$1", id).Scan(&hash); e != nil {
		t.Fatal(e)
	}
	if e = bcrypt.CompareHashAndPassword([]byte(hash), []byte("First-password-123")); e != nil {
		t.Fatal("password overwritten", e)
	}
	in.ClinicID = "660e8400-e29b-41d4-a716-446655440003"
	if _, e = Apply(ctx, pool, in); e == nil {
		t.Fatal("elevated existing account")
	}
}
