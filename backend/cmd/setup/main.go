// Command setup runs migrations and optional development seeds/admin bootstrap.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"github.com/vetdata/api/internal/bootstrap"
	"github.com/vetdata/api/internal/db"
	"github.com/vetdata/api/migrations"
	"github.com/vetdata/api/seeds"
	"os"
	"strings"
	"time"
)

func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
func run() error {
	seed := flag.Bool("seed-dev", false, "Install optional development fixtures")
	admin := flag.Bool("admin", false, "Bootstrap admin; password read from stdin")
	flag.Parse()
	if *seed && os.Getenv("APP_ENV") == "production" {
		return fmt.Errorf("development seeds are forbidden in production")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	pool, e := db.New(ctx, url)
	if e != nil {
		return e
	}
	defer pool.Close()
	if e = migrations.Apply(ctx, pool); e != nil {
		return e
	}
	if *seed {
		if e = seeds.Apply(ctx, pool); e != nil {
			return e
		}
	}
	if *admin {
		password, e := bufio.NewReader(os.Stdin).ReadString('\n')
		if e != nil {
			return fmt.Errorf("password must be supplied on stdin followed by newline")
		}
		id, e := bootstrap.Apply(ctx, pool, bootstrap.Input{ClinicID: os.Getenv("BOOTSTRAP_CLINIC_ID"), Name: os.Getenv("BOOTSTRAP_NAME"), Email: os.Getenv("BOOTSTRAP_EMAIL"), Password: strings.TrimRight(password, "\r\n")})
		if e != nil {
			return e
		}
		fmt.Println("Administrator ready:", id)
	}
	fmt.Println("Setup complete")
	return nil
}
