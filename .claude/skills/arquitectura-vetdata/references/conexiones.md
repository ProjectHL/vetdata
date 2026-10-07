# Conexiones entre canales (flujos)

Cada flujo indica, paso a paso, el componente que dispara la acción, la mutación del store, la operación de servicio y quién lee el resultado. Rutas relativas a `src/`. "Optimista" = el store cambia el estado local antes de llamar al servicio con `runInBackground`.

---

## 1. Red de clínicas, compartición y acceso a la ficha

**Regla** (`domain/sharing.ts`): `accessLevel(patient, grants, clinic)` → `propio` si `patient.clinic === clinic`; `compartido` si existe `AccessGrant` con `grantedTo === clinic` y `grantStatus(g) === "Vigente"` (no revocado, `until` ≥ `TODAY`); si no, `ninguno`. La clínica actual es `currentClinic` (`lib/lookups.ts` ← `mocks/network.ts`).

Hooks (`lib/store.tsx`): `useAccess(id)` → `{level, grant}`; `useCanView()` → `(id) => level !== "ninguno"`; `usePendingRequest(id)` → solicitud pendiente propia.

**Solicitar acceso**
1. Origen de la búsqueda:
   - Clínicas › Red: `NetworkSearch` (`components/network/network-search.tsx`) busca un RUT (`findOwner` sobre `owners` de lookups), lista `petsOf(rut)` con `accessLevel` y permite seleccionar. Acepta `?rut=` (`app/(dashboard)/clinicas/red/page.tsx` lee `searchParams` y pasa `initialRut`).
   - Ficha bloqueada: `AccessGate` → `LockedRecord` (`components/sharing/access-gate.tsx`).
   - Ficha de propietario: `OwnerPets` (`components/owners/owner-pets.tsx`); si no hay ninguna mascota visible, `OwnerGate` remite a `/clinicas/red?rut=…`.
   - Buscador ⌘K: mascotas/dueños sin acceso enlazan a `/clinicas/red?rut=…` (§11).
2. `RequestAccessDialog` (`components/sharing/request-access-dialog.tsx`) precarga alcance y vigencia desde `sharingPolicy.defaultScope/defaultDuration` y llama `useStore().sendRequest(patientIds, scope, duration, reason)` (botón protegido con `Guard red.solicitar` en quien lo abre).
3. `sendRequest` (`lib/store.tsx`) descarta mascotas propias o con solicitud `Pendiente`, crea un `AccessRequest` por mascota (`from: currentClinic`, `to: patient.clinic`) y llama `services.sharing.sendRequests`.

**Responder (clínica de origen)**
4. La campana del `Topbar` cuenta `requests` con `to === currentClinic` y `Pendiente` (si `sharingPolicy.notifyRequests`); `useNavBadges` pone el mismo contador en el ítem "Solicitudes"; `useTasks` crea la tarea `solicitud:<id>` (permiso `red.aprobar`).
5. Clínicas › Solicitudes: `RequestTabs` (`components/sharing/request-tabs.tsx`); el diálogo de aprobación permite ajustar alcance/vigencia y exige confirmar consentimiento del dueño si `sharingPolicy.requireConsent && !owner.shareConsent`. Llama `respondRequest(id, approve, terms)` (`Guard red.aprobar`).
6. `respondRequest` marca `Aprobada/Rechazada` y, si aprueba, crea el `AccessGrant` local (`until = addDays(TODAY, duration)` o `null`) → `services.sharing.respond`.

**Revocar**
7. Clínicas › Compartidos: `SharedTabs` (`components/sharing/shared-tabs.tsx`) → `revokeGrant(id)` (`Guard red.revocar`) → `services.sharing.revoke`.

**Efecto en todos los canales**: al cambiar `grants`, `useCanView`/`useAccess` reevalúan. Lo consumen `PetBrowser`, `PatientList`, `OwnerList`, `OwnerGate`, `OwnerRecords`, `ClinicActivity`, `Agenda`, `CommandPalette`, y las métricas vía `visiblePatients(grants, currentClinic)` (`lib/analytics.ts`) en Panorama, Mi día (Admin), Vacunación, Diagnósticos, Clientes y `useTasks`.

