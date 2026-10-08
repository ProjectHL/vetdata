# Arquitectura de VetData (prototipo frontend)

> Rutas en este documento son relativas a `frontend/` (el front vive en `frontend/src/` desde la separación front/back; ver README raíz).

> Documento generado a partir del código actual (`src/`) con la skill `arquitectura-vetdata`.
> Detalle por módulo: `.claude/skills/arquitectura-vetdata/references/modulos.md`.
> Flujos entre canales: `.claude/skills/arquitectura-vetdata/references/conexiones.md`.

## 1. Resumen

**VetData** es un dashboard de datos de mascotas **compartido entre clínicas veterinarias** (Chile). Cada clínica opera su día (agenda, boxes, facturación, farmacia, tienda, cámaras) y puede **pedir acceso a fichas de mascotas de otras clínicas de la red** con alcance y vigencia acotados.

**Alcance del prototipo**

- Solo frontend. **No hay backend ni base de datos**: los datos son semillas en memoria (`src/mocks`) y lo que se crea desde la UI vive en stores de sesión (React context) hasta recargar la página.
- La sesión es simulada: el login (`/login`) solo redirige a `/dashboard`; la clínica actual es fija (`Clínica Vet Providencia`) y el rol se cambia con **"Ver como"**.
- Fecha y hora "actuales" fijas (`TODAY = 2026-10-07`, `NOW_TIME = 11:05`) para que la demo sea reproducible.
- Está preparado para que un dev conecte una API real **implementando `src/services/http`** y cambiando el estado inicial de los stores (ver §9).

## 2. Stack y comandos

| | |
|---|---|
| Framework | Next.js **16.3.8** (App Router). Ojo: tiene cambios incompatibles con versiones previas; leer `node_modules/next/dist/docs/` antes de usar APIs de Next (ver `AGENTS.md`). |
| UI | React 19.2, Tailwind CSS v4, shadcn/ui (`src/components/ui`, radix-ui), íconos `lucide-react`, gráficos `recharts` vía shadcn Charts (`components/ui/chart.tsx`), `cmdk` para el buscador ⌘K |
| Lenguaje | TypeScript 5 |
| Gestor | pnpm (`packageManager: pnpm@11.8.0`) |

```bash
pnpm install
pnpm dev        # http://localhost:3000 → redirige a /login
pnpm build
pnpm start
pnpm lint
```

Variables de entorno (se inyectan en build, prefijo `NEXT_PUBLIC_`):

| Variable | Valores | Dónde se lee |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` (por defecto) · `http` | `src/services/index.ts` |
| `NEXT_PUBLIC_API_URL` | URL base de la API, p. ej. `https://api.vetdata.cl` | `src/services/http/client.ts` (`API_URL`) |

No hay archivo `.env` en el repo.

## 3. Capas y reglas de importación

```
src/app/(dashboard)/<canal>/<módulo>/page.tsx    Rutas: páginas delgadas (server components)
        │ componen
        ▼
src/components/<dominio>/*.tsx                    UI (client components con estado/interacción)
src/components/layout/*                           PageContainer, PageHeader, EmptyState, clickableRow
        │ leen/escriben estado con hooks            │ lecturas de catálogos (DEUDA, §12)
        ▼                                           ▼
src/lib/store.tsx          useStore + useAccess,    src/lib/lookups.ts  ── único puente a src/mocks
src/lib/retail-store.tsx   useCanView, useCan,                             para componentes y utilidades
src/lib/support-store.tsx  useDoctors, usePending…
src/lib/security-store.tsx useSecurity, usePrivacy
src/lib/tasks.ts           useTasks, useNavBadges (deriva de los 4 stores)
        │ cada mutación: update optimista + runInBackground(services.<dominio>.<op>())
        ▼
src/services/contracts.ts  interfaces async por dominio (15 servicios)
src/services/index.ts      elige implementación (NEXT_PUBLIC_DATA_SOURCE) + runInBackground
src/services/mock/*        en memoria (db.ts clona src/mocks)
src/services/http/*        esqueleto: NotImplementedError + apiFetch
        │ el mock usa
        ▼
src/mocks/*.ts             datos semilla
src/domain/*.ts            tipos, constantes y reglas puras de dominio (usado por todas las capas)
src/lib/format.ts · src/lib/analytics.ts · src/lib/metrics/* · src/lib/csv.ts · src/lib/nav.ts   utilidades
```

### Reglas y su cumplimiento (verificado con grep)

