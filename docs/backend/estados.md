# Máquinas de estado y enums

> Todas las uniones de string de `src/domain/*` (y las derivadas en `src/lib/*`) aparecen aquí. Parte A: entidades con ciclo de vida (transiciones). Parte B: estados **derivados** (se calculan, no se persisten). Parte C: enums/catálogos sin transiciones.
>
> Columnas: **Quién** = permiso / actor que ejecuta. **UI hoy** = qué permite el prototipo. **Backend DEBE** = restricción que hoy no existe en el contrato/mock. Transición inválida → `409 Conflict`.

---

## A. Entidades con ciclo de vida

### Cita
`AppointmentStatus = "Agendada" | "Confirmada" | "Realizada" | "Cancelada" | "No asistió"` — `src/domain/appointments.ts`

```
(crear) ──► Agendada ──confirmar──► Confirmada
              │  ▲                     │
              │  └──reprogramar────────┤ (también Agendada→Agendada)
              ├──────────────► Realizada ◄──┤
              ├──────────────► Cancelada ◄──┤
              └──────────────► No asistió ◄─┘
Terminales: Realizada, Cancelada, No asistió
```

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Agendada | `appointments.create` | `agenda.gestionar` | Siempre envía `Agendada` (`agenda.tsx`, `schedule-form.tsx`) | Forzar `Agendada` ignorando `status` recibido; validar bloque libre (doctor+fecha+hora, sin canceladas), paciente con acceso, profesional activo, hora ∈ `SLOTS` |
| Agendada → Confirmada | `appointments.update` | `agenda.gestionar` | Botón "Confirmar" solo si `Agendada` | Solo desde `Agendada` |
| Agendada/Confirmada → Agendada (reprogramar) | `appointments.update {date,time,doctorId,status:"Agendada"}` | `agenda.gestionar` | Solo citas activas no pasadas; verifica bloque libre | Validar bloque libre; no reprogramar terminales |
| Agendada/Confirmada → Realizada | `appointments.update` | `agenda.gestionar` | "Marcar realizada" si etapa `En box` (`agenda.tsx`); "Finalizar atención" en Mi día del vet (`my-day/vet.tsx`, sin Guard) | Solo si la fecha/hora ya llegó (`date ≤ hoy`); idealmente si pasó por box |
| Agendada/Confirmada → Cancelada | `appointments.update` | `agenda.gestionar` | Solo activas y no pasadas | No desde terminales |
| Agendada/Confirmada → No asistió | `appointments.update` | `agenda.gestionar` | Solo activas y no pasadas (¡permite marcar "no asistió" a una cita futura!) | Solo si la hora de la cita ya pasó; no si hay check-in |
| Terminal → cualquiera | `appointments.update` (PATCH libre) | — | No se ofrece | **Rechazar** (hoy el mock acepta cualquier patch: `mock/clinic.ts:appointments.update`) |

### Box / sala del mapa (Room)
`RoomStatus = "ocupado" | "limpieza" | "disponible"` — `src/domain/clinic.ts`

```
disponible ──asignar/pasar a box──► ocupado ──finalizar atención──► limpieza ──marcar disponible──► disponible
```

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| disponible → ocupado | `security.callFromWaiting` o `clinic.updateRoom {status:"ocupado", doctorId, patientId}` | `agenda.gestionar` (propuesto) | Mapa (`clinic-activity.tsx`) ofrece solo doctores y pacientes no ocupados; agenda ofrece solo `kind=box` disponibles | Validar `disponible`, `kind ≠ comun`, doctor activo no ocupado en otro room, paciente visible no ocupado en otro room; `since = ahora` |
| ocupado → limpieza | `clinic.updateRoom {status:"limpieza"}` | `agenda.gestionar` (propuesto) | "Finalizar atención y enviar a limpieza" limpia doctor/paciente | Limpiar `doctorId/patientId`; idealmente marcar la cita como `Realizada` en la misma transacción |
| limpieza → disponible | `clinic.updateRoom {status:"disponible"}` | `agenda.gestionar` (propuesto) | "Marcar como disponible" | — |
| otros saltos (ej. limpieza → ocupado, ocupado → disponible) | `clinic.updateRoom` (PATCH libre) | — | No se ofrecen | **Rechazar** |
Efecto: `ocupado` + `privacyInBoxes` ⇒ cámara del room en privacidad (`security-store.tsx:usePrivacy`). Registrar historial de estados con timestamp (requerido por `analytics.boxOccupancy`).

