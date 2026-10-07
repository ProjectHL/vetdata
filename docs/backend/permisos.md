# Permisos

> Fuentes: `src/domain/settings.ts` (`Permission`, `PERMISSIONS`, `Role`, `ROLES`, `RolePermissions`) · `src/mocks/settings.ts:defaultRolePermissions` · `src/lib/store.tsx:useCan` · `src/components/settings/guard.tsx` (`Guard`, `RequirePermission`) · usos de `Guard`/`RequirePermission`/`can(...)` en `src/components/**` y `src/app/**`.
>
> - El catálogo de 21 permisos es **fijo del producto**; la matriz rol → permisos es **configurable por clínica** (`settings.togglePermission`).
> - La UI **solo** deshabilita (`Guard`, tooltip "Rol X sin permiso: …") u oculta (`RequirePermission`). **El backend debe validar cada permiso** (403).
> - "*(propuesto)*" = el contrato no declara permiso; se infiere de la UI o se recomienda.

## 1. Matriz por defecto (semilla de cada clínica nueva)

| Permiso | Área | Admin | Veterinario | Recepción | Farmacia |
|---|---|:-:|:-:|:-:|:-:|
| `ficha.ver` | Clínica | ✔ | ✔ | | |
| `ficha.editar` | Clínica | ✔ | ✔ | | |
| `agenda.gestionar` | Clínica | ✔ | ✔ | ✔ | |
| `facturas.emitir` | Clínica | ✔ | ✔ | ✔ | ✔ |
| `medicamentos.derivar` | Clínica | ✔ | ✔ | | |
| `farmacia.dispensar` | Farmacia | ✔ | | | ✔ |
| `farmacia.inventario` | Farmacia | ✔ | | | ✔ |
| `red.solicitar` | Red | ✔ | ✔ | ✔ | |
| `red.aprobar` | Red | ✔ | ✔ | | |
| `red.revocar` | Red | ✔ | | | |
| `tienda.vender` | Tienda | ✔ | | ✔ | ✔ |
| `tienda.inventario` | Tienda | ✔ | | | ✔ |
| `tienda.compras` | Tienda | ✔ | | | ✔ |
| `soporte.crear` | Soporte | ✔ | ✔ | ✔ | ✔ |
| `soporte.administrar` | Soporte | ✔ | | | |
| `seguridad.ver` | Seguridad | ✔ | | ✔ | ✔ |
| `seguridad.boxes` | Seguridad | ✔ | | | |
| `seguridad.grabaciones` | Seguridad | ✔ | | | |
| `seguridad.administrar` | Seguridad | ✔ | | | |
| `reportes.financiero` | Administración | ✔ | | | |
| `usuarios.administrar` | Administración | ✔ | | | |

Fuente: `src/mocks/settings.ts:defaultRolePermissions` (`Admin: all`).

## 2. Permiso → operaciones que habilita

