# Red y acceso (compartición de fichas)

> Fuentes: `src/domain/sharing.ts` · `src/domain/network.ts` · `src/domain/settings.ts` (`SharingPolicy`) · `src/services/contracts.ts` (`NetworkService`, `SharingService`) · `src/lib/store.tsx` (`sendRequest`, `respondRequest`, `revokeGrant`, `useAccess`, `useCanView`, `usePendingRequest`) · `src/services/mock/sharing.ts` · `src/components/sharing/*` · `src/components/network/network-search.tsx`

## Propósito
Permite que una clínica vea la ficha de una mascota cuya clínica de origen es otra, mediante solicitud → aprobación (con consentimiento del dueño) → acceso con alcance y vigencia → revocación. Es el núcleo diferenciador de VetData. Reglas generales en [`../transversales.md#2-red-y-compartición-de-fichas`](../transversales.md).

Pantallas: `/clinicas/red` (directorio de la red y búsqueda por RUT), `/clinicas/compartidos` (accesos recibidos y otorgados), `/clinicas/solicitudes` (recibidas / enviadas), ficha `/pacientes/historial/[id]` (bloqueo `AccessGate`), `/ajustes/permisos` (política de compartición), campana del topbar.

## Entidades

### Clinic (catálogo de la red)
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | uuid | sí | **No existe en el prototipo** (se usa `name` como clave). Agregar. |
| name | string | sí | Único en la red. |
| sector | string | sí | Comuna. Se usa en alertas de red y despachos. |
| address, phone, email | string | sí | Contacto público dentro de la red. |
| specialties | string[] | sí | |
| joinedAt | date | sí | |
| status | `ClinicStatus` | sí | `Conectada` \| `Invitación pendiente`. |
| lastSync | datetime | no | Hoy texto ("07 oct 2026 · 11:02" o "—"). |
| patients | int | sí | Pacientes registrados (dato referencial, agregado). |

### AccessRequest
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | uuid | sí | Generado por servidor. |
| patientId | id | sí | Mascota de **otra** clínica. |
| ownerRut | RUT | sí | Copiado de la mascota al crear (snapshot). |
| from | clinicId | sí | Clínica solicitante = clínica de la sesión. |
| to | clinicId | sí | Clínica de origen de la mascota (= `patient.clinic`). |
| requestedBy | userId | sí | De la sesión (hoy nombre). |
| date | date | sí | Hoy (servidor). |
| reason | string | sí | Motivo libre. Recomendado no vacío. |
| scope | `AccessScope` | sí | Solicitado. |
| duration | `AccessDuration` | sí | `30 \| 90 \| null`. |
| status | `RequestStatus` | sí | `Pendiente` al crear. |
| respondedAt | date | no | Al responder. |
| *(nuevo)* respondedBy | userId | no | Quién respondió. |
| *(nuevo)* consent | objeto | no | Declaración de consentimiento del dueño al aprobar (ver regla 7). |

Restricción: a lo más **una** solicitud `Pendiente` por (`patientId`, `from`).

### AccessGrant
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | uuid | sí | |
| patientId | id | sí | |
| ownerClinic | clinicId | sí | Clínica de origen (quien otorga). |
| grantedTo | clinicId | sí | Clínica receptora. |
| scope | `AccessScope` | sí | Alcance final (puede diferir del solicitado). |
| since | date | sí | Fecha de aprobación. |
| until | date \| null | sí | `null` = permanente. Último día vigente inclusive. |
| revoked | bool | sí | `false` al crear. |
| *(nuevo)* requestId | id | no | Solicitud que lo originó (trazabilidad). |
| *(nuevo)* revokedAt / revokedBy | datetime / userId | no | |

Relaciones: AccessRequest N—1 Patient; AccessGrant N—1 Patient; AccessGrant 0..1—1 AccessRequest.

