# Cierre técnico de Fase 2

Fecha: 2026-10-09. Rama: `review/fase-1-validacion` (commits T2-1..T2-10 sobre `fa14264`).

## Alcance

Identidad + red owner-driven mediante API y Postgres. La integración de pantallas permanece en Fase 5; el frontend conserva `red.aprobar` y flujos de aprobación por clínica solo como deuda visual sin autorización real en la API.

## Matriz T2

| Tarea | Estado técnico | Evidencia verificable |
|---|---|---|
| T2-1 | validada | `TestLastAdminAndCrossClinicMembership` + `TestInviteAcceptSingleUseAndExpiry`: invitaciones 72 h un solo uso, `lastAccess`, anti-autobloqueo 409, `red.suspender` solo Admin. |
| T2-2 | validada | `TestOwnerConsentProjectionSuspensionAndRevocation` + `TestExpiredGrantDeniesRead`: propio/compartido/ninguno, Vigente/Suspendido/Revocado/Vencido, operativas por tenant. |
| T2-3 | validada | `TestNetworkSearchMinimalRateLimitAndAudit`: tarjeta mínima sin fugas, `network.searched` auditado, 429, 403; matriz 401/403/404/429. |
| T2-4 | validada | `TestSharingDuplicatePendingAndRenewal`: 409 `pending_request` explícito, renovación linkeada (`previousRequestId`) sin sucesión (D-14), aviso en correo al dueño. |
| T2-5 | validada | `TestOwnerDecisionDeniesAndRecordsEvidence`: denegar no crea grant, re-decidir 409, baja de alcance, evidencia `consent_ip`/`consent_method=email-link`. Sin bypass de clínica. |
| T2-6 | validada | `TestEmergencySuspensionTransitionsAndNotifications`: 422 sin motivo, 404 receptora, doble transición 409, `inactive_grant` en vencido, dueño notificado. |
| T2-7 | validada | `TestSharedReadAuditVisibleToOriginAndOwner`: fila por lectura compartida, visible origen y dueño, 403 no-Admin, trigger inmutable (retención por diseño, sin purga). |
| T2-8 | validada | `TestTasksComputedFilteredAndMeta`: `GET /api/v1/tasks?view=` (solicitudes + llegadas de hoy, filtro por rol) y `PATCH /api/v1/tasks/:taskId` (`:` URL-encode, `task_meta`, `task.updated`). Fuentes de fases 3/4 fuera por criterio. |
| T2-9 | validada | `TestVetLifecycleGeneratesDoctorIdAndBlocksDeactivation`: crear vet genera `doctorId`, 409 con citas futuras en desactivar/cambiar rol, reasignar libera. |
| T2-10 | validada | `TestPhaseTwoExitTwoClinicsShareRecord`: dos clínicas, vigencia real 30 días (`until == since + 30`), lectura completa + resumen sin escalamiento por grant, suspensión/restauración, 8 decisiones concurrentes → un solo grant, renovación anticipada sin tocar el grant anterior, revocación con pérdida inmediata, PATCH sin permiso 403, 3 lecturas auditadas. |

## Comandos de aceptación

Desde la raíz:

```powershell
docker compose -f infra/docker-compose.test.yml run --rm test
```

Resultado: salida 0 en `gofmt` + `go vet` + suite Go/Postgres completa en proyecto aislado `vetdata-tests`. Sin tocar la base `vetdata` del usuario.

## Revisión y límites

- Revisor técnico automatizado: Codex + pruebas reproducibles anteriores. Revisión humana del desarrollador: ver observaciones.
- Pendiente fuera de alcance: smoke `verify.yml` con Mailpit (imagen final + SMTP real) y aviso proactivo 7 días antes del vencimiento (sin runner de jobs en el slice).
- Decisiones aplicadas: renovación anticipada convive con el grant anterior sin sucesión (D-14); `previousRequestId` en `POST /sharing/requests` en lugar del endpoint dedicado `:id/renew`; tareas de fases 3/4 en servidor quedan para sus fases.
- El próximo cierre es Fase 3.

## Observaciones del desarrollador

- 2026-10-09 — Revisión sobre `review/fase-1-validacion` (T2-1..T2-10 en commits `6772d6b`..`3d5d837` + salida).
- Escenario: suite aislada `vetdata-tests` (base efímera), runs `go test` por paquete y completos, `go vet` + `gofmt -l` limpios vía `check.sh`.
- Resultado: T2-1..T2-10 verdes con la evidencia de la matriz; dos correcciones de comportamiento en el camino (renovación anticipada permitida con grant vigente; nota de renovación antes del enlace para no contaminar el token).
- Decisión: se firma el cierre técnico de Fase 2 para desarrollo por API. Se avanza a Fase 3 desde T3-1.