| Capa | Puede importar | No debe importar | Estado real |
|---|---|---|---|
| `app/` | `components/`, `domain/`, `lib/format`, `lib/nav` | stores, `mocks/`, `services/` | ⚠️ `(dashboard)/layout.tsx` importa los 4 *Providers* (excepción necesaria). ⚠️ 4 páginas importan `@/lib/lookups`: `pacientes/historial/[id]`, `pacientes/propietarios/[rut]`, `inicio/actividad`, `farmacia/medicamentos`. ⚠️ `historial/[id]/page.tsx` (299 líneas) y `propietarios/[rut]/page.tsx` (141) no son páginas delgadas. ✅ ninguna importa `@/mocks` ni `@/services`. |
| `components/` | stores/hooks, `domain/`, `lib/` utilidades, `components/ui`, `components/layout` | `services/`, `mocks/` | ✅ 0 imports de `@/services`, ✅ 0 imports de `@/mocks`. ⚠️ 45 archivos leen catálogos vía `@/lib/lookups` (deuda, §12). |
| stores (`lib/*store*.tsx`) | `services/`, `domain/`, `lib/` | componentes | ✅ no importan componentes. ⚠️ importan `@/mocks/*` para el **estado inicial** (marcado `// TODO(api)`), y `@/lib/lookups`. |
| `lib/lookups.ts` | `mocks/`, `domain/` | — | Es el puente explícito a las semillas (por diseño, temporal). |
| `lib/analytics.ts`, `lib/metrics/*` | `domain/`, `lib/format` | — | ⚠️ No son 100 % puras: `analytics.ts`, `metrics/clinic.ts`, `metrics/customers.ts` y `metrics/retail.ts` leen semillas vía `@/lib/lookups` (`patients`, `owners`, `petsOf`, `getOwner`, `ownerLastVisit`, `monthlyConsults`). |
| `services/mock` | `mocks/`, `domain/`, `lib/format` | stores, componentes | ✅ |
| `services/http` | `../contracts`, `./client` | todo lo demás | ✅ |
| `mocks/` | `domain/` | — | ⚠️ `mocks/retail.ts` importa `TODAY, addDays` de `@/lib/format` (aceptable). |
| `domain/` | nada del proyecto | todo lo demás | ⚠️ `domain/medications.ts`, `patients.ts`, `support.ts`, `sharing.ts` importan `@/lib/format` (`TODAY`, `NOW_ISO`, `daysUntil`, `ageFrom`, `hoursBetween`) para las reglas que dependen de la fecha actual. |

## 4. Árbol de carpetas (comentado)

```
.claude/
  agents/                     backend-assistant · frontend-expert · nextjs-expert (§15)
  skills/                     arquitectura-vetdata (+ references/) · documentacion-backend (+ references/plantilla-dominio.md)
src/
  app/
    layout.tsx                <html lang="es">, fuentes Geist, TooltipProvider
    page.tsx                  redirect("/login")
    login/page.tsx            login simulado (client) → /dashboard
    globals.css               tokens de tema (claro/oscuro) y --viz-1/2/3
    (dashboard)/
      layout.tsx              StoreProvider › RetailProvider › SupportProvider › SecurityProvider + AppSidebar + Topbar
      dashboard/page.tsx      "Mi día" (canal Inicio)
      [channel]/[section]/    fallback "sección sin contenido" para ítems de nav.ts sin página (notFound si no existe en nav)
      inicio/  pacientes/  clinicas/  farmacia/  tienda/  analisis/  seguridad/  soporte/  ajustes/
                              una carpeta por módulo con page.tsx (§5); dinámicas: pacientes/historial/[id],
                              pacientes/propietarios/[rut], soporte/tickets/[id]
  components/
    ui/                       shadcn (no editar)
    layout/                   page-container.tsx · page-header.tsx · empty-state.tsx · clickable-row.ts
    sidebar/                  app-sidebar (channel-rail + nav-panel con badges)
    topbar.tsx                breadcrumb, buscador ⌘K, campana de solicitudes, reportar problema, "Ver como"
    search/                   command-palette (⌘K)
    dashboard/my-day/         Mi día por rol: vet, reception, pharmacy, admin, shared
    agenda/  activity/  tasks/                       canal Inicio
    pets/  owners/  patients/  care-actions/         canal Pacientes (+ acciones clínicas reutilizables)
    network/  sharing/                               canal Clínicas (red, accesos, AccessGate)
    pharmacy/  retail/  analytics/  security/  support/  settings/
    logo.tsx
  lib/
    store.tsx                 store clínico (citas, facturas, derivaciones, red, boxes, farmacia, tareas, ajustes)
    retail-store.tsx  support-store.tsx  security-store.tsx
    tasks.ts                  useTasks / useNavBadges (pendientes derivados)
    lookups.ts                catálogos y búsquedas sobre semillas (TODO(api))
    nav.ts                    canales → ítems (rail + panel + breadcrumb + fallback)
    format.ts                 TODAY, NOW_TIME, NOW_ISO, formatCLP, formatDate, formatRut…
    analytics.ts  metrics/{clinic,customers,day,pharmacy,retail,support}.ts   KPIs y reglas derivadas
    csv.ts  utils.ts
  domain/                     tipos + reglas puras: appointments, clinic, invoices, medications, metrics, network,
                              owners, patients, pharmacy, referrals, retail, security, services, settings, sharing,
                              support, tasks
  mocks/                      semillas: appointments, clinic, invoices, medications, metrics, network, owners,
                              patients, pharmacy, referrals, retail, security, services, settings, sharing, support
  services/
    contracts.ts              interfaces + tipos de entrada (endpoint REST sugerido en cada método)
    index.ts                  services, dataSource, runInBackground
    mock/                     db.ts + un archivo por dominio (clinic agrupa patients/owners/clinic/appointments/
                              invoices/referrals/network; settings agrupa settings/tasks)
    http/                     client.ts (apiFetch, ApiError, NotImplementedError) + mismo reparto que mock/
```

Los requerimientos de backend están en `docs/backend/` (generados con la skill `documentacion-backend`; empieza por `docs/backend/README.md`).

## 5. Canales → módulos → ruta

Fuente: `src/lib/nav.ts` + `find src/app -name page.tsx`. Todos los ítems del menú tienen página propia.