**Ficha** (`app/(dashboard)/pacientes/historial/[id]/page.tsx`): la página (server) resuelve `getPatient`/`getOwner` y envuelve el contenido en `AccessGate`: `propio` → todo; `compartido` + "Ficha completa" → todo con banner de origen/vencimiento; `compartido` + "Resumen clínico" → solo `PatientSummary`; `ninguno` → `LockedRecord` con solicitud. Dentro, las secciones clínicas usan `RequirePermission ficha.ver`.

---

## 2. Día clínico: agenda → llegada (hall) → sala de espera → box (Actividad) → privacidad de cámara

Estado compartido: `appointments` y `rooms` (`useStore`), `access` y `waiting` (`useSecurity`).
Regla de etapa: `appointmentStage(appt, waiting, rooms)` (`lib/metrics/day.ts`) → `Por llegar` · `En espera` (hay `WaitingEntry`) · `En box` (box ocupado por el paciente y cita dentro de la próxima hora) · `Realizada` · `Cancelada` · `No asistió`. `expectedArrivals(...)` = citas de hoy `Agendada/Confirmada` sin ingreso ni espera y en `Por llegar`.

1. **Agendar**: `ScheduleForm` (`components/care-actions/schedule-form.tsx`, desde `PatientQuickView`/`CareActionButtons`) o `Agenda` (`components/agenda/agenda.tsx`) → `addAppointment` → `services.appointments.create`. Profesionales: `useDoctors()` (usuarios Veterinario activos ∩ `doctors`).
2. **Confirmar / reprogramar / cancelar / no asistió**: `Agenda` → `updateAppointment(id, {status…})` → `services.appointments.update`.
3. **Llegada (hall)**: cualquiera de estos llama `useSecurity().checkIn(appointmentId)`:
   - `Agenda` ("Registrar llegada"), `HallZone` (`components/security/zones.tsx`, lista `expectedArrivals`), `ReceptionDay` (`components/dashboard/my-day/reception.tsx`, "Llegó"), tarea `llegada:<id>` de `useTasks` (acción rápida).
   - `checkIn` (`lib/security-store.tsx`) agrega un `AccessEntry` "Ingreso/Cliente" y un `WaitingEntry`, y llama `services.security.checkIn` (`CheckInResult`). La cita pasa a `En espera` en Agenda y Mi día.
4. **Sala de espera → box**: `WaitingZone` (zones.tsx), `Agenda` (botón con box libre) o `VetDay` (`components/dashboard/my-day/vet.tsx`) llaman `callFromWaiting(entryId, roomId)`.
   - `callFromWaiting` ocupa el box con `useStore().updateRoom(roomId, {status:"ocupado", doctorId, patientId, since: NOW_TIME}, {sync:false})` (no llama `clinic.updateRoom`: el backend lo hace dentro de la operación), quita la entrada de `waiting` y llama `services.security.callFromWaiting` (`CallFromWaitingResult`). La cita pasa a `En box`.
5. **Box en Actividad**: `ClinicActivity` (`components/activity/clinic-activity.tsx`) muestra `rooms` con `statusMeta`/`kindIcon` (`activity/room-status.ts`) y permite ocupar/limpiar/liberar con `updateRoom` → `services.clinic.updateRoom`. `VetDay` "Finalizar atención y enviar box a limpieza" hace `updateAppointment(id, {status:"Realizada"})` + `updateRoom(id, {status:"limpieza", …})`.
6. **Privacidad de cámara**: `usePrivacy(camera)` (`lib/security-store.tsx`) = `settings.privacyInBoxes && room.status === "ocupado"`. `useCameraView` (`components/security/camera-dialog.tsx`) devuelve `offline` / `locked` (sin `seguridad.ver`, o box sin `seguridad.boxes`) / `private` (overlay "Atención en curso · doctor con paciente") / `live`. Se ve en `BoxesZone`, `Monitoring` y `CameraTile`. En `CameraDialog`, "Ver de todos modos" exige `Guard seguridad.boxes` + motivo → `logAudit(cameraId, "Desactivó privacidad", motivo)` → `services.security.logAudit`. Abrir/exportar grabaciones (`seguridad.grabaciones`) también llama `logAudit`. El ajuste `privacyInBoxes` se cambia en Dispositivos (`updateSettings`).

