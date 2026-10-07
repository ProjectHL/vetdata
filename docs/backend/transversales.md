# Requerimientos transversales

Reglas que aplican a todos los dominios. Cada dominio las asume.

---

## 1. Multi-clínica (tenant)

1. **Toda clínica es un tenant.** Todo dato operativo (citas, rooms, facturas, inventarios, tienda, seguridad, usuarios, permisos, tickets, tareas) pertenece a exactamente una clínica y solo es visible para ella. *(regla)*
2. **La clínica activa sale de la sesión**, nunca de un parámetro del cliente. Fuente: `src/services/contracts.ts` (cabecera: "El usuario que ejecuta la acción… lo resuelve el backend desde la sesión") y `src/lib/lookups.ts:currentClinic` (TODO: "reemplazar por la clínica de la sesión autenticada"). *(regla)*
3. **Identificador estable de clínica.** El prototipo referencia clínicas por **nombre** (`Patient.clinic`, `Consultation.clinic`, `Exam.clinic`, `AccessRequest.from/to`, `AccessGrant.ownerClinic/grantedTo`, `Referral.destination`, `Idea.proposedBy`). El backend DEBE usar `clinicId` y exponer el nombre como dato de presentación. Fuente: `src/mocks/network.ts:clinics`. *(supuesto del prototipo → cambiar)*
4. **Datos de alcance red (no tenant)**: catálogo de clínicas (`Clinic`), mascotas y dueños (accesibles según la regla de acceso, ver §2), ideas y votos de mejoras (tablero común de la red), releases/novedades (globales de VetData), series agregadas anónimas de analítica. *(regla)*
5. **Dueños (Owner) se identifican por RUT** y hoy no tienen clínica asociada: un mismo dueño puede tener mascotas en varias clínicas (`src/components/network/network-search.tsx` agrupa mascotas del dueño por clínica). Cómo se modela la propiedad del dato del dueño (¿global con RUT? ¿por clínica?) es una decisión abierta → `preguntas-abiertas.md#p-03`.
6. **Errores de aislamiento**: acceder a un recurso de otra clínica devuelve `404` (no revelar existencia) salvo en los endpoints de red donde la UI necesita saber que existe (búsqueda por RUT/mascota para pedir acceso), donde se devuelve la **tarjeta mínima** (ver §2.6).

---

## 2. Red y compartición de fichas

Fuente principal: `src/domain/sharing.ts` (comentario de cabecera, `grantStatus`, `accessLevel`), `src/lib/store.tsx` (`sendRequest`, `respondRequest`, `revokeGrant`, `useAccess`, `useCanView`, `usePendingRequest`), `src/services/mock/sharing.ts`.

### 2.1 Las tres reglas del prototipo
1. Cada mascota tiene una **clínica de origen** (`patient.clinic`) dueña del dato.
2. Otra clínica solo ve la ficha si tiene un **acceso vigente**, que se obtiene solicitándolo a la clínica de origen (con consentimiento del dueño).
3. Todo acceso tiene **alcance y vigencia**, y el origen puede **revocarlo**.

### 2.2 Nivel de acceso (`accessLevel`)
```
si patient.clinicId == clínicaActual            → "propio"
si existe grant g con g.patientId == patient.id
   y g.grantedTo == clínicaActual
   y grantStatus(g) == "Vigente"                → "compartido" (con g.scope)
en otro caso                                    → "ninguno"
```
Fuente: `src/domain/sharing.ts:accessLevel`. El backend DEBE aplicar esta función en **cada** lectura de datos de mascota y de su historial (incluye listas, búsqueda, analítica local, tareas, mapa de boxes, agenda). *(regla)*

### 2.3 Estado del grant (`grantStatus`)
```
revoked == true                     → "Revocado"
until != null y until < hoy         → "Vencido"   (el día `until` aún es vigente)
en otro caso                        → "Vigente"
```
Fuente: `src/domain/sharing.ts:grantStatus`. Es un estado **derivado**: el backend lo calcula con la fecha del servidor en zona `America/Santiago` (ver §5); no se persiste "Vencido". *(regla)*