| Canal | Módulo | Ruta | Componente raíz |
|---|---|---|---|
| Inicio | Mi día | `/dashboard` | `dashboard/my-day/my-day.tsx` → `MyDay` |
| Inicio | Agenda | `/inicio/agenda` | `agenda/agenda.tsx` → `Agenda` |
| Inicio | Pendientes | `/inicio/pendientes` | `tasks/task-inbox.tsx` → `TaskInbox` |
| Inicio | Actividad | `/inicio/actividad` | `activity/clinic-activity.tsx` → `ClinicActivity` |
| Pacientes | Mascotas | `/pacientes/mascotas` | `pets/pet-browser.tsx` → `PetBrowser` |
| Pacientes | Propietarios | `/pacientes/propietarios` | `owners/owner-list.tsx` → `OwnerList` |
| Pacientes | (ficha propietario) | `/pacientes/propietarios/[rut]` | página + `OwnerGate`, `OwnerPets`, `OwnerRecords` |
| Pacientes | Historial clínico | `/pacientes/historial` | `patients/patient-list.tsx` → `PatientList` |
| Pacientes | (ficha mascota) | `/pacientes/historial/[id]` | página + `AccessGate`, `CareActionButtons`, tablas de `care-actions/records.tsx` |
| Clínicas | Red de clínicas | `/clinicas/red` (`?rut=`) | `HowItWorks`, `NetworkSearch`, `ClinicDirectory` |
| Clínicas | Compartidos conmigo | `/clinicas/compartidos` | `sharing/shared-tabs.tsx` → `SharedTabs` |
| Clínicas | Solicitudes | `/clinicas/solicitudes` | `sharing/request-tabs.tsx` → `RequestTabs` |
| Farmacia | Medicamentos | `/farmacia/medicamentos` | `pharmacy/medication-table.tsx` → `MedicationTable` |
| Farmacia | Movimientos | `/farmacia/movimientos` | `DispenseQueue`, `Kardex` |
| Farmacia | Proveedores | `/farmacia/proveedores` | `RestockSuggestions`, `PurchaseOrders`, `SupplierDirectory` |
| Tienda | Productos | `/tienda/productos` | `retail/catalog.tsx` → `Catalog` |
| Tienda | Punto de venta | `/tienda/venta` | `retail/pos.tsx` → `PointOfSale` |
| Tienda | Ventas | `/tienda/ventas` | `retail/sales-report.tsx` → `SalesReport` |
| Tienda | Bodega | `/tienda/bodega` | `retail/warehouse.tsx` → `WarehouseView` |
| Tienda | Compras | `/tienda/compras` | `retail/purchasing.tsx` → `RetailPurchasing` |
| Tienda | Despachos | `/tienda/despachos` | `retail/shipments.tsx` → `Shipments` |
| Análisis | Panorama | `/analisis/panorama` | `analytics/panorama.tsx` → `Panorama` |
| Análisis | Vacunación | `/analisis/vacunacion` | `analytics/vaccination.tsx` → `Vaccination` |
| Análisis | Diagnósticos | `/analisis/diagnosticos` | `analytics/diagnoses.tsx` → `Diagnoses` |
| Análisis | Clientes | `/analisis/clientes` | `analytics/customers.tsx` → `Customers` |
| Análisis | Tienda | `/analisis/tienda` | `analytics/retail-analytics.tsx` → `RetailAnalytics` |
| Análisis | Reportes | `/analisis/reportes` | `analytics/reports.tsx` → `Reports` |
| Seguridad | Centro de monitoreo | `/seguridad/monitoreo` | `SecurityPage` + `Monitoring` |
| Seguridad | Hall y entrada | `/seguridad/hall` | `SecurityPage` + `HallZone` |
| Seguridad | Sala de espera | `/seguridad/sala-espera` | `SecurityPage` + `WaitingZone` |
| Seguridad | Boxes | `/seguridad/boxes` | `SecurityPage` + `BoxesZone` |
| Seguridad | Tienda | `/seguridad/tienda` | `SecurityPage` + `StoreZone` |
| Seguridad | Eventos | `/seguridad/eventos` (`?id=`) | `SecurityPage` + `SecurityEvents` |
| Seguridad | Dispositivos | `/seguridad/dispositivos` | `SecurityPage` + `Devices` |
| Soporte | Tickets | `/soporte/tickets` | `support/ticket-list.tsx` → `TicketList` |
| Soporte | (detalle ticket) | `/soporte/tickets/[id]` | `support/ticket-detail.tsx` → `TicketDetail` |
| Soporte | Mejoras | `/soporte/mejoras` | `support/ideas-board.tsx` → `IdeasBoard` |
| Soporte | Novedades | `/soporte/novedades` | `support/releases.tsx` → `Releases` |
| Ajustes | Perfil | `/ajustes/perfil` | `UserProfile`, `ClinicProfileCard` |
| Ajustes | Usuarios | `/ajustes/usuarios` | `settings/users-table.tsx` → `UsersTable` |
| Ajustes | Permisos | `/ajustes/permisos` | `PermissionsMatrix`, `SharingPolicyCard` |

Fuera del menú: `/` (redirige a `/login`), `/login`, y el fallback `/[channel]/[section]`.

## 6. Stores (estado de sesión)

Montados en `src/app/(dashboard)/layout.tsx` en este orden (los internos dependen de `useStore`):
`StoreProvider › RetailProvider › SupportProvider › SecurityProvider`.

Patrón común: `useState(seed…) // TODO(api)`, ids optimistas `<prefijo>-new-N`, y cada mutación aplica el cambio local y luego `runInBackground(services.<dominio>.<op>(…))`.

### `useStore` — `src/lib/store.tsx`

