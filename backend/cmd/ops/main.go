// Command ops exposes simulations only. No delete/anonymize execution exists.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/vetdata/api/internal/config"
	"github.com/vetdata/api/internal/db"
	"github.com/vetdata/api/internal/privacy"
	"os"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "operation failed:", err)
		os.Exit(1)
	}
}
func run() error {
	kind := flag.String("kind", "", "retention or anonymization (simulation only)")
	asof := flag.String("as-of", "", "RFC3339 timestamp required")
	clinic := flag.String("clinic", "", "clinic UUID")
	owner := flag.String("owner", "", "owner UUID")
	flag.Parse()
	if *kind != "retention" && *kind != "anonymization" {
		return fmt.Errorf("unknown simulation")
	}
	at, err := time.Parse(time.RFC3339, *asof)
	if err != nil {
		return fmt.Errorf("as-of must be RFC3339")
	}
	url, err := config.Secret("DATABASE_URL")
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	p, err := db.New(ctx, url)
	if err != nil {
		return fmt.Errorf("database unavailable")
	}
	defer p.Close()
	var report privacy.Report
	if *kind == "retention" {
		report, err = privacy.Retention(ctx, p, at)
	} else {
		report, err = privacy.Anonymization(ctx, p, *clinic, *owner, at)
	}
	if err != nil {
		return err
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(report)
}
