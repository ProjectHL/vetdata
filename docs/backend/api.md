# API: inventario del prototipo y contrato objetivo

> 96 operaciones en 15 servicios. Ruta y método = JSDoc del contrato (idénticos al esqueleto `src/services/http/*`). Permiso: el contrato **no** declara permisos; "*(propuesto)*" = inferido de la UI o recomendado. `sesión` = basta usuario autenticado de la clínica (siempre con aislamiento por tenant y regla de acceso de red). Prefijo común `/api/v1`. Detalle de entradas/salidas/errores en cada `dominios/*.md`.

**Estado:** las 96 operaciones de las tablas numeradas son el inventario del prototipo (frontend/src/), no la cobertura de la API Go. Las sustituciones de red se indican abajo. El contrato objetivo añade operaciones y no conserva el total de 96; su implementación se sigue en el [roadmap](../roadmap/README.md).

Convenciones: `:id` = id del servidor; `:rut` = RUT normalizado `12345678-9`; `:taskId` = `fuente:id` (URL-encode); `:role` contiene tildes (`Recepción`) → usar ids ASCII o URL-encode.


## red-y-acceso (7)  — [detalle](dominios/red-y-acceso.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 18 | `network.getCurrentClinic` | GET | `/api/v1/me/clinic` | sesión | Hoy devuelve string |
| 19 | `network.listClinics` | GET | `/api/v1/network/clinics` | sesión |  |
| 20 | `sharing.listRequests` | GET | `/api/v1/sharing/requests` | sesión | Solo donde mi clínica es from/to |
| 21 | `sharing.listGrants` | GET | `/api/v1/sharing/grants` | sesión | Incluir estado derivado |
| 22 | `sharing.sendRequests` | POST | `/api/v1/sharing/requests` | `red.solicitar` | una solicitud por mascota de otra clínica sin solicitud pendiente |
| 23 | `sharing.respond` (solo prototipo; retirar) | POST | `/api/v1/sharing/requests/:id/response` | Sin autorización válida en contrato objetivo | Sustituir por decisión del dueño; ver rutas objetivo de red |
| 24 | `sharing.revoke` (solo prototipo; retirar) | POST | `/api/v1/sharing/grants/:id/revoke` | Sin autorización válida en contrato objetivo | Dueño revoca consentimiento; Admin origen suspende/restablece |

### Ampliaciones y sustituciones de red