| Estado | Semilla (hoy) | Lectura que lo reemplaza |
|---|---|---|
| `appointments` | `mocks/appointments` | `appointments.list()` |
| `invoices` | `mocks/invoices` | `invoices.list()` |
| `referrals` | `mocks/referrals` | `referrals.list()` |
| `requests`, `grants` | `mocks/sharing` | `sharing.listRequests()`, `sharing.listGrants()` |
| `rooms` (mapa de boxes, compartido por Actividad y Seguridad) | `mocks/clinic` | `clinic.listRooms()` |
| `medications`, `movements`, `purchaseOrders` | `mocks/medications`, `mocks/pharmacy` | `pharmacy.listMedications/listMovements/listPurchaseOrders()` |
| `reminders`, `taskMeta` | `[]`, `{}` | `tasks.listReminders()`, `tasks.listMeta()` |
| `role` (demo "Ver como"), `currentUser` (derivado de `demoUserByRole[role]`) | `"Veterinario"` | `settings.getCurrentUser()` |
| `users`, `rolePermissions`, `clinicProfile`, `sharingPolicy` | `mocks/settings` | `settings.listUsers/getRolePermissions/getClinicProfile/getSharingPolicy()` |

| Mutación | Operación de servicio | Efecto local adicional |
|---|---|---|
| `addAppointment` / `updateAppointment` | `appointments.create` / `appointments.update` | — |
| `addInvoice` | `invoices.create` | folio = máx+1; **salida de stock** (`Venta`) por ítems con `medicationId` |
| `addReferral` | `referrals.create` | — |
| `sendRequest(patientIds, scope, duration, reason)` | `sharing.sendRequests` | descarta mascotas propias o con solicitud pendiente |
| `respondRequest(id, approve, terms?)` | `sharing.respond` | si aprueba crea el `AccessGrant` local |
| `revokeGrant` | `sharing.revoke` | — |
| `updateRoom(id, patch, {sync})` | `clinic.updateRoom` (omitido con `sync:false`) | — |
| `dispenseReferral` | `referrals.dispense` | salidas `Dispensación` + estado `Dispensada` |
| `adjustStock` | `pharmacy.adjustStock` | movimiento `Ajuste` |
| `createPurchaseOrder` / `sendPurchaseOrder` / `receivePurchaseOrder` | `pharmacy.createPurchaseOrder` / `sendPurchaseOrder` / `receivePurchaseOrder` | costo = precio × `COST_RATIO`; al recibir, entradas `Compra` |
| `assignTask` / `completeTask` / `sendReminder` | `tasks.assign` / `tasks.complete` / `tasks.sendReminder` | — |
| `inviteUser` / `updateUser` | `settings.inviteUser` / `settings.updateUser` | — |
| `togglePermission` | `settings.togglePermission` | — |
| `setClinicProfile` / `setSharingPolicy` | `settings.updateClinicProfile` / `settings.updateSharingPolicy` | — |
| `setRole` | — (solo demo) | — |

Hooks derivados: `useAccess(patientId)`, `useCanView()`, `usePendingRequest(patientId)`, `useCan()`, `useDoctors()` (catálogo `doctors` de lookups filtrado por usuarios veterinarios activos).

### `useRetail` — `src/lib/retail-store.tsx`

Estado: `products`, `sales`, `movements`, `orders`, `shipments` (semillas `mocks/retail`; `shipments` se genera con `buildSeedShipments`). Usa `currentUser` de `useStore`.

| Mutación | Operación |
|---|---|
| `checkout({items, ownerRut, payment, delivery})` | `retail.checkout` (salida de **sala**; si hay despacho, crea `Shipment` "Por preparar" para mañana) |
| `transferToSala(productId, qty)` | `retail.transferToSala` |
| `adjust(productId, location, qty, reason)` | `retail.adjust` |
| `createOrder` / `sendOrder` / `receiveOrder` | `retail.createOrder` / `sendOrder` / `receiveOrder` (entrada a bodega **central**) |
| `advanceShipment` | `retail.advanceShipment` (`SHIPMENT_FLOW`) |

### `useSupport` — `src/lib/support-store.tsx`

Estado: `tickets`, `ideas` (`mocks/support`). Usa `currentUser` y `role` de `useStore` (contexto del ticket).

| Mutación | Operación |
|---|---|
| `createTicket` | `support.createTicket` |
| `replyTicket` | `support.reply` ("Esperando cliente" → "En progreso") |
| `changeStatus` | `support.changeStatus` |
| `rateTicket` | `support.rate` (cierra) |
| `voteIdea` | `support.vote` |
| `proposeIdea` | `support.proposeIdea` (idea + ticket "Mejora" vinculado; el ticket local se crea sin llamar a `createTicket`) |
| `simulateSupportReply` | — (solo demo) |

### `useSecurity` — `src/lib/security-store.tsx`

Estado: `cameras`, `devices`, `events`, `access`, `waiting`, `audit`, `settings` (`mocks/security`). Usa `currentUser`, `role`, `appointments` y `updateRoom` de `useStore`.

| Mutación | Operación |
|---|---|
| `updateEvent` / `addEventNote` / `createEvent` | `security.updateEvent` / `addEventNote` / `createEvent` |
| `logAudit` | `security.logAudit` |
| `toggleLock` / `setAlarm` / `updateSettings` / `setCameraStatus` | `security.toggleLock` / `setAlarm` / `updateSettings` / `setCameraStatus` |
| `checkIn(appointmentId)` | `security.checkIn` (registro de ingreso en hall + entrada en sala de espera) |
| `callFromWaiting(entryId, roomId)` | `security.callFromWaiting` (ocupa el box con `updateRoom(..., {sync:false})` y saca de la sala) |

