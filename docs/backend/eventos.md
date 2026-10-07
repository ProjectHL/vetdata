# Eventos de dominio y notificaciones

> El prototipo **no emite eventos ni envía notificaciones**: solo muestra contadores (campana de solicitudes en `src/components/topbar.tsx`, insignias del menú en `src/lib/tasks.ts:useNavBadges`) y la bandeja "Pendientes" derivada en el cliente (`src/lib/tasks.ts:useTasks`). Este catálogo propone los eventos que el backend debería publicar (bus interno / outbox) para alimentar: (a) notificaciones in-app por clínica, rol o usuario; (b) mensajes externos (email/WhatsApp, `preguntas-abiertas.md#p-08`); (c) auditoría; (d) recálculo de tareas y métricas.
>
> Convención: `NombreEvento { payload }` → **destinatarios** · canal sugerido. "Permiso" = solo usuarios con ese permiso en la clínica destinataria.

## 1. Red y compartición
| Evento | Disparador (operación / regla) | Payload | Destinatarios · canal | Fuente |
|---|---|---|---|---|
| `AccesoSolicitado` | `sharing.sendRequests` (uno por solicitud creada) | requestId, patientId, from, to, scope, duration, reason | Clínica de origen (`to`), usuarios con `red.aprobar`; solo si `SharingPolicy(to).notifyRequests` · in-app (+ email opcional) | `topbar.tsx` (campana condicionada a `notifyRequests`), `lib/tasks.ts` (`solicitud:*`) |
| `SolicitudSinResponder` | Job diario: solicitud `Pendiente` con ≥ 1 día | requestId, días | Clínica de origen (`red.aprobar`) · in-app (prioridad Alta) | `lib/tasks.ts` (prioridad Alta si `daysUntil(r.date) <= -1`) |
| `AccesoAprobado` | `sharing.respond(approve)` | requestId, grantId, scope, until | Clínica solicitante (`from`), usuario `requestedBy` · in-app | `mock/sharing.ts:respond` |
| `AccesoRechazado` | `sharing.respond(!approve)` | requestId | Clínica solicitante, `requestedBy` · in-app | ídem |
| `ConsentimientoDeclarado` | Aprobación con `needsConsent` | requestId, ownerRut, userId, método | Auditoría · (y opcional aviso al dueño) | `sharing/request-tabs.tsx:ApproveDialog` |
| `AccesoRevocado` | `sharing.revoke` | grantId, patientId, grantedTo | Clínica receptora (`grantedTo`) · in-app; invalidar cachés | `mock/sharing.ts:revoke` |
| `AccesoPorVencer` | Job diario: grant vigente con `until` en ≤ N días (N a definir, p. ej. 7) | grantId, until | Clínica receptora (renovar) y origen · in-app | *(nuevo)* |
| `AccesoVencido` | Job diario: `until < hoy` (transición derivada de `grantStatus`) | grantId | Clínica receptora · in-app | `domain/sharing.ts:grantStatus` |
| `FichaCompartidaConsultada` | Lectura de mascota con nivel `compartido` | patientId, clinicId, userId, scope | Auditoría de la clínica de origen | *(nuevo, `transversales.md#2.9`)* |

## 2. Agenda y atención
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `CitaAgendada` / `CitaReprogramada` / `CitaCancelada` | `appointments.create/update` | Dueño (confirmación por `preferredContact`), profesional · externo + in-app | `agenda.tsx` |
| `CitaConfirmada` | `appointments.update → Confirmada` | Profesional · in-app | `agenda.tsx` |
| `RecordatorioCita` | Job: citas de mañana `Agendada` | Dueño · externo | *(nuevo)* |
| `PacienteLlego` | `security.checkIn` | Profesional de la cita · in-app ("en espera") | `mock/security.ts:checkIn`, `my-day/vet.tsx` (lista de espera) |
| `AforoExcedido` | `checkIn` hace que Σ `people` > `WAITING_CAPACITY` (12) | Seguridad (`seguridad.ver`) · in-app; crea `SecurityEvent` tipo `Aforo excedido` | `domain/security.ts:WAITING_CAPACITY` |
| `PacienteLlamadoABox` | `security.callFromWaiting` | Recepción / pantalla de sala · in-app | `mock/security.ts:callFromWaiting` |
| `BoxOcupado` / `BoxEnLimpieza` / `BoxDisponible` | `clinic.updateRoom`, `callFromWaiting` | Mapa en vivo (push), Seguridad (privacidad de cámara) | `security-store.tsx:usePrivacy` |
| `AtencionFinalizada` | Cita → `Realizada` + box → `limpieza` | Recepción/caja (facturar) · in-app | `my-day/vet.tsx` |
| `VacunaPorVencer` | Job diario: `vaccineState = próxima` (≤ 30 días) | Clínica (`agenda.gestionar`) · in-app; opcional dueño | `lib/analytics.ts:vaccineState`, `analytics/vaccination.tsx` ("Enviar recordatorio") |
| `VacunaVencida` | Job diario: `vaccineState = vencida` sin recordatorio | Clínica (`agenda.gestionar`) · in-app (tarea `vacuna:*`) | `lib/tasks.ts` |
| `RecordatorioVacunaEnviado` | `tasks.sendReminder` | Dueño por `preferredContact` · WhatsApp/Teléfono/Email | `mock/settings.ts:tasks.sendReminder` (hoy no envía) |
| `TareaAsignada` | `tasks.assign` | Usuario asignado · in-app | `tasks/task-inbox.tsx` |

