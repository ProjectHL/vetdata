// Package config loads the API environment configuration.
// It fails fast on missing required values.
package config

import (
	"fmt"
	"os"
)

// Config holds the runtime configuration of the API.
type Config struct {
	Port        string
	DatabaseURL string
}

// Load reads configuration from the environment.
func Load() (Config, error) {
	cfg := Config{
		Port:        getenv("PORT", "4000"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	return cfg, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
