// Package bootstrap provides an operator-only first administrator setup.
package bootstrap

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/model"
	"golang.org/x/crypto/bcrypt"
	"net/mail"
	"strings"
)

type Input struct {
	ClinicID, Name, Email, Password string
	Tenant                          *Tenant
}
type Tenant struct{ GroupID, GroupName, ClinicName, Sector, Address, Phone, LegalName, RUT string }

func Apply(ctx context.Context, pool *pgxpool.Pool, in Input) (string, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	address, e := mail.ParseAddress(in.Email)
	if e != nil || address.Address != in.Email || !domain.ValidID(in.ClinicID) || strings.TrimSpace(in.Name) == "" || len(in.Name) > 200 || len(in.Password) < 12 || len(in.Password) > 72 {
		return "", errors.New("clinic UUID, name, email and a 12–72 byte password are required")
	}
	hash, e := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
	if e != nil {
		return "", e
	}
	tx, e := pool.Begin(ctx)
	if e != nil {
		return "", e
	}
	defer tx.Rollback(context.Background())
	if in.Tenant != nil {
		t := in.Tenant
		rut, err := domain.NormalizeRUT(t.RUT)
		if err != nil || !domain.ValidID(t.GroupID) || strings.TrimSpace(t.GroupName) == "" || strings.TrimSpace(t.ClinicName) == "" || strings.TrimSpace(t.Address) == "" || strings.TrimSpace(t.Sector) == "" || strings.TrimSpace(t.LegalName) == "" {
			return "", errors.New("complete tenant identity and valid RUT required")
		}
		if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", t.GroupID); e != nil {
			return "", e
		}
		if _, e = tx.Exec(ctx, "INSERT INTO groups(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING", t.GroupID, t.GroupName); e != nil {
			return "", e
		}
		if _, e = tx.Exec(ctx, `INSERT INTO clinics(id,group_id,name,sector,address,phone,email,status,joined_at) VALUES($1,$2,$3,$4,$5,$6,$7,'Conectada',CURRENT_DATE) ON CONFLICT(id) DO NOTHING`, in.ClinicID, t.GroupID, t.ClinicName, t.Sector, t.Address, t.Phone, in.Email); e != nil {
			return "", e
		}
		var group string
		if e = tx.QueryRow(ctx, "SELECT group_id FROM clinics WHERE id=$1", in.ClinicID).Scan(&group); e != nil || group != t.GroupID {
			return "", errors.New("clinic belongs to another group")
		}
		if _, e = tx.Exec(ctx, "INSERT INTO clinic_profiles(clinic_id,legal_name,rut) VALUES($1,$2,$3) ON CONFLICT(clinic_id) DO NOTHING", in.ClinicID, t.LegalName, rut); e != nil {
			return "", e
		}
		if _, e = tx.Exec(ctx, "INSERT INTO sharing_policies(clinic_id,default_scope,default_duration) VALUES($1,'Resumen clínico',30) ON CONFLICT(clinic_id) DO NOTHING", in.ClinicID); e != nil {
			return "", e
		}
	}
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", in.ClinicID); e != nil {
		return "", e
	}
	var clinic string
	if e = tx.QueryRow(ctx, "SELECT id FROM clinics WHERE id=$1", in.ClinicID).Scan(&clinic); e != nil {
		return "", e
	}
	var id, status string
	var existing *string
	e = tx.QueryRow(ctx, "SELECT id,password_hash,status FROM users WHERE lower(email)=$1 FOR UPDATE", in.Email).Scan(&id, &existing, &status)
	if e != nil && e != pgx.ErrNoRows {
		return "", e
	}
	if e == nil {
		// Never reset an established account or elevate an existing membership.
		var role string
		if e = tx.QueryRow(ctx, "SELECT role FROM memberships WHERE user_id=$1 AND clinic_id=$2 AND status='Activo'", id, in.ClinicID).Scan(&role); e != nil || role != "Admin" || status != "Activo" {
			return "", errors.New("existing account is not an active administrator of this clinic")
		}
		if existing != nil && *existing != "" {
			return id, nil
		}
		if _, e = tx.Exec(ctx, "UPDATE users SET password_hash=$2 WHERE id=$1 AND (password_hash IS NULL OR password_hash='')", id, string(hash)); e != nil {
			return "", e
		}
	} else {
		id = domain.UUID()
		if _, e = tx.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,$2,$3,$4,'Activo')", id, in.Name, in.Email, string(hash)); e != nil {
			return "", e
		}
		if _, e = tx.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role,status) VALUES($1,$2,'Admin','Activo')", id, in.ClinicID); e != nil {
			return "", e
		}
	}
	for _, p := range model.AllPermissions {
		if _, e = tx.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin',$2) ON CONFLICT DO NOTHING", in.ClinicID, string(p)); e != nil {
			return "", e
		}
	}
	if _, e = tx.Exec(ctx, "INSERT INTO audit_events(clinic_id,actor_id,action,resource_id) VALUES($1,$2,'bootstrap.admin',$3)", in.ClinicID, id, id); e != nil {
		return "", e
	}
	if e = tx.Commit(ctx); e != nil {
		return "", e
	}
	return id, nil
}
