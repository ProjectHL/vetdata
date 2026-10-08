package config

import "testing"

func TestProductionConfiguration(t *testing.T) {
	for _, key := range []string{"DATABASE_URL", "APP_ENV", "PUBLIC_WEB_URL", "SMTP_ADDR", "OUTBOX_KEY", "SMTP_ALLOW_PLAIN"} {
		t.Setenv(key, "")
	}
	if _, e := Load(); e == nil {
		t.Fatal("database missing")
	}
	t.Setenv("DATABASE_URL", "postgresql://unused/unused")
	t.Setenv("PUBLIC_WEB_URL", "http://localhost:3000/path")
	if _, e := Load(); e == nil {
		t.Fatal("origin with path")
	}
	t.Setenv("PUBLIC_WEB_URL", "http://localhost:3000")
	t.Setenv("APP_ENV", "production")
	if _, e := Load(); e == nil {
		t.Fatal("insecure production")
	}
	t.Setenv("PUBLIC_WEB_URL", "https://vetdata.example")
	t.Setenv("SMTP_ADDR", "smtp.example:587")
	t.Setenv("OUTBOX_KEY", "test-config-only")
	t.Setenv("SMTP_ALLOW_PLAIN", "true")
	c, e := Load()
	if e != nil || !c.SecureCookies || c.SMTPAllowPlain {
		t.Fatal(c.SecureCookies, c.SMTPAllowPlain, e)
	}
}