---

## 3. Derivación → dispensación → kardex → reposición → orden de compra (Farmacia)

1. **Derivar**: `ReferralForm` (`components/care-actions/referral-form.tsx`, `Guard medicamentos.derivar` en `CareActionButtons`) con destino `INTERNAL_PHARMACY` ("Farmacia interna") u otra clínica; muestra `stockStatus` de cada medicamento → `addReferral` → `services.referrals.create`.
2. **Cola**: `DispenseQueue` (`components/pharmacy/dispense-queue.tsx`, en Farmacia › Movimientos y en `PharmacyDay`) lista derivaciones internas no dispensadas; bloquea si `stock < qty`. `useTasks` crea `receta:<id>` (acción rápida "Dispensar" si no está bloqueada).
3. **Dispensar**: `dispenseReferral(id)` (`lib/store.tsx`) → `recordMovements` crea `StockMovement` `Salida/Dispensación` (qty negativa, `ref: "Derivación <mascota>"`) y descuenta `medications[].stock`; estado `Dispensada` → `services.referrals.dispense`.
4. **Kardex**: `Kardex` (`components/pharmacy/kardex.tsx`) lee `movements` + `medications` (saldo por medicamento).
5. **Reposición**: `stockStatus(m)` (`domain/medications.ts`) ≠ `Disponible` y sin OC abierta → `RestockSuggestions` (`components/pharmacy/purchasing.tsx`) y tarea `stockmed:<id>`.
6. **Orden de compra**: `createPurchaseOrder(supplierId, items)` (costo unitario = `price × COST_RATIO`) → `services.pharmacy.createPurchaseOrder`; `PurchaseOrders` → `sendPurchaseOrder` → `services.pharmacy.sendPurchaseOrder`; `receivePurchaseOrder` (también desde `PharmacyDay` y la tarea `ocfar:<id>`) → movimientos `Entrada/Compra` (`ref: "OC <n>"`) → `services.pharmacy.receivePurchaseOrder`. Todo con `Guard farmacia.inventario`.
7. **Ajustes manuales**: `AdjustStockDialog` (`components/pharmacy/adjust-stock-dialog.tsx`) → `adjustStock` → movimiento `Ajuste` → `services.pharmacy.adjustStock`.

---

## 4. Factura con medicamento → salida de stock

1. `InvoiceForm` (`components/care-actions/invoice-form.tsx`, `Guard facturas.emitir`) arma ítems desde `billableServices` (lookups) y `useStore().medications` (con `medicationId`); calcula neto + `IVA_RATE` (`domain/services.ts`).
2. `addInvoice` (`lib/store.tsx`): folio = máx+1; `recordMovements` crea `Salida/Venta` por cada ítem con `medicationId` (`ref: "Factura <folio>"`) → baja `medications[].stock` → `services.invoices.create` (el mock también registra el movimiento).
3. Se refleja en `Kardex`, `MedicationTable`, `RestockSuggestions`, `pharmacyKpis` y en la tarea `factura:<id>` ("Cobrar factura", estado `Emitida`).

---

## 5. Venta POS → stock de sala → despacho (Tienda)

