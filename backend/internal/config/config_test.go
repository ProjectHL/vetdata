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

func TestPatientStatusRulesEnv(t *testing.T) {
	for _, key := range []string{"DATABASE_URL", "PATIENT_STATUS_RULES"} {
		t.Setenv(key, "")
	}
	t.Setenv("DATABASE_URL", "postgresql://unused/unused")
	if c, e := Load(); e != nil || c.StatusRules != "" {
		t.Fatal(c, e)
	}
	t.Setenv("PATIENT_STATUS_RULES", `{"default":"Al día","rules":[{"status":"Urgente","any":[{"overdueVaccine":true}]}]}`)
	if _, e := Load(); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PATIENT_STATUS_RULES", `{"default":"Grave","rules":[]}`)
	if _, e := Load(); e == nil {
		t.Fatal("invalid rules accepted")
	}
}