### 2.4 Alcance
| Alcance | Qué ve la clínica receptora | Fuente |
|---|---|---|
| `Ficha completa` | Todo lo que ve la clínica de origen (identificación, alergias, condiciones, consultas, vacunas, exámenes, recetas). | `src/components/sharing/access-gate.tsx:AccessGate` |
| `Resumen clínico` | Identificación (nombre, especie, raza, clínica de origen), **alergias, condiciones crónicas y vacunas**. Sin consultas, exámenes ni recetas. | `access-gate.tsx:PatientSummary`, `request-access-dialog.tsx` (texto "alergias, condiciones crónicas y vacunas"), `owners/owner-records.tsx` (excluye consultas en resumen) |

**DEBE**: el recorte por alcance ocurre en el servidor (proyección del recurso), no en la UI. Hoy `patients.get` devuelve el `Patient` completo y la UI oculta. *(regla)*

### 2.5 Vigencia
- Valores: `30 | 90 | null` (permanente). Fuente: `src/domain/sharing.ts:AccessDuration, DURATIONS`.
- Al aprobar: `since = hoy`, `until = duration ? hoy + duration días : null`. Fuente: `src/services/mock/sharing.ts:respond`, `src/lib/store.tsx:respondRequest`. *(regla)*
- La clínica de origen puede **ajustar alcance y vigencia** al aprobar (`RespondAccessRequestInput.terms`). Si no envía `terms`, se usan los solicitados. *(regla)*
- Renovación: no existe operación; se hace con una nueva solicitud (semilla `q03` "Renovación de acceso", `src/mocks/sharing.ts`). → `preguntas-abiertas.md#p-05`.

### 2.6 Solicitud de acceso
- Una solicitud **por mascota**; se ignoran mascotas propias y las que ya tienen una solicitud `Pendiente` de mi clínica. Fuente: `mock/sharing.ts:sendRequests`, `store.tsx:sendRequest`. *(regla)*
- **DEBE** además: ignorar (o rechazar con 409) mascotas sobre las que ya existe un grant vigente; la UI solo ofrece pedir si `level == "ninguno"` (`access-gate.tsx:LockedRecord`).
- Para poder pedir, la UI muestra una **tarjeta mínima** de mascotas ajenas (nombre, especie, raza, clínica de origen) buscando por RUT del dueño (`network/network-search.tsx`) y el dueño (nombre, RUT, sector). Definir exactamente qué campos son visibles sin acceso → `preguntas-abiertas.md#p-04`.
- Valores por defecto del formulario: `SharingPolicy.defaultScope` y `defaultDuration` de **mi** clínica (`request-access-dialog.tsx`). Son solo defaults de UI.

### 2.7 Aprobación, consentimiento y política de la clínica
- Solo la **clínica de origen** (`request.to`) responde, con permiso `red.aprobar`. Solo solicitudes `Pendiente` (mock: si no está pendiente devuelve la solicitud sin cambios; backend: **409**). *(regla)*
- Consentimiento: `needsConsent = sharingPolicy.requireConsent && !owner.shareConsent` (política **de la clínica de origen**). Si `needsConsent`, la UI exige marcar "Confirmo que el dueño autorizó compartir estos datos (firma o SMS)". Fuente: `src/components/sharing/request-tabs.tsx:ApproveDialog`. *(regla)*
- **Hallazgo**: esa confirmación **no viaja al backend** (`RespondAccessRequestInput` no tiene campo de consentimiento). **DEBE**: agregar `ownerConsent: { confirmed: boolean, method?: "firma" | "SMS" | ..., evidence? }` y rechazar (`422`) si se requiere y no viene; registrar quién lo confirmó y cuándo (auditoría). Ver `preguntas-abiertas.md#p-06`.
- Rechazar no requiere consentimiento.

### 2.8 Revocación
- Solo la clínica de origen (`grant.ownerClinic`), permiso `red.revocar`, y solo grants `Vigente` (la UI muestra el botón solo si `status === "Vigente"`, `src/components/sharing/shared-tabs.tsx`). *(regla)*
- Efecto inmediato: desde la revocación la receptora pasa a `ninguno`. Irreversible. *(regla)*
- **DEBE**: invalidar cachés/sesiones de la receptora y notificarle (ver `eventos.md`).