## 3. Facturación
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `FacturaEmitida` | `invoices.create` | Dueño (envío del documento, `#p-12`); cobranza (tarea `factura:*`) | `mock/clinic.ts:invoices.create` |
| `FacturaPagada` | (operación faltante) | Cobranza · in-app | `#p-11` |
| `FacturaVencida` / `SaldoMoroso` | Job: factura `Emitida` > 30/60 días | `reportes.financiero` · in-app | `lib/metrics/customers.ts:receivables` (buckets) |

## 4. Farmacia
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `RecetaDerivada` | `referrals.create` | Destino `Farmacia interna` → usuarios `farmacia.dispensar` · in-app (tarea `receta:*`, prioridad Alta). Destino otra clínica → esa clínica (`#p-13`) | `mock/clinic.ts:referrals.create`, `lib/tasks.ts` |
| `RecetaBloqueadaPorStock` | Derivación interna con ítem sin stock suficiente | `farmacia.inventario` · in-app | `pharmacy/dispense-queue.tsx` (`blocked`) |
| `RecetaDispensada` | `referrals.dispense` | Veterinario prescriptor · in-app | `mock/clinic.ts:referrals.dispense` |
| `StockBajo` / `SinStock` | Movimiento que cruza `minStock` o llega a 0 (`stockStatus`) y no hay OC abierta | `farmacia.inventario` · in-app (tarea `stockmed:*`) | `domain/medications.ts:stockStatus`, `lib/tasks.ts` |
| `MedicamentoPorVencer` / `MedicamentoVencido` | Job diario `expiryStatus` (≤ 60 días / < 0) | `farmacia.inventario` · in-app | `domain/medications.ts:expiryStatus` |
| `OCEnviada` | `pharmacy.sendPurchaseOrder` | Proveedor (email, `#p-08`) | `mock/pharmacy.ts` |
| `OCRecibida` | `pharmacy.receivePurchaseOrder` | `farmacia.inventario` · in-app; resuelve `StockBajo` | `mock/pharmacy.ts` |

## 5. Tienda
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `VentaRegistrada` | `retail.checkout` | Cliente (boleta por email si RUT, `#p-12`) | `mock/retail.ts:checkout` |
| `DespachoCreado` | `checkout` con `delivery` | `tienda.inventario` · in-app (tarea `despacho:*`); dueño · externo | ídem |
| `DespachoAvanzado` (`Preparado`, `En ruta`, `Entregado`) | `retail.advanceShipment` | Dueño · WhatsApp/email ("tu pedido va en camino") | `mock/retail.ts:advanceShipment` |
| `DespachoAtrasado` | Job: no entregado y `scheduledFor < hoy` | `tienda.inventario` · in-app | `lib/metrics/retail.ts:shipmentKpis` |
| `ReponerSala` | Movimiento deja `sala < shelfMin` con stock central | `tienda.inventario` · in-app (tarea `sala:*`) | `lib/tasks.ts` |
| `ProductoParaComprar` / `ProductoAgotado` | `stockLevel` → `Comprar` / `Agotado` | `tienda.compras` · in-app | `domain/retail.ts:stockLevel` |
| `QuiebreProximo` | Job: cobertura < 7 días | `tienda.compras` · in-app | `analytics/panorama.tsx` (`breakSoon`) |
| `OCTiendaRecibida` | `retail.receiveOrder` | `tienda.inventario` (reponer sala) · in-app | `mock/retail.ts:receiveOrder` |
| `OCTiendaAtrasada` | Job: `Enviada` y `expected ≤ hoy` | `tienda.compras` · in-app (tarea `octda:*` prioridad Media) | `lib/tasks.ts` |

