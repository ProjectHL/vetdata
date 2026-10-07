# Requerimientos de backend · VetData

> Documento generado a partir del prototipo de frontend (`src/`). Fecha de referencia del prototipo: **07-10-2026 11:05** (fija, ver `src/lib/format.ts:TODAY/NOW_TIME`).
> Audiencia: el desarrollador que construirá la API y que **no** vio el prototipo.

## 1. Qué es VetData

Dashboard SaaS para clínicas veterinarias en Chile. Cada clínica (tenant) gestiona su agenda, boxes, fichas, facturas, farmacia interna, tienda de productos, seguridad (cámaras, cerraduras, alarma) y soporte con VetData. Lo distintivo: las clínicas forman una **red** y pueden **compartir fichas de mascotas** entre ellas, siempre con solicitud, aprobación de la clínica de origen, consentimiento del dueño, alcance y vigencia.

## 2. Alcance de esta documentación

- **Incluye**: entidades con campos y restricciones, reglas de negocio (con su fuente en el código), máquinas de estado, permisos, endpoints sugeridos, efectos cruzados entre dominios, eventos/notificaciones y decisiones pendientes.
- **No incluye**: código de servidor, esquema de base de datos/DDL, infraestructura. Las entidades se describen a nivel lógico.
- **Fuente de verdad**: `src/services/contracts.ts` (96 operaciones = 96 endpoints), `src/domain/*` (tipos y reglas puras), stores `src/lib/*store*.tsx` (efectos de cada mutación), `src/services/mock/*` (cómo debería responder el servidor).
- Todo lo que el prototipo **simula** o **no resuelve** está en [`preguntas-abiertas.md`](preguntas-abiertas.md).

## 3. Cómo leer

| Archivo | Para qué |
|---|---|
| [`transversales.md`](transversales.md) | Reglas que aplican a todo: tenant, red y compartición, sesión, autorización, auditoría, fechas, RUT, CLP/IVA, atomicidad, ids, archivos, notificaciones. **Leer primero.** |
| [`dominios/`](dominios/) | Un archivo por dominio con entidades, reglas, estados, operaciones y efectos cruzados. |
| [`api.md`](api.md) | Tabla de las 96 operaciones → método + ruta → permiso → dominio. |
| [`estados.md`](estados.md) | Todas las máquinas de estado y enums, con transiciones válidas y qué debe restringir el backend. |
| [`permisos.md`](permisos.md) | Cada permiso → operaciones que habilita → roles por defecto. Operaciones sin permiso explícito. |
| [`eventos.md`](eventos.md) | Eventos de dominio y notificaciones. |
| [`preguntas-abiertas.md`](preguntas-abiertas.md) | Decisiones pendientes para negocio / dev. |

Convenciones en el texto:
- **Fuente:** `ruta:función` indica dónde vive la regla en el prototipo.
- *(regla)* = comportamiento de negocio que el backend debe garantizar. *(supuesto del prototipo)* = valor o simplificación de demo que hay que confirmar o parametrizar.
- **DEBE** = requisito de backend que hoy solo existe (o ni siquiera existe) en la UI.
- "Permiso propuesto" = el contrato no declara permiso; se infiere de qué `Guard`/`RequirePermission` envuelve la acción en la UI.

### Mapa de pantallas (rutas del frontend)
`src/lib/nav.ts`: Inicio (`/dashboard` Mi día, `/inicio/agenda`, `/inicio/pendientes`, `/inicio/actividad`), Pacientes (`/pacientes/mascotas`, `/pacientes/propietarios`, `/pacientes/historial`), Red (`/clinicas/red`, `/clinicas/compartidos`, `/clinicas/solicitudes`), Farmacia (`/farmacia/medicamentos`, `/farmacia/movimientos`, `/farmacia/proveedores`), Tienda (`/tienda/productos`, `/tienda/venta`, `/tienda/ventas`, `/tienda/bodega`, `/tienda/compras`, `/tienda/despachos`), Análisis (`/analisis/panorama`, `vacunacion`, `diagnosticos`, `clientes`, `tienda`, `reportes`), Seguridad (`/seguridad/monitoreo`, `hall`, `sala-espera`, `boxes`, `tienda`, `eventos`, `dispositivos`), Soporte (`/soporte/tickets`, `mejoras`, `novedades`), Ajustes (`/ajustes/perfil`, `usuarios`, `permisos`).

