# Fase 4 — Tienda + seguridad + soporte + analítica (tracking)

Objetivo: completar dominios operativos y agregación de red por API con autorización, auditoría y privacidad en servidor.
Rama: `review/fase-4-dominios` (desde `main` @ 92bb5ab). Ruta: worker delegado (subagentes disponibles en este runner).
Entrada: Fase 3 firmada (`docs/roadmap/cierre-fase-03.md`, T3-5 parcial por D-02).

## Alcance autorizado

`backend/` + `docs/backend/` + `docs/roadmap/` + este archivo. `frontend/` intacto hasta Fase 5.

## Tareas

- [x] T4-1 Tienda: checkout atómico (boleta + kardex sala + 409 si falta + despacho), transferToSala atómico, receiveOrder a central, todo con permisos `tienda.*`
- [x] T4-2 Seguridad: eventos crear/actualizar/nota con `seguridad.ver`, cerrar/falsa-alarma con `seguridad.administrar`, `resolvedAt` inmutable sin reapertura, auditoría append-only servidor (sin POST cliente)
- [x] T4-3 Soporte: tickets + ideas + `proposeIdea` atómico, rol `VetData Staff` fuera de tenant + `/admin` mínimo, SLA horas corridas, sin `simulateSupportReply` en prod
- [ ] T4-4 Analítica: KPIs en servidor, job diario, k≥5, default-on anonimizado con opt-out, base sector dueño, texto VetData, sin fichas/dueños ajenos (T4-4a cerrado, falta T4-4b: vaccine-coverage/coverageByVaccine, revenue-by-line/monthly-revenue con reportes.financiero, box-occupancy)
- [x] T4-5 Roles custom: evaluado 2026-10-09 — diferido, MVP con 4 fijos (acta en TAREAS)
- [ ] T4-6 Salida fase: 10 dominios con endpoints reales y 403 funcionando

## Progreso

- 2026-10-09: T4-2 cerrada — eventos (`GET/POST /api/v1/security/events`, `GET/PATCH /:id`, `POST /:id/notes`) + settings (`GET/PATCH`, migración 010) + `TestSecurityEventsLifecycleAndClosure` / `TestSecuritySettingsAndValidation` PASS (asignar Nuevo→En revisión, cerrar solo administrar 403 ver, reapertura/nota en cerrado 409, vinculado, filtros, defaults, alarmArmed no por PATCH) + suite completa verde. Alcance mínimo decidido con el usuario: sin cámaras/dispositivos/NVR/alarma (hardware, p-09 Fase 8); `logAudit` por cliente retirado, auditoría la genera el servidor.
- 2026-10-09: T4-3 cerrada — tickets/incidencias/mejoras/ideas+votos/releases/Staff backoffice (`/admin`) + migración 011 + `TestSupportTicketsIdeasAndStaff` PASS (creación, aislamiento cross-tenant, clinic states 403/409, reply → En progreso, Resuelto→Cerrado con rating, `proposeIdea` atómico idea+voto+ticket Mejora, vote toggle por clínica, releases read-only, SLA horas corridas, Staff en clínica fantasma `0000…0002` con login Staff/isStaffTenant, adminReply 403 clinic, switchClinic 403 Staff) + suite completa verde. Decisiones: `mutate` admite `permission=""` para staff (bypass perm check, sigue valida sesión); `listTickets` scan columna-por-columna (evita `LIMIT` fuera subquery en pgx); Staff usa StaffClinicID no tabla usuarios global.
- 2026-10-09: T4-4a cerrada — analítica base (`GET /api/v1/analytics/diagnosis-categories`, `/network-alerts`, `/monthly-consults`, `PUT/GET /opt-out`, migración 012 `analytics_daily` + `clinics.analytics_opt_out`, `recomputeAnalyticsDaily`, `TestAnalytics*` 5/5 PASS: k 4vs5, opt-out excluye red, sin identificables, sector dueño, job idempotente) + fix `seeds_test` groups 8→9 (migración 011 Staff) + suite completa verde. Límites conocidos: gate diagnosis global no por-corte, rollup daily cota superior multi-día, alerts solo alzas, daily crudo con gate en lectura (verificación independiente partial).
- 2026-10-09: T4-1 cerrada — `POST/GET /api/v1/retail/sales` + `POST /api/v1/retail/transfers` + `POST /api/v1/retail/adjustments` (Conteo/Merma) + `GET /api/v1/retail/shipments` + `POST .../advance` (migración 009) + `TestRetailCheckoutAtomicAndConcurrency` / `TestRetailTransferReceiveAndAdjust` / `TestRetailShipmentsAdvance` PASS (concurrencia 2×última unidad sala → 1x201+1x409 sin negativo, precios servidor, despacho mañana + 400 sin dueño/courier, transfer preserva total, sobre-recepción 409, avance lineal) + suite completa verde. Decisión: despacho con tarifa fija 3990 bruto (neto 3353) hasta tabla de tarifas por clínica; `deductLotsAt` para sala (FEFO con `FOR UPDATE`); transferencia mueve lotes central→sala con doble movimiento `Transferencia`.