### SharingPolicy (por clínica)
| Campo | Tipo | Descripción |
|---|---|---|
| defaultScope | `AccessScope` | Default del formulario de solicitud. Semilla `Resumen clínico`. |
| defaultDuration | `AccessDuration` | Default. Semilla `90`. |
| requireConsent | bool | Si al **aprobar** se exige consentimiento del dueño. Semilla `true`. |
| notifyRequests | bool | Si se notifican solicitudes recibidas (campana). Semilla `true`. |

Fuente semilla: `src/mocks/settings.ts:seedSharingPolicy`. Se edita en Ajustes → Permisos (operaciones en [usuarios-y-permisos](usuarios-y-permisos.md)).

## Reglas de negocio
1. **Nivel de acceso** `propio | compartido | ninguno`. Fuente: `src/domain/sharing.ts:accessLevel`. *(regla)* — aplicar en servidor a toda lectura.
2. **Estado del grant** `Revocado > Vencido (until < hoy) > Vigente`. Fuente: `src/domain/sharing.ts:grantStatus`. *(regla)*; estado derivado con fecha del servidor.
3. **Una solicitud por mascota**; se descartan mascotas propias y las que ya tienen solicitud `Pendiente` desde mi clínica. Fuente: `src/services/mock/sharing.ts:sendRequests`, `src/lib/store.tsx:sendRequest`. *(regla)*. Respuesta: lista de solicitudes efectivamente creadas (la UI informa cuántas). **Agregar**: descartar también mascotas con grant `Vigente` a mi clínica.
4. **Solo la clínica de origen responde** (`request.to == clínica de sesión`) y solo si `Pendiente`. Fuente: `mock/sharing.ts:respond` (`if (req.status !== "Pendiente") return ok({request})`). *(regla)* → backend: 403 si no es la clínica de origen, 409 si no está pendiente.
5. **Aprobar crea el grant** con `scope = terms?.scope ?? req.scope`, `duration = terms ? terms.duration : req.duration`, `since = hoy`, `until = duration ? hoy+duration : null`. Fuente: `mock/sharing.ts:respond`, `store.tsx:respondRequest`. *(regla)*
6. **Rechazar** solo cambia estado y `respondedAt`. *(regla)*
7. **Consentimiento**: si `policy(origen).requireConsent && !owner.shareConsent`, la aprobación requiere declaración explícita del usuario ("firma o SMS"). Fuente: `src/components/sharing/request-tabs.tsx:ApproveDialog` (`needsConsent`). *(regla; hoy no viaja al backend → agregar campo y validar, 422)*. La lista de solicitudes recibidas marca "Dueño sin consentimiento registrado" (`request-tabs.tsx`).
8. **Revocar**: solo `ownerClinic`, solo grants `Vigente`. Fuente: `src/components/sharing/shared-tabs.tsx` (`canRevoke && status === "Vigente"`), `mock/sharing.ts:revoke`. *(regla)* → backend: 403/409.
9. **Alcance "Resumen clínico"** expone solo identificación, alergias, condiciones y vacunas. Fuente: `src/components/sharing/access-gate.tsx:PatientSummary`. *(regla)* — proyección en servidor.
10. **Clínica de la sesión**: `network.getCurrentClinic` devuelve hoy un **string** (nombre). Fuente: `contracts.ts:NetworkService.getCurrentClinic`. *(supuesto del prototipo)* → devolver objeto `{ id, name, … }`.
11. **Defaults de solicitud** desde la política de **mi** clínica. Fuente: `src/components/sharing/request-access-dialog.tsx`. *(regla de UI)*
12. **Campana de solicitudes**: cuenta solicitudes recibidas `Pendiente` solo si `notifyRequests`. Fuente: `src/components/topbar.tsx`. *(regla)*
13. **Solicitudes recibidas sin responder desde ≥ 1 día** son prioridad Alta en Pendientes. Fuente: `src/lib/tasks.ts:useTasks` (`daysUntil(r.date) <= -1`). *(regla de UI)*

