# Fase 2 — Núcleo: identidad + red (diferencial)

Fuente: `docs/TAREAS.md` T2-1..T2-10, `docs/DECISIONES.md` p-01/p-03/p-04/p-05/p-06/p-07/p-10/p-23/p-25.

## Objetivo
Usuarios/invitaciones/roles por clínica + regla de acceso owner-driven + solicitudes/consentimiento por email-link + freno `red.suspender` + auditoría. Salida: dos clínicas compartiendo una ficha con vigencia real.

## Tasks
- [x] T2-1 Usuarios/invitaciones/roles (matriz por clínica, invitaciones con expiración, lastAccess, anti-autobloqueo 409; muere `red.aprobar`, nace `red.suspender`)
- [x] T2-2 Regla acceso en cada lectura (accessLevel + grantStatus derivado; propio/compartido/ninguno + Vigente/Suspendido/Revocado/Vencido; lecturas operativas por tenant T1-3)
- [x] T2-3 Alcance en servidor (Ficha completa vs Resumen clínico, 404 vs 403, rate-limit + log)
- [x] T2-4 Solicitudes owner-driven (link token un solo uso hash 72h, estados, 409, renovar linkeada)
- [x] T2-5 Consentimiento owner-driven (RUT DV + aprueba/deniega/baja alcance, evidencia IP/timestamp, revocar mata grants)
- [x] T2-6 Freno emergencia `red.suspender` (solo origen Admin, motivo obligatorio, auditado, reversible)
- [x] T2-7 Auditoría red (insert en lectura compartido, visible origen + dueño, retención 2-3 años)
- [x] T2-8 Pendientes `GET /tasks` en servidor (fuentes disponibles, permisos filtran, `taskId` con `:`)
- [x] T2-9 Desactivar vet (409 + citas futuras, fix doctorId)
- [x] T2-10 Salida fase (dos clínicas compartiendo ficha con vigencia real)

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
- 2026-10-08: T2-1 cerrada sobre `review/fase-1-validacion` — `TestLastAdminAndCrossClinicMembership` + nuevo `TestInviteAcceptSingleUseAndExpiry` (invitar→aceptar→login, reuso 400/409, expirada 400) PASS en suite aislada `vetdata-tests`; `go vet` + `gofmt -l` limpios. Gap cerrado: el flujo de invitación no tenía test dedicado. Frontend con `red.aprobar` queda intacto hasta Fase 5.
- 2026-10-08: T2-2 cerrada — `TestOwnerConsentProjectionSuspensionAndRevocation` (ya existía, PASS) + nuevo `TestExpiredGrantDeniesRead` (grant con `until` pasado → GET 404 y excluido del listado) PASS; `go vet` + `gofmt` limpios. Aprendizajes: la decisión del dueño exige `scope` explícito (sin él → 400 `scope_escalation`); `sharing_grants` tiene `CHECK(until IS NULL OR until>=since)`, para simular vencido hay que mover `since` y `until` juntos.
- 2026-10-08: T2-3 cerrada — nuevo `TestNetworkSearchMinimalRateLimitAndAudit` PASS: tarjeta mínima sin fugas (ni RUT, chip, teléfono, diagnósticos ni historial), `network.searched` auditado, 429 al superar 20/min, 403 sin `red.solicitar`. Matriz confirmada en `server.go`: 401 sin sesión, 403 sin permiso (`permitted`), 404 sin acceso (sin leak), 429 con `limited`.
- 2026-10-08: T2-4 cerrada — `sendRequests` ahora rechaza duplicada pendiente con 409 `pending_request` explícito y acepta `previousRequestId` (renovación de a una ficha, enlace a solicitud terminal, aviso en el correo al dueño); `TestSharingDuplicatePendingAndRenewal` PASS + suite completa verde. Sin sucesión automática (D-14): el grant nuevo rige desde su aprobación, el anterior intacto. Contrato actualizado en `docs/backend/dominios/red-y-acceso.md`. Diferido con motivo: aviso proactivo 7 días antes del vencimiento (sin runner de jobs en el slice). Aprendizaje: en tests, no usar `CURRENT_DATE` para simular vencidos — pasada la medianoche UTC diverge de la fecha civil America/Santiago; usar fechas fijas.
- 2026-10-09: T2-5 cerrada — sin bypass de clínica en backend (solo el mock/seed lo menciona como deuda); nuevo `TestOwnerDecisionDeniesAndRecordsEvidence` PASS (denegar no crea grant, re-decidir 409, baja de alcance a Resumen, evidencia `consent_ip`/`consent_method=email-link` en DB) + suite completa verde. Helper `lastToken` en `sharing_test.go`: drena el outbox y busca hacia atrás el último mail con token (los mails de decisión no traen).
- 2026-10-09: T2-6 cerrada — nuevo `TestEmergencySuspensionTransitionsAndNotifications` PASS (422 sin motivo, 404 receptora suspende/restaura, doble suspensión/restauración 409, suspender vencido `inactive_grant`, dueño notificado por correo) + suite completa verde. Solo Admin origen puede frenar; revocado o vencido no se suspende ni se revive.
- 2026-10-09: T2-7 cerrada — nuevo `TestSharedReadAuditVisibleToOriginAndOwner` PASS (fila con clínica/usuario/alcance/hora, visible en `/sharing/audit` para Admin origen y en `/owner/sharing/audit` para el dueño vía email-link, 403 no-Admin, UPDATE/DELETE bloqueados por trigger) + suite completa verde. Retención por diseño: sin purga y trigger inmutable. `lastToken` ahora delega en `lastMarker` (los mails de login de dueño usan `#token=`).
- 2026-10-09: T2-8 cerrada — nuevo `tasks.go`: `GET /api/v1/tasks?view=` (fuentes disponibles: `solicitud:` con Alta si vence en 24 h + `llegada:` de hoy con Alta si urgencia; filtro por permiso del rol; vistas all/open/mine/done; orden prioridad+antigüedad) y `PATCH /api/v1/tasks/:taskId` (`:` URL-encode, `assignee` validado en la clínica, meta fusionada, `task.updated` auditado); `TestTasksComputedFilteredAndMeta` PASS + suite completa verde. Fuentes de fases 3/4 (vacunas, facturas, recetas, stock, tienda, seguridad, soporte) quedan fuera por criterio de validación. Contrato en `agenda-y-acceso.md` + `api.md`. Aprendizaje: filtrar por permiso del rol del actor, no de cualquier rol de la clínica.
- 2026-10-09: T2-9 cerrada — nuevo `TestVetLifecycleGeneratesDoctorIdAndBlocksDeactivation` PASS (invitar vet genera `doctorId` visible en `GET /users`, desactivar o cambiar rol con citas futuras 409 con lista, reasignar libera, desactivar 200) + suite completa verde. Aprendizaje: reasignar revalida contra grilla de slots (:00/:30) y horarios — en tests alinear la cita y dar `clinic_hours`/`doctor_hours` 24/7.
- 2026-10-09: T2-10 cerrada — nuevo `TestPhaseTwoExitTwoClinicsShareRecord` PASS (vigencia real 30 días, completa vs resumen sin escalamiento, suspensión/restauración, 8 decisiones concurrentes → 1 grant, renovación anticipada sin tocar el anterior, revocación con pérdida inmediata, 403 sin permiso, 3 auditorías) + suite completa verde. Cambios de comportamiento: renovación anticipada salta el bloqueo de acceso vigente (D-14, conviven sin sucesión) en `sendRequests` y `ownerDecision`; nota de renovación antes del enlace (ir después contaminaba el token). `TAREAS.md` T2-1..T2-10 a [x] + `docs/roadmap/cierre-fase-02.md` creado. Diferido: smoke `verify.yml` con Mailpit.