Hook derivado: `usePrivacy(camera)` = privacidad activada + box ocupado → sin vista en vivo.

### `useTasks` / `useNavBadges` — `src/lib/tasks.ts`

No guarda estado propio: **deriva** la bandeja de pendientes de los cuatro stores (ver `references/conexiones.md` §7). `taskMeta` (asignado/hecho) vive en `useStore`.

## 7. Capa de servicios

- **Contratos** (`src/services/contracts.ts`): 15 servicios (`patients`, `owners`, `clinic`, `appointments`, `invoices`, `referrals`, `network`, `sharing`, `pharmacy`, `retail`, `support`, `security`, `settings`, `tasks`, `analytics`). Cada método documenta su endpoint REST sugerido (`/api/v1/...`). Entradas y salidas usan solo tipos de `src/domain`. El usuario que ejecuta la acción **no viaja en la entrada**: lo resuelve el backend desde la sesión.
- **Selección** (`src/services/index.ts`): `dataSource = NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock"`; `services = httpServices | mockServices`. Re-exporta los tipos de `contracts`.
- **Mock** (`src/services/mock`): `db.ts` clona las semillas con `structuredClone`; las mutaciones escriben ahí, generan ids `<prefijo>-srv-N` y devuelven copias (`ok()`). `actor()` siempre es el usuario demo **Veterinario** (no conoce "Ver como"). La UI **no lee** de esta db: es una simulación del servidor.
- **HTTP** (`src/services/http`): cada método lanza `NotImplementedError("<MÉTODO> <ruta>")`. `client.ts` ya trae `apiFetch<T>(path, {method, body})` (JSON, `credentials: "include"`, lanza `ApiError(status, body)`), con `TODO(api)` para el token y la clínica activa.
- **`runInBackground(promise)`**: fire-and-forget; solo hace `console.error("[services]", error)`. No revierte el estado optimista ni avisa al usuario (TODO(api) en el propio archivo).
- **Hoy solo se invocan mutaciones.** Ninguna lectura (`list*`/`get*`) se llama en tiempo de ejecución: aparecen únicamente en comentarios `TODO(api)` de stores y `lookups.ts`. Consecuencia: con `NEXT_PUBLIC_DATA_SOURCE=http` la UI sigue mostrando semillas y cada mutación falla en silencio en consola con `NotImplementedError`.
- Operaciones del contrato sin referencia alguna (ni en comentarios): `support.getTicket`. `analytics.*` solo se referencia de forma genérica en `lookups.ts`.

**Agregar una operación**

1. Firma async + tipo de entrada en `contracts.ts` (con el comentario `/** MÉTODO /api/v1/... */`).
2. Implementación en `services/mock/<dominio>.ts` sobre `db`.
3. Esqueleto en `services/http/<dominio>.ts` que lance `NotImplementedError` con el endpoint (o ya con `apiFetch`).
4. Mutación en el store del dominio: actualización optimista + `runInBackground(services.<dominio>.<op>(…))`.
5. Pedir a `backend-assistant` que la documente (`docs/backend/api.md`, skill `documentacion-backend`).

## 8. Conexiones entre módulos (resumen)

Detalle paso a paso con archivos y funciones en `references/conexiones.md`.

| Flujo | Canales | Punto de unión |
|---|---|---|
| Red y acceso a ficha | Clínicas → Pacientes → (todos) | `accessLevel` (`domain/sharing.ts`), `useCanView`/`useAccess`, `AccessGate` |
| Día clínico | Inicio (Agenda/Mi día) → Seguridad (Hall, Sala) → Inicio (Actividad) → Seguridad (Boxes) | `checkIn`, `callFromWaiting`, `rooms` compartido, `appointmentStage`, `usePrivacy` |
| Receta | Pacientes (derivación) → Farmacia (dispensación, kardex, reposición, OC) | `addReferral` → `dispenseReferral` → `recordMovements` |
| Factura con medicamento | Pacientes → Farmacia | `addInvoice` → salida `Venta` en kardex |
| Venta tienda | Tienda POS → Bodega → Despachos | `checkout`, `transferToSala`, `advanceShipment` |
| Pendientes | todos → Inicio | `useTasks` (`lib/tasks.ts`) + badges de nav |
| Panorama / Mi día | todos → Análisis / Inicio | `lib/metrics/*`, `lib/analytics.ts` |
| Ticket automático | Seguridad / topbar → Soporte | `createTicket` con `route` y contexto |
| Roles y permisos | Ajustes → todos | `rolePermissions`, `useCan`, `Guard`, `RequirePermission` |
| Buscador ⌘K | topbar → todos | `CommandPalette` + `useCanView` + `useCan` |

## 9. Guía: conectar el backend

Pasos en orden para el dev. No hace falta tocar componentes salvo los de la deuda (§12).

