package config

import (
	"fmt"
	"os"
	"strings"
)

// Secret accepts either NAME or NAME_FILE, never both. Errors omit values.
func Secret(name string) (string, error) {
	value, path := os.Getenv(name), os.Getenv(name+"_FILE")
	if path == "" {
		return value, nil
	}
	if value != "" {
		return "", fmt.Errorf("configure only %s or %s_FILE", name, name)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("cannot read %s_FILE", name)
	}
	value = strings.TrimRight(string(raw), "\r\n")
	if value == "" {
		return "", fmt.Errorf("%s_FILE is empty", name)
	}
	return value, nil
}
