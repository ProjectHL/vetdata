# Fase 6 — Endurecimiento (tracking)

Objetivo: cerrar riesgos de concurrencia, autorización y seguridad antes del piloto.
Rama: `review/fase-6-endurecimiento` (desde `main` @ `ce56e7c`). Ruta: un writer delegado por tarea.
Entrada: Fase 5 firmada (`docs/roadmap/cierre-fase-05.md`).

## Alcance autorizado

`backend/` + `docs/backend/` + `docs/roadmap/` + este archivo. `frontend/` intacto salvo que un control exija cambio mínimo de contrato (entonces se documenta, no se improvisa).

## Política de verificación (test-first backend)

El backend tiene runner Go con suites aisladas (base `vetdata-tests`, nunca migrar la real). Cada tarea: RED observable (test que falla) → GREEN (implementación) → refactor con suite completa verde. Registrar comandos y salida abajo.

## Tareas

- [ ] T6-1 Consolidar las 12 operaciones atómicas de transversales §8 en transacciones reales (fallo inyectado → rollback completo; pruebas concurrentes)
- [x] T6-2 PATCH con lista blanca + transiciones 409 + toggles con estado deseado; mock "no-op" eliminado (ningún no-op se presenta como éxito) — 2026-10-10: `voteIdea` a `{"voted":bool}` idempotente (decode 400, `FOR UPDATE`, `ON CONFLICT DO NOTHING`, no-op 200 sin write/audit, 409 Lanzada precede) + firma frontend `vote(id, voted)` en contracts/http/mock/store; tests `TestSupportVoteIdempotentAndNoOp` + `TestSupportVoteLaunchedIdea` PASS con DB real + suite `go test ./...` verde + `lint`/`tsc` limpios
- [ ] T6-3 2FA Admin/cámaras (p-01), auditoría administrativa/red completa, `tasks` servidor ya hecho (sin 2FA no hay acceso; recuperación no salta control ni bloquea último Admin)
- [ ] T6-4 Suite aislamiento tenant + red + permisos + stock no negativo + anti-autobloqueo admin sobre DB real (listas, detalle, búsqueda, tareas, analítica)
- [ ] T6-5 Salida fase: suite verde anti-filtración entre clínicas (cierre-fase-06.md)

## Progreso

- 2026-10-10: T6-2 cerrada — ver arriba. `decode` global + transiciones 409 ya existían; el único gap era `voteIdea` toggle. Writer delegado (superficies autorizadas) + fix parent: corregidos 2 bugs del writer en el test nuevo (`voted=false` borra de verdad, conteo concurrencia 2 no 1, 409 Lanzada con `voted=false` no-op) y 1 extra (`mock/support.ts` fuera de superficies pero necesario por cambio de firma — toggle optimista del mock ahora idempotente). Commit pendiente.
  - T6-1: las 12 ops ya corren en tx (`s.mutate` = `BEGIN` + `pg_advisory_xact_lock` por clínica + `COMMIT/ROLLBACK` en `mutation.go:28`; `sharing.ownerDecision` tx manual `sharing.go:286`; `tasks.updateTask` tx manual). `finishRoom` (`appointments.go:475`) ya es la operación compuesta que pedía §8. Resta: auditoría fina + tests de fallo inyectado y concurrencia, no conversión a tx. Riesgo: lecturas pre-tx en `retail.go:124,205` (dueño/dirección fuera de tx).
  - T6-2: `decode` rechaza desconocidos global (`server.go:131-132` `DisallowUnknownFields` → 400). `updateAppointment`, `updateRoom` (solo `limpieza→disponible`, 409), `updateSecurityEvent` (cerrado 409, transiciones 409), `updateUser` (self_change 409, invitación 409, citas futuras 409), `setPermission` (estado deseado `{granted}`, anti-autobloqueo `ensureAdmin`) ya cumplen. Gap: `voteIdea` (`support.go:652`) es toggle sin estado deseado + `SELECT` sin `FOR UPDATE` ni filtro clínica en idea. Riesgo: doble voto concurrente / no-op como éxito.
  - T6-3: 2FA inexistente (`grep totp|2fa|otp` vacío en `*.go`+`*.sql`). Auditoría base existe (`audit()` en mutates; `ownerRevoke/sharingAudit/ownerAudit` en `owner_access.go`). Tasks en servidor SÍ (`tasks.go` list+update con tx). Riesgo: T6-3 es greenfield y exige política (enrolamiento/desafío/recuperación) antes de rutas.
  - T6-4: 16 suites `*_test.go` existen (incl. concurrencia retail y phase_exit). Falta suite sistemática de aislamiento (2 tenants/grupos × todos los roles × listas/detalle/búsqueda/tareas/analítica) + stock no negativo + anti-autobloqueo como gate único.