1. **Configurar**: `NEXT_PUBLIC_DATA_SOURCE=http` y `NEXT_PUBLIC_API_URL=<url>` (se fijan en build).
2. **Autenticación y tenant** en `src/services/http/client.ts` (`apiFetch`): agregar token (cookie httpOnly o header `Authorization`) y la clínica activa, según defina el backend. Ya envía `credentials: "include"`.
3. **Implementar `src/services/http/*`** reemplazando cada `throw new NotImplementedError(...)` por `apiFetch<T>(ruta, {method, body})`. Las rutas están en el comentario de cada método y en `contracts.ts`. El orden sugerido: `settings` + `network` (sesión) → `patients`/`owners` → `appointments`/`clinic` → resto.
4. **Hidratar los stores**: en cada provider, reemplazar `useState(seed…) // TODO(api)` por una carga inicial con la lectura indicada en el comentario (`services.<dominio>.list…()`), con estado de carga/error. Hay 16 en `store.tsx`, 5 en `retail-store.tsx`, 2 en `support-store.tsx`, 7 en `security-store.tsx`. Alternativa: cargar en server components y pasar el estado inicial como prop al provider.
5. **Reemplazar `src/lib/lookups.ts`**: cada export indica su operación (`TODO(api): services.…`). Mover esos catálogos a un store (p. ej. `patients`, `owners`, `doctors`, `clinics`, `suppliers`, `retailSuppliers`, `billableServices`, `releases`, `NVR`, series de `analytics`) o a cargas por página; las funciones de búsqueda (`getPatient`, `getOwner`, `petsOf`, `getSupplier`) pasan a buscar en ese estado o a llamar `patients.get`/`owners.get`/`patients.listByOwner`. `ownerLastVisit` debe ser un campo calculado por el backend. Luego actualizar los 45 componentes, 4 páginas, 3 stores, `lib/tasks.ts`, `lib/analytics.ts` y `lib/metrics/{clinic,customers,retail}.ts` que lo importan (§12).
6. **Sesión, usuario y clínica actual**:
   - `currentClinic` (hoy constante re-exportada por `lookups.ts` desde `mocks/network.ts`) → `network.getCurrentClinic()` o el tenant del token.
   - `currentUser` (hoy `users.find(u => u.id === demoUserByRole[role])`) → `settings.getCurrentUser()`.
   - `role` sale del usuario autenticado. **"Ver como"** (`setRole` en el menú del avatar, `topbar.tsx`) es solo demo: quitarlo o restringirlo a un modo de previsualización para Admin.
   - El login (`src/app/login/page.tsx`) hoy solo hace `router.push("/dashboard")`.
7. **Reconciliar ids optimistas**: los stores crean ids `<prefijo>-new-N` (y números/folios con `máx+1` en cliente: factura, OC, boleta, ticket) y nunca los sustituyen. Cambiar `runInBackground` (o cada mutación) para esperar la respuesta, reemplazar el objeto optimista por el canónico (id, folio, número, totales) y revertir/avisar si falla. Casos sensibles:
   - `createTicket` navega a `/soporte/tickets/${t.id}` con el id optimista (`support/shared.tsx`, `security/camera-dialog.tsx`, `security/devices.tsx`).
   - `respondRequest` crea el `AccessGrant` en cliente; el contrato devuelve `{request, grant}`.
   - `checkout` crea el `Shipment` en cliente; el contrato devuelve `{sale, shipment}`.
   - `checkIn` y `callFromWaiting` actualizan varias colecciones (acceso, sala, box): usar la respuesta (`CheckInResult`, `CallFromWaitingResult`).
8. **Atomicidad en servidor**: operaciones que tocan varios dominios deben ser transaccionales en el backend: `invoices.create` (factura + salida de stock), `referrals.dispense` (movimientos + estado), `pharmacy.receivePurchaseOrder`, `retail.checkout` (salida de sala + despacho), `retail.receiveOrder`, `security.checkIn`, `security.callFromWaiting` (box + sala), `support.proposeIdea` (idea + ticket).
9. **Permisos en servidor**: `Guard`, `RequirePermission` y `useCan` solo ocultan/deshabilitan en la UI. El backend debe validar cada operación contra la matriz `rolePermissions` de la clínica y responder `403`. La regla de acceso de la red (`accessLevel`: propio / compartido vigente con alcance / ninguno) también debe aplicarse en servidor al servir fichas de otras clínicas, incluyendo alcance "Resumen clínico" vs "Ficha completa". Las acciones de cámara (`logAudit`) deben auditarse en servidor.
10. **Fechas**: reemplazar `TODAY`/`NOW_TIME`/`NOW_ISO` (`lib/format.ts`) por la fecha real en zona `America/Santiago`, cuidando la hidratación (calcular en servidor o tras montar).
11. **Quitar lo demo**: `simulateSupportReply` (support-store), `actor()` del mock, "Ver como".

## 10. Convenciones