### 2.9 Auditoría de accesos de red
El prototipo no registra quién de la clínica receptora abrió una ficha compartida. **DEBE** registrarse cada lectura de ficha con `level = compartido` (usuario, clínica, mascota, alcance, fecha-hora) y ponerse a disposición de la clínica de origen. → `preguntas-abiertas.md#p-07`.

---

## 3. Autenticación, sesión, usuario actual y rol

- Login simulado: `src/app/login/page.tsx` solo hace `router.push("/dashboard")` (correo + contraseña sin validar). → `preguntas-abiertas.md#p-01`.
- `settings.getCurrentUser` (`GET /api/v1/me`) devuelve el `User` de la sesión, con su `role`. `network.getCurrentClinic` (`GET /api/v1/me/clinic`) devuelve la clínica. **Recomendación**: un solo `GET /me` que devuelva `{ user, clinic, permissions[] }` para evitar que la UI calcule permisos.
- Cliente HTTP: `credentials: "include"` y TODO "agregar el token de sesión (Authorization) y la clínica activa… (cookie httpOnly o header)". Fuente: `src/services/http/client.ts:apiFetch`.
- Solo usuarios `Activo` pueden iniciar sesión (`Invitado` debe aceptar invitación; `Inactivo` bloqueado). *(regla inferida de `UserStatus`)*
- **"Ver como" es solo demo**: `src/lib/store.tsx` mantiene `role` en estado local (`setRole`) y `currentUser = users.find(u => u.id === demoUserByRole[role])`. El mock del servidor ignora ese selector y usa siempre al veterinario demo (`src/services/mock/db.ts:actor`). En producción el rol **solo** viene de la sesión y no hay endpoint para cambiarlo. *(supuesto del prototipo)*
- `User.lastAccess` es texto ("07 oct 2026 · 11:04"); el backend debe persistir un timestamp y actualizarlo al autenticar.

---

## 4. Autorización en servidor

- Matriz `RolePermissions = Record<Role, Permission[]>` **configurable por clínica** (`src/domain/settings.ts`). Catálogo de 21 permisos fijo en el producto (`PERMISSIONS`).
- La UI usa `useCan()` (`src/lib/store.tsx`) y los componentes `Guard` / `RequirePermission` (`src/components/settings/guard.tsx`) que **solo deshabilitan u ocultan**. **DEBE**: cada endpoint valida `permiso ∈ rolePermissions[clínica][user.role]`; si no → `403`. Detalle por operación en `permisos.md`.
- Hay autorizaciones que **no son un permiso** sino reglas de pertenencia: solo la clínica de origen aprueba/revoca; solo la clínica dueña del ticket responde; un admin no se cambia su propio rol ni se desactiva (`users-table.tsx`: oculta acciones si `u.id === currentUser.id`). *(regla)*
- **Riesgo de auto-bloqueo**: `togglePermission` permite quitar `usuarios.administrar` al rol Admin. **DEBE** impedir que la clínica quede sin ningún usuario activo con `usuarios.administrar` (409). → `preguntas-abiertas.md#p-10`.
- Lecturas: el contrato no asigna permisos a los `list/get`. Se proponen en `permisos.md` (p. ej. `invoices.list` y series de ingresos con `reportes.financiero`; auditoría con `seguridad.administrar`; cámaras con `seguridad.ver`).

---

## 5. Fechas, horas y zona horaria