## 4. Glosario

| Término | Significado |
|---|---|
| **Tenant / clínica** | Cliente de VetData. Todo dato operativo pertenece a una clínica. Hoy se identifica por **nombre** (`Patient.clinic`, `AccessGrant.ownerClinic`, `AccessRequest.from/to`); el backend debe usar un `clinicId` estable. |
| **Clínica actual** | La del usuario autenticado (`network.getCurrentClinic`). En el prototipo es fija: "Clínica Vet Providencia" (`src/mocks/network.ts:currentClinic`). |
| **Red** | Conjunto de clínicas conectadas a VetData (`Clinic`, estado `Conectada` o `Invitación pendiente`). |
| **Clínica de origen** | Dueña del dato clínico de una mascota (`Patient.clinic`). Es la única que puede aprobar o revocar accesos. |
| **Nivel de acceso: propio / compartido / sin acceso** | Resultado de `accessLevel()`: `propio` si la mascota es de mi clínica; `compartido` si tengo un acceso (grant) **vigente**; `ninguno` en otro caso. Fuente: `src/domain/sharing.ts:accessLevel`. |
| **Solicitud de acceso (AccessRequest)** | Pedido de una clínica a la de origen para ver la ficha de una mascota. Estados `Pendiente → Aprobada | Rechazada`. |
| **Acceso / grant (AccessGrant)** | Permiso otorgado por la clínica de origen a otra clínica sobre **una** mascota, con alcance y vigencia. |
| **Alcance (scope)** | `Ficha completa` (todo) o `Resumen clínico` (solo alergias, condiciones crónicas y vacunas; sin consultas, exámenes ni recetas). Fuente: `src/components/sharing/access-gate.tsx:PatientSummary`. |
| **Vigencia (duration)** | 30 días, 90 días o permanente (`null`). Al aprobar se convierte en `until = since + días`. |
| **Revocación** | La clínica de origen apaga un grant (`revoked = true`). Irreversible; para volver a compartir se requiere otra solicitud. |
| **Consentimiento del dueño** | `Owner.shareConsent` (registrado) + política de la clínica `SharingPolicy.requireConsent`. Si la política lo exige y el dueño no tiene consentimiento, quien aprueba debe declarar que el dueño autorizó. |
| **Box** | Sala de atención (`Room` con `kind = "box"`). Por extensión el "mapa de Actividad" incluye quirófano, imagen, laboratorio, hospitalización y áreas comunes. Estados `disponible → ocupado → limpieza → disponible`. |
| **Sala de espera** | Lista de pacientes con cita de hoy que ya llegaron (`WaitingEntry`). Aforo `WAITING_CAPACITY = 12`. |
| **Llegada (check-in)** | Registrar que el cliente de una cita de hoy entró: crea un ingreso en el hall (`AccessEntry`) y una entrada en la sala de espera. |
| **Pasar a box (llamar)** | Sacar a un paciente de la sala de espera y ocupar un box con el profesional de la cita. |
| **Pendientes / tareas** | Bandeja unificada de trabajo derivada del estado de todos los módulos (`src/lib/tasks.ts:useTasks`). Solo se persiste asignación y "hecho". |
| **Derivación / receta (Referral)** | "Ficha de medicamentos" que un veterinario envía a la farmacia interna o a otra clínica. Al dispensarla en farmacia interna se descuenta stock. |
| **Kardex** | Registro de movimientos de inventario (entradas, salidas, ajustes) con saldo. Farmacia: `StockMovement`; Tienda: `RetailMovement`. |
| **OC** | Orden de compra a proveedor. Farmacia: `PurchaseOrder`; Tienda: `RetailOrder`. `Borrador → Enviada → Recibida`. |
| **Bodega central / sala de ventas** | Las dos ubicaciones de stock de la tienda. Las compras entran a central; la venta descuenta de sala; la reposición transfiere central → sala. |
| **Boleta vs factura** | **Factura** (`Invoice`, módulo clínico): líneas a precio **neto** + IVA 19 % calculado. **Boleta** (`Sale`, tienda): precios **con IVA incluido**; el IVA se desglosa. Ninguna es aún un DTE del SII. |
| **Despacho (Shipment)** | Envío a domicilio de una venta de tienda. `Por preparar → Preparado → En ruta → Entregado`. |
| **Ticket / SLA** | Caso de soporte de la clínica a VetData. SLA = horas para la **primera respuesta** de VetData según prioridad (Crítica 4 h, Alta 24 h, Media 72 h, Baja 168 h). |
| **Idea / Mejora** | Propuesta de funcionalidad votada entre las clínicas de la red; las lanzadas aparecen en Novedades (`Release`). |
| **Evento de seguridad** | Incidente (puerta forzada, aforo excedido, botón de pánico, marcado manual…) con severidad y estado. |
| **Privacidad de boxes** | Si `privacyInBoxes` está activo y el box vigilado está `ocupado`, la cámara no muestra video; verla exige motivo y queda auditado. |
| **NVR** | Grabador de video en red; almacena las grabaciones (retención configurable 15/30/60/90 días). |
| **"Ver como"** | Selector de rol solo para la demo (`src/components/topbar.tsx`). **No** debe existir en producción. |