## Estados
- AccessRequest: `Pendiente → Aprobada | Rechazada` (terminales). Ejecuta: clínica de origen con `red.aprobar`.
- AccessGrant (derivado): `Vigente → Vencido` (tiempo) · `Vigente → Revocado` (clínica de origen con `red.revocar`).
- Clinic: `Invitación pendiente → Conectada` (sin operación en el prototipo).
Detalle en [`../estados.md`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `network.getCurrentClinic` | `GET /api/v1/me/clinic` | — | `string` (nombre) → recomendado `Clinic` | sesión | 401 | — |
| `network.listClinics` | `GET /api/v1/network/clinics` | filtros: sector, especialidad, estado | `Clinic[]` | sesión | 401 | — |
| `sharing.listRequests` | `GET /api/v1/sharing/requests` | `?direction=received\|sent&status=` | `AccessRequest[]` (solo donde mi clínica es `from` o `to`) | sesión (recibidas: `red.aprobar` recomendado para ver motivo/dueño) | 401 | — |
| `sharing.listGrants` | `GET /api/v1/sharing/grants` | `?direction=received\|granted&status=` | `AccessGrant[]` con `status` derivado (recomendado incluirlo) | sesión | 401 | — |
| `sharing.sendRequests` | `POST /api/v1/sharing/requests` | `{ patientIds[], scope, duration, reason }` | `AccessRequest[]` creadas | `red.solicitar` | 400, 403 | Evento `AccesoSolicitado` por solicitud → notifica a la clínica de origen |
| `sharing.respond` | `POST /api/v1/sharing/requests/:id/response` | `{ approve, terms?: {scope, duration}, consent?: {confirmed, method} }` | `{ request, grant? }` | `red.aprobar` + ser clínica de origen | 403, 404, 409 (no pendiente), 422 (falta consentimiento) | Atómico: solicitud + grant. Auditoría del consentimiento. Evento `AccesoAprobado`/`AccesoRechazado` |
| `sharing.revoke` | `POST /api/v1/sharing/grants/:id/revoke` | — | `AccessGrant` | `red.revocar` + ser clínica de origen | 403, 404, 409 (no vigente) | Evento `AccesoRevocado` → notifica a receptora; invalidar caché |

## Efectos en otros dominios
- Un grant vigente hace visible la mascota en: listas de mascotas/dueños, agenda (agendar a mascotas compartidas), mapa de boxes (`clinic-activity.tsx` filtra pacientes con `canView`), analítica local (`lib/analytics.ts:visiblePatients`), tareas de vacunas vencidas, derivaciones y facturación. El backend debe aplicar el mismo filtro en todos esos endpoints.
- Revocar o vencer un grant **no** borra citas/facturas existentes de la receptora sobre esa mascota → definir qué datos mínimos sigue viendo la receptora de sus propios documentos (`preguntas-abiertas.md#p-04`).

## Datos de referencia / semilla
- Catálogo de clínicas de la red (`src/mocks/network.ts:networkClinics`, 8 clínicas, 1 con invitación pendiente).
- `SCOPES`, `DURATIONS` (`src/domain/sharing.ts`).
- Política por defecto de cada clínica nueva (`seedSharingPolicy`).

## Notas para el dev
- El prototipo usa nombres de clínica como clave en todas las relaciones de red; migrar a ids.
- No existe: cancelar una solicitud enviada, expiración de solicitudes pendientes, renovar/extender un grant, ver quién de la receptora consultó la ficha. Ver `preguntas-abiertas.md` (#p-05, #p-07).
- Las mascotas tienen consultas registradas por **otras** clínicas (`Consultation.clinic`, p. ej. `p-001` tiene una consulta en VetCare Las Condes en `src/mocks/patients.ts`): el historial es de red. Quién es dueño de una consulta hecha por una clínica con acceso compartido → `preguntas-abiertas.md#p-03`.