- El prototipo usa una fecha/hora **fija**: `TODAY = "2026-10-07"`, `NOW_TIME = "11:05"`, `NOW_ISO = "2026-10-07T11:05"` (`src/lib/format.ts`). Todo cálculo de "hoy" (vencimientos, SLA, llegadas, citas pasadas, agenda libre) depende de ellos. *(supuesto del prototipo)*
- **DEBE**: el servidor usa la hora real en `America/Santiago` (incluye cambio horario verano/invierno) para: fecha de creación de movimientos, OCs, facturas, boletas, solicitudes, grants (`since/until`), eventos, auditoría, tickets y mensajes; estado de grants, `expiryStatus`, `vaccineState`, `slaState`.
- Formatos actuales: fechas `YYYY-MM-DD` (date-only), horas `HH:mm` (time-only, sin fecha: `Room.since`, `WaitingEntry.arrivedAt`, `AccessEntry.time`, `Sale.time`, `Camera.lastMotion`, `Device.lastSeen`), y fecha-hora local **sin zona** `YYYY-MM-DDTHH:mm` (`Ticket.createdAt`, `SecurityEvent.at`, `AuditEntry.at`). `hoursBetween` los interpreta como UTC (`src/lib/format.ts:hoursBetween`). **Recomendación**: la API emite ISO 8601 con offset (`2026-10-07T11:05:00-03:00`) en todo instante, y `date` sin hora solo para fechas civiles (nacimiento, vencimiento de lote, fecha de cita). Las horas sueltas deben pasar a instantes completos.
- Citas: bloques de 30 min de 09:00 a 18:30 (20 bloques) — `src/domain/appointments.ts:SLOTS`. *(supuesto del prototipo: horario debería venir del perfil de la clínica; `ClinicProfile.hours` es texto libre "Lun a Sáb 09:00–20:00 · Urgencias 24 h" y no coincide con `SLOTS`)*. → `preguntas-abiertas.md#p-15`.
- `daysUntil` redondea diferencias de días con `Date.parse` (UTC). Usar aritmética de fechas civiles en el servidor.

---

## 6. RUT

- Formato persistido: **normalizado sin puntos con guion y DV**: `"16482335-0"` (`src/domain/owners.ts:Owner.rut`). Presentación con puntos: `formatRut` (`src/lib/format.ts`).
- `normalizeRut(input)` solo quita puntos/espacios y pasa a mayúsculas (`src/lib/format.ts:normalizeRut`). La búsqueda de red acepta también el cuerpo sin DV (`network-search.tsx`: `o.rut.split("-")[0] === r`).
- **Hallazgo**: el prototipo **no valida** el dígito verificador. **DEBE**: validar módulo 11 en toda entrada de RUT (dueños, `checkout.ownerRut`, proveedores, perfil de clínica):
  1. Normalizar: quitar puntos/espacios, mayúsculas, separar cuerpo y DV (aceptar con o sin guion).
  2. Cuerpo numérico de 7–8 dígitos.
  3. Multiplicar los dígitos del cuerpo de derecha a izquierda por la serie 2,3,4,5,6,7 (cíclica) y sumar.
  4. `dv = 11 − (suma mod 11)`; 11 → `0`, 10 → `K`.
  5. Rechazar (`400`) si no coincide.
- Unicidad: RUT único por dueño (clave de `owners.get`, `GET /owners/:rut`). En rutas, usar la forma normalizada. Proveedores (`Supplier.rut`, `RetailSupplier.rut`) y `ClinicProfile.rut` hoy se guardan **con puntos** ("76.543.210-3") — normalizar.
- El RUT es dato personal: ver §11 y `preguntas-abiertas.md#p-14`.

---

## 7. Montos: CLP e IVA 19 %

- Montos en **CLP enteros** (sin decimales). Formato: `formatCLP` (`src/lib/format.ts`). *(regla)*
- IVA 19 %: `IVA_RATE = 0.19` (`src/domain/services.ts`) y `IVA = 0.19` (`src/domain/retail.ts`) — dos constantes duplicadas; unificar en el servidor como parámetro. *(supuesto del prototipo: tasa vigente en Chile)*
- **Factura (clínica)** — precios **netos**: `net = Σ qty·unitPrice`, `iva = round(net·0.19)`, `total = net + iva`. Fuente: `src/domain/invoices.ts:invoiceTotals`. Los precios de prestaciones son netos (`Service.price`, "precio neto en CLP"). *(regla)*
  - **Ambigüedad**: la factura también admite medicamentos con `unitPrice = Medication.price` ("Precio de venta unitario en CLP", `src/domain/medications.ts`), sin indicar si es neto o bruto. Hoy se trata como **neto** (se le suma IVA). → `preguntas-abiertas.md#p-17`.