### Solicitud de acceso

Contrato objetivo p-05/p-06: `Esperando dueño → Aprobada | Denegada | Expirada | Cancelada`. El enum actual del prototipo Pendiente/Aprobada/Rechazada debe migrarse en fases 2/5.

| Transición | Actor | Restricción |
|---|---|---|
| Crear → Esperando dueño | Solicitante con red.solicitar | Mascota ajena; sin solicitud pendiente ni grant vigente salvo renovación explícita; token 72 h |
| Esperando dueño → Aprobada | Dueño verificado | Token/RUT; alcance igual o menor; evidencia + token consumido + grant atómicos |
| Esperando dueño → Denegada | Dueño verificado | Token válido; consumido al decidir |
| Esperando dueño → Expirada | Sistema/validación de tiempo | Más de 72 h; no depender solo del job para impedir respuesta |
| Esperando dueño → Cancelada | Clínica solicitante con red.solicitar | Invalida token |
| Terminal → otra respuesta | Nadie | 409; renovar crea solicitud vinculada |

### Acceso / grant

Solo Vigente habilita acceso compartido. Propuesta de estado derivado: Revocado > Vencido > Suspendido > Vigente; hasta until inclusive en America/Santiago.

| Cambio | Actor | Efecto |
|---|---|---|
| Crear grant | Dueño aprueba | Consentimiento por grant, alcance y vigencia autorizados |
| Vigente → Vencido | Tiempo | Denegar nuevas lecturas; conservar documentos propios |
| Revocar consentimiento | Dueño verificado | Revocar grants correspondientes e invalidar acceso |
| Suspender | Admin origen con red.suspender | Motivo, auditoría y aviso a dueño/receptora |
| Restablecer | Admin origen con red.suspender | Quitar suspensión; no alterar vencimiento ni revocación |
| Renovar | Solicitante y nueva decisión del dueño | Nueva solicitud/grant vinculados; no reactivar implícitamente el anterior |

Ver [red-y-acceso](dominios/red-y-acceso.md) para contrato y autorización temporal del dueño.

### Receta / derivación (Referral)
`ReferralStatus = "Enviada" | "Recibida" | "Dispensada"` — `src/domain/referrals.ts`

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Enviada | `referrals.create` | `medicamentos.derivar` | Siempre `Enviada` | Forzar `Enviada` |
| Enviada → Dispensada | `referrals.dispense` | `farmacia.dispensar` | Solo `destination = Farmacia interna`; bloqueado si falta stock | 409 si externa, ya dispensada o stock insuficiente (mock devuelve sin cambios) |
| Enviada → Recibida | **sin operación** | (clínica destino) | Solo semilla | Definir (`preguntas-abiertas.md#p-13`) |
| Recibida → Dispensada | `referrals.dispense` | `farmacia.dispensar` | El mock lo permitiría si fuera interna | Definir |

### Orden de compra de farmacia
`PurchaseOrderStatus = "Borrador" | "Enviada" | "Recibida"` — `src/domain/pharmacy.ts`

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Borrador | `pharmacy.createPurchaseOrder` | `farmacia.inventario` | Desde sugerencia de reposición | `unitCost` del servidor |
| Borrador → Enviada | `pharmacy.sendPurchaseOrder` | `farmacia.inventario` | Botón en borradores | 409 si no `Borrador` (mock devuelve sin cambios) |
| Enviada → Recibida | `pharmacy.receivePurchaseOrder` | `farmacia.inventario` | Botón / acción rápida en Pendientes | Atómico con entradas de stock; 409 si no `Enviada` |
El prototipo no tiene recepción parcial. El contrato objetivo p-24 la agrega en Fase 3: Enviada → Parcialmente recibida → Recibida, registrando cantidades acumuladas, pendientes, lotes y costo real por entrega. No cerrar ni repetir cantidades ya recibidas. Edición/cancelación adicional se especifica antes de implementarla.