## 6. Seguridad
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `EventoSeguridadCreado` | `security.createEvent` o ingesta de dispositivos | `seguridad.ver` · in-app (tarea `evento:*`) | `mock/security.ts:createEvent` |
| `EventoSeguridadCritico` | Evento con severidad `Crítica` (p. ej. `Botón de pánico`, `Puerta forzada`) | `seguridad.administrar` + admins · **push/SMS inmediato** | `analytics/panorama.tsx` ("eventos de seguridad críticos sin revisar") |
| `EventoAsignado` | `security.updateEvent {assignee}` | Usuario asignado · in-app | `security/events.tsx` |
| `EventoResuelto` | `updateEvent → Resuelto/Falsa alarma` | Creador / admins · in-app | `mock/security.ts:updateEvent` |
| `CamaraSinSenal` | Telemetría `CameraStatus → Sin señal` | `seguridad.administrar` · in-app; crea `SecurityEvent` tipo `Cámara sin señal` | `domain/security.ts` |
| `DispositivoBateriaBaja` / `DispositivoSinConexion` | Telemetría `Device.status` | `seguridad.administrar` · in-app | `domain/security.ts:Device` |
| `NVRCapacidadAlta` | `usedTb/totalTb` > umbral o `daysRecorded < retentionDays` | `seguridad.administrar` · in-app | `domain/security.ts:NvrStorage` |
| `MovimientoFueraDeHorario` | Sensor/cámara en ventana `afterHoursFrom–afterHoursTo` | `seguridad.administrar` · push | `SecuritySettings` |
| `AlarmaArmada` / `AlarmaDesarmada` | `security.setAlarm` o `autoArm` | Admins · in-app + auditoría | `mock/security.ts:setAlarm` |
| `CerraduraCambiada` | `security.toggleLock` | Auditoría | `mock/security.ts:toggleLock` |
| `PrivacidadDesactivada` | `logAudit("Desactivó privacidad")` | Auditoría; opcional aviso al profesional del box | `camera-dialog.tsx` |
| `GrabacionAccedida` / `ClipExportado` | Abrir/exportar grabación | Auditoría | `camera-dialog.tsx`, `events.tsx` |
| `AjustesSeguridadCambiados` | `security.updateSettings` (especial: `privacyInBoxes = false`, retención) | Admins · in-app + auditoría | `devices.tsx` |

## 7. Soporte
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `TicketCreado` | `support.createTicket` / `proposeIdea` | Cola VetData (backoffice); `Crítica` → alerta on-call | `mock/support.ts` |
| `TicketRespondidoPorVetData` | Backoffice (fija `firstResponseAt`) | Creador del ticket · in-app + email | `support-store.tsx:simulateSupportReply` (demo) |
| `TicketEsperandoCliente` | Backoffice → `Esperando cliente` | Creador · in-app (tarea `ticket:*`) | `lib/tasks.ts` |
| `MensajeClinica` | `support.reply` | Agente VetData | `mock/support.ts:reply` |
| `SLAEnRiesgo` / `SLAVencido` | Job: `slaState` pasa a `En riesgo` (< 25 % del plazo) o `Vencido` | VetData (backoffice) · alerta; clínica ve indicador | `domain/support.ts:slaState`, `lib/metrics/support.ts` |
| `TicketResuelto` | → `Resuelto` | Creador (pedir calificación) | `ticket-detail.tsx` |
| `TicketCalificado` | `support.rate` | VetData (CSAT) | `mock/support.ts:rate` |
| `IdeaPropuesta` / `IdeaCambioEstado` / `IdeaLanzada` | `proposeIdea` / backoffice | Clínicas que votaron · in-app; `Lanzada` → Novedades | `domain/support.ts:Idea`, `Release` |

## 8. Usuarios y configuración
| Evento | Disparador | Destinatarios · canal | Fuente |
|---|---|---|---|
| `UsuarioInvitado` | `settings.inviteUser` | Invitado · **email con enlace** | `mock/settings.ts:inviteUser` |
| `UsuarioActivado` / `UsuarioDesactivado` / `RolCambiado` | `settings.updateUser` | Usuario afectado · email; auditoría; invalidar sesiones | `users-table.tsx` |
| `PermisosCambiados` | `settings.togglePermission` | Admins · auditoría; refrescar permisos de sesiones | `permissions-matrix.tsx` |
| `PoliticaComparticionCambiada` | `settings.updateSharingPolicy` | Auditoría | `permissions-matrix.tsx` |
| `PerfilClinicaCambiado` | `settings.updateClinicProfile` | Auditoría; actualizar ficha en directorio de red | `profile.tsx` |

## 9. Analítica / red
| Evento | Disparador | Destinatarios | Fuente |
|---|---|---|---|
| `AlertaRedPublicada` | Recalculo de `networkAlerts` detecta alza significativa por sector/categoría | Todas las clínicas conectadas · in-app (anónimo) | `domain/metrics.ts:NetworkAlert`, `analytics/diagnoses.tsx` |

## Requisitos técnicos sugeridos
- **Outbox transaccional**: el evento se escribe en la misma transacción que el cambio de estado (ver atomicidad en `transversales.md#8`).
- **Jobs programados** (zona `America/Santiago`): vencimiento de grants, vacunas, medicamentos, SLA, despachos/OC atrasados, facturas morosas, recordatorios de cita.
- **Preferencias** por usuario/clínica (qué eventos y por qué canal); hoy solo existe `SharingPolicy.notifyRequests`.
- **Idempotencia** en consumidores y registro de entrega de mensajes externos.