| Permiso | Descripción (catálogo) | Operaciones (servicio.operación) | Dónde lo exige la UI |
|---|---|---|---|
| `ficha.ver` | Consultas, exámenes y recetas del paciente. | `patients.get` / `patients.list` / `patients.listByOwner` → incluir `consultations`, `exams`, `prescriptions` (proyección, no bloqueo del endpoint) | `app/(dashboard)/pacientes/historial/[id]/page.tsx` (3× `RequirePermission`) |
| `ficha.editar` | Registrar consultas, diagnósticos y tratamientos. | **Ninguna** — no existe operación de escritura de ficha en `contracts.ts` | Ninguno (no se usa en la UI) |
| `agenda.gestionar` | Agendar, mover y cancelar horas. | `appointments.create`, `appointments.update`, `security.checkIn`, `security.callFromWaiting`, `tasks.sendReminder`; *(propuesto)* `clinic.updateRoom`, `security.listAccess` | `agenda/agenda.tsx`, `care-actions/patient-quick-view.tsx`, `analytics/vaccination.tsx` (recordatorio); tareas `llegada:*`, `vacuna:*` |
| `facturas.emitir` | Generar facturas por atención. | `invoices.create`; *(propuesto)* `invoices.list` | `patient-quick-view.tsx`, `search/command-palette.tsx`; tarea `factura:*` |
| `medicamentos.derivar` | Prescribir y derivar fichas de medicamentos. | `referrals.create` | `patient-quick-view.tsx` |
| `farmacia.dispensar` | Entregar medicamentos derivados a farmacia interna. | `referrals.dispense`; *(propuesto)* `pharmacy.listMovements`, `referrals.list` | `pharmacy/dispense-queue.tsx`; tarea `receta:*` |
| `farmacia.inventario` | Ajustes de stock y órdenes de compra. | `pharmacy.adjustStock`, `pharmacy.createPurchaseOrder`, `pharmacy.sendPurchaseOrder`, `pharmacy.receivePurchaseOrder`; *(propuesto)* `pharmacy.listPurchaseOrders`, `pharmacy.listMovements` | `pharmacy/medication-table.tsx`, `pharmacy/purchasing.tsx`; tareas `stockmed:*`, `ocfar:*` |
| `red.solicitar` | Pedir fichas a otras clínicas de la red. | `sharing.sendRequests` | `sharing/access-gate.tsx`, `network/network-search.tsx`, `owners/owner-pets.tsx` |
| `red.aprobar` | Compartir fichas propias con otras clínicas. | `sharing.respond` (además: ser clínica de origen) | `sharing/request-tabs.tsx`, `dashboard/my-day/vet.tsx`; tarea `solicitud:*` |
| `red.revocar` | Quitar accesos otorgados a otras clínicas. | `sharing.revoke` (además: ser clínica de origen) | `sharing/shared-tabs.tsx` |
| `tienda.vender` | Usar el punto de venta y emitir boletas. | `retail.checkout`; *(propuesto)* `retail.listSales` | `retail/pos.tsx`, `command-palette.tsx` |
| `tienda.inventario` | Reponer sala, ajustes y despachos. | `retail.transferToSala`, `retail.adjust`, `retail.advanceShipment`; *(propuesto)* `retail.listMovements`, `retail.listShipments` | `retail/warehouse.tsx`, `retail/shipments.tsx`; tareas `despacho:*`, `sala:*` |
| `tienda.compras` | Órdenes de compra a proveedores de productos. | `retail.createOrder`, `retail.sendOrder`, `retail.receiveOrder`; *(propuesto)* `retail.listOrders` | `retail/purchasing.tsx`; tarea `octda:*` |
| `soporte.crear` | Reportar incidencias y proponer mejoras a VetData. | `support.createTicket`, `support.reply`, `support.changeStatus` (excepto `Cerrado`), `support.proposeIdea`; *(propuesto)* `support.rate`, `support.vote` | `support/ticket-list.tsx`, `ticket-detail.tsx`, `ideas-board.tsx`, `security/camera-dialog.tsx` y `devices.tsx` ("Reportar"); tarea `ticket:*` |
| `soporte.administrar` | Cerrar tickets y gestionar los de todo el equipo. | `support.listTickets?scope=all`, `support.getTicket` de otros usuarios, `support.changeStatus → Cerrado` | `ticket-list.tsx` (`effectiveScope`), `ticket-detail.tsx` (`statusOptions`) |
| `seguridad.ver` | Hall, sala de espera y tienda. | `security.listCameras`, `security.listDevices`, `security.getNvrStorage`, `security.listEvents`, `security.getSettings`, ver stream de zonas ≠ `boxes`; *(propuesto)* `security.createEvent`, `security.updateEvent`, `security.addEventNote`, `security.listAccess`, `security.logAudit("Vio en vivo")` | `security/page-shell.tsx` (toda la sección), `camera-dialog.tsx`; tarea `evento:*` |
| `seguridad.boxes` | Ver boxes y quirófano; en atención exige motivo y queda auditado. | Ver stream de zona `boxes`; `security.logAudit("Desactivó privacidad", motivo)` | `camera-dialog.tsx` (`locked` sin permiso; Guard en "ver de todos modos") |
| `seguridad.grabaciones` | Abrir y exportar clips grabados. | `security.logAudit("Abrió grabación" \| "Exportó clip")` + (futuro) endpoints de segmentos y exportación | `camera-dialog.tsx`, `security/zones.tsx`, `security/events.tsx` |
| `seguridad.administrar` | Dispositivos, cerraduras, alarma y retención. | `security.toggleLock`, `security.setAlarm`, `security.updateSettings`, `security.setCameraStatus`, `security.listAudit` | `security/devices.tsx` (incluye auditoría con `RequirePermission`), `monitoring.tsx`, `zones.tsx` |
| `reportes.financiero` | Ingresos, facturación y cobranza. | *(propuesto)* `analytics.monthlyRevenue`, `analytics.revenueByLine`, `invoices.list` (para reportes), `retail.listSales` (para reportes), `analytics.boxOccupancy`; montos/margenes en KPIs | `analytics/reports.tsx`, `panorama.tsx`, `customers.tsx`, `retail-analytics.tsx` (`RequirePermission`) |
| `usuarios.administrar` | Invitar usuarios, cambiar roles y permisos. | `settings.inviteUser`, `settings.updateUser`, `settings.togglePermission`, `settings.updateClinicProfile`, `settings.updateSharingPolicy` | `settings/users-table.tsx`, `permissions-matrix.tsx` (matriz **y** política de compartición), `profile.tsx` |

