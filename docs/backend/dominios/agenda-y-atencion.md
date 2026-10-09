# Agenda y atención (citas, boxes, sala de espera, llegadas, tareas y recordatorios)

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-05/p-06/p-10 sustituyen las tareas de aprobación por clínica por seguimiento de solicitudes al dueño; p-15 exige horarios reales y configurables. La bandeja se calcula en servidor (p-23). Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/appointments.ts` · `src/domain/clinic.ts` · `src/domain/security.ts` (`AccessEntry`, `WaitingEntry`, `WAITING_CAPACITY`) · `src/domain/tasks.ts` · `src/services/contracts.ts` (`AppointmentsService`, `ClinicService` [doctores, rooms], `SecurityService` [access, waiting, checkIn, callFromWaiting], `TasksService`) · `src/lib/store.tsx` · `src/lib/security-store.tsx` · `src/lib/tasks.ts` · `src/lib/metrics/day.ts` · `src/components/agenda/agenda.tsx` · `src/components/activity/clinic-activity.tsx` · `src/components/dashboard/my-day/*`

## Propósito
Flujo del día de la clínica: agendar → confirmar → registrar llegada (hall + sala de espera) → pasar a box → finalizar atención (box a limpieza, cita realizada) → box disponible. Más la bandeja "Pendientes" (tareas derivadas de todos los módulos) y los recordatorios de vacunas a dueños.

Pantallas: `/inicio/agenda`, `/inicio/actividad` (mapa de boxes), `/inicio/pendientes`, `/dashboard` (Mi día por rol), `/seguridad/hall`, `/seguridad/sala-espera`, `/analisis/vacunacion` (recordatorios).

> Nota: llegadas y sala de espera se exponen en `SecurityService` (rutas `/security/access`, `/security/waiting`) porque la UI las muestra también en Seguridad; funcionalmente pertenecen a este dominio.

## Entidades

### Doctor (profesional)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | id | sí | `"d1"`. |
| name, specialty, initials | string | sí | |

Relación: `User.doctorId` (opcional) vincula un usuario con su profesional. **Profesionales disponibles** = usuarios `Activo`, rol `Veterinario`, con `doctorId`. Fuente: `src/lib/store.tsx:useDoctors`. *(regla)*

### Appointment (cita)
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | uuid | sí | Servidor. |
| clinicId | id | sí | Tenant (implícito). |
| patientId | id | sí | Mascota con acceso `propio` o `compartido`. |
| date | date | sí | |
| time | `HH:mm` | sí | Uno de `SLOTS` (09:00…18:30, cada 30 min). |
| doctorId | id | sí | Profesional activo. |
| roomId | id | no | Box sugerido. |
| reason | string | sí | Default "Consulta". |
| status | `AppointmentStatus` | sí | `Agendada` al crear. |

Unicidad: (`doctorId`, `date`, `time`) entre citas **no canceladas**. Fuente: `components/agenda/agenda.tsx` y `care-actions/schedule-form.tsx` (`taken` excluye `Cancelada`). *(regla — hoy solo UI)*.

### Room (box / sala del mapa)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | id | sí | `"box-1"`, `"quirofano"`… |
| name | string | sí | |
| kind | `RoomKind` | sí | `box \| quirofano \| imagen \| laboratorio \| hospitalizacion \| comun`. |
| span | 1 \| 2 | sí | Ancho en la grilla del plano (presentación). |
| status | `RoomStatus` | sí | `disponible \| ocupado \| limpieza`. |
| doctorId, patientId | id | no | Solo si `ocupado`. |
| since | `HH:mm` | no | Inicio del estado actual → recomendado datetime. |
| note | string | no | Texto libre ("4 de 8 jaulas ocupadas"). |

### AccessEntry (registro de hall)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| time | `HH:mm` | sí | → datetime. |
| direction | `"Ingreso" \| "Salida"` | sí | |
| kind | `AccessKind` | sí | `Cliente \| Proveedor \| Courier \| Personal`. |
| who | string | sí | Nombre de la persona. |
| detail | string | sí | p. ej. "Luna · control anual". |
| ownerRut, patientId, appointmentId | id | no | Para clientes con cita. |
| href | string | no | Link de UI (no persistir). |

### WaitingEntry (sala de espera)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| appointmentId | id | sí | Única por cita. |
| arrivedAt | `HH:mm` | sí | → datetime. |
| people | int | sí | Personas que acompañan (aforo). Check-in fija `1`. |
| alert | string | no | Alerta visible (p. ej. "agresivo", "alergia"). |

### TaskMeta (estado manual de una tarea derivada)
| Campo | Tipo | Descripción |
|---|---|---|
| taskId | string | `"<fuente>:<id>"` (ver lista abajo). Clave. |
| assignee | string \| undefined | Hoy **nombre** de usuario → usar `userId`. |
| done | bool | Marcado como hecho. |

### Recordatorio enviado
`listReminders()` devuelve `patientId[]` con recordatorio de vacuna enviado. Recomendado entidad `Reminder { id, patientId, ownerRut, channel, sentAt, sentBy, vaccines[], status }`.

## Reglas de negocio
1. **Bloques de agenda**: 20 bloques de 30 min de 09:00 a 18:30. Fuente: `src/domain/appointments.ts:SLOTS`. *(supuesto del prototipo: debería derivarse del horario de la clínica)*.
2. **No doble reserva** del profesional en el mismo bloque (excluye `Cancelada`). Fuente: `agenda.tsx` / `schedule-form.tsx:taken`. *(regla)* → 409 en `create` y en `update` al reprogramar.
3. **Nueva cita siempre `Agendada`**. Fuente: `agenda.tsx`, `schedule-form.tsx` (`status: "Agendada"`). *(regla)* — `NewAppointment` permite enviar cualquier `status`: el servidor DEBE ignorarlo.
4. **Transiciones de cita** (botones de agenda, solo si cita activa y no pasada): Confirmar (`Agendada→Confirmada`), Reprogramar (`→Agendada` con nueva fecha/hora/profesional), Cancelar, No asistió, Marcar realizada (si etapa `En box`). Fuente: `agenda.tsx` (líneas con `updateAppointment`), `dashboard/my-day/vet.tsx`. *(regla)* — ver `../estados.md#cita`.
5. **Etapa real de la cita** (derivada): `Cancelada`/`No asistió`/`Realizada` por estado; `En espera` si tiene `WaitingEntry`; `En box` si es de hoy, faltan ≤ 60 min para su hora (o ya pasó) y el paciente ocupa un box; si no, `Por llegar`. Fuente: `src/lib/metrics/day.ts:appointmentStage`. *(regla)* — recomendado: persistir el vínculo cita↔box al pasar a box en vez de inferirlo por paciente y hora.
6. **Llegadas esperadas**: citas de hoy `Agendada`/`Confirmada` sin ingreso en hall ni en espera y en etapa `Por llegar`. Fuente: `src/lib/metrics/day.ts:expectedArrivals`. *(regla)*
7. **Check-in**: solo citas existentes de **hoy**, con paciente y dueño; no duplicar si ya está en espera. Crea `AccessEntry {direction: Ingreso, kind: Cliente, who: nombre del dueño, detail: "<mascota> · <motivo>"}` + `WaitingEntry {people: 1}`. Fuente: `src/services/mock/security.ts:checkIn`, `src/lib/security-store.tsx:checkIn` (`waiting.some(...)` evita duplicado). *(regla)* — el mock no valida la fecha ni el duplicado: backend 409.
8. **Aforo** de sala de espera `WAITING_CAPACITY = 12` personas (suma de `people`). Fuente: `src/domain/security.ts`. *(regla; hoy solo se muestra; al superarlo existe el tipo de evento "Aforo excedido")* → el backend debería generar el evento de seguridad (ver `eventos.md`).
9. **Pasar a box**: box destino `disponible` (la UI ofrece solo boxes libres de `kind = box`); el box queda `ocupado` con `doctorId` y `patientId` de la cita y `since = ahora`; se elimina la `WaitingEntry`. Fuente: `mock/security.ts:callFromWaiting`, `agenda.tsx` (`freeBoxes`). *(regla)* — mock no valida que el box esté disponible: backend 409.
10. **Mapa de boxes** (asignación manual en Actividad): `disponible → ocupado` exige profesional activo **no ocupado en otro box** y paciente visible **no ocupado en otro box**; `ocupado → limpieza` ("Finalizar atención", limpia doctor/paciente); `limpieza → disponible`. Áreas `comun` no se ocupan. Fuente: `src/components/activity/clinic-activity.tsx` (`busyDoctors`, `busyPatients`, botones por estado). *(regla)* — `clinic.updateRoom` es un PATCH libre: backend DEBE validar transición y unicidad.
11. **Finalizar atención** (Mi día del veterinario): marca la cita en box como `Realizada` y envía el box a `limpieza`. Fuente: `src/components/dashboard/my-day/vet.tsx`. *(regla; hoy 2 requests → hacerlo atómico)*.
12. **Bandeja de Pendientes**: tareas derivadas en el cliente desde el estado de todos los módulos. Fuente: `src/lib/tasks.ts:useTasks`. Tabla de fuentes:

| Prefijo `taskId` | Canal | Condición | Prioridad | Permiso para verla | Acción rápida |
|---|---|---|---|---|---|
| `llegada:<apptId>` | Clínica | Llegada esperada de hoy | Media | `agenda.gestionar` | `security.checkIn` |
| `vacuna:<patientId>` | Clínica | Mascota visible con vacuna vencida y sin recordatorio | Media | `agenda.gestionar` | `tasks.sendReminder` |
| `factura:<invoiceId>` | Clínica | Factura `Emitida` (impaga) | Baja | `facturas.emitir` | — |
| `solicitud:<reqId>` | Red | Seguimiento de solicitud Esperando dueño de mi clínica (origen solo notificado, no aprueba) | Alta si vence en 24 h, si no Media | `red.solicitar` para solicitante | No permite decidir en nombre del dueño |
| `receta:<refId>` | Farmacia | Derivación a farmacia interna no dispensada | Alta | `farmacia.dispensar` | `referrals.dispense` (si hay stock) |
| `stockmed:<medId>` | Farmacia | Stock bajo/sin stock y sin OC abierta | Alta si 0, si no Media | `farmacia.inventario` | — |
| `ocfar:<poId>` | Farmacia | OC farmacia `Enviada` | Baja | `farmacia.inventario` | `pharmacy.receivePurchaseOrder` |
| `despacho:<shId>` | Tienda | Despacho `Por preparar`/`Preparado` | Alta si programado ≤ hoy | `tienda.inventario` | `retail.advanceShipment` |
| `sala:<productId>` | Tienda | Sala < mínimo exhibido y hay stock central | Alta si sala 0 | `tienda.inventario` | `retail.transferToSala(min(central, 2·shelfMin − sala))` |
| `octda:<orderId>` | Tienda | OC tienda `Enviada` | Media si llegada estimada ≤ hoy | `tienda.compras` | `retail.receiveOrder` |
| `evento:<eventId>` | Seguridad | Evento `Nuevo`/`En revisión` | Alta si Crítica/Alta | `seguridad.ver` | — |
| `ticket:<ticketId>` | Soporte | Ticket `Esperando cliente` | Media | `soporte.crear` | — |

   Orden: prioridad, luego antigüedad. "Mías" = abiertas sin asignar o asignadas a mí. Una tarea desaparece cuando su condición deja de cumplirse. *(regla)* — **Decisión**: mantener la derivación en el cliente (el backend solo persiste `TaskMeta`) o moverla a un endpoint `GET /tasks` calculado en servidor (recomendado: evita traer todos los módulos al navegador y respeta permisos). `preguntas-abiertas.md#p-23`.
13. **TaskMeta** huérfana: si la tarea desaparece, su meta queda; limpiar periódicamente. *(recomendación)*
14. **Recordatorio de vacuna**: idempotente por paciente (no duplica). Fuente: `mock/settings.ts:tasks.sendReminder`, `store.tsx:sendReminder`. *(regla)*; el envío real por `Owner.preferredContact` no existe (`preguntas-abiertas.md#p-08`). Hoy un recordatorio "marca" al paciente para siempre; DEBE asociarse a las vacunas/fecha que motivaron el aviso para que una nueva vacuna vencida genere una nueva tarea.

## Estados
- Cita: `Agendada → Confirmada → Realizada`; `Agendada|Confirmada → Cancelada | No asistió`; reprogramar `Agendada|Confirmada → Agendada`.
- Etapa (derivada): `Por llegar → En espera → En box → Realizada`.
- Box: `disponible → ocupado → limpieza → disponible`.
- Tarea: abierta ↔ hecha.
Detalle y quién ejecuta en [`../estados.md`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `clinic.listDoctors` | `GET /api/v1/doctors` | `?active=true` | `Doctor[]` | sesión | 401 | — |
| `clinic.listRooms` | `GET /api/v1/rooms` | — | `Room[]` | sesión | 401 | — |
| `clinic.updateRoom` | `PATCH /api/v1/rooms/:id` | `Partial<Room>` (lista blanca: `status`, `doctorId`, `patientId`, `note`) | `Room` | `agenda.gestionar` (propuesto; hoy sin guard) | 404, 409 (transición, doctor/paciente ocupado), 403 (paciente sin acceso) | Afecta privacidad de cámaras del box (seguridad) |
| `appointments.list` | `GET /api/v1/appointments` | `?from&to&doctorId&status&patientId` | `Appointment[]` | sesión | 401 | — |
| `appointments.create` | `POST /api/v1/appointments` | `NewAppointment` (status ignorado) | `Appointment` | `agenda.gestionar` | 400, 403 (paciente sin acceso), 409 (bloque ocupado) | Evento `CitaAgendada` |
| `appointments.update` | `PATCH /api/v1/appointments/:id` | `AppointmentPatch` | `Appointment` | `agenda.gestionar` | 404, 409 (transición/bloque) | Evento según transición |
| `security.listAccess` | `GET /api/v1/security/access` | `?date` | `AccessEntry[]` | `seguridad.ver` o `agenda.gestionar` (propuesto) | 401 | — |
| `security.listWaiting` | `GET /api/v1/security/waiting` | — | `WaitingEntry[]` | sesión | 401 | — |
| `security.checkIn` | `POST /api/v1/security/waiting` | `{ appointmentId }` | `{ access, waiting }` | `agenda.gestionar` | 404, 409 (no es de hoy, ya llegó, cita no activa) | Atómico. Si aforo excedido → evento de seguridad |
| `security.callFromWaiting` | `POST /api/v1/security/waiting/:id/call` | `{ roomId }` | `{ room }` | `agenda.gestionar` | 404, 409 (box no disponible / no es box) | Atómico: box ocupado + sale de espera. Cámara del box entra en privacidad |
| `tasks.list` | `GET /api/v1/tasks?view=all\|open\|mine\|done` | `?view` (defecto `open`) | `Task[]` calculadas en servidor (fuentes T2-8: solicitudes + llegadas de hoy; el resto en fases 3/4) con meta fusionada | sesión; filtra por permiso de cada tarea | 400 (vista inválida) | — |
| `tasks.update` | `PATCH /api/v1/tasks/:taskId` (`:` URL-encode) | `{ assignee?: userId\|null, done?: bool }` (parcial) | `{ id, assignee, done }` | sesión + permiso de la tarea | 400 (tarea o responsable inválido), 403 | `task.updated` |
| `tasks.listReminders` | `GET /api/v1/reminders` | — | `string[]` (patientIds) | sesión | — | — |
| `tasks.sendReminder` | `POST /api/v1/patients/:patientId/reminders` | — (recomendado `{ channel?, vaccines? }`) | `void` | `agenda.gestionar` | 403 (sin acceso), 404 | Envía mensaje al dueño; evento `RecordatorioVacunaEnviado` |

## Efectos en otros dominios
- `callFromWaiting` y `updateRoom(ocupado)` activan la **privacidad** de la cámara del box en Seguridad (`security-store.tsx:usePrivacy`: privado si `privacyInBoxes && room.status === "ocupado"`).
- `checkIn` escribe en el registro de accesos del hall (Seguridad).
- Mi día y Pendientes leen de todos los dominios.

## Datos de referencia / semilla
Profesionales (`src/mocks/clinic.ts:doctors`, 6), plano de la clínica (`rooms`, 12 salas: recepción, espera, 6 boxes, rayos, laboratorio, quirófano, hospitalización), `SLOTS`, `WAITING_CAPACITY`.

## Notas para el dev
- Horas sueltas (`since`, `arrivedAt`, `time`) deben ser instantes con zona.
- No existe registrar **salida** del hall ni "no llegó" automático; tampoco historial de ocupación de boxes (necesario para la métrica `boxOccupancy`, ver [analitica](analitica.md)).
- No hay validación de que el profesional de la cita esté activo ni de horario de atención por profesional.
