// Package model defines the Fase 1 domain types for the VetData API.
// These types mirror the SQL in backend/migrations/002_fase1_core.sql
// and the seed contract in frontend/src/mocks/.
//
// Scope: model + migrations + seeds (T1-1). No handlers, no auth (T1-2+).
package model

import (
	"time"
)

// ClinicStatus reflects settings.ts ClinicStatus.
type ClinicStatus string

const (
	ClinicStatusConnected     ClinicStatus = "Conectada"
	ClinicStatusInvitePending ClinicStatus = "Invitación pendiente"
)

// UserStatus mirrors settings.ts UserStatus.
type UserStatus string

const (
	UserStatusActive   UserStatus = "Activo"
	UserStatusGuest    UserStatus = "Invitado"
	UserStatusInactive UserStatus = "Inactivo"
)

// Role mirrors settings.ts Role. Order must match the 4 roles in mocks.
type Role string

const (
	RoleAdmin       Role = "Admin"
	RoleVeterinario Role = "Veterinario"
	RoleRecepcion   Role = "Recepción"
	RoleFarmacia    Role = "Farmacia"
)

// AllRoles is the canonical ordered set of 4 fixed roles.
var AllRoles = []Role{RoleAdmin, RoleVeterinario, RoleRecepcion, RoleFarmacia}

// Permission is one of the 20 fixed permissions after decision p-10.
type Permission string

// AllPermissions lists the 20 fixed permissions in the order defined
// in frontend/src/domain/settings.ts. The role-permission matrix
// is stored per-clinic in role_permissions; the set itself is fixed.
var AllPermissions = []Permission{
	"ficha.ver",
	"ficha.editar",
	"agenda.gestionar",
	"facturas.emitir",
	"medicamentos.derivar",
	"farmacia.dispensar",
	"farmacia.inventario",
	"red.solicitar",
	"red.suspender",
	"tienda.vender",
	"tienda.inventario",
	"tienda.compras",
	"soporte.crear",
	"soporte.administrar",
	"seguridad.ver",
	"seguridad.boxes",
	"seguridad.grabaciones",
	"seguridad.administrar",
	"reportes.financiero",
	"usuarios.administrar",
}

// AccessScope mirrors domain/sharing.ts (default_scope in sharing_policies).
type AccessScope string

const (
	AccessScopeFull    AccessScope = "Ficha completa"
	AccessScopeSummary AccessScope = "Resumen clínico"
)

// PreferredContact mirrors owners.ts preferredContact.
type PreferredContact string

const (
	ContactWhatsApp PreferredContact = "WhatsApp"
	ContactPhone    PreferredContact = "Teléfono"
	ContactEmail    PreferredContact = "Email"
)

