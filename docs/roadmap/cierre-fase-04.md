# Cierre técnico de Fase 4

Fecha: 2026-10-09. Rama: `review/fase-4-dominios` (commits T4-1..T4-6 sobre `92bb5ab`).

## Alcance

Dominios operativos y agregación de red por API con autorización, auditoría y privacidad en servidor. Integración de pantallas en Fase 5; roles custom diferidos con acta (no es faltante del MVP).

## Matriz T4

| Tarea | Estado técnico | Evidencia verificable |
|---|---|---|
| T4-1 | validada | `TestRetailCheckoutAtomicAndConcurrency` / `TestRetailTransferReceiveAndAdjust` / `TestRetailShipmentsAdvance`: checkout crea venta+movimientos+despacho juntos, 2×última unidad → 1×201+1×409 sin negativo, transferencia preserva total, despacho con tarifa fija 3990 bruto. |
| T4-2 | validada | `TestSecurityEventsLifecycleAndClosure` / `TestSecuritySettingsAndValidation`: crear/anotar con `seguridad.ver`, cerrar solo `seguridad.administrar` (403 ver), `resolvedAt` inmutable sin reapertura (409), auditoría generada por servidor. |
| T4-3 | validada | `TestSupportTicketsIdeasAndStaff`: tickets+ideas+`proposeIdea` atómico, Staff en clínica fantasma `0000…0002` con login dedicado, `switchClinic` 403 a Staff, SLA horas corridas, `mutate` admite `permission=""` para staff. |
| T4-4 | validada | `TestAnalytics*` 9/9: job diario `recomputeAnalyticsDaily`, k≥5 (4 suprime, 5 publica), opt-out excluye red, base sector del dueño, nota editorial VetData, sin fichas/contactos ajenos; vacunas (por especie y por vacuna), ingresos y por línea con `reportes.financiero`, boxes por eventos. Límites: gate diagnosis global, rollup daily cota superior multi-día, alerts solo alzas. |
| T4-5 | evaluada | Acta en TAREAS: roles custom diferidos; MVP con 4 fijos + ajuste por clínica vía `role_permissions` con anti-autobloqueo 409. No es funcionalidad faltante. |
| T4-6 | validada | 10 dominios con endpoints reales y 403 por dominio: `TestAgendaRequiresPermission`, `TestInventoryRequiresPermission`, `TestBillingRequiresPermission`, `TestRetailRequiresPermission`, `TestTasksRequiresPermission`, `TestReferralsRequiresPermission` + 403 preexistentes (auth, clinical, sharing, security, support, analytics, attachments). |

## Comandos de aceptación

Desde la raíz:

```powershell
docker compose -f infra/docker-compose.test.yml run --rm test
```

Resultado: salida 0 en `gofmt` + `go vet` + suite Go/Postgres completa en proyecto aislado `vetdata-tests`. Sin tocar la base `vetdata` del usuario.

## Revisión y límites

- Revisor técnico automatizado: pruebas reproducibles por tarea. Verificación independiente de analítica: partial con 4 límites documentados arriba (decisión del desarrollador: se aceptan para el MVP).
- Pendiente fuera de alcance: fórmulas exactas de cobertura vacunal (D-04 parcial), horarios por clínica para boxes (aproximación por eventos), smoke `verify.yml` con Mailpit, storage real de adjuntos, SII/DTE.
- Decisiones aplicadas: despacho tarifa fija 3990 bruto hasta tabla por clínica; Staff vía clínica fantasma sin tabla global; `deductLotsAt` FEFO para sala; medication+product → farmacia en revenue-by-line; alerts solo alzas con nota editorial.
- El próximo cierre es Fase 5 (integración frontend).