El contrato objetivo y sus entradas/salidas se especifican en [red-y-acceso](dominios/red-y-acceso.md#endpoints-propuestos): búsqueda con tarjeta mínima; cancelar, reenviar y renovar solicitudes; decisión y revocación por dueño; suspensión/restablecimiento por Admin origen; auditoría para origen y dueño verificado. Estas rutas son propuestas para implementar en Fase 2 y no existen aún en contracts.ts. No exponer las operaciones 23/24 como aprobación o revocación discrecional de la clínica.

## pacientes-y-propietarios (5)  — [detalle](dominios/pacientes-y-propietarios.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 1 | `patients.list` | GET | `/api/v1/patients` | sesión (+`ficha.ver` para secciones clínicas) | Filtrar por acceso de red |
| 2 | `patients.get` | GET | `/api/v1/patients/:id` | sesión (+`ficha.ver` para secciones clínicas) | Proyección por alcance; auditar si compartido |
| 3 | `patients.listByOwner` | GET | `/api/v1/owners/:rut/patients` | sesión | Filtrar por acceso de red |
| 3b | `patients.addRecord` | POST | `/api/v1/patients/:id/records` | `ficha.editar` | Append-only (consulta/vacuna/examen/receta/corrección/anulación); corrección solo de la clínica autora; 403 con Resumen clínico |
| 4 | `owners.list` | GET | `/api/v1/owners` | sesión | Solo dueños con mascota visible |
| 5 | `owners.get` | GET | `/api/v1/owners/:rut` | sesión | Validar RUT |

## agenda-y-atencion (15)  — [detalle](dominios/agenda-y-atencion.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 6 | `clinic.listDoctors` | GET | `/api/v1/doctors` | sesión |  |
| 7 | `clinic.listRooms` | GET | `/api/v1/rooms` | sesión |  |
| 8 | `clinic.updateRoom` | PATCH | `/api/v1/rooms/:id` | `agenda.gestionar` *(propuesto; hoy sin guard)* | Validar transición y unicidad doctor/paciente |
| 10 | `appointments.list` | GET | `/api/v1/appointments` | sesión |  |
| 11 | `appointments.create` | POST | `/api/v1/appointments` | `agenda.gestionar` | 409 bloque ocupado; status forzado a Agendada |
| 12 | `appointments.update` | PATCH | `/api/v1/appointments/:id` | `agenda.gestionar` | Validar transición y bloque |
| 67 | `security.listAccess` | GET | `/api/v1/security/access` | `seguridad.ver` o `agenda.gestionar` *(propuesto)* |  |
| 68 | `security.listWaiting` | GET | `/api/v1/security/waiting` | sesión |  |
| 69 | `security.checkIn` | POST | `/api/v1/security/waiting` | `agenda.gestionar` | registra la llegada de una cita de hoy; Atómico acceso+espera; solo citas de hoy |
| 70 | `security.callFromWaiting` | POST | `/api/v1/security/waiting/:id/call` | `agenda.gestionar` | el box queda ocupado; Atómico box+espera; box disponible |
| 84 | `tasks.listMeta` | GET | `/api/v1/tasks/meta` | sesión |  |
| 85 | `tasks.assign` | PUT | `/api/v1/tasks/:taskId/assignee` | sesión *(propuesto: permiso de la tarea)* | taskId con `:` → URL-encode |
| 86 | `tasks.complete` | PUT | `/api/v1/tasks/:taskId/done` | sesión *(propuesto: permiso de la tarea)* |  |
| 87 | `tasks.listReminders` | GET | `/api/v1/reminders` | sesión | ids de pacientes con recordatorio enviado |
| 88 | `tasks.sendReminder` | POST | `/api/v1/patients/:patientId/reminders` | `agenda.gestionar` | recordatorio de vacuna al dueño; Idempotente por paciente; envío real no existe |

## facturacion (3)  — [detalle](dominios/facturacion.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 9 | `clinic.listServices` | GET | `/api/v1/billable-services` | sesión |  |
| 13 | `invoices.list` | GET | `/api/v1/invoices` | `facturas.emitir` | Solo la clínica |
| 14 | `invoices.create` | POST | `/api/v1/invoices` | `facturas.emitir` | Folio único por clínica; precios desde catálogo; kardex `Venta` FEFO atómico; 409 sin stock; reintento idempotente |

## farmacia (11)  — [detalle](dominios/farmacia.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 15 | `referrals.list` | GET | `/api/v1/referrals` | sesión *(propuesto: `medicamentos.derivar` o `farmacia.dispensar`)* |  |
| 16 | `referrals.create` | POST | `/api/v1/referrals` | `medicamentos.derivar` |  |
| 17 | `referrals.dispense` | POST | `/api/v1/referrals/:id/dispense` | `farmacia.dispensar` | salida de stock por cada ítem (solo farmacia interna); Atómico con kardex; 409 externa/ya dispensada/sin stock |
| 25 | `pharmacy.listMedications` | GET | `/api/v1/pharmacy/medications` | sesión |  |
| 26 | `pharmacy.listMovements` | GET | `/api/v1/pharmacy/movements` | `farmacia.dispensar` o `farmacia.inventario` *(propuesto)* |  |
| 27 | `pharmacy.adjustStock` | POST | `/api/v1/pharmacy/movements` | `farmacia.inventario` | ajuste manual (merma, vencimiento…); Solo Merma/Vencimiento, negativo |
| 28 | `pharmacy.listSuppliers` | GET | `/api/v1/pharmacy/suppliers` | sesión |  |
| 29 | `pharmacy.listPurchaseOrders` | GET | `/api/v1/pharmacy/purchase-orders` | `farmacia.inventario` *(propuesto)* |  |
| 30 | `pharmacy.createPurchaseOrder` | POST | `/api/v1/pharmacy/purchase-orders` | `farmacia.inventario` | crea en borrador con costo estimado; unitCost lo calcula el servidor |
| 31 | `pharmacy.sendPurchaseOrder` | POST | `/api/v1/pharmacy/purchase-orders/:id/send` | `farmacia.inventario` | Borrador→Enviada |
| 32 | `pharmacy.receivePurchaseOrder` | POST | `/api/v1/pharmacy/purchase-orders/:id/receive` | `farmacia.inventario` | recepción por líneas/cantidades; Enviada→Parcialmente recibida→Recibida, atómico con kardex y lotes (p-24) |

## tienda (13)  — [detalle](dominios/tienda.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 33 | `retail.listProducts` | GET | `/api/v1/retail/products` | sesión |  |
| 34 | `retail.listSuppliers` | GET | `/api/v1/retail/suppliers` | sesión |  |
| 35 | `retail.listSales` | GET | `/api/v1/retail/sales` | `tienda.vender` o `reportes.financiero` *(propuesto)* |  |
| 36 | `retail.checkout` | POST | `/api/v1/retail/sales` | `tienda.vender` | vende desde sala; con despacho crea el envío; Atómico boleta+kardex+despacho |
| 37 | `retail.listMovements` | GET | `/api/v1/retail/movements` | `tienda.inventario` *(propuesto)* |  |
| 38 | `retail.transferToSala` | POST | `/api/v1/retail/transfers` | `tienda.inventario` | bodega central → sala de ventas; 409 si central insuficiente |
| 39 | `retail.adjust` | POST | `/api/v1/retail/adjustments` | `tienda.inventario` | Merma (−) o Conteo (±) |
| 40 | `retail.listOrders` | GET | `/api/v1/retail/orders` | `tienda.compras` *(propuesto)* |  |
| 41 | `retail.createOrder` | POST | `/api/v1/retail/orders` | `tienda.compras` |  |
| 42 | `retail.sendOrder` | POST | `/api/v1/retail/orders/:id/send` | `tienda.compras` | Borrador→Enviada |
| 43 | `retail.receiveOrder` | POST | `/api/v1/retail/orders/:id/receive` | `tienda.compras` | entrada a bodega central; Enviada→Recibida, entrada a central |
| 44 | `retail.listShipments` | GET | `/api/v1/retail/shipments` | `tienda.inventario` *(propuesto)* |  |
| 45 | `retail.advanceShipment` | POST | `/api/v1/retail/shipments/:id/advance` | `tienda.inventario` | siguiente estado de SHIPMENT_FLOW; Lineal; 409 si Entregado |

## seguridad (14)  — [detalle](dominios/seguridad.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 56 | `security.listCameras` | GET | `/api/v1/security/cameras` | `seguridad.ver` | Incluir privacidad calculada |
| 57 | `security.setCameraStatus` | PATCH | `/api/v1/security/cameras/:id` | `seguridad.administrar` | `Sin señal` solo por sistema |
| 58 | `security.listDevices` | GET | `/api/v1/security/devices` | `seguridad.ver` |  |
| 59 | `security.toggleLock` | POST | `/api/v1/security/devices/:id/toggle-lock` | `seguridad.administrar` | Solo cerraduras; toggle no idempotente |
| 60 | `security.getNvrStorage` | GET | `/api/v1/security/nvr` | `seguridad.ver` |  |
| 61 | `security.listEvents` | GET | `/api/v1/security/events` | `seguridad.ver` |  |
| 62 | `security.createEvent` | POST | `/api/v1/security/events` | `seguridad.ver` *(propuesto)* |  |
| 63 | `security.updateEvent` | PATCH | `/api/v1/security/events/:id` | `seguridad.ver` para abierto; `seguridad.administrar` para cerrar | Cerrado inmutable; resolvedAt servidor (p-26) |
| 64 | `security.addEventNote` | POST | `/api/v1/security/events/:id/notes` | `seguridad.ver` *(propuesto)* |  |
| 65 | `security.listAudit` | GET | `/api/v1/security/audit` | `seguridad.administrar` |  |
| 66 | `security.logAudit` (solo prototipo; retirar) | POST | `/api/v1/security/audit` | No es endpoint objetivo | Auditoría generada por servidor al ejecutar la acción autorizada (p-19/T4-2) |
| 71 | `security.getSettings` | GET | `/api/v1/security/settings` | `seguridad.ver` |  |
| 72 | `security.updateSettings` | PATCH | `/api/v1/security/settings` | `seguridad.administrar` | Excluir alarmArmed |
| 73 | `security.setAlarm` | PUT | `/api/v1/security/alarm` | `seguridad.administrar` |  |

## soporte (10)  — [detalle](dominios/soporte.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 46 | `support.listTickets` | GET | `/api/v1/support/tickets` | sesión; ver todos requiere `soporte.administrar` | Propios por defecto |
| 47 | `support.getTicket` | GET | `/api/v1/support/tickets/:id` | dueño del ticket o `soporte.administrar` |  |
| 48 | `support.createTicket` | POST | `/api/v1/support/tickets` | `soporte.crear` |  |
| 49 | `support.reply` | POST | `/api/v1/support/tickets/:id/messages` | `soporte.crear` | Esperando cliente→En progreso |
| 50 | `support.changeStatus` | PATCH | `/api/v1/support/tickets/:id/status` | `soporte.crear`; `Cerrado` requiere `soporte.administrar` | Limitar transiciones de la clínica |
| 51 | `support.rate` | POST | `/api/v1/support/tickets/:id/rating` | `soporte.crear` *(propuesto; hoy sin guard)* | califica y cierra; Solo Resuelto; cierra |
| 52 | `support.listIdeas` | GET | `/api/v1/support/ideas` | sesión | Alcance red |
| 53 | `support.vote` | POST | `/api/v1/support/ideas/:id/vote` | sesión *(propuesto `soporte.crear`; hoy sin guard)* | alterna el voto de la clínica; Toggle no idempotente |
| 54 | `support.proposeIdea` | POST | `/api/v1/support/ideas` | `soporte.crear` | crea la idea y su ticket "Mejora" vinculado; Atómico idea+ticket |
| 55 | `support.listReleases` | GET | `/api/v1/support/releases` | sesión | Global |

## usuarios-y-permisos (10)  — [detalle](dominios/usuarios-y-permisos.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 74 | `settings.getCurrentUser` | GET | `/api/v1/me` | sesión |  |
| 75 | `settings.listUsers` | GET | `/api/v1/users` | sesión |  |
| 76 | `settings.inviteUser` | POST | `/api/v1/users/invitations` | `usuarios.administrar` | Email único; envía invitación |
| 77 | `settings.updateUser` | PATCH | `/api/v1/users/:id` | `usuarios.administrar` | No a sí mismo; lista blanca de campos |
| 78 | `settings.getRolePermissions` | GET | `/api/v1/settings/role-permissions` | sesión |  |
| 79 | `settings.togglePermission` | POST | `/api/v1/settings/role-permissions/:role/toggle` | `usuarios.administrar` | Evitar auto-bloqueo; toggle no idempotente |
| 80 | `settings.getClinicProfile` | GET | `/api/v1/settings/clinic-profile` | sesión |  |
| 81 | `settings.updateClinicProfile` | PUT | `/api/v1/settings/clinic-profile` | `usuarios.administrar` | Validar RUT |
| 82 | `settings.getSharingPolicy` | GET | `/api/v1/settings/sharing-policy` | sesión |  |
| 83 | `settings.updateSharingPolicy` | PUT | `/api/v1/settings/sharing-policy` | `usuarios.administrar` |  |

## analitica (8)  — [detalle](dominios/analitica.md)

| # | Servicio.operación | Método | Ruta | Permiso | Notas |
|---|---|---|---|---|---|
| 89 | `analytics.monthlyConsults` | GET | `/api/v1/analytics/monthly-consults` | sesión | Columna red anónima |
| 90 | `analytics.monthlyRevenue` | GET | `/api/v1/analytics/monthly-revenue` | `reportes.financiero` *(propuesto)* |  |
| 91 | `analytics.revenueByLine` | GET | `/api/v1/analytics/revenue-by-line` | `reportes.financiero` *(propuesto)* |  |
| 92 | `analytics.vaccineCoverage` | GET | `/api/v1/analytics/vaccine-coverage` | sesión | Columna red anónima |
| 93 | `analytics.coverageByVaccine` | GET | `/api/v1/analytics/coverage-by-vaccine` | sesión | Columna red anónima |
| 94 | `analytics.diagnosisCategories` | GET | `/api/v1/analytics/diagnosis-categories` | sesión | redPct anónimo |
| 95 | `analytics.networkAlerts` | GET | `/api/v1/analytics/network-alerts` | sesión | Agregado anónimo de red |
| 96 | `analytics.boxOccupancy` | GET | `/api/v1/analytics/box-occupancy` | sesión *(propuesto `reportes.financiero`)* | Requiere historial de boxes |

## Resumen del inventario del prototipo por dominio

| Dominio | Operaciones |
|---|---|
| red-y-acceso | 7 |
| pacientes-y-propietarios | 5 |
| agenda-y-atencion | 15 |
| facturacion | 3 |
| farmacia | 11 |
| tienda | 13 |
| seguridad | 14 |
| soporte | 10 |
| usuarios-y-permisos | 10 |
| analitica | 8 |
| **Total** | **96** |

## Resumen del inventario del prototipo por método

| Método | Cantidad |
|---|---|
| GET | 52 |
| POST | 32 |
| PUT | 5 |
| PATCH | 7 |
| DELETE | 0 |

## Observaciones de diseño
- **No hay ningún `DELETE`** en el contrato: nada se borra (anulaciones, cancelaciones y revocaciones son cambios de estado). Mantenerlo así para trazabilidad.
- **Rutas de "agenda" bajo `/security`**: `checkIn`, `callFromWaiting`, `listAccess`, `listWaiting` viven en `SecurityService` por cómo está organizada la UI; se pueden exponer también bajo `/appointments/:id/check-in` y `/rooms/:id/call` sin cambiar la semántica.
- **Toggles no idempotentes** (`support.vote`, `security.toggleLock`, `settings.togglePermission`): recomendado enviar el estado deseado.
- **`network.getCurrentClinic` y `settings.getCurrentUser`**: recomendado fusionarlos en `GET /me` con `{ user, clinic, permissions }`.
- **Faltan endpoints** que la UI implica o el negocio necesitará (no están en el contrato, ver `preguntas-abiertas.md`): registrar pago de factura, alta/edición de mascotas, dueños y consultas (permiso `ficha.editar` sin operación), recibir derivación externa, stream/segmentos de video, backoffice de soporte.