1. `PointOfSale` (`components/retail/pos.tsx`, `Guard tienda.vender`): carrito sobre `products`, cliente opcional (`owners`/`petsOf` de lookups), medio de pago, despacho opcional con `COURIERS`.
2. `checkout` (`lib/retail-store.tsx`): `Sale` (número máx+1, `channel: "Mesón"`, `deliveryFee(owner.sector)` si hay despacho), `record` de `Salida/Venta` en **sala** (`ref: "Boleta <n>"`), y si hay despacho crea `Shipment` `Por preparar` para `TODAY+1` → `services.retail.checkout` (`CheckoutResult {sale, shipment?}`). Muestra `Receipt` (`retail/receipt.tsx`, usa `clinicProfile` e `ivaIncluded`).
3. `Shipments` (`components/retail/shipments.tsx`, `Guard tienda.inventario`) y tarea `despacho:<id>` → `advanceShipment` sigue `SHIPMENT_FLOW` (`Por preparar → Preparado → En ruta → Entregado`) → `services.retail.advanceShipment`.
4. Consumidores: `SalesReport`, `Catalog`, `RetailAnalytics`, `Panorama`, Mi día (Recepción/Farmacia/Admin con `retailKpis`), `OwnerRecords` (compras del dueño), `StoreZone` (Seguridad › Tienda, ventas de hoy), `customerSpend` en Análisis › Clientes.

## 6. Reposición de sala de tienda

1. Regla: `p.stock.sala < p.shelfMin` con `stock.central > 0`; cantidad sugerida `min(central, shelfMin×2 − sala)` (`refillQty` en `components/retail/warehouse.tsx` y la tarea `sala:<id>` en `lib/tasks.ts`).
2. `WarehouseView` ("Reponer todo" o por producto) o acción rápida de la tarea → `transferToSala(productId, qty)` → movimiento `Transferencia/Reposición sala` (`from: "central"`, `location: "sala"`) → `services.retail.transferToSala`.
3. Si falta en central: `RetailPurchasing` → `createOrder`/`sendOrder`/`receiveOrder` (entrada en **central**) → `services.retail.*`; tarea `octda:<id>` para recibir.
4. Ajustes: `adjust(productId, location, qty, "Merma"|"Conteo")` → `services.retail.adjust`.

---

## 7. Pendientes derivados de todos los stores

`useTasks()` (`lib/tasks.ts`) lee `useStore`, `useRetail`, `useSecurity`, `useSupport` y `useCan`, y construye tareas con id estable `"fuente:id"`:

| Tarea | Fuente | Permiso | Acción rápida (mutación) |
|---|---|---|---|
| `llegada:` | `expectedArrivals` (citas + access + waiting + rooms) | `agenda.gestionar` | `security.checkIn` |
| `vacuna:` | `dueVaccines(visiblePatients)` vencidas sin recordatorio | `agenda.gestionar` | `sendReminder` → `tasks.sendReminder` |
| `factura:` | facturas `Emitida` | `facturas.emitir` | — |
| `solicitud:` | solicitudes recibidas pendientes | `red.aprobar` | — |
| `receta:` | derivaciones internas no dispensadas | `farmacia.dispensar` | `dispenseReferral` (si hay stock) |
| `stockmed:` | `stockStatus ≠ Disponible` sin OC abierta | `farmacia.inventario` | — |
| `ocfar:` | OC farmacia `Enviada` | `farmacia.inventario` | `receivePurchaseOrder` |
| `despacho:` | envíos `Por preparar`/`Preparado` | `tienda.inventario` | `advanceShipment` |
| `sala:` | sala bajo mínimo con stock central | `tienda.inventario` | `transferToSala` |
| `octda:` | órdenes de tienda `Enviada` | `tienda.compras` | `receiveOrder` |
| `evento:` | eventos de seguridad `OPEN_EVENT` | `seguridad.ver` | — (enlace a `/seguridad/eventos?id=`) |
| `ticket:` | tickets `Esperando cliente` | `soporte.crear` | — |

Filtra por `can(permission)`, ordena por prioridad y antigüedad, y combina con `taskMeta` (`assignee`, `done`). Devuelve `all`, `open`, `mine` (sin asignar o asignadas a `currentUser`), `done`.
Consumidores: `TaskInbox` (Inicio › Pendientes; `assignTask`/`completeTask` → `tasks.assign`/`tasks.complete`), `MyTasksCard` (Mi día Vet/Recepción/Farmacia), `AdminAlerts` (conteo `open`), `useNavBadges` (badge de "Pendientes" = `mine.length`; "Solicitudes" = recibidas pendientes) en `sidebar/nav-panel.tsx`.