- **Boleta (tienda)** — precios **con IVA incluido**: `Product.price` "Precio de venta con IVA"; `total = Σ qty·unitPrice + deliveryFee`; IVA desglosado `ivaIncluded(gross) = round(gross − gross/1.19)`. Fuente: `src/domain/retail.ts:ivaIncluded`, `mock/retail.ts:checkout`. `Product.cost` es **neto**. Margen: `round(((price/1.19 − cost)/(price/1.19))·100)` (`retail.ts:margin`). *(regla)*
- **DEBE**: el servidor **recalcula** todos los totales; nunca confía en `net/iva/total` ni `unitPrice` enviados por el cliente (hoy `NewInvoice` y `SaleItem` los traen del navegador). Precios desde catálogo; descuentos no existen (→ `preguntas-abiertas.md#p-16`).
- Redondeo: IVA de factura se redondea sobre el neto total (no por línea).

---

## 8. Atomicidad de operaciones multi-dominio

Cada fila es **una** transacción: o se aplica todo o nada. Hoy los stores aplican cambios locales separados y el mock los hace en secuencia sin rollback.

| Operación | Efectos que deben ser atómicos | Fuente |
|---|---|---|
| `invoices.create` | asignar folio + crear factura + 1 `StockMovement` `Salida/Venta` por línea con `medicationId` + descontar stock (409 si insuficiente) | `mock/clinic.ts:invoices.create`, `store.tsx:addInvoice` |
| `referrals.dispense` | 1 `StockMovement` `Salida/Dispensación` por ítem + descontar stock + `Referral.status = Dispensada` | `mock/clinic.ts:referrals.dispense`, `store.tsx:dispenseReferral` |
| `pharmacy.receivePurchaseOrder` | 1 `StockMovement` `Entrada/Compra` por ítem + sumar stock + `status = Recibida`, `receivedAt` | `mock/pharmacy.ts`, `store.tsx:receivePurchaseOrder` |
| `pharmacy.adjustStock` | movimiento `Ajuste` + stock | `mock/pharmacy.ts:recordMovements` |
| `retail.checkout` | N° de boleta + `Sale` + `RetailMovement` `Salida/Venta` en **sala** por ítem + descontar stock sala + (si despacho) `Shipment` | `mock/retail.ts:checkout`, `retail-store.tsx:checkout` |
| `retail.transferToSala` | movimiento `Transferencia` + `central −= qty`, `sala += qty` (409 si central insuficiente) | `mock/retail.ts:record` |
| `retail.receiveOrder` | movimientos `Entrada/Compra` a **central** + `status = Recibida` | `mock/retail.ts:receiveOrder` |
| `sharing.respond` (aprobar) | `request.status = Aprobada`, `respondedAt` + crear `AccessGrant` | `mock/sharing.ts:respond` |
| `security.checkIn` | `AccessEntry` (Ingreso, Cliente) + `WaitingEntry` | `mock/security.ts:checkIn` |
| `security.callFromWaiting` | `Room` → `ocupado` con doctor/paciente de la cita + quitar `WaitingEntry` | `mock/security.ts:callFromWaiting`; el store solo actualiza el mapa local con `sync:false` (`security-store.tsx`) |
| `support.proposeIdea` | `Idea` (votes = 1, votedByMe) + `Ticket` categoría `Mejora` prioridad `Baja` vinculado (`ideaId`) | `mock/support.ts:proposeIdea` |
| "Finalizar atención" (UI, 2 llamadas) | `appointments.update(status: Realizada)` + `clinic.updateRoom(limpieza)` — hoy son **dos** requests independientes desde `components/dashboard/my-day/vet.tsx`. Recomendación: operación compuesta `POST /rooms/:id/finish` o hacer que una arrastre a la otra. | — |

