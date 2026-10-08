package migrations

import (
	"context"
	"github.com/vetdata/api/internal/testutil"
	"os"
	"sync"
	"testing"
	"testing/fstest"
)

func TestSeedsReapplyWithoutDuplicates(t *testing.T) {
	pool := testutil.Database(t)
	ctx := context.Background()
	if e := Apply(ctx, pool); e != nil {
		t.Fatal(e)
	}
	sql, e := os.ReadFile("../seeds/002_fase1_seeds.sql")
	if e != nil {
		t.Fatal(e)
	}
	counts := map[string]int{}
	for run := 0; run < 2; run++ {
		if _, e = pool.Exec(ctx, string(sql)); e != nil {
			t.Fatal(e)
		}
		for _, table := range []string{"groups", "clinics", "users", "memberships", "doctors", "owners", "role_permissions"} {
			var n int
			if e = pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&n); e != nil {
				t.Fatal(e)
			}
			if run == 1 && n != counts[table] {
				t.Fatalf("%s: %d -> %d", table, counts[table], n)
			}
			counts[table] = n
		}
	}
	var legacy int
	if e = pool.QueryRow(ctx, "SELECT count(*) FROM role_permissions WHERE permission IN ('red.aprobar','red.revocar')").Scan(&legacy); e != nil || legacy != 0 {
		t.Fatal(legacy, e)
	}
}

func TestConcurrentMigrationsAndUpgrade(t *testing.T) {
	pool := testutil.Database(t)
	ctx := context.Background()
	// Simulate an existing installation that already applied 001/002.
	old := fstest.MapFS{}
	for _, name := range []string{"001_init.sql", "002_fase1_core.sql"} {
		b, e := files.ReadFile(name)
		if e != nil {
			t.Fatal(e)
		}
		old[name] = &fstest.MapFile{Data: b}
	}
	if err := applyFS(ctx, pool, old); err != nil {
		t.Fatal(err)
	}
	seed, e := os.ReadFile("../seeds/002_fase1_seeds.sql")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = pool.Exec(ctx, string(seed)); e != nil {
		t.Fatal(e)
	}
	var before int
	if e = pool.QueryRow(ctx, "SELECT count(*) FROM owners").Scan(&before); e != nil {
		t.Fatal(e)
	}
	var wg sync.WaitGroup
	errors := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() { defer wg.Done(); errors <- Apply(ctx, pool) }()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations").Scan(&count); err != nil {
		t.Fatal(err)
	}
	entries, _ := files.ReadDir(".")
	if count != len(entries) {
		t.Fatalf("versions %d want %d", count, len(entries))
	}
	var after int
	if e = pool.QueryRow(ctx, "SELECT count(*) FROM owners").Scan(&after); e != nil || after != before {
		t.Fatal("upgrade lost data", before, after, e)
	}
}
func TestMigrationFailureRollsBackDDLAndLedger(t *testing.T) {
	pool := testutil.Database(t)
	ctx := context.Background()
	broken := fstest.MapFS{"001_broken.sql": &fstest.MapFile{Data: []byte("CREATE TABLE should_not_exist(id int); SELECT definitely_missing_function();")}}
	if err := applyFS(ctx, pool, broken); err == nil {
		t.Fatal("expected migration failure")
	}
	var exists bool
	if err := pool.QueryRow(ctx, "SELECT to_regclass('should_not_exist') IS NOT NULL OR to_regclass('schema_migrations') IS NOT NULL").Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Fatal("partial migration survived")
	}
}