### Orden de compra de tienda
`RetailOrderStatus = "Borrador" | "Enviada" | "Recibida"` — `src/domain/retail.ts`. Mismas transiciones que farmacia con permiso `tienda.compras`; recibir hace entradas a **bodega central**. Fuente: `mock/retail.ts:sendOrder, receiveOrder`.

### Despacho
`ShipmentStatus = "Por preparar" | "Preparado" | "En ruta" | "Entregado"`, `SHIPMENT_FLOW` — `src/domain/retail.ts`

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Por preparar | `retail.checkout` con `delivery` y cliente | `tienda.vender` | `scheduledFor = mañana` | — |
| Por preparar → Preparado → En ruta → Entregado | `retail.advanceShipment` | `tienda.inventario` | Avance lineal; acción rápida en Pendientes | 409 al avanzar desde `Entregado`; guardar `deliveredAt` y timestamps por estado |
No existen: cancelar, fallido/reintento, retroceder.

### Ticket de soporte
`TicketStatus = "Nuevo" | "En revisión" | "En progreso" | "Esperando cliente" | "Resuelto" | "Cerrado"`, `TICKET_FLOW`, `OPEN_STATUSES` — `src/domain/support.ts`

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Nuevo | `support.createTicket` / `support.proposeIdea` | `soporte.crear` | — | — |
| Nuevo → En revisión → En progreso | (backoffice VetData) | Agente VetData | Simulado con `simulateSupportReply` (fija `firstResponseAt`) | Solo VetData |
| En progreso → Esperando cliente | (backoffice VetData) | Agente VetData | — | Solo VetData |
| Esperando cliente → En progreso | `support.reply` | `soporte.crear` (clínica) | Automático al responder | — |
| * (abierto) → Resuelto | `support.changeStatus` o VetData | clínica (`soporte.crear`) o VetData | Select con todos los estados | Permitir a la clínica |
| Resuelto → En progreso (reabrir) | `support.changeStatus` | clínica | Permitido por select | Permitir a la clínica |
| Resuelto → Cerrado | `support.rate` | clínica (`soporte.crear`) | Al calificar 1–5 | 409 si no `Resuelto` o ya calificado |
| * → Cerrado (sin calificar) | `support.changeStatus` | `soporte.administrar` | Solo admin ve la opción | — |
| Cualquiera → Nuevo / En revisión / En progreso / Esperando cliente | `support.changeStatus` | — | **La UI lo permite a la clínica** (`ticket-detail.tsx:statusOptions` = todo `TICKET_FLOW`) | **Restringir**: la clínica solo puede `→ Resuelto`, reabrir `Resuelto → En progreso`, y (admin) `→ Cerrado` |
| Cerrado → * | — | — | Select oculto si cerrado | 409 |

### Idea (mejora)
`IdeaStatus = "En evaluación" | "Planificada" | "En desarrollo" | "Lanzada"`, `IDEA_FLOW` — `src/domain/support.ts`

| De → A | Operación | Quién | Backend DEBE |
|---|---|---|---|
| ∅ → En evaluación | `support.proposeIdea` | `soporte.crear` | Atómico con ticket `Mejora` |
| En evaluación → Planificada → En desarrollo → Lanzada | **sin operación** (backoffice VetData) | VetData | `Lanzada` ⇒ `releaseId` |
Votos: `support.vote` (toggle por clínica) — recomendado bloquear en `Lanzada`.