## 3. Operaciones sin permiso explícito

### 3.1 Mutaciones sin `Guard` en la UI (hay que decidir el permiso)
| Operación | Situación hoy | Propuesta |
|---|---|---|
| `clinic.updateRoom` | Mapa de Actividad (`activity/clinic-activity.tsx`) y "Finalizar atención" (`my-day/vet.tsx`) sin guard | `agenda.gestionar` |
| `appointments.update` desde Mi día del vet | Sin guard (`my-day/vet.tsx`), aunque el vet tiene `agenda.gestionar` por defecto | `agenda.gestionar` |
| `tasks.assign`, `tasks.complete` | Sin guard (`tasks/task-inbox.tsx`); la tarea solo es visible si se tiene su permiso | Exigir el permiso de la tarea (tabla en `dominios/agenda-y-atencion.md`) |
| `support.rate` | Sin guard (`ticket-detail.tsx`) | `soporte.crear` + ser dueño del ticket |
| `support.vote` | Sin guard (`ideas-board.tsx`) | `soporte.crear` |
| `security.updateEvent`, `security.addEventNote`, `security.createEvent` | Solo protegidos por `seguridad.ver` de la sección | `seguridad.ver` (¿cerrar como `Falsa alarma` requiere `seguridad.administrar`? → `preguntas-abiertas.md#p-26`) |
| `security.logAudit` | Implícito en la acción auditada | Según acción (ver tabla §2); idealmente generado por el servidor |

### 3.2 Lecturas sin permiso (basta sesión + tenant + regla de red)
`patients.list`, `patients.get`, `patients.listByOwner`, `owners.list`, `owners.get`, `clinic.listDoctors`, `clinic.listRooms`, `clinic.listServices`, `appointments.list`, `referrals.list`, `network.getCurrentClinic`, `network.listClinics`, `sharing.listRequests`, `sharing.listGrants`, `pharmacy.listMedications`, `pharmacy.listSuppliers`, `retail.listProducts`, `retail.listSuppliers`, `support.listIdeas`, `support.listReleases`, `security.listWaiting`, `settings.getCurrentUser`, `settings.listUsers`, `settings.getRolePermissions`, `settings.getClinicProfile`, `settings.getSharingPolicy`, `tasks.listMeta`, `tasks.listReminders`, `analytics.monthlyConsults`, `analytics.vaccineCoverage`, `analytics.coverageByVaccine`, `analytics.diagnosisCategories`, `analytics.networkAlerts`.

Lecturas con permiso propuesto (contienen datos sensibles o financieros): `invoices.list`, `pharmacy.listMovements`, `pharmacy.listPurchaseOrders`, `retail.listSales`, `retail.listMovements`, `retail.listOrders`, `retail.listShipments`, `support.listTickets` (scope all), `support.getTicket`, `security.listCameras`, `security.listDevices`, `security.getNvrStorage`, `security.listEvents`, `security.listAudit`, `security.listAccess`, `security.getSettings`, `analytics.monthlyRevenue`, `analytics.revenueByLine`, `analytics.boxOccupancy`.

### 3.3 Permisos sin operación
- `ficha.editar`: no hay endpoint de escritura de ficha clínica. → `preguntas-abiertas.md#p-22`.
- `seguridad.grabaciones` y `seguridad.boxes`: no hay endpoints de video; hoy solo gobiernan `logAudit` y la visibilidad en UI. → `#p-09`.

## 4. Reglas de autorización que no son permisos
1. **Tenant**: todo recurso se filtra por la clínica de la sesión.
2. **Red**: `sharing.respond`/`sharing.revoke` solo por la clínica de origen; lecturas de mascotas según `accessLevel` y alcance.
3. **Auto-gestión**: un usuario no cambia su propio rol ni estado (`users-table.tsx`).
4. **Último administrador**: no dejar la clínica sin usuario activo con `usuarios.administrar` (toggle de matriz o desactivación). Riesgo real: hoy se puede quitar `usuarios.administrar` al rol Admin con un clic.
5. **Propiedad del ticket**: sin `soporte.administrar` solo tickets propios.

## 5. Observaciones sobre la matriz por defecto
- Veterinario puede **aprobar** solicitudes de red pero no **revocar** (`red.revocar` solo Admin). Confirmar si es intencional. → `#p-10`.
- Recepción tiene `red.solicitar` pero no `ficha.ver`: puede pedir fichas que luego no verá en detalle clínico.
- Farmacia tiene `facturas.emitir` y `tienda.*` pero no `ficha.ver`; dispensa recetas viendo solo el nombre de la mascota.
- Solo Admin ve cámaras de boxes, grabaciones y finanzas.
