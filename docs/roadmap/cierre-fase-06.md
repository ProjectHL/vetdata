# Cierre técnico de Fase 6

Fecha: 2026-10-10. Rama: `review/fase-6-endurecimiento` (commits T6-1..T6-4 sobre `ce56e7c`).

## Alcance

Endurecimiento backend: atomicidad, transiciones y toggles idempotentes, 2FA mínimo para Admin, y gate de aislamiento/permisos sobre DB real. `frontend/` solo cambió la firma de `support.vote(id, voted)` para consumir el contrato idempotente de T6-2.

## Matriz T6

| Tarea | Estado técnico | Evidencia verificable |
|---|---|---|
| T6-1 | validada | Las 12 operaciones de `transversales.md` §8 usan transacción real (`mutate` o tx manual). Gap corregido: `checkoutRetail` movió resolución de dueño/address/sector dentro de la tx con `FOR UPDATE OF o`. Test `TestRetailCheckoutOwnerSnapshotInTx` confirma snapshot vigente y 404 sin vínculo; suite completa verde. |
| T6-2 | validada | `voteIdea` dejó de ser toggle: acepta `{voted}` idempotente, lock `FOR UPDATE`, `ON CONFLICT DO NOTHING`, no-op 200 sin write/audit, `Lanzada` 409. Frontend y mock actualizados. Tests `TestSupportVoteIdempotentAndNoOp` y `TestSupportVoteLaunchedIdea` verdes. |
| T6-3 | validada con límite | 2FA mínimo para Admin con códigos de recuperación de un uso: `POST /auth/mfa/enroll`, login Admin enrolado devuelve 202 challenge sin cookies, `POST /auth/mfa/verify` consume código y emite sesión. Reset de password no salta 2FA. Migración 013 aditiva. Límite: no hay TOTP/app autenticadora ni cámaras reales (hardware diferido a Fase 8). |
| T6-4 | validada | Nuevo `isolation_test.go` cubre dos clínicas, roles, listas/detalle, búsqueda de red, tareas y analítica. Descubrió y corrigió bug real: `GET /support/ideas` devolvía 500 por SQL sin cierre de subquery. Suite completa verde con DB real. |
| T6-5 | validada | `go test ./... -count=1` verde contra `vetdata-tests` Postgres real; cero defectos abiertos de filtración, doble operación, stock negativo o escalamiento en el alcance probado. |

## Comandos de aceptación

Desde `backend/`, con `TEST_DATABASE_URL=postgresql://vetdata_test:test-only@172.24.0.2:5432/vetdata_test?sslmode=disable` y `REQUIRE_INTEGRATION=1`:

```bash
go test ./internal/handler/ -run 'TestSupport' -count=1
go test ./internal/handler/ -run 'TestRetailCheckoutOwnerSnapshotInTx' -count=1
go test ./internal/handler/ -run 'TestIsolation' -count=1
go test ./internal/handler/ -run 'TestAdminMFA|TestMFA' -count=1
go test ./... -count=1
```

Suite completa observada verde:

```text
ok github.com/vetdata/api/internal/handler 41.167s
ok github.com/vetdata/api/migrations 1.455s
ok github.com/vetdata/api/seeds 0.772s
```

## Revisión y límites

- T6-1 confirma atomicidad por transacción y tests de concurrencia existentes; el nuevo gap era lectura pre-tx en retail.
- T6-2 cambió contrato de `support.vote` a estado deseado; el mock también se volvió idempotente.
- T6-3 implementa política mínima documentada: Admin puede enrolar recovery codes; un Admin enrolado no obtiene sesión hasta completar el challenge; reset de password revoca sesiones pero conserva el segundo factor. No se implementa TOTP ni gestión UI de códigos.
- T6-4 opera sobre fixtures aisladas, nunca datos reales.
- Pendiente fuera de Fase 6: E2E navegador manual de Fase 5, cámaras/NVR reales (Fase 8), TOTP/app autenticadora si se decide elevar el factor.
