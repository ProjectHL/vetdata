-- 002_fase1_core: Fase 1 core model (groups, clinics, clinic_profiles,
-- sharing_policies, users, memberships, doctors, owners, role_permissions).
-- Decisiones: p-00 (Go+Postgres), p-02 (group+clinic_id, 1:1 inicio),
-- p-03 (owner global por RUT), p-01 (auth Fase 2, solo modelo),
-- p-17 (montos netos CLP enteros), p-15 (America/Santiago).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------------------
-- groups: agrupacion multitenant (p-02). Se usa 1:1 al inicio, pero
-- permite a futuro agrupar clinicas de una misma red.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- clinics: tenant operativo. El id (UUID estable) es la clave de
-- tenant (transversales.md §1.3). El nombre es dato de presentacion.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinics (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    sector       TEXT NOT NULL,
    address      TEXT NOT NULL,
    phone        TEXT NOT NULL,
    email        TEXT NOT NULL,
    specialties  TEXT[] DEFAULT '{}',
    status       TEXT NOT NULL CHECK (status IN ('Conectada', 'Invitación pendiente')),
    joined_at    DATE NOT NULL,
    last_sync    TIMESTAMPTZ,
    patients_ref INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- clinic_profiles: datos legales/ficha de la clinica (clinic profile).
-- Decision: tabla hija con PK clinic_id (1:1 con clinics). Se separa
-- para mantener clinics liviana (lookup de tenant) y permitir que el
-- perfil evolucione independientemente (p-03: clinica = custodia).
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_profiles (
    clinic_id   UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
    legal_name  TEXT NOT NULL,
    rut         TEXT NOT NULL,          -- normalizado sin puntos: "76543210-3"
    hours       TEXT,
    boxes       INT CHECK (boxes >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- sharing_policies: política de comparticion de la clinica de origen.
-- Decision: tabla hija con PK clinic_id (1:1). La política vive con la
-- clinica que es custodia de los datos (p-03), no con la que recibe.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sharing_policies (
    clinic_id         UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
    default_scope     TEXT NOT NULL CHECK (default_scope IN ('Ficha completa', 'Resumen clínico')),
    default_duration  INT CHECK (default_duration IN (30, 90)),
    require_consent   BOOLEAN NOT NULL DEFAULT TRUE,
    notify_requests   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- users: cuenta de usuario (login global por email).
-- Decision: tabla maestra de user. Status Activo|Invitado|Inactivo
-- (p-01: Invitado acepta invitacion; Inactivo bloqueado).
-- password_hash nullable para invitados que aun no aceptan.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    status        TEXT NOT NULL CHECK (status IN ('Activo', 'Invitado', 'Inactivo')),
    last_access   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- memberships: vinculo usuario-clinica con rol.
-- Decision: PK compuesta (user_id, clinic_id) + UNIQUE natural.
-- 4 roles fijos (settings.ts). p-02: vet en 2 clinicas = 2 memberships.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memberships (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    role      TEXT NOT NULL CHECK (role IN ('Admin', 'Veterinario', 'Recepción', 'Farmacia')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, clinic_id)
);

------------------------------------------------------------------------
-- doctors: profesionales mapa/agenda (domain/clinic.ts).
-- user_id nullable: link vet-doctor (p-25: crear vet genera doctor con
-- user_id, pero doctor puede existir sin usuario si se crea luego).
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    specialty  TEXT NOT NULL,
    initials   TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- owners: dueño de mascota, global por RUT (p-03).
-- RUT normalizado sin puntos con guion y DV modulo 11 (§6).
-- balance en CLP enteros netos (p-17).
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owners (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rut               TEXT NOT NULL UNIQUE,  -- "16482335-0"
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT NOT NULL,
    alt_phone         TEXT,
    address           TEXT NOT NULL,
    sector            TEXT NOT NULL,
    region            TEXT NOT NULL,
    birth_date        DATE NOT NULL,
    registered_at     DATE NOT NULL,
    preferred_contact TEXT NOT NULL CHECK (preferred_contact IN ('WhatsApp', 'Teléfono', 'Email')),
    emergency_contact JSONB,
    share_consent     BOOLEAN NOT NULL DEFAULT FALSE,
    consent_metadata  JSONB,                -- fecha, medio, evidencia (Fase 2)
    balance           INT NOT NULL DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------
-- role_permissions: matriz de permisos por clinica/rol (§4).
-- 21 permisos fijos en codigo (settings.ts PERMISSIONS). No hay FK a
-- un catalogo: la validacion de permisos vive en Go (T1-4+).
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('Admin', 'Veterinario', 'Recepción', 'Farmacia')),
    permission TEXT NOT NULL,
    PRIMARY KEY (clinic_id, role, permission)
);

------------------------------------------------------------------------
-- Índices de performance
------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clinics_group_id ON clinics(group_id);
CREATE INDEX IF NOT EXISTS idx_clinics_status   ON clinics(status);
CREATE INDEX IF NOT EXISTS idx_memberships_clinic_id ON memberships(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_user_id  ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_owners_rut       ON owners(rut);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
