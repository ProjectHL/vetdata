# Tareas VetData — por fases

> Derivado de `docs/DECISIONES.md` + `docs/backend/` (api, transversales, permisos, estados, eventos).
> Toda tarea referencia su decisión p-NN cuando aplica. Las decisiones son revisables en fase superior.
> Convención: `- [ ]` pendiente · `- [x]` hecha. No escribir backend hasta cerrar Fase 0 + Fase 1.

## Fase 0 — Cierre pre-backend (bloqueante)

- [x] T0-1 Confirmar p-05 → CERRADO owner-driven (decide el dueño vía email, clínica sin veto, freno `red.suspender`)
- [x] T0-2 Confirmar p-21 → CERRADO (job diario, k≥5, default-on anonimizado, base sector dueño, texto VetData)
- [x] T0-3 Confirmar p-26 → CERRADO (ver+anotar con `seguridad.ver`, cerrar con `seguridad.administrar`, inmutable sin reapertura)
- [ ] T0-4 Cerrar p-20 cuando toque: elegir S3 vs cloud storage vs folder en server (diferido, solo dejar modelo `attachments` previsto)
- [x] T0-5 Validar `docs/DECISIONES.md` como contrato firmado (cada cambio futuro: editar archivo + entrada Engram anterior→nuevo + fase)
- [x] T0-6 Stack CERRADO: Go + Postgres; hosting VPS con docker compose (front+api+db), escalar después
- [x] T0-7 MVP slice CERRADO: Fase 1 + Fase 2 + agenda/pacientes-lectura/red

## Fase 1 — Fundaciones técnicas

- [ ] T1-1 Crear repo backend, migraciones, seeds desde `src/mocks/` (pacientes, dueños, clínicas, settings)
- [ ] T1-2 Auth p-01: cookie httpOnly + refresh rotation + expiración, recovery email, `GET /me` → `{user, clinic, permissions[]}`, solo `Activo` loguea
- [ ] T1-3 Multitenant p-02: tablas `group + clinic_id`, tenant desde sesión (nunca parámetro cliente), `clinicId` estable (no nombre), membership por clínica/rol
- [ ] T1-4 Convenciones API: REST `/api/v1`, errores 400/401/403/404/409/422, paginación + filtros que ya usa la UI, recursos en inglés
- [ ] T1-5 RUT p-06-transversal: normalizar sin puntos con guion, validar DV módulo 11 (400 si falla), RUT único dueño, normalizar proveedores y perfil clínica
- [ ] T1-6 Montos p-17: todo interno en neto, CLP enteros, IVA 19% en una sola constante backend, factura neto→IVA→total con redondeo sobre neto total, boleta bruta con `ivaIncluded`
- [ ] T1-7 Fechas p-15: hora real `America/Santiago`, ISO 8601 con offset en instantes, `date` solo civil (nacimiento/vencimiento/cita), eliminar `TODAY/NOW_TIME` fijos
- [ ] T1-8 Ids p-09-transversal: UUIDs servidor, correlativos por clínica en transacción, `Idempotency-Key` en POSTs, devolver recurso canónico, errores explícitos para revertir optimista
- [ ] T1-9 CI (lint+migrate+test), compose local con DB, observabilidad base (logs, healthcheck)
- [ ] T1-10 Horarios p-15: horario estructurado por clínica + profesional + feriados, slots 30' configurables, flag urgencia sin cita (reemplaza `SLOTS` fijo)

## Fase 2 — Núcleo: identidad + red (diferencial)