Una tarea desaparece cuando se resuelve en su módulo (la fuente deja de cumplir la condición) o se marca hecha.

---

## 8. Panorama y Mi día leyendo métricas compartidas

Funciones puras (sobre estado de los stores) en `lib/metrics/*` y `lib/analytics.ts`, reutilizadas para que los números coincidan entre pantallas:

| Métrica | Archivo | Panorama | Mi día | Otros |
|---|---|---|---|---|
| `visiblePatients`, `coverage`, `dueVaccines` | `lib/analytics.ts` | ✓ | Admin | Vacunación, Diagnósticos, Clientes, `useTasks` |
| `consultsThisMonth`, `vaccineKpis` | `lib/metrics/clinic.ts` (lee `monthlyConsults`, `patients` de lookups) | ✓ | Admin | Diagnósticos (misma serie) |
| `agendaLoad`, `appointmentRates` | `lib/metrics/clinic.ts` | | | Reportes |
| `pharmacyKpis`, `expiringValue`, `medicationTurnover` | `lib/metrics/pharmacy.ts` | ✓ (`pharmacyKpis`) | Farmacia | Reportes |
| `retailKpis`, `retailMonthNet`, `marginByCategory`, `productTurnover`, `shipmentKpis` | `lib/metrics/retail.ts` | ✓ | Recepción, Farmacia, Admin (`retailKpis`) | Análisis › Tienda |
| `supportKpis` | `lib/metrics/support.ts` | ✓ | `AdminAlerts` | Tickets |
| `speciesDistribution`, `customerSpend`… | `lib/metrics/customers.ts` | | Admin (`speciesDistribution`) | Clientes |
| `todayAppointments`, `appointmentStage`, `expectedArrivals` | `lib/metrics/day.ts` | | Vet, Recepción | Agenda, Hall, `useTasks` |

Panorama (`components/analytics/panorama.tsx`) además: `useRevenueByLine()` toma `revenueByLine` (lookups) y reemplaza el mes en curso de la tienda con `retailMonthNet(sales)`; margen con `SERVICES_MARGIN` (`domain/metrics.ts`), `COST_RATIO` (`domain/pharmacy.ts`) y margen de tienda; bloque "Requiere atención" con enlaces a cada módulo (eventos críticos, tickets críticos, cámaras sin señal, vacunas vencidas, solicitudes, recetas, despachos atrasados, quiebres). Sección financiera con `RequirePermission reportes.financiero`.

---

## 9. Ticket de soporte desde cámara caída / dispositivo / topbar

1. **Cámara sin señal**: `CameraDialog` con `view === "offline"` → botón (`Guard soporte.crear`) → `useSupport().createTicket({title: "Cámara sin señal: …", category: "Integración / datos", priority: "Alta", module: "Seguridad › Dispositivos", route: "/seguridad/monitoreo", body})` → `router.push("/soporte/tickets/<id optimista>")`.
2. **Dispositivo con falla**: `Devices` (`components/security/devices.tsx`) `report(name, detail)` → `createTicket({… route: "/seguridad/dispositivos"})` → navega al ticket. En la misma pantalla `setCameraStatus` ("Reiniciar"/"Mantención").
3. **Topbar**: botón salvavidas → `NewTicketDialog` (`components/support/shared.tsx`) con `defaultModule = moduleLabel(canal, ítem)` (de `findByPath(pathname)`) y `route = pathname`; adjunta usuario, rol y página. `createTicket` → navega al ticket. El buscador ⌘K también ofrece "Reportar un problema" (enlace a `/soporte/tickets`).
4. `createTicket` (`lib/support-store.tsx`): número máx+1, `status: "Nuevo"`, `context: {route, role}`, primer mensaje → `services.support.createTicket`.
5. **Mejoras**: `IdeasBoard` → `proposeIdea` crea `Idea` + ticket `Mejora` vinculado (`ideaId`) → `services.support.proposeIdea`; `voteIdea` → `services.support.vote`. `Releases` muestra novedades (`releases` de lookups) cruzadas con `ideas`.
6. **Seguimiento**: `TicketDetail` (`replyTicket`, `changeStatus`, `rateTicket`; `simulateSupportReply` solo demo). Tickets `Esperando cliente` → tarea `ticket:<id>`; `supportKpis` en Panorama/`AdminAlerts`.