Correlativos (folio, N° de boleta, N° de OC, N° de ticket) se asignan dentro de la transacción, únicos por clínica (por VetData en tickets), sin huecos si la normativa lo exige (folios SII → `preguntas-abiertas.md#p-12`). Mock: `src/services/mock/db.ts:nextNumber` = max + 1.

---

## 9. Ids del servidor vs ids optimistas

- Los stores crean ids locales `"<prefijo>-new-<n>"` (p. ej. `a-new-3`) y números provisorios (`Math.max(...)+1`) y luego llaman al servicio en segundo plano sin esperar (`src/services/index.ts:runInBackground`). El mock devuelve ids `"<prefijo>-srv-<n>"` (`mock/db.ts:mockId`). **Nadie reconcilia** (TODO en `runInBackground`). *(supuesto del prototipo)*
- **DEBE**: el servidor genera todos los `id` (UUID recomendado) y correlativos, y devuelve el recurso canónico en cada mutación; la UI reemplaza el optimista. Para que la reconciliación sea posible y los reintentos seguros, aceptar un **`Idempotency-Key`** (o `clientRef`) en todos los `POST` de creación (citas, facturas, derivaciones, solicitudes, ventas, OCs, tickets, eventos, notas).
- Errores: el servidor debe devolver errores explícitos (`400/403/404/409/422`) para que la UI revierta; hoy el mock "no-op" ante transiciones inválidas (devuelve el recurso sin cambios), lo que la UI no puede distinguir de un éxito.
- Excepción: `TaskMeta` se indexa por un id **derivado** `"<fuente>:<id>"` (`llegada:a-1`, `vacuna:p-001`, `factura:f-1`, `solicitud:q01`, `receta:r-1`, `stockmed:m-1`, `ocfar:oc-1`, `despacho:sh-1`, `sala:pr-1`, `octda:ro-1`, `evento:ev-1`, `ticket:tk-1`). Fuente: `src/lib/tasks.ts:useTasks`. Contiene `:` → codificar en la URL. Ver `dominios/agenda-y-atencion.md`.

---

## 10. Auditoría

| Qué | Hoy | Backend DEBE | Fuente |
|---|---|---|---|
| Ver cámara de box/quirófano en vivo | Bloqueado si privacidad; si se fuerza con motivo, la UI hace `logAudit("Desactivó privacidad", motivo)`. `"Vio en vivo"` existe en el enum pero **nunca se registra**. | Registrar `Vio en vivo` en todo acceso a stream de zona `boxes` (y opcionalmente otras), y `Desactivó privacidad` con motivo **obligatorio** (422 sin motivo) cuando el box está ocupado y la privacidad activa. | `domain/security.ts` (regla 2), `components/security/camera-dialog.tsx` |
| Abrir grabación | `logAudit("Abrió grabación", "Revisión de las HH:mm")` desde el cliente | El servidor registra al **entregar** el segmento (no depender del POST del cliente); permiso `seguridad.grabaciones`. | `camera-dialog.tsx` |
| Exportar clip | `logAudit("Exportó clip", …)` | Ídem; además guardar rango, cámara, hash del archivo exportado. | `camera-dialog.tsx`, `security/events.tsx` |
| Accesos de red a fichas compartidas | No existe | Registrar lecturas con nivel `compartido` (ver §2.9). | — |
| Aprobación con consentimiento declarado | No existe | Registrar quién declaró el consentimiento y el medio. | `request-tabs.tsx` |
| Cambios de permisos, roles, estado de usuarios, política de compartición, ajustes de seguridad, alarma, cerraduras | No existe | Registro de auditoría administrativa (quién, qué, antes/después). | `mock/settings.ts`, `mock/security.ts` |
| Movimientos de inventario | `user` = nombre del actor | Guardar `userId` (no nombre) y `ref` al documento origen (folio, OC, derivación) como relación, no texto. | `domain/pharmacy.ts:StockMovement`, `domain/retail.ts:RetailMovement` |

- `AuditEntry` es **append-only**: sin update ni delete. `user` y `role` los pone el servidor (`mock/security.ts:logAudit`). El listado de auditoría solo con `seguridad.administrar` (`components/security/devices.tsx` `RequirePermission`).
- Retención de auditoría independiente de la retención de video (`SecuritySettings.retentionDays`). → `preguntas-abiertas.md#p-19`.

