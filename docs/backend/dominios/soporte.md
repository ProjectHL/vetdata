# Soporte (tickets a VetData, mejoras/ideas, novedades)

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-18: Staff VetData fuera del tenant y SLA en horas corridas. La simulación de respuesta del prototipo no es una operación de producción. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/support.ts` (`SLA_HOURS`, `TICKET_FLOW`, `OPEN_STATUSES`, `slaState`, `IDEA_FLOW`) · `src/services/contracts.ts` (`SupportService`) · `src/services/mock/support.ts` · `src/lib/support-store.tsx` · `src/lib/metrics/support.ts` · `src/components/support/*`

## Propósito
La clínica (cliente de VetData) reporta incidencias, hace consultas y propone mejoras del software. VetData responde con SLA de primera respuesta. Las ideas se votan entre las clínicas de la red y las lanzadas aparecen en Novedades.

Pantallas: `/soporte/tickets`, `/soporte/tickets/[id]`, `/soporte/mejoras`, `/soporte/novedades`; botones "Reportar" en cámaras/dispositivos.

**Dos lados**: la clínica (este frontend) y el equipo de VetData (backoffice **no existe** en el prototipo; se simula con `simulateSupportReply`).

## Entidades

### Ticket
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| number | int | sí | Correlativo **global de VetData** (semillas 1041…). |
| clinicId | id | sí | Tenant (implícito). |
| title | string | sí | |
| category | `TicketCategory` | sí | `Incidencia \| Mejora \| Consulta \| Integración / datos \| Facturación del servicio`. |
| priority | `TicketPriority` | sí | `Crítica \| Alta \| Media \| Baja`. Elegida por la clínica. |
| module | string | sí | "Canal › Módulo" (p. ej. "Farmacia › Movimientos"). |
| status | `TicketStatus` | sí | `Nuevo` al crear. |
| createdBy | userId | sí | Servidor (hoy nombre). |
| createdAt | datetime | sí | Servidor. |
| firstResponseAt | datetime | no | Primera respuesta de VetData (la fija el backoffice). |
| messages | `TicketMessage[]` | sí | `{ author, side: "Clínica"\|"VetData", body, at }`. El primero es el cuerpo del reporte. |
| context | `{ route, role }` | sí | Ruta desde donde se reportó y rol del usuario (servidor toma el rol de la sesión). |
| rating | 1–5 | no | Al calificar. |
| ideaId | id | no | Ticket "Mejora" vinculado a una idea. |

### Idea
`{ id, title, description, module, status: IdeaStatus, votes: int, votedByMe: bool, proposedBy: clinicId, releaseId? }`. Alcance **red**: todas las clínicas ven y votan. `votedByMe` es por **clínica** (un voto por clínica), calculado para la sesión.

### Release (novedades)
`{ id, version, date, items: { type: "Nuevo"|"Mejora"|"Corrección", text, ideaId? }[] }`. Global, de solo lectura.

## Reglas de negocio
1. **SLA de primera respuesta**: Crítica 4 h, Alta 24 h, Media 72 h, Baja 168 h. Fuente: `src/domain/support.ts:SLA_HOURS`. *(regla; valores supuestos del prototipo / contrato comercial)*.
2. **Estado SLA** (`slaState`): con `firstResponseAt` → `Cumplido` si `≤ límite` si no `Incumplido`; sin respuesta → `Vencido` si `horas restantes < 0`, `En riesgo` si `< 25 %` del límite, si no `En plazo`. Fuente: `src/domain/support.ts:slaState`. *(regla)* — calcular con hora del servidor (hoy `NOW_ISO` fijo). Horas corridas, no hábiles (→ `preguntas-abiertas.md#p-18`).
3. **Crear ticket**: `status = Nuevo`, primer mensaje = cuerpo, `context = { route, role de sesión }`. Fuente: `mock/support.ts:createTicket`. *(regla)*
4. **Responder (clínica)**: agrega mensaje lado `Clínica`; si estaba `Esperando cliente` pasa a `En progreso`. Fuente: `mock/support.ts:reply`, `support-store.tsx:replyTicket`. *(regla)*
5. **Cambiar estado (clínica)**: con `soporte.administrar` puede elegir cualquier estado de `TICKET_FLOW`; sin él, cualquiera excepto `Cerrado`. Requiere `soporte.crear`. Fuente: `src/components/support/ticket-detail.tsx` (`statusOptions`, Guard). *(regla de UI)* — **Hallazgo**: permite a la clínica poner estados que son del lado VetData (`En revisión`, `En progreso`, `Esperando cliente`) o devolver a `Nuevo`. El comentario dice "La clínica puede marcar resuelto o reabrir". Backend DEBE limitar (ver `estados.md#ticket`).
6. **Calificar**: solo cuando `Resuelto` y sin calificación; rating 1–5; cierra el ticket (`Cerrado`). Fuente: `ticket-detail.tsx`, `mock/support.ts:rate`. *(regla)* — mock acepta cualquier estado: backend 409.
7. **Visibilidad de tickets**: sin `soporte.administrar` solo los propios (`createdBy == usuario`); con él, todos los de la clínica. Fuente: `src/components/support/ticket-list.tsx` (`effectiveScope`). *(regla)* — DEBE filtrar el servidor (por `userId`, no nombre). `getTicket` de otro usuario sin permiso → 404.
8. **Votar idea**: alterna el voto de la clínica (`votes ± 1`). Fuente: `mock/support.ts:vote`, `support-store.tsx:voteIdea`. *(regla)* — sin Guard en la UI; único voto por clínica; no votar ideas `Lanzada` (recomendado).
9. **Proponer idea**: crea `Idea { status: En evaluación, votes: 1, votedByMe: true, proposedBy: mi clínica }` + ticket `Mejora` prioridad `Baja`, `route = "/soporte/mejoras"`, `ideaId`. Fuente: `mock/support.ts:proposeIdea`. *(regla)* — **atómico**.
10. **Respuesta de VetData simulada**: `simulateSupportReply` fija `firstResponseAt` (si no había), avanza `Nuevo → En revisión → En progreso` y agrega un mensaje `VetData`. Fuente: `support-store.tsx:simulateSupportReply` ("Solo demo… Sin operación de servicio"). *(supuesto del prototipo — no implementar en la API de clínica; pertenece al backoffice de VetData)*.
11. **KPIs**: abiertos, en riesgo (En riesgo + Vencido), críticos abiertos, promedio de horas a primera respuesta, CSAT (promedio de rating). Fuente: `src/lib/metrics/support.ts:supportKpis`. *(métrica)*

## Estados
- Ticket: `TICKET_FLOW` = `Nuevo → En revisión → En progreso → Esperando cliente → Resuelto → Cerrado`.
- Idea: `En evaluación → Planificada → En desarrollo → Lanzada` (solo VetData).
- SLA: derivado.
Ver [`../estados.md`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `support.listTickets` | `GET /api/v1/support/tickets` | `?scope=mine\|all&status&category&priority` | `Ticket[]` (+ `slaState` calculado recomendado) | sesión; `all` requiere `soporte.administrar` | 403 | — |
| `support.getTicket` | `GET /api/v1/support/tickets/:id` | — | `Ticket` | dueño del ticket o `soporte.administrar` | 404 | — |
| `support.createTicket` | `POST /api/v1/support/tickets` | `NewTicket` | `Ticket` | `soporte.crear` | 400 | Evento `TicketCreado` → cola de VetData; Crítica → alerta |
| `support.reply` | `POST /api/v1/support/tickets/:id/messages` | `{ body }` | `Ticket` | `soporte.crear` + acceso al ticket | 400, 404, 409 (Cerrado) | Notifica a VetData |
| `support.changeStatus` | `PATCH /api/v1/support/tickets/:id/status` | `{ status }` | `Ticket` | `soporte.crear`; `Cerrado` requiere `soporte.administrar` | 403, 409 (transición) | — |
| `support.rate` | `POST /api/v1/support/tickets/:id/rating` | `{ rating: 1..5 }` | `Ticket` (Cerrado) | `soporte.crear` (propuesto) + acceso | 400, 409 (no Resuelto / ya calificado) | — |
| `support.listIdeas` | `GET /api/v1/support/ideas` | `?status&module` | `Idea[]` | sesión | — | — |
| `support.vote` | `POST /api/v1/support/ideas/:id/vote` | — (recomendado `{ voted: bool }`) | `Idea` | sesión (propuesto `soporte.crear`) | 404, 409 (Lanzada) | — |
| `support.proposeIdea` | `POST /api/v1/support/ideas` | `{ title, description, module }` | `{ idea, ticket }` | `soporte.crear` | 400 | Atómico |
| `support.listReleases` | `GET /api/v1/support/releases` | — | `Release[]` | sesión | — | — |

## Efectos en otros dominios
- Pendientes: `ticket:*` cuando `Esperando cliente`.
- Mi día muestra KPIs de soporte.
- Seguridad: "Reportar" cámara/dispositivo crea ticket.

## Datos de referencia / semilla
Tickets, ideas y releases semilla (`src/mocks/support.ts`). Lista de módulos ("Canal › Módulo") derivada de la navegación.

## Notas para el dev
- Se necesita un **backoffice de VetData** (otra API/rol fuera del tenant) para responder tickets, fijar `firstResponseAt`, pasar a `En revisión/En progreso/Esperando cliente/Resuelto`, y gestionar ideas y releases. `#p-18`.
- Adjuntos (capturas) no existen.
