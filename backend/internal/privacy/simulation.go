// Package privacy provides read-only operational assessments. It never deletes.
package privacy

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vetdata/api/internal/domain"
	"time"
)

type Category struct {
	Name       string     `json:"name"`
	Total      int64      `json:"total"`
	Candidates int64      `json:"candidates"`
	Cutoff     *time.Time `json:"cutoff,omitempty"`
	Reason     string     `json:"reason"`
}
type Report struct {
	Version    string     `json:"version"`
	AsOf       time.Time  `json:"asOf"`
	DryRun     bool       `json:"dryRun"`
	Categories []Category `json:"categories"`
}

func Retention(ctx context.Context, p *pgxpool.Pool, at time.Time) (Report, error) {
	report := Report{Version: "retention-v1", AsOf: at.UTC(), DryRun: true}
	if at.IsZero() {
		return report, errors.New("explicit as-of timestamp required")
	}
	tx, err := p.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return report, err
	}
	defer tx.Rollback(context.Background())
	cutoff := at.UTC().AddDate(-5, 0, 0)
	general := Category{Name: "general-audit", Cutoff: &cutoff, Reason: "p-19: five years; simulation only; immutable audit preserved"}
	if err = tx.QueryRow(ctx, "SELECT count(*),count(*) FILTER(WHERE created_at < $1) FROM audit_events", cutoff).Scan(&general.Total, &general.Candidates); err != nil {
		return report, err
	}
	report.Categories = append(report.Categories, general)
	for _, entry := range []struct{ name, table, reason string }{
		{"shared-reads", "shared_read_audit", "D-01 unresolved: retain all"},
		{"consent", "sharing_grants", "D-01/D-07 unresolved: retain all"},
		{"clinical", "clinical_records", "D-07 unresolved: retain all"},
	} {
		c := Category{Name: entry.name, Reason: entry.reason}
		if err = tx.QueryRow(ctx, "SELECT count(*) FROM "+entry.table).Scan(&c.Total); err != nil {
			return report, err
		}
		report.Categories = append(report.Categories, c)
	}
	report.Categories = append(report.Categories, Category{Name: "video", Reason: "p-19: default 30 days; no real recording storage before phase 8; nothing to purge"})
	return report, tx.Commit(ctx)
}

func Anonymization(ctx context.Context, p *pgxpool.Pool, clinic, owner string, at time.Time) (Report, error) {
	report := Report{Version: "anonymization-v1", AsOf: at.UTC(), DryRun: true}
	if !domain.ValidID(clinic) || !domain.ValidID(owner) || at.IsZero() {
		return report, errors.New("clinic, owner UUID and as-of required")
	}
	tx, err := p.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return report, err
	}
	defer tx.Rollback(context.Background())
	var exists bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM clinic_owners WHERE clinic_id=$1 AND owner_id=$2)", clinic, owner).Scan(&exists); err != nil {
		return report, err
	}
	if !exists {
		return report, errors.New("owner not linked to clinic")
	}
	queries := []struct{ name, query string }{
		{"global-owner-links", `SELECT count(*) FROM clinic_owners WHERE owner_id=$2 AND $1::uuid IS NOT NULL`},
		{"own-patients", `SELECT count(*) FROM patients WHERE origin_clinic_id=$1 AND owner_id=$2`},
		{"clinical", `SELECT count(*) FROM clinical_records c JOIN patients p ON p.id=c.patient_id WHERE c.clinic_id=$1 AND p.owner_id=$2`},
		{"invoices", `SELECT count(*) FROM invoices WHERE clinic_id=$1 AND owner_id=$2`},
		{"retail-sales", `SELECT count(*) FROM retail_sales WHERE clinic_id=$1 AND owner_id=$2`},
		{"shipments", `SELECT count(*) FROM shipments WHERE clinic_id=$1 AND owner_id=$2`},
		{"attachments", `SELECT count(*) FROM attachments a JOIN patients p ON p.id=a.patient_id WHERE a.clinic_id=$1 AND p.owner_id=$2`},
	}
	for _, q := range queries {
		c := Category{Name: q.name, Reason: "D-07 pending; no changes authorized"}
		if err = tx.QueryRow(ctx, q.query, clinic, owner).Scan(&c.Total); err != nil {
			return report, err
		}
		report.Categories = append(report.Categories, c)
	}
	for _, name := range []string{"encrypted-outbox", "audit-and-free-text", "backups", "external-provider-copies"} {
		report.Categories = append(report.Categories, Category{Name: name, Reason: "manual inventory required; not counted; D-07 pending"})
	}
	return report, tx.Commit(ctx)
}
