// Package config loads the API environment configuration.
// It fails fast on missing required values.
package config

import (
	"fmt"
	"net/netip"
	"net/url"
	"os"
	"strings"

	"github.com/vetdata/api/internal/domain"
)

// Config holds the runtime configuration of the API.
type Config struct {
	Port           string
	DatabaseURL    string
	Origin         string
	SecureCookies  bool
	SMTPAddr       string
	SMTPFrom       string
	SMTPUser       string
	SMTPPassword   string
	OutboxKey      string
	SMTPAllowPlain bool
	StatusRules    string
	TrustedProxies []netip.Prefix
}

// Load reads configuration from the environment.
func Load() (Config, error) {
	cfg := Config{
		Port:           getenv("PORT", "4000"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		Origin:         getenv("PUBLIC_WEB_URL", "http://localhost:3000"),
		SecureCookies:  os.Getenv("APP_ENV") == "production",
		SMTPAddr:       os.Getenv("SMTP_ADDR"),
		SMTPFrom:       getenv("SMTP_FROM", "VetData <noreply@vetdata.local>"),
		SMTPUser:       os.Getenv("SMTP_USER"),
		SMTPPassword:   os.Getenv("SMTP_PASSWORD"),
		OutboxKey:      os.Getenv("OUTBOX_KEY"),
		SMTPAllowPlain: os.Getenv("SMTP_ALLOW_PLAIN") == "true" && os.Getenv("APP_ENV") != "production",
		StatusRules:    os.Getenv("PATIENT_STATUS_RULES"),
	}
	for key, dest := range map[string]*string{"DATABASE_URL": &cfg.DatabaseURL, "SMTP_PASSWORD": &cfg.SMTPPassword, "OUTBOX_KEY": &cfg.OutboxKey} {
		value, err := Secret(key)
		if err != nil {
			return Config{}, err
		}
		*dest = value
	}
	for _, raw := range strings.Split(os.Getenv("TRUSTED_PROXY_CIDRS"), ",") {
		if strings.TrimSpace(raw) == "" {
			continue
		}
		prefix, err := netip.ParsePrefix(strings.TrimSpace(raw))
		if err != nil || prefix.Bits() == 0 {
			return Config{}, fmt.Errorf("invalid TRUSTED_PROXY_CIDRS")
		}
		cfg.TrustedProxies = append(cfg.TrustedProxies, prefix)
	}
	if _, err := domain.ParsePatientStatusRules(cfg.StatusRules); err != nil {
		return Config{}, err
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	u, err := url.Parse(cfg.Origin)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return Config{}, fmt.Errorf("PUBLIC_WEB_URL must be an origin without a path")
	}
	if cfg.SecureCookies && (u.Scheme != "https" || cfg.SMTPAddr == "" || cfg.OutboxKey == "") {
		return Config{}, fmt.Errorf("production requires HTTPS origin, SMTP_ADDR and OUTBOX_KEY")
	}
	if cfg.SMTPAddr != "" && cfg.OutboxKey == "" {
		return Config{}, fmt.Errorf("SMTP requires OUTBOX_KEY")
	}
	return cfg, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