## 5. Mapa dominio → archivos del prototipo

| Dominio (doc) | Tipos | Contrato (servicio) | Store / reglas | Mock |
|---|---|---|---|---|
| [red-y-acceso](dominios/red-y-acceso.md) | `domain/sharing.ts`, `domain/network.ts`, `domain/settings.ts` (`SharingPolicy`) | `NetworkService`, `SharingService` | `lib/store.tsx` (`sendRequest`, `respondRequest`, `revokeGrant`, `useAccess`, `useCanView`) | `services/mock/sharing.ts`, `mock/clinic.ts:network` |
| [pacientes-y-propietarios](dominios/pacientes-y-propietarios.md) | `domain/patients.ts`, `domain/owners.ts` | `PatientsService`, `OwnersService` | `lib/lookups.ts`, `lib/analytics.ts` | `mock/clinic.ts:patients/owners` |
| [agenda-y-atencion](dominios/agenda-y-atencion.md) | `domain/appointments.ts`, `domain/clinic.ts`, `domain/security.ts` (`AccessEntry`, `WaitingEntry`), `domain/tasks.ts` | `AppointmentsService`, `ClinicService` (doctores, rooms), `SecurityService` (access/waiting/checkIn/call), `TasksService` | `lib/store.tsx`, `lib/security-store.tsx`, `lib/tasks.ts`, `lib/metrics/day.ts` | `mock/clinic.ts`, `mock/security.ts`, `mock/settings.ts:tasks` |
| [facturacion](dominios/facturacion.md) | `domain/invoices.ts`, `domain/services.ts` | `InvoicesService`, `ClinicService.listServices` | `lib/store.tsx:addInvoice` | `mock/clinic.ts:invoices` |
| [farmacia](dominios/farmacia.md) | `domain/medications.ts`, `domain/pharmacy.ts`, `domain/referrals.ts` | `PharmacyService`, `ReferralsService` | `lib/store.tsx` (farmacia), `lib/metrics/pharmacy.ts` | `mock/pharmacy.ts`, `mock/clinic.ts:referrals` |
| [tienda](dominios/tienda.md) | `domain/retail.ts` | `RetailService` | `lib/retail-store.tsx`, `lib/metrics/retail.ts` | `mock/retail.ts` |
| [seguridad](dominios/seguridad.md) | `domain/security.ts` | `SecurityService` (cámaras, dispositivos, eventos, auditoría, ajustes) | `lib/security-store.tsx` | `mock/security.ts` |
| [soporte](dominios/soporte.md) | `domain/support.ts` | `SupportService` | `lib/support-store.tsx`, `lib/metrics/support.ts` | `mock/support.ts` |
| [usuarios-y-permisos](dominios/usuarios-y-permisos.md) | `domain/settings.ts` | `SettingsService` | `lib/store.tsx` (ajustes, `useCan`), `components/settings/guard.tsx` | `mock/settings.ts`, `mocks/settings.ts` |
| [analitica](dominios/analitica.md) | `domain/metrics.ts` | `AnalyticsService` | `lib/analytics.ts`, `lib/metrics/*` | `mock/analytics.ts`, `mocks/metrics.ts` |

## 6. Resumen de decisiones transversales (detalle en `transversales.md`)