---

## 11. Datos personales y privacidad

- Datos personales en juego: dueños (RUT, nombre, email, teléfonos, dirección, fecha de nacimiento, contacto de emergencia, saldo), usuarios (email), video con personas, accesos al hall con nombre.
- El consentimiento de compartir (`Owner.shareConsent`) es un dato con valor legal: necesita fecha, medio y evidencia, y debe poder revocarse. → `preguntas-abiertas.md#p-06`.
- Las series de red son agregados anónimos (`src/domain/metrics.ts`, cabecera). **DEBE**: aplicar umbral mínimo de conteo (k-anonimato) antes de publicar agregados por sector/categoría. → `preguntas-abiertas.md#p-21`.
- Retención y borrado de datos personales → `preguntas-abiertas.md#p-14`.

---

## 12. Archivos, video y clips

- No hay video real: cada cámara dibuja una escena ilustrada (`Camera.scene`, `src/domain/security.ts` comentario "no hay video real en el prototipo"). Las grabaciones se simulan por hora y el clip exportado no genera archivo.
- **DEBE (cuando exista)**: el backend actúa como **proxy autenticado** hacia el NVR/VMS: emite URLs firmadas de corta duración para stream en vivo y segmentos grabados, aplica permisos (`seguridad.ver`, `seguridad.boxes`, `seguridad.grabaciones`), la regla de privacidad y la auditoría **antes** de firmar la URL. Retención según `retentionDays`. → `preguntas-abiertas.md#p-09`.
- No hay otros adjuntos (exámenes, imágenes, PDFs de factura). → `preguntas-abiertas.md#p-20`.
- Exportaciones CSV se generan en el navegador (`src/lib/csv.ts:downloadCsv`, separador `;`, BOM UTF-8); no requieren backend salvo que se quiera auditar exportaciones de datos personales.

---

## 13. Notificaciones

- Hoy no hay envío real de nada. Indicadores en UI: campana con solicitudes recibidas pendientes si `SharingPolicy.notifyRequests` (`src/components/topbar.tsx`), contadores del menú (`src/lib/tasks.ts:useNavBadges`), bandeja de Pendientes.
- `tasks.sendReminder(patientId)` solo marca al paciente como "recordatorio enviado" (`mock/settings.ts:tasks.sendReminder`); no envía WhatsApp/email. El canal preferido está en `Owner.preferredContact` (`WhatsApp | Teléfono | Email`).
- **DEBE**: los eventos de `eventos.md` alimentan (a) un centro de notificaciones in-app por clínica/usuario/rol y (b) envíos externos (email/WhatsApp) para dueños y usuarios, con plantillas y registro de entrega. Canales externos → `preguntas-abiertas.md#p-08`.

---

## 14. Convenciones de API

- REST JSON, prefijo `/api/v1`, recursos en inglés (como ya están en `contracts.ts`), documentación en español.
- Errores: `400` validación, `401` sin sesión, `403` sin permiso o sin acceso de red, `404` no existe / de otra clínica, `409` conflicto de estado (transición inválida, horario ocupado, stock insuficiente, solicitud ya respondida), `422` regla de negocio (falta consentimiento, falta motivo de auditoría).
- Listas con paginación y los filtros que la UI ya usa: fecha/rango, estado, clínica, especie, RUT, profesional, categoría, prioridad, ubicación. Hoy todas las `list*` devuelven todo.
- `PATCH` genéricos (`appointments.update`, `clinic.updateRoom`, `security.updateEvent`, `settings.updateUser`, `security.updateSettings`) deben validar **qué campos** puede tocar el cliente (lista blanca) además de la transición.
- Operaciones "toggle" (`support.vote`, `security.toggleLock`, `settings.togglePermission`) no son idempotentes; se recomienda enviar el estado deseado (`PUT … { voted: true }`, `{ locked: true }`, `{ granted: true }`). Se mantienen en `api.md` con la ruta del contrato y la recomendación.
