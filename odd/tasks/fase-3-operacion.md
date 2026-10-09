# Fase 3 — Operación diaria (tracking)

Objetivo: flujo clínico y financiero interno completo por API con operaciones transaccionales.
Rama: `review/fase-1-validacion`. Ruta: inline (delegación no disponible en este runner; decisión del usuario 2026-10-09).
Entrada: Fase 2 firmada (`docs/roadmap/cierre-fase-02.md`).

## Alcance autorizado

`backend/` + `docs/backend/` + `docs/roadmap/` + este archivo. `frontend/` intacto hasta Fase 5.

## Tareas

- [x] T3-1 Agenda + boxes (checkIn, callFromWaiting, finalización compuesta, updateRoom lista blanca, concurrencia, historial ocupación)
- [x] T3-2 Ficha escritura append-only + PatientStatus en servidor
- [x] T3-3 Facturación atómica + kardex + 409 sin stock
- [ ] T3-4 Descuento % por línea en servidor
- [ ] T3-5 Farmacia: receta vigente, dispense atómico, OC, ajustes, movement_lot, recepción parcial
- [ ] T3-6 Pagos manuales + saldo + Pagada
- [ ] T3-7 Notificaciones: capa abstracta + recordatorio citas (preferredContact + opt-out)
- [ ] T3-8 Modelo attachments con herencia de alcance
- [ ] T3-9 Salida fase: agenda → atiende → deriva → dispensa → factura → abono por API

## Progreso

- 2026-10-09: T3-1 cerrada — backend ya implementaba el flujo; nuevo `TestAgendaBoxesConcurrencyAndWhitelist` PASS (2 llamadas concurrentes al mismo box → 1x200+1x409, box ocupado 409, finish compone cita Realizada + limpieza + libera ocupantes, lista blanca solo limpieza→disponible con 404 cross-tenant, historial ocupado→limpieza→disponible, check-in futuro 409) + suite completa verde. Excepción test-first: verificación de comportamiento preexistente, sin RED previo.
- 2026-10-09: T3-2 cerrada — `POST /api/v1/patients/:id/records` + `TestClinicalRecordsAppendOnly` PASS + `PatientStatus` calculado por política configurable `PATIENT_STATUS_RULES` (default provisional: solo vacuna vencida → Control; Urgente solo por config; D-03 sigue abierto para valores clínicos). Tests: `TestPatientStatusDefaults/CustomPolicy/InvalidPolicy` (domain) + `TestPatientStatusFromDefaultRules` (handler) + `TestPatientStatusRulesEnv` (config) + suite completa verde.
- 2026-10-09: T3-3 cerrada — `POST /api/v1/invoices` + `GET /api/v1/invoices` (permiso `facturas.emitir`) + `TestInvoicesAtomicFolioStockAndRetry` PASS (folio 1-2-3 sin huecos, precios desde catálogo, kardex Venta FEFO con reference_id, reintento idem misma factura, 2×5 concurrentes sobre 7 → 1x201+1x409 y resto 2, 404/409 validaciones, tenant aislado) + suite completa verde. RED: la ruta no existía.