- **Fecha/hora fijas**: `TODAY = "2026-10-07"`, `NOW_TIME = "11:05"`, `NOW_ISO` en `src/lib/format.ts`. Nunca `new Date()` para "hoy".
- **Formatos** (`src/lib/format.ts`): `formatCLP`, `formatDate`, `formatDateTime`, `formatHours`, `formatRut`, `normalizeRut`, `ageFrom`, `addDays`, `daysUntil`, `minutesSince`, `hoursBetween`. IVA 19 % (`IVA_RATE` en `domain/services.ts` para facturas; `IVA`/`ivaIncluded` en `domain/retail.ts` para boletas — constante duplicada).
- **Permisos**: catálogo `PERMISSIONS` y tipo `Permission` en `src/domain/settings.ts`; matriz por defecto `defaultRolePermissions` en `src/mocks/settings.ts`; editable en Ajustes › Permisos. Uso: `useCan()(permiso)`; acciones con `<Guard permission>` (deshabilitada + tooltip con el rol); vistas con `<RequirePermission permission>` (aviso de acceso restringido) — ambos en `src/components/settings/guard.tsx`. Las páginas de Seguridad pasan por `SecurityPage` (`seguridad.ver`).
- **Regla de acceso de red** (`src/domain/sharing.ts`): cada mascota tiene clínica de origen; otra clínica solo la ve con `AccessGrant` vigente (`grantStatus`), con alcance (`Ficha completa` / `Resumen clínico`) y vigencia (30/90 días/permanente) revocable. En UI: `accessLevel`, `useCanView`, `useAccess`, `usePendingRequest`; la ficha se envuelve en `AccessGate`.
- **Clínica actual**: `currentClinic` importado desde `@/lib/lookups` (definido en `src/mocks/network.ts`).
- **Gráficos**: shadcn Charts (`components/ui/chart.tsx`, recharts). Cargar la skill `dataviz` antes de crear/modificar un gráfico. Colores de series `--viz-1` (teal), `--viz-2` (naranja), `--viz-3` (violeta) definidos en `src/app/globals.css` para claro y oscuro; una serie sola usa `--viz-1`.
- **Layout de página** (`src/components/layout/`): `PageContainer` (ancho `default`/`narrow`), `PageHeader` (`title`, `description`, `eyebrow`, `actions`), `EmptyState` (ícono, título, descripción, acción), `clickableRow(onActivate)` (fila de tabla accesible por teclado; archivo `.ts`). Excepciones con encabezado propio: `MyDay`, fichas `historial/[id]` y `propietarios/[rut]`, `TicketDetail`.
- **UI**: español de Chile; shadcn en `components/ui` (no editar; agregar con `pnpm dlx shadcn@latest add`); íconos lucide; tokens de tema (sin colores fijos salvo escenas de cámara); badges de estado con ícono + texto.
- **Páginas**: server components delgados que componen componentes; `params`/`searchParams` son promesas (`await props.params`), tipadas con `PageProps<"/ruta">`.

## 11. Roles demo y "Ver como"

El menú del avatar (`src/components/topbar.tsx`) permite cambiar `role` (`setRole`); el `currentUser` se deriva de `demoUserByRole` (`src/mocks/settings.ts`). "Mi día" muestra una vista distinta por rol.

| Rol | Usuario demo | Permisos por defecto |
|---|---|---|
| Veterinario (inicial) | u1 · Dra. Paula Rivas | ficha.ver, ficha.editar, agenda.gestionar, facturas.emitir, medicamentos.derivar, red.solicitar, red.aprobar, soporte.crear |
| Recepción | u7 · Constanza Arias | agenda.gestionar, facturas.emitir, red.solicitar, tienda.vender, soporte.crear, seguridad.ver |
| Farmacia | u9 · Marcela Toro | farmacia.dispensar, farmacia.inventario, facturas.emitir, tienda.vender, tienda.inventario, tienda.compras, soporte.crear, seguridad.ver |
| Admin | u10 · Rodrigo Bravo | todos |

## 12. Deuda técnica

### 12.1 Lecturas vía `src/lib/lookups.ts` desde componentes y páginas

Obtenido con `grep -rn "@/lib/lookups" src`. Cada export debe reemplazarse por la operación indicada (cargada en un store o en la página).

