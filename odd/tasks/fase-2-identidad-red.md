# Fase 2 — Núcleo: identidad + red (diferencial)

Fuente: `docs/TAREAS.md` T2-1..T2-10, `docs/DECISIONES.md` p-01/p-03/p-04/p-05/p-06/p-07/p-10/p-23/p-25.

## Objetivo
Usuarios/invitaciones/roles por clínica + regla de acceso owner-driven + solicitudes/consentimiento por email-link + freno `red.suspender` + auditoría. Salida: dos clínicas compartiendo una ficha con vigencia real.

## Tasks
- [ ] T2-1 Usuarios/invitaciones/roles (matriz por clínica, invitaciones con expiración, lastAccess, anti-autobloqueo 409; muere `red.aprobar`, nace `red.suspender`)
- [ ] T2-2 Regla acceso en cada lectura (accessLevel + grantStatus derivado)
- [ ] T2-3 Alcance en servidor (Ficha completa vs Resumen clínico, 404 vs 403, rate-limit + log)
- [ ] T2-4 Solicitudes owner-driven (link token un solo uso hash 72h, estados, 409, renovar linkeada)
- [ ] T2-5 Consentimiento owner-driven (RUT DV + aprueba/deniega/baja alcance, evidencia IP/timestamp, revocar mata grants)
- [ ] T2-6 Freno emergencia `red.suspender` (solo origen Admin, motivo obligatorio, auditado, reversible)
- [ ] T2-7 Auditoría red (insert en lectura compartido, visible origen + dueño, retención 2-3 años)
- [ ] T2-8 Pendientes `GET /tasks` replicando `lib/tasks.ts`
- [ ] T2-9 Desactivar vet (409 + citas futuras, fix doctorId)
- [ ] T2-10 Salida fase (dos clínicas compartiendo ficha con vigencia real)

## Alcance autorizado
Rama de trabajo nueva desde `review/fase-1-validacion`. Solo `backend/` + `docs/backend/` + docs de fase. Sin tocar `frontend/` hasta Fase 5.

## Criterios de aceptación
- Cada T2 con tests nominales PASS en suite aislada + `go vet` / `gofmt` limpios.
- T2-10 verificable extremo a extremo con vigencia real.

## Checks aplicables
- `docker compose -f infra/docker-compose.test.yml run --rm test` (o `go test` por paquete como override)
- `go vet ./...`, `gofmt -l` vacío
- Smoke `verify.yml` solo donde aplique SMTP/links reales.

## Progreso
- 2026-10-08: tracking creado al firmar Fase 1. Siguiente: T2-1.