### Evento de seguridad
`EventStatus = "Nuevo" | "En revisión" | "Resuelto" | "Falsa alarma"`, `EVENT_STATUSES`, `OPEN_EVENT` — `src/domain/security.ts` (regla 3)

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Nuevo | `security.createEvent` / dispositivos | `seguridad.ver` (propuesto) / sistema | Manual desde cámara o Eventos | — |
| Nuevo → En revisión | `security.updateEvent {assignee}` o `{status}` | `seguridad.ver` (propuesto) | Asignar responsable desde `Nuevo` pasa a `En revisión` | — |
| Nuevo/En revisión → Resuelto | `security.updateEvent` | `seguridad.administrar` | "Resolver" | `resolvedAt = ahora`, cierre inmutable (p-26) |
| Nuevo/En revisión → Falsa alarma | `security.updateEvent` | `seguridad.administrar` | "Falsa alarma" | `resolvedAt = ahora`, cierre inmutable (p-26) |
| Resuelto/Falsa alarma → Nuevo/En revisión | `security.updateEvent` | — | **El select lo permite**; `resolvedAt` queda con el valor anterior | Rechazar 409 según p-26; evento nuevo vinculado si reaparece; no editar ni agregar notas al cerrado |

### Factura
`InvoiceStatus = "Emitida" | "Pagada"` — `src/domain/invoices.ts`

| De → A | Operación | Quién | Backend DEBE |
|---|---|---|---|
| ∅ → Emitida | `invoices.create` | `facturas.emitir` | Forzar `Emitida` (hoy la UI envía `status` y el mock lo respeta) |
| Emitida → Pagada | `invoices.pay` (derivado `paid >= total`) | `facturas.emitir` | Abonos parciales con medio; 409 sobrepago; `balance` del dueño acompaña |
No existen: anulación, nota de crédito.

### Cámara
`CameraStatus = "En línea" | "Sin señal" | "Mantención"` — `src/domain/security.ts`

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| * → En línea ("Reiniciar") | `security.setCameraStatus` | `seguridad.administrar` | Botón | En producción: comando de reinicio; el estado lo reporta la telemetría |
| En línea → Mantención | `security.setCameraStatus` | `seguridad.administrar` | Botón | — |
| En línea → Sin señal / Sin señal → En línea | telemetría | sistema | Solo semilla | No asignable por usuario (400); genera evento `Cámara sin señal` |

### Usuario
`UserStatus = "Activo" | "Invitado" | "Inactivo"` — `src/domain/settings.ts`

| De → A | Operación | Quién | UI hoy | Backend DEBE |
|---|---|---|---|---|
| ∅ → Invitado | `settings.inviteUser` | `usuarios.administrar` | — | Email único; enviar invitación |
| Invitado → Activo | `settings.updateUser {status}` ("Marcar aceptada") | `usuarios.administrar` | Botón | Idealmente solo al aceptar la invitación (usuario); crear/vincular `Doctor` si es Veterinario |
| Activo → Inactivo | `settings.updateUser` | `usuarios.administrar` | No a sí mismo | Invalidar sesiones; no dejar la clínica sin admin |
| Inactivo → Activo | `settings.updateUser` ("Reactivar") | `usuarios.administrar` | — | — |
| Invitado → Inactivo (revocar invitación) | `settings.updateUser` | — | La UI muestra "Marcar aceptada" pero no revocar | Recomendado permitir |

### Tarea (Pendientes)
`TaskMeta { assignee?, done? }` — `src/domain/tasks.ts`. Abierta ↔ Hecha (`tasks.complete(done)`), asignación libre (`tasks.assign`). La tarea "desaparece" cuando su condición de origen deja de cumplirse (`src/lib/tasks.ts`).

### Alarma y cerraduras
- `SecuritySettings.alarmArmed: boolean` — armada ↔ desarmada (`security.setAlarm`, `seguridad.administrar`).
- `Device.locked: boolean` (solo `Cerradura`) — bloqueada ↔ desbloqueada (`security.toggleLock`, `seguridad.administrar`).