| Export de `lookups.ts` | Operación de servicio equivalente | Usado en |
|---|---|---|
| `currentClinic` | `network.getCurrentClinic()` | `topbar`, `care-actions/referral-form`, `sharing/request-tabs`, `sharing/shared-tabs`, `network/network-search`, `network/clinic-directory`, `pets/pet-browser`, `owners/owner-pets`, `owners/owner-records`, `dashboard/my-day/{vet,admin}`, `support/ideas-board`, `analytics/{reports,vaccination,customers,diagnoses,panorama}`; páginas `inicio/actividad`, `farmacia/medicamentos`; `lib/store`, `lib/support-store`, `lib/tasks` |
| `patients` | `patients.list()` | `patients/patient-list`, `pets/pet-browser`, `activity/clinic-activity`, `agenda/agenda`, `search/command-palette`, `analytics/{reports,vaccination}`; `lib/analytics`, `lib/metrics/clinic` |
| `getPatient` | `patients.get(id)` | `care-actions/records`, `pharmacy/dispense-queue`, `sharing/{request-tabs,shared-tabs,request-access-dialog,access-gate}`, `security/{zones,camera-dialog}`, `activity/clinic-activity`, `agenda/agenda`, `search/command-palette`, `dashboard/my-day/{reception,vet,admin}`, `owners/owner-pets`; página `historial/[id]`; `lib/store`, `lib/security-store`, `lib/tasks` |
| `petsOf` | `patients.listByOwner(rut)` | `network/network-search`, `retail/pos`, `search/command-palette`, `owners/{owner-list,owner-records,owner-gate}`; página `propietarios/[rut]`; `lib/metrics/retail` |
| `ownerLastVisit` | campo calculado por el backend (en `owners.list/get`) | `owners/owner-list`; página `propietarios/[rut]`; `lib/metrics/customers` |
| `owners`, `sectors` | `owners.list()` | `network/network-search`, `retail/pos`, `search/command-palette`, `owners/owner-list`, `analytics/reports`; `lib/metrics/customers` |
| `getOwner` | `owners.get(rut)` | `care-actions/{invoice-form,patient-quick-view}`, `patients/patient-list`, `sharing/{request-tabs,shared-tabs}`, `security/zones`, `activity/clinic-activity`, `pets/pet-browser`, `retail/{shipments,sales-report,receipt}`, `search/command-palette`, `dashboard/my-day/{reception,vet,admin}`, `agenda/agenda`, `owners/owner-gate`; páginas `historial/[id]`, `propietarios/[rut]`; `lib/analytics`, `lib/metrics/retail`, `lib/retail-store`, `lib/security-store`, `lib/tasks` |
| `doctors` | `clinic.listDoctors()` | `care-actions/{records,patient-quick-view,schedule-form}`, `pharmacy/dispense-queue`, `security/{zones,camera-dialog}`, `activity/clinic-activity`, `dashboard/my-day/reception`, `agenda/agenda`; `lib/store` (`useDoctors`) |
| `rooms` (catálogo estático) | `clinic.listRooms()` | `care-actions/{records,schedule-form}`, `dashboard/my-day/vet` (`roomCatalog`), `agenda/agenda` (`allRooms`) — leen nombres/tipos del catálogo semilla en vez de `useStore().rooms` |
| `billableServices` | `clinic.listServices()` | `care-actions/invoice-form` |
| `clinics`, `networkClinics` | `network.listClinics()` | `care-actions/referral-form`, `pets/pet-browser` (`clinics`); `network/clinic-directory` (`networkClinics`) |
| `medications` (catálogo estático) | `pharmacy.listMedications()` | `care-actions/records`, `pharmacy/medication-table` (categorías) |
| `suppliers`, `getSupplier` | `pharmacy.listSuppliers()` | `pharmacy/purchasing`, `dashboard/my-day/pharmacy` |
| `retailSuppliers` | `retail.listSuppliers()` | `retail/{purchasing,catalog}`, `dashboard/my-day/pharmacy` |
| `releases` | `support.listReleases()` | `support/releases` |
| `NVR` | `security.getNvrStorage()` | `security/{monitoring,devices}` |
| `revenueByLine` | `analytics.revenueByLine()` | `analytics/panorama` |
| `monthlyRevenue`, `boxOccupancy` | `analytics.monthlyRevenue()`, `analytics.boxOccupancy()` | `analytics/reports` |
| `vaccineCoverage`, `coverageByVaccine` | `analytics.vaccineCoverage()`, `analytics.coverageByVaccine()` | `analytics/vaccination` |
| `diagnosisCategories`, `monthlyConsults`, `networkAlerts` | `analytics.diagnosisCategories()`, `monthlyConsults()`, `networkAlerts()` | `analytics/diagnoses`; `monthlyConsults` también en `lib/metrics/clinic` |
| `getClinic` | `network.listClinics()` | **sin uso** (export muerto) |

### 12.2 Otras deudas e inconsistencias

- Estado inicial de los 4 stores desde `@/mocks` (30 `TODO(api)`); lecturas del contrato nunca invocadas (§7).
- Ids/folios optimistas sin reconciliar (§9.7); `runInBackground` no revierte ni avisa.
- `src/domain/*` depende de `@/lib/format` (fecha fija) → al conectar el backend, las reglas `grantStatus`, `expiryStatus`, `slaState`, `patientAge` necesitarán recibir "ahora" como parámetro o leer la fecha real.
- `lib/analytics.ts` y `lib/metrics/{clinic,customers,retail}.ts` leen semillas (no son puras).
- Páginas `historial/[id]` y `propietarios/[rut]` contienen mucha UI y leen `lookups` en servidor; conviene extraer a componentes.
- Constante IVA duplicada (`IVA_RATE` en `domain/services.ts` e `IVA` en `domain/retail.ts`).
- Tipo `NewTicket` duplicado en `lib/support-store.tsx` y `services/contracts.ts`; las firmas de los stores (argumentos posicionales) difieren de las entradas del contrato (objetos).
- El mock usa `actor()` fijo (Veterinario) y no refleja "Ver como".
- `simulateSupportReply` sin operación de servicio (solo demo).

## 13. Agentes y skills del proyecto

| Recurso | Ruta | Cuándo usarlo |
|---|---|---|
| Agente `nextjs-expert` | `.claude/agents/nextjs-expert.md` | Rutas, límites server/client, `PageProps`/`searchParams`, metadata, build/lint, rendimiento y **capa de servicios** (`src/services`). No para diseño visual ni para especificar backend. |
| Agente `frontend-expert` | `.claude/agents/frontend-expert.md` | Consistencia visual, componentes compartidos, accesibilidad, responsive, estados vacíos/carga/error, **gráficos** (con skill `dataviz`), patrones de permisos y acceso en la UI. |
| Agente `backend-assistant` | `.claude/agents/backend-assistant.md` | Traducir el prototipo a requerimientos de backend (entidades, reglas, estados, permisos, endpoints, eventos, auditoría) en `docs/backend/`; verificar que `contracts.ts` y la doc coincidan. No escribe código de servidor ni DDL. |
| Skill `arquitectura-vetdata` | `.claude/skills/arquitectura-vetdata/SKILL.md` (+ `references/modulos.md`, `references/conexiones.md`) | Antes de agregar/mover un canal, módulo, componente, store u operación; para regenerar este documento. |
| Skill `documentacion-backend` | `.claude/skills/documentacion-backend/SKILL.md` (+ `references/plantilla-dominio.md`) | Cuando cambia una operación de `contracts.ts`, un tipo/estado de `src/domain` o un permiso; la usa `backend-assistant`. |
| Skill `dataviz` (global) | — | Antes de crear o modificar cualquier gráfico, KPI o paleta. |