- [ ] T2-1 Usuarios/invitaciones/roles p-10+p-01: matriz por clínica, invitaciones con expiración, `lastAccess` timestamp, guarda anti-autobloqueo (409 si queda sin admin). Cambio owner-driven: muere `red.aprobar`; nuevo `red.suspender` (SOLO Admin origen, motivo obligatorio, auditado, notificado a dueño y B, reversible). `red.solicitar` = pedir (B)
- [ ] T2-2 Regla acceso p-03+p-04: `accessLevel` (propio/compartido/ninguno) + `grantStatus` (Vigente/Revocado/Vencido derivado) aplicados en **cada** lectura de mascota/historial/listas/búsqueda/analítica local/tareas/boxes/agenda
- [ ] T2-3 Alcance en servidor: proyección `Ficha completa` vs `Resumen clínico` (solo alergias + crónicas + vacunas), tarjeta mínima sin acceso + rate-limit + log búsquedas, 404 vs 403 según caso
- [ ] T2-4 Solicitudes p-05 owner-driven: B pide con alcance+vigencia (pedidos) → email al dueño con link token un solo uso (hash en DB, expira 72h). Estados `Esperando dueño`/`Aprobada`/`Denegada`/`Expirada`/`Cancelada` por B. Una por mascota; 409 si propia, pendiente o grant vigente. Renovar = nueva solicitud linkeada + aviso 7 días. La origen NO aprueba, solo es notificada
- [ ] T2-5 Consentimiento p-06 owner-driven: el dueño verifica RUT (DV) + aprueba/deniega/baja alcance (nunca mayor al pedido) vía link. Evidencia: token hash, IP, timestamp, método `email-link`. Revocar consentimiento mata grants. Muere el checkbox de la clínica declarando consentimiento ajeno
- [ ] T2-6 Freno emergencia (ex-revocación): solo origen con `red.suspender` (Admin), motivo obligatorio, auditado, notificado a dueño y B, reversible. Ya no es revocación por criterio sino suspensión por causa objetiva (fraude, error grave, orden legal)
- [ ] T2-7 Auditoría red p-07: insert en toda lectura `compartido` (usuario, clínica, mascota, alcance, hora), visible para origen Y dueño (quién vio la ficha de su mascota), retención 2-3 años
- [ ] T2-8 Pendientes p-23: `GET /tasks` en servidor replicando `lib/tasks.ts`, mantener `taskId` con `:` codificado
- [ ] T2-9 Desactivar vet p-25: 409 con lista citas futuras + reasignar/cancelar explícito; fix crear vet genera `doctorId`
- [ ] T2-10 Salida fase: dos clínicas de prueba compartiendo una ficha con vigencia real

## Fase 3 — Operación diaria

- [ ] T3-1 Agenda + boxes: citas, `checkIn` (acceso+espera atómico), `callFromWaiting` (box+espera atómico), finalización compuesta (cita Realizada + room limpieza en una op), `clinic.updateRoom` con lista blanca + `agenda.gestionar`
- [ ] T3-2 Ficha escritura p-22: eventos append-only (crear mascota/dueño/consulta/vacuna/examen/receta, sin edit/delete; corrección con nuevo evento/anulación), diagnóstico texto+regla, `PatientStatus` calculado en servidor
- [ ] T3-3 Facturación: `invoices.create` atómica (folio + factura + kardex Venta por línea con `medicationId` + 409 si stock insuficiente), precios desde catálogo, folio único por clínica en transacción
- [ ] T3-4 Precios p-16: descuento % por línea en servidor (listas por convenio después)
- [ ] T3-5 Farmacia p-13+p-24: derivaciones con bandeja "recibidas" por definir, firma simple = usuario autenticado, verificar receta vigente al dispensar/facturar, `dispense` atómico, OC (crear/enviar/recibir) atómica, ajustes con movimiento, costo real proveedor, modelo `movement_lot` (lote único en MVP), recepción parcial después
- [ ] T3-6 Pagos p-11: registro manual (abonos parciales, medio, saldo dueño, `Pagada`), pasarela/arqueo después
- [ ] T3-7 Notificaciones slice p-08: capa `notifications` abstracta + email transaccional, solo recordatorio citas, respetar `preferredContact` + opt-out
- [ ] T3-8 Modelo adjuntos p-20: tabla `attachments` que hereda regla red/alcance (implementación S3/cloud/folder diferida)
- [ ] T3-9 Salida fase: flujo vet completo agenda → atiende → deriva → dispensa → factura

## Fase 4 — Tienda + seguridad + soporte + analítica