### Clínica de la red
`ClinicStatus = "Conectada" | "Invitación pendiente"` — `src/domain/network.ts`. `Invitación pendiente → Conectada`: **sin operación** (alta de clínicas en backoffice VetData).

---

## B. Estados derivados (calcular en servidor, no persistir)

| Enum | Valores | Regla | Fuente |
|---|---|---|---|
| `GrantStatus` objetivo | Vigente, Vencido, Revocado, Suspendido | ver arriba | `domain/sharing.ts:grantStatus` |
| `AccessLevel` | propio, compartido, ninguno | origen = mi clínica → propio; grant vigente → compartido | `domain/sharing.ts:accessLevel` |
| `AppointmentStage` | Por llegar, En espera, En box, Realizada, Cancelada, No asistió | estado terminal; en espera si `WaitingEntry`; en box si hoy, ≤ 60 min y paciente en box ocupado | `lib/metrics/day.ts:appointmentStage` |
| `StockStatus` | Disponible, Stock bajo, Sin stock | 0 → Sin stock; < min → Stock bajo | `domain/medications.ts:stockStatus` |
| `ExpiryStatus` | vencido, por vencer, ok | días < 0; ≤ 60; resto | `domain/medications.ts:expiryStatus` |
| `StockLevel` | OK, Reponer sala, Comprar, Agotado | total 0; total ≤ reorderPoint; sala < shelfMin | `domain/retail.ts:stockLevel` |
| `SlaState` | En plazo, En riesgo, Vencido, Cumplido, Incumplido | ver soporte | `domain/support.ts:slaState` |
| `VaccineState` | vencida, próxima, vigente | nextDose < hoy; ≤ 30 días; resto/sin nextDose | `lib/analytics.ts:vaccineState` |
| `TaskPriority` | Alta, Media, Baja | según fuente de la tarea | `lib/tasks.ts` |
| `TaskChannel` | Clínica, Red, Farmacia, Tienda, Seguridad, Soporte | canal de la tarea | `lib/tasks.ts` |

---

## C. Enums y catálogos sin transiciones

