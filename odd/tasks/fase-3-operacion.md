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
- [x] T3-4 Descuento % por línea en servidor
- [ ] T3-5 Farmacia: receta vigente, dispense atómico, OC, ajustes, movement_lot, recepción parcial
- [x] T3-6 Pagos manuales + saldo + Pagada
- [x] T3-7 Notificaciones: capa abstracta + recordatorio citas (preferredContact + opt-out)
- [ ] T3-8 Modelo attachments con herencia de alcance
- [ ] T3-9 Salida fase: agenda → atiende → deriva → dispensa → factura → abono por API

## Progreso

- 2026-10-09: T3-1 cerrada — backend ya implementaba el flujo; nuevo `TestAgendaBoxesConcurrencyAndWhitelist` PASS (2 llamadas concurrentes al mismo box → 1x200+1x409, box ocupado 409, finish compone cita Realizada + limpieza + libera ocupantes, lista blanca solo limpieza→disponible con 404 cross-tenant, historial ocupado→limpieza→disponible, check-in futuro 409) + suite completa verde. Excepción test-first: verificación de comportamiento preexistente, sin RED previo.
- 2026-10-09: T3-2 cerrada — `POST /api/v1/patients/:id/records` + `TestClinicalRecordsAppendOnly` PASS + `PatientStatus` calculado por política configurable `PATIENT_STATUS_RULES` (default provisional: solo vacuna vencida → Control; Urgente solo por config; D-03 sigue abierto para valores clínicos). Tests: `TestPatientStatusDefaults/CustomPolicy/InvalidPolicy` (domain) + `TestPatientStatusFromDefaultRules` (handler) + `TestPatientStatusRulesEnv` (config) + suite completa verde.
- 2026-10-09: T3-3 cerrada — `POST /api/v1/invoices` + `GET /api/v1/invoices` (permiso `facturas.emitir`) + `TestInvoicesAtomicFolioStockAndRetry` PASS (folio 1-2-3 sin huecos, precios desde catálogo, kardex Venta FEFO con reference_id, reintento idem misma factura, 2×5 concurrentes sobre 7 → 1x201+1x409 y resto 2, 404/409 validaciones, tenant aislado) + suite completa verde. RED: la ruta no existía.
- 2026-10-09: T3-4 cerrada — `discount` 0–100 por línea con `domain.DiscountedLine` + `TestInvoiceLineDiscounts` PASS (10% en 2×10000 + servicio → neto 23000 IVA 4370; 100% deja línea en cero; 101/-1/priceNet/net manipulados → 400 por validación y `DisallowUnknownFields`) + suite completa verde.
- 2026-10-09: T3-5 parcial — derivaciones internas + `dispense` atómico + receta en factura (`POST /pharmacy/referrals`, `POST /pharmacy/referrals/:id/dispense`, flag `prescription_required` migración 006, helper `deductLots` reutilizado en factura) + `TestReferralsDispenseAndInvoiceGate` PASS + suite completa verde. Aprendizajes: DATE no se escanea en string (usar time.Time); parámetro sin tipo en `jsonb_build_object` da 42P18 (castear `$4::text`); `id=ANY($2)` con uuid exige `::uuid[]`. Falta: bandeja recibidas externa (bloqueada en D-02).
- 2026-10-09: T3-6 cerrada — `POST /api/v1/invoices/:id/payments` + historial + `TestInvoicePaymentsPartialAndBalance` PASS (abono parcial, medio/monto inválidos, sobrepago 409, 2×7000 concurrentes sobre 7900 → 1x201+1x409, Pagada al completar, balance dueño acompaña factura y pagos, tenant aislado) + suite completa verde. Decisión: la factura suma deuda a `clinic_owners.balance` y el pago la resta (p-11 decía que nunca se movía).
- 2026-10-09: T3-7 cerrada — recordatorios sobre outbox abstracto (`POST /appointments/:id/remind`, `POST /owners/:rut/contact` con opt-out migración 007) + `TestAppointmentRemindersRespectContactAndOptOut` PASS (envío real vía DeliverOne, reintento no duplica, opt-out suprime pendiente y bloquea, canal no-Email se respeta, cancelada 409 y borra pendiente, validaciones) + suite completa verde. Solo Email enviable en el slice (WhatsApp/Teléfono vía capa futura).