- [ ] T4-1 Tienda: `checkout` atómico (boleta + kardex sala + 409 si falta + despacho), `transferToSala` atómico, `receiveOrder` a central, todo con permisos `tienda.*`
- [ ] T4-2 Seguridad p-26 CERRADO: eventos crear/actualizar/nota con `seguridad.ver`, cerrar/falsa-alarma con `seguridad.administrar`, `resolvedAt` inmutable, sin reapertura (evento nuevo linkeado); auditoría append-only generada por servidor al entregar recurso (en vivo, grabación, export con hash), `logAudit` sin POST cliente
- [ ] T4-3 Soporte p-18: tickets + ideas + `proposeIdea` atómico (idea+ticket), rol `VetData Staff` fuera de tenant + `/admin` mínimo (tickets, ideas, releases, alta clínicas), SLA horas corridas, eliminar `simulateSupportReply` y "Ver como" de prod
- [ ] T4-4 Analítica p-21 CERRADO: KPIs en servidor, job diario, k≥5, default-on anonimizado con opt-out, base sector dueño, texto VetData, sin fichas/dueños ajenos
- [ ] T4-5 Roles custom p-10: evaluar recién aquí (MVP sigue con 4 fijos)
- [ ] T4-6 Salida fase: 10 dominios con endpoints reales y 403 funcionando

## Fase 5 — Integración frontend (la más larga, toda `TODO(api)`)

- [ ] T5-1 `http/client.ts`: auth (cookie/credentials) + tenant, `apiFetch` real, implementar 96 métodos (hoy `NotImplementedError`)
- [ ] T5-2 Hidratar 4 stores (16+5+2+7 cargas) con loading/error, `NEXT_PUBLIC_DATA_SOURCE=http` + `NEXT_PUBLIC_API_URL`
- [ ] T5-3 Matar `lib/lookups.ts`: migrar 45 componentes + 4 páginas + stores + `tasks.ts` + `analytics/metrics` a estado servidor
- [ ] T5-4 Reconciliar ids optimistas (`-new-N` → canónico), revertir/avisar en error, `Idempotency-Key` desde UI
- [ ] T5-5 Fechas reales sin romper hidratación (servidor o post-mount), `currentClinic/currentUser/role` desde sesión
- [ ] T5-6 Salida fase: con `http`, recargar no pierde nada

## Fase 6 — Endurecimiento

- [ ] T6-1 Los 12 casos de atomicidad `transversales.md` §8 en transacciones reales
- [ ] T6-2 PATCH con lista blanca + transiciones 409, toggles con estado deseado, mock "no-op" eliminado
- [ ] T6-3 2FA Admin/cámaras (p-01), auditoría administrativa/red completa, `tasks` servidor ya hecho
- [ ] T6-4 Tests: aislamiento tenant + red + permisos + stock no negativo + auto-bloqueo admin
- [ ] T6-5 Salida fase: suite verde anti-filtración entre clínicas

## Fase 7 — Chile + producción

- [ ] T7-1 SII p-12: proveedor DTE, tipos 39/33 primero (61/52 después), folio/tipo/PDF/estado SII guardados, anulaciones
- [ ] T7-2 Privacidad p-14: ARCO manual (exportar/borrar dueño con auditoría), contrato encargado, ficha retenida ~10 años con contacto anonimizado, RUT normalizado global
- [ ] T7-3 Retención p-19: audit 5 años exportable, video 30 días default, dos retenciones separadas
- [ ] T7-4 Infra prod: compose front+api+db, backups, TLS, logs, alertas, runbook piloto 1-2 clínicas

## Fase 8 — Integraciones post-MVP

- [ ] T8-1 Mensajería p-08: WhatsApp Business + plantillas + registro entregas + costos (email ya hecho en Fase 3)
- [ ] T8-2 Pagos: pasarela/terminal + voucher + cierre/arqueo + devoluciones (p-11)
- [ ] T8-3 Adjuntos p-20: implementar storage elegido + AV + límites + control acceso
- [ ] T8-4 Video p-09 (al final): proxy NVR/ONVIF-RTSP, URLs firmadas cortas, auditoría pre-firma, privacidad también en grabaciones, audio off default
- [ ] T8-5 Receta avanzada p-13: firma electrónica, retenidos/psicotrópicos, vínculo Prescription↔Referral
- [ ] T8-6 Diagnósticos p-22: VeNom/SNOMED-CT, recepción parcial + diferencias + FEFO p-24, listas de precios por convenio p-16