Nota: el id usado en la navegación es el optimista (`tk-new-N`); con backend hay que esperar el id real.

---

## 10. Roles y permisos

1. Catálogo `PERMISSIONS` + tipo `Permission` + `ROLES` en `domain/settings.ts`. Matriz inicial `defaultRolePermissions` y usuarios demo `seedUsers`/`demoUserByRole` en `mocks/settings.ts`.
2. Estado en `useStore`: `role` (inicial `Veterinario`), `rolePermissions`, `currentUser = users.find(id === demoUserByRole[role])`.
3. **"Ver como"**: menú del avatar en `Topbar` → `setRole(r)` (sin operación de servicio). Cambia `currentUser`, la vista de `MyDay` (`VetDay`/`ReceptionDay`/`PharmacyDay`/`AdminDay` y accesos rápidos `QUICK[role]`), los permisos efectivos y por ende tareas, badges y resultados del buscador. `support-store` y `security-store` usan `currentUser`/`role` como autor de tickets, notas y auditoría.
4. **Editar matriz**: Ajustes › Permisos `PermissionsMatrix` → `togglePermission(role, permission)` → `services.settings.togglePermission`. Efecto inmediato en toda la UI.
5. **Consumo**: `useCan()(p)`; `<Guard permission>` deshabilita acciones con tooltip "Rol X sin permiso: …"; `<RequirePermission permission>` reemplaza vistas (fichas `ficha.ver`, análisis financieros `reportes.financiero`, Seguridad `seguridad.ver` vía `SecurityPage`, Dispositivos `seguridad.administrar`); `useTasks` filtra tareas por permiso; `CommandPalette` filtra grupos y atajos; `useCameraView` decide `locked`.
6. `useDoctors()` deriva los profesionales agendables de `users` (Veterinario + Activo + `doctorId`): invitar/desactivar usuarios en Ajustes › Usuarios (`inviteUser`/`updateUser`) cambia la Agenda y el mapa de Actividad.
7. El mock (`services/mock/db.ts` `actor()`) siempre actúa como el Veterinario demo; el servidor real debe validar permisos (`403`).

---

## 11. Buscador ⌘K y regla de acceso

1. `Topbar` monta `SearchTrigger` + `CommandPalette` (`components/search/command-palette.tsx`); `useCommandPaletteShortcut` abre con ⌘K / Ctrl+K.
2. Con ≥ 2 caracteres busca:
   - **Mascotas** (`patients` de lookups) por nombre, chip, raza o RUT del dueño. Si `useCanView()(id)` → enlace a `/pacientes/historial/<id>`; si no → "En la red · <clínica> · solicitar acceso" con candado y enlace a `/clinicas/red?rut=<rut>` (§1).
   - **Propietarios** (`owners`) por nombre, RUT o teléfono: visible si alguna de sus mascotas (`petsOf`) es visible → `/pacientes/propietarios/<rut>`; si no → `/clinicas/red?rut=<rut>`.
   - **Citas de hoy** (`todayAppointments`, sin canceladas) por paciente o motivo → `/inicio/agenda`.
   - Grupos condicionados por permiso (`useCan`): productos (`tienda.vender`/`tienda.inventario`), medicamentos (`farmacia.*` o `medicamentos.derivar`), boletas por número (`tienda.vender`), facturas por folio (`facturas.emitir`), tickets (`soporte.crear`).
3. Atajos ("Nueva venta", "Agendar cita", "Reportar un problema") también filtrados por permiso. Selección → `router.push(href)`.
