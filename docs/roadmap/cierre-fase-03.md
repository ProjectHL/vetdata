# Cierre técnico de Fase 3

Fecha: 2026-10-09. Rama: `review/fase-1-validacion` (commits T3-1..T3-9 sobre `6671016`).

## Alcance

Operación diaria por API con operaciones transaccionales. Integración de pantallas en Fase 5; D-02 (bandeja de derivaciones recibidas externas) y D-03 (valores clínicos de `PatientStatus`) siguen abiertos con mecanismo entregado.

## Matriz T3

| Tarea | Estado técnico | Evidencia verificable |
|---|---|---|
| T3-1 | validada | `TestAgendaBoxesConcurrencyAndWhitelist`: 2 llamadas concurrentes → 1×200+1×409, finish compone Realizada+limpieza, lista blanca, historial, check-in solo hoy. |
| T3-2 | validada | `POST /patients/:id/records` + `TestClinicalRecordsAppendOnly` (corrección vinculada, trigger anti-UPDATE) + `PatientStatus` por política `PATIENT_STATUS_RULES` (default provisional administrativo). |
| T3-3 | validada | `POST /invoices` + `TestInvoicesAtomicFolioStockAndRetry`: folio 1-2-3 sin huecos, precios de catálogo, kardex Venta FEFO, reintento idempotente, concurrencia. |
| T3-4 | validada | `TestInvoiceLineDiscounts`: `discount` 0–100 por línea, totales manipulados → 400. |
| T3-5 | parcial | Derivaciones internas + `dispense` atómico + receta en factura (`TestReferralsDispenseAndInvoiceGate`). Bloqueado: bandeja recibidas externa (D-02). |
| T3-6 | validada | `POST /invoices/:id/payments` + `TestInvoicePaymentsPartialAndBalance`: abonos, sobrepago 409, `Pagada`, `balance` como deuda. |
| T3-7 | validada | `TestAppointmentRemindersRespectContactAndOptOut`: envío por outbox, idempotencia por cita, opt-out y cancelación suprimen pendientes. |
| T3-8 | validada | `TestAttachmentsInheritScope`: solo metadatos, cuarentena, Resumen solo vacunas, moderación terminal. |
| T3-9 | validada | `TestPhaseThreeExitFullVetFlow`: agenda → atiende → deriva → dispensa → factura → abono con evidencia SQL de atomicidad. |

## Comandos de aceptación

Desde la raíz:

```powershell
docker compose -f infra/docker-compose.test.yml run --rm test
```

Resultado: salida 0 en `gofmt` + `go vet` + suite Go/Postgres completa en proyecto aislado `vetdata-tests`. Sin tocar la base `vetdata` del usuario.

## Revisión y límites

- Revisor técnico automatizado: pruebas reproducibles por tarea. Revisión humana del desarrollador: ver observaciones.
- Pendiente fuera de alcance: smoke `verify.yml` con Mailpit; aviso proactivo 7 días (sin runner); pasarela de pagos y arqueo; storage real de adjuntos (S3); listas de precios por convenio.
- Decisiones aplicadas: `balance` del dueño como deuda; `PatientStatus` configurable con default administrativo; una factura por derivación (`invoiced_at`); firma simple = actor autenticado.
- El próximo cierre es Fase 4.

## Observaciones del desarrollador

- 2026-10-09 — Revisión sobre `review/fase-1-validacion` (T3-1..T3-9 en commits `e4f6be5`..`salida`).
- Escenario: suite aislada `vetdata-tests` (base efímera), runs por paquete y completos, `go vet` + `gofmt -l` limpios vía `check.sh`.
- Resultado: T3-1..T3-4 y T3-6..T3-9 verdes con la evidencia de la matriz; T3-5 parcial por D-02.
- Tres hallazgos pgx en el camino (DATE/time.Time, parámetro sin tipo en `jsonb_build_object`, `ANY` con uuid) documentados en el tracking.
- Decisión: se firma el cierre técnico de Fase 3 para desarrollo por API, con T3-5 parcial explícito. Se avanza a Fase 4 desde T4-1.
