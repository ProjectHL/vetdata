# Fase 1 — Fundaciones técnicas (backend Go + Postgres)

Fuente: `docs/TAREAS.md` T1-1..T1-10, `docs/DECISIONES.md` p-00/p-01/p-02/p-15/p-17, `docs/backend/transversales.md` §1,§5-§9.

## Objetivo
Repo backend compilable + migraciones base + seeds desde `frontend/src/mocks/` + auth mínima + convenciones API + utilidades transversales (RUT, montos, fechas, IDs). Nada de dominios todavía.

## Tasks
- [x] T1-1 Modelo + migraciones + seeds (groups, clinics, users, memberships, doctors, owners, role_permissions)
- [ ] T1-2 Auth base (cookie httpOnly + refresh rotation, GET /me, recovery stub, solo Activo)
- [ ] T1-3 Multitenant (tenant desde sesión, clinicId estable, membership por clínica/rol)
- [ ] T1-4 Convenciones API (REST /api/v1, errores tipados, paginación, envelope)
- [ ] T1-5 RUT (normalizar + DV módulo 11 + 400)
- [ ] T1-6 Montos (neto, CLP enteros, IVA 19% único)
- [ ] T1-7 Fechas (America/Santiago, ISO con offset)
- [ ] T1-8 IDs (UUID servidor, Idempotency-Key, correlativos por clínica)
- [ ] T1-9 CI + compose + observabilidad base
- [ ] T1-10 Horarios (estructura clínica/profesional/feriados, slots configurables)

## Evidencia
- T1-1: `backend/migrations/002_fase1_core.sql`, `backend/internal/model/model.go`, `backend/seeds/002_fase1_seeds.sql`, `backend/seeds/seeds_uuid_mapping.md`, `backend/scripts/apply_seeds.sh`. Fix post-delegación: `Invitacion pendiente` → `Invitación pendiente` (igual que `domain/network.ts`). Checks: `go build` OK, `go vet` OK, migración + seeds en PG17 sin errores (1/8/11/11/6/4/43).