1. **Tenant obligatorio**: toda ruta opera en el contexto de la clínica de la sesión; nunca se acepta `clinicId` del cliente para escribir. Identificadores de clínica estables (no el nombre).
2. **Acceso de red en servidor**: `patients.list/get`, `owners.*` y cualquier dato clínico se filtran por `accessLevel` (propio / compartido vigente) y se **recortan por alcance** (`Resumen clínico`). Hoy `patients.list()` del mock devuelve **todas** las mascotas de la red.
3. **Autorización por permiso en servidor**: la UI solo deshabilita botones (`Guard`). Cada mutación valida el permiso del rol del usuario según la matriz **de su clínica**.
4. **El actor sale de la sesión**: `createdBy`, `requestedBy`, `user`, `seller`, `by`, `role` de auditoría los pone el servidor (`contracts.ts`, cabecera).
5. **Transiciones de estado validadas** (409 si no aplica). Hoy los PATCH genéricos (`appointments.update`, `security.updateEvent`, `support.changeStatus`, `settings.updateUser`, `clinic.updateRoom`) aceptan cualquier valor.
6. **Operaciones multi-dominio atómicas**: facturar (factura + kardex), dispensar, recibir OC, checkout (boleta + kardex + despacho), check-in (acceso + espera), pasar a box (box + espera), proponer idea (idea + ticket), aprobar solicitud (solicitud + grant).
7. **Montos y totales los calcula el servidor**: totales de factura, IVA, costo de despacho, costo unitario de OC, precios desde catálogo.
8. **Folios y correlativos por clínica** generados por el servidor (folio de factura, N° de boleta, N° de OC, N° de ticket).
9. **Fechas reales en `America/Santiago`**: reemplazar `TODAY`/`NOW_TIME` fijos; los vencimientos (grants, medicamentos, vacunas, SLA) se evalúan con la hora del servidor.
10. **Auditoría obligatoria** de video (en vivo en boxes, grabaciones, exportación, desactivar privacidad) **generada por el servidor** al entregar el recurso, no por un POST voluntario del cliente; y de los accesos de red a fichas compartidas.
11. **Datos de red agregados y anónimos**: las series "red" de analítica nunca exponen fichas ni dueños de otras clínicas.
12. **Stock no puede quedar negativo**: el prototipo lo "aplana" a 0 en silencio; el backend debe rechazar con 409.

## 7. Verificación de consistencia

Ejecutada al generar esta documentación (07-10-2026) con un script de comparación contra el código:

| Chequeo | Código | Documentación | Resultado |
|---|---|---|---|
| Operaciones de `src/services/contracts.ts` ↔ filas de `api.md` | 96 (15 servicios) | 96 filas, 96 únicas | ✔ sin faltantes ni sobrantes |
| Operaciones presentes en algún `dominios/*.md` | 96 | 96 | ✔ |
| Endpoints de `src/services/http/*` ↔ JSDoc de `contracts.ts` | 96 | — | ✔ idénticos (método y ruta) |
| Uniones `export type` en `src/domain` + `src/lib` ↔ `estados.md` | 50 (incl. `Permission`) | 50 nombres y todos sus valores | ✔ |
| Uniones inline en campos de `src/domain` | 9 | 9 | ✔ |
| `Permission` ↔ `permisos.md` | 21 | 21 | ✔ |
| Matriz por defecto (`src/mocks/settings.ts`) ↔ tabla §1 de `permisos.md` | Admin 21 · Veterinario 8 · Recepción 6 · Farmacia 8 | ídem | ✔ |
| Referencias `#p-NN` ↔ `preguntas-abiertas.md` | — | 26 definidas, todas referenciadas | ✔ |

Diferencias del prototipo (no de la documentación) que el dev debe conocer:
- `ficha.editar` no habilita ninguna operación (no hay escritura de ficha clínica).
- `ReferralStatus.Recibida`, `InvoiceStatus.Pagada`, `IdeaStatus` (salvo `En evaluación`), `ClinicStatus` y `AuditAction."Vio en vivo"` no tienen operación que los asigne.
- Varias mutaciones sin `Guard` en la UI: `clinic.updateRoom`, `tasks.assign`, `tasks.complete`, `support.rate`, `support.vote`, `security.createEvent/updateEvent/addEventNote` (ver `permisos.md#3-operaciones-sin-permiso-explícito`).

Para repetir la verificación cuando cambie el código: comparar los nombres de método de cada `interface *Service` de `contracts.ts` con la columna "Servicio.operación" de `api.md`, cada `export type X = "…" | …` de `src/domain` con `estados.md`, y `Permission` con `permisos.md`.