| Enum | Valores | Fuente | Nota backend |
|---|---|---|---|
| `PatientStatus` | Al día, Control, Urgente | `domain/patients.ts` | Calculado en servidor por política configurable `PATIENT_STATUS_RULES` (JSON: `default` + `rules` con `diagnosisCategory`/`condition`/`overdueVaccine`/`recentConsultationDays`, primera coincidencia gana). Default provisional: solo vacuna vencida → Control; Urgente solo por config (D-03 abierto) |
| `Species` | Perro, Gato, Ave, Conejo | `domain/patients.ts` | Catálogo; ampliable (exóticos) |
| `Patient.sex` | Macho, Hembra | `domain/patients.ts` | |
| `Owner.preferredContact` | WhatsApp, Teléfono, Email | `domain/owners.ts` | Canal de recordatorios |
| `RoomKind` | box, quirofano, imagen, laboratorio, hospitalizacion, comun | `domain/clinic.ts` | `comun` no ocupable |
| `AccessScope` | Ficha completa, Resumen clínico | `domain/sharing.ts` | Proyección de datos |
| `AccessDuration` | 30, 90, null | `domain/sharing.ts` | null = permanente |
| `MedCategory` | Antibiótico, Antiparasitario, Antiinflamatorio, Analgésico, Anestésico, Vacuna, Cardiológico, Gastrointestinal | `domain/medications.ts` | |
| `MovementType` | Entrada, Salida, Ajuste | `domain/pharmacy.ts` | Signo de `qty` coherente con tipo |
| `MovementReason` | Compra, Dispensación, Venta, Merma, Vencimiento, Transferencia | `domain/pharmacy.ts` | `Transferencia` no la usa ninguna operación (¿multi-sucursal? `#p-02`) |
| `ProductCategory` | Alimentos, Snacks, Accesorios, Ropa, Juguetes, Higiene, Camas y transporte | `domain/retail.ts` | |
| `TargetSpecies` | Perro, Gato, Ave, Conejo, Todas | `domain/retail.ts` | |
| `Location` | central, sala | `domain/retail.ts` | |
| `PaymentMethod` | Efectivo, Débito, Crédito, Transferencia | `domain/retail.ts` | Sin pasarela (`#p-11`) |
| `SaleChannel` | Mesón, Web | `domain/retail.ts` | `Web` sin canal real |
| `RetailMovementType` | Entrada, Salida, Transferencia, Ajuste | `domain/retail.ts` | |
| `RetailMovementReason` | Compra, Venta, Reposición sala, Merma, Conteo | `domain/retail.ts` | |
| `Zone` | hall, espera, boxes, tienda, bodega, farmacia | `domain/security.ts` | `boxes` exige `seguridad.boxes` |
| `Scene` | door, reception, waiting, exam, surgery, counter, aisle, shelves | `domain/security.ts` | Solo prototipo (ilustración) |
| `Camera.recording` | Continua, Por movimiento | `domain/security.ts` | |
| `Camera.resolution` | 1080p, 2K, 4K | `domain/security.ts` | |
| `DeviceKind` | Cerradura, Botón de pánico, Sensor de humo, Sensor de movimiento, Grabador (NVR) | `domain/security.ts` | |
| `Device.status` | Operativo, Batería baja, Sin conexión | `domain/security.ts` | Telemetría (no editable) |
| `AccessKind` | Cliente, Proveedor, Courier, Personal | `domain/security.ts` | Check-in solo crea `Cliente` |
| `AccessEntry.direction` | Ingreso, Salida | `domain/security.ts` | `Salida` sin operación |
| `EventType` | Movimiento fuera de horario, Puerta forzada, Puerta abierta, Acceso no autorizado, Aforo excedido, Cámara sin señal, Caja abierta sin venta, Botón de pánico, Marcado manual | `domain/security.ts` | Todos salvo `Marcado manual` deberían generarse automáticamente |
| `Severity` | Crítica, Alta, Media, Baja | `domain/security.ts` | |
| `AuditAction` | Vio en vivo, Abrió grabación, Exportó clip, Desactivó privacidad | `domain/security.ts` | `Vio en vivo` nunca se registra hoy |
| `SecuritySettings.retentionDays` | 15, 30, 60, 90 | `domain/security.ts` | |
| `TicketCategory` | Incidencia, Mejora, Consulta, Integración / datos, Facturación del servicio | `domain/support.ts` | |
| `TicketPriority` | Crítica, Alta, Media, Baja | `domain/support.ts` | Define SLA |
| `TicketMessage.side` | Clínica, VetData | `domain/support.ts` | `VetData` solo desde backoffice |
| `Release.items[].type` | Nuevo, Mejora, Corrección | `domain/support.ts` | |
| `Role` | Admin, Veterinario, Recepción, Farmacia | `domain/settings.ts` | Fijos; ver `permisos.md` |
| `Permission` | 21 actuales / 20 objetivo | `domain/settings.ts` | Sustituir red.aprobar/red.revocar por red.suspender; ver `permisos.md` |

---

## Cobertura y diferencias objetivo

Los estados adicionales de red y compras son contratos objetivo aún ausentes de los tipos del prototipo. La cobertura siguiente describe el inventario anterior a su migración; no prueba equivalencia con la API futura.

Las 50 uniones de string declaradas con `export type` en `src/domain/*` y `src/lib/*` (incluida `Permission`, detallada en `permisos.md`) y las 9 uniones inline de campos (`Patient.sex`, `Owner.preferredContact`, `Camera.recording`, `Camera.resolution`, `Device.status`, `AccessEntry.direction`, `TicketMessage.side`, `Release.items[].type`, `SecuritySettings.retentionDays`) aparecen en este documento con todos sus valores. Ver la verificación en `README.md#7-verificación-de-consistencia`.
