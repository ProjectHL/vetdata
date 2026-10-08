# Pacientes (mascotas) y propietarios

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-03: dueño global por RUT y vínculo por clínica; consultas de la clínica autora. p-22: escritura append-only con correcciones trazables y estado calculado en servidor. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/patients.ts` · `src/domain/owners.ts` · `src/services/contracts.ts` (`PatientsService`, `OwnersService`) · `src/services/mock/clinic.ts` (`patients`, `owners`) · `src/lib/lookups.ts` (`getPatient`, `petsOf`, `ownerLastVisit`, `getOwner`) · `src/lib/analytics.ts` · `src/components/sharing/access-gate.tsx` · `src/app/(dashboard)/pacientes/*`

## Propósito
Ficha de la mascota (identificación, alergias, condiciones, consultas, vacunas, exámenes, recetas) y del propietario (identificado por RUT). Pantallas: `/pacientes/mascotas`, `/pacientes/propietarios`, `/pacientes/propietarios/[rut]`, `/pacientes/historial`, `/pacientes/historial/[id]`, vista rápida del paciente (`components/care-actions/patient-quick-view.tsx`).

**Importante**: en el prototipo este dominio es de **solo lectura**. No hay operaciones para crear/editar mascotas, dueños, consultas, vacunas, exámenes ni recetas, aunque existe el permiso `ficha.editar` ("Registrar consultas, diagnósticos y tratamientos"). Ver `preguntas-abiertas.md#p-22`.

## Entidades

### Patient
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | id | sí | Hoy `"p-001"`. |
| name | string | sí | |
| species | `Species` | sí | `Perro \| Gato \| Ave \| Conejo`. |
| breed | string | sí | |
| sex | `"Macho" \| "Hembra"` | sí | |
| birthDate | date | sí | Edad derivada (`patientAge` → `lib/format.ts:ageFrom`). |
| color | string | sí | |
| sterilized | bool | sí | |
| weightKg | number | sí | Decimal (28.4). |
| chip | string | sí | N° de microchip (15 dígitos en semilla). Recomendado único en la red. |
| ownerRut | RUT | sí | FK a Owner. |
| clinic | clinicId | sí | **Clínica de origen** (dueña del dato). Hoy nombre. |
| status | `PatientStatus` | sí | `Al día \| Control \| Urgente`. Sin operación que lo cambie (ver estados). |
| allergies | string[] | sí | Visible en `Resumen clínico`. |
| conditions | string[] | sí | Condiciones crónicas. Visible en resumen. |
| consultations | `Consultation[]` | sí | Solo `Ficha completa`/propio + `ficha.ver`. |
| vaccines | `Vaccine[]` | sí | Visible en resumen. |
| exams | `Exam[]` | sí | Solo ficha completa + `ficha.ver`. |
| prescriptions | `Prescription[]` | sí | Solo ficha completa + `ficha.ver`. |

Sub-entidades (hoy embebidas; recomendado tablas propias con `clinicId` del autor):
- `Consultation { date, clinic, doctor, reason, diagnosis, treatment }` — `clinic` y `doctor` son nombres.
- `Vaccine { name, date, nextDose? }`.
- `Exam { date, name, result, clinic }`.
- `Prescription { date, drug, dose, duration, doctor }` — distinta de `Referral` (farmacia); no hay vínculo entre ambas (→ `preguntas-abiertas.md#p-13`).

### Owner
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| rut | RUT | sí | **Clave**. Normalizado `"16482335-0"`. Validar módulo 11 (no se valida hoy). |
| firstName, lastName | string | sí | `ownerName()` = nombre + apellidos. |
| email | email | sí | |
| phone | string | sí | Formato `+56 9 …`. |
| altPhone | string | no | |
| address, sector, region | string | sí | `sector` = comuna; determina costo de despacho en tienda. |
| birthDate | date | sí | |
| registeredAt | date | sí | |
| preferredContact | `"WhatsApp" \| "Teléfono" \| "Email"` | sí | Canal para recordatorios. |
| emergencyContact | `{ name, phone }` | sí | |
| shareConsent | bool | sí | Consentimiento registrado para compartir fichas en la red. |
| balance | int CLP | sí | Saldo pendiente (cobranza). Sin operación que lo modifique. |
| notes | string | no | |

Relaciones: Owner 1—N Patient (`ownerRut`). Patient N—1 Clinic (origen).

## Reglas de negocio
1. **Visibilidad por nivel de acceso** (`propio`/`compartido`/`ninguno`). Fuente: `src/domain/sharing.ts:accessLevel`, `src/lib/store.tsx:useCanView`, `src/lib/analytics.ts:visiblePatients`. *(regla)* — **Hallazgo**: `patients.list()` del mock devuelve **todas** las mascotas de la red (`mock/clinic.ts:patients.list`). El backend DEBE devolver solo `propio` + `compartido` vigentes, y aparte un endpoint de búsqueda de red con tarjeta mínima.
2. **Proyección por alcance**: `Resumen clínico` sin `consultations`, `exams`, `prescriptions`. Fuente: `access-gate.tsx:PatientSummary`, `owners/owner-records.tsx` (`summaryOnly`). *(regla)*
3. **Proyección por permiso**: sin `ficha.ver` no se muestran consultas, exámenes ni recetas, ni siquiera de pacientes propios. Fuente: `src/app/(dashboard)/pacientes/historial/[id]/page.tsx` (3× `RequirePermission permission="ficha.ver"`). *(regla)* → el servidor omite esos arreglos si el rol no tiene `ficha.ver`.
4. **Sin acceso** se muestra solo encabezado (nombre, especie, raza, clínica de origen) y botón "Solicitar acceso". Fuente: `access-gate.tsx:LockedRecord, PatientHeader`. *(regla)*
5. **Última visita** = fecha máxima de consultas; de un dueño = máximo entre sus mascotas. Fuente: `src/domain/patients.ts:lastVisit`, `src/lib/lookups.ts:ownerLastVisit` (TODO "campo calculado por el backend"). *(regla)* — el backend debería exponer `lastVisit` calculado respetando el acceso.
6. **Mascotas de un dueño**: `patients.listByOwner(rut)` filtra por `ownerRut`. Fuente: `mock/clinic.ts:patients.listByOwner`. *(regla)* — DEBE aplicar regla 1 (la búsqueda de red muestra mascotas ajenas solo como tarjeta mínima).
7. **Búsqueda por RUT** acepta con/sin puntos y con/sin DV. Fuente: `src/components/network/network-search.tsx`, `src/lib/format.ts:normalizeRut`. *(regla)*
8. **Estado de vacuna** `vencida` (nextDose < hoy) / `próxima` (≤ 30 días) / `vigente` (sin nextDose o > 30 días). Paciente "al día" = tiene ≥ 1 vacuna y ninguna vencida. Fuente: `src/lib/analytics.ts:vaccineState, isUpToDate`. *(regla)*
9. **Categoría de diagnóstico** por palabras clave sobre el texto libre del diagnóstico. Fuente: `src/lib/analytics.ts:diagnosisCategory` (`CATEGORY_KEYWORDS`). *(supuesto del prototipo: debería ser un código de diagnóstico estructurado)*.
10. **`PatientStatus`** (`Al día`/`Control`/`Urgente`) es un dato de semilla sin regla de cálculo ni operación. *(supuesto del prototipo)* → `preguntas-abiertas.md#p-22`.

## Estados
`PatientStatus` sin transiciones definidas; `VaccineState` derivado. Ver [`../estados.md`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `patients.list` | `GET /api/v1/patients` | filtros: especie, estado, dueño, origen (`propio`/`compartido`), texto | `Patient[]` proyectados por acceso/alcance/permiso, con `accessLevel` y `grant` (recomendado) | sesión | 401 | — |
| `patients.get` | `GET /api/v1/patients/:id` | — | `Patient` proyectado; si `ninguno` → tarjeta mínima o 403 | sesión (+ `ficha.ver` para secciones clínicas) | 403, 404 | Si `compartido`: registrar acceso de red (auditoría) |
| `patients.listByOwner` | `GET /api/v1/owners/:rut/patients` | RUT normalizado | `Patient[]` proyectados | sesión | 400 (RUT inválido), 404 | — |
| `owners.list` | `GET /api/v1/owners` | filtros: texto, sector | `Owner[]` con ≥ 1 mascota visible para mi clínica | sesión | 401 | — |
| `owners.get` | `GET /api/v1/owners/:rut` | RUT | `Owner` (completo si tiene mascota visible; mínimo si solo para pedir acceso) | sesión | 400, 404 | — |

## Efectos en otros dominios
- Mascotas visibles alimentan agenda, mapa de boxes, facturación, derivaciones, analítica local, tareas de vacunas.
- `Owner.sector` define costo de despacho en tienda (`retail.ts:deliveryFee`); `Owner.address/sector` se copian al `Shipment`.
- `Owner.balance` se suma a "por cobrar" (`lib/metrics/customers.ts:receivables`).
- `Owner.shareConsent` interviene en la aprobación de solicitudes de red.

## Datos de referencia / semilla
`Species`, catálogo de vacunas (nombres usados: Óctuple, Antirrábica, KC, Triple felina, etc. en `src/mocks/patients.ts`), sectores/comunas (`src/mocks/owners.ts:sectors`).

## Notas para el dev
- Faltan operaciones de alta/edición (mascota, dueño, consulta, vacuna, examen, receta, consentimiento, saldo). Antes de construirlas, decidir quién es dueño de los registros clínicos creados por una clínica receptora (`preguntas-abiertas.md#p-03`).
- `ownerRut` como FK expone el RUT en cada mascota: considerar id interno de dueño y RUT como atributo (privacidad).
