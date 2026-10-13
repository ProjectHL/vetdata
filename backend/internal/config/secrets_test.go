package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSecretFiles(t *testing.T) {
	p := filepath.Join(t.TempDir(), "secret")
	if err := os.WriteFile(p, []byte("test-secret\n"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TEST_SECRET", "")
	t.Setenv("TEST_SECRET_FILE", p)
	if v, e := Secret("TEST_SECRET"); e != nil || v != "test-secret" {
		t.Fatal("read failed", e)
	}
	t.Setenv("TEST_SECRET", "conflict")
	if _, e := Secret("TEST_SECRET"); e == nil {
		t.Fatal("ambiguous source")
	}
	t.Setenv("TEST_SECRET", "")
	t.Setenv("TEST_SECRET_FILE", p+"missing")
	if _, e := Secret("TEST_SECRET"); e == nil {
		t.Fatal("missing accepted")
	}
}