// Group is the multitenant group (p-02). 1:1 with clinics at Fase 1 start.
type Group struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Clinic is the operational tenant. ID is the stable tenant key.
type Clinic struct {
	ID          string       `json:"id"`
	GroupID     string       `json:"group_id"`
	Name        string       `json:"name"`
	Sector      string       `json:"sector"`
	Address     string       `json:"address"`
	Phone       string       `json:"phone"`
	Email       string       `json:"email"`
	Specialties []string     `json:"specialties"`
	Status      ClinicStatus `json:"status"`
	JoinedAt    time.Time    `json:"joined_at"`
	LastSync    *time.Time   `json:"last_sync,omitempty"`
	PatientsRef *int         `json:"patients_ref,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// ClinicProfile is the legal/profile data for a clinic (1:1 with Clinic).
type ClinicProfile struct {
	ClinicID  string    `json:"clinic_id"`
	LegalName string    `json:"legal_name"`
	RUT       string    `json:"-"` // normalized, e.g. "76543210-3"
	Hours     string    `json:"hours,omitempty"`
	Boxes     *int      `json:"boxes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SharingPolicy is the origin clinic's sharing policy (1:1 with Clinic).
type SharingPolicy struct {
	ClinicID        string      `json:"clinic_id"`
	DefaultScope    AccessScope `json:"default_scope"`
	DefaultDuration *int        `json:"default_duration,omitempty"` // 30 or 90; nil = permanent
	RequireConsent  bool        `json:"require_consent"`
	NotifyRequests  bool        `json:"notify_requests"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// User is the login account (email unique globally).
type User struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	PasswordHash *string    `json:"-"` // nil for invited/guest users
	Status       UserStatus `json:"status"`
	LastAccess   *time.Time `json:"last_access,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Membership links a user to a clinic with a role.
type Membership struct {
	UserID    string    `json:"user_id"`
	ClinicID  string    `json:"clinic_id"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RolePermissions is the per-clinic permission matrix (settings.ts RolePermissions).
type RolePermissions map[Role][]Permission

// DefaultRolePermissions mirrors frontend/src/mocks/settings.ts defaultRolePermissions.
func DefaultRolePermissions() RolePermissions {
	adminPerms := make([]Permission, len(AllPermissions))
	copy(adminPerms, AllPermissions)
	return RolePermissions{
		RoleAdmin:       adminPerms,
		RoleVeterinario: {"ficha.ver", "ficha.editar", "agenda.gestionar", "facturas.emitir", "medicamentos.derivar", "red.solicitar", "soporte.crear"},
		RoleRecepcion:   {"agenda.gestionar", "facturas.emitir", "red.solicitar", "tienda.vender", "soporte.crear", "seguridad.ver"},
		RoleFarmacia:    {"farmacia.dispensar", "farmacia.inventario", "facturas.emitir", "tienda.vender", "tienda.inventario", "tienda.compras", "soporte.crear", "seguridad.ver"},
	}
}

// Doctor is a professional on the clinic map/agenda (domain/clinic.ts).
type Doctor struct {
	ID        string    `json:"id"`
	ClinicID  string    `json:"clinic_id"`
	UserID    *string   `json:"user_id,omitempty"` // nullable (p-25)
	Name      string    `json:"name"`
	Specialty string    `json:"specialty"`
	Initials  string    `json:"initials"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Owner is the pet owner, identified globally by RUT (p-03).
type Owner struct {
	ID               string            `json:"id"`
	RUT              string            `json:"-"` // normalized: "16482335-0"
	FirstName        string            `json:"first_name"`
	LastName         string            `json:"last_name"`
	Email            string            `json:"email"`
	Phone            string            `json:"phone"`
	AltPhone         *string           `json:"alt_phone,omitempty"`
	Address          string            `json:"address"`
	Sector           string            `json:"sector"`
	Region           string            `json:"region"`
	BirthDate        time.Time         `json:"birth_date"`
	RegisteredAt     time.Time         `json:"registered_at"`
	PreferredContact PreferredContact  `json:"preferred_contact"`
	EmergencyContact *EmergencyContact `json:"emergency_contact,omitempty"`
	ShareConsent     bool              `json:"share_consent"`
	ConsentMetadata  *ConsentMetadata  `json:"consent_metadata,omitempty"` // Fase 2
	Balance          int               `json:"balance"`                    // CLP enteros netos (p-17)
	Notes            *string           `json:"notes,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

// EmergencyContact is the owner's emergency contact (owners.ts).
type EmergencyContact struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

// ConsentMetadata holds evidence of owner share-consent (Fase 2 owner-driven).
type ConsentMetadata struct {
	ConfirmedAt time.Time `json:"confirmed_at"`
	ConfirmedBy string    `json:"confirmed_by"` // user id or "owner"
	Method      string    `json:"method"`       // "firma", "SMS", "email_link", ...
}

// RolePermission is a single row in role_permissions (for inserts/queries).
type RolePermission struct {
	ClinicID   string     `json:"clinic_id"`
	Role       Role       `json:"role"`
	Permission Permission `json:"permission"`
}
