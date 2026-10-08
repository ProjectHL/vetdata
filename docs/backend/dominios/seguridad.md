# Seguridad (cámaras, privacidad de boxes, grabaciones, dispositivos, alarma, eventos, auditoría)

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-26: ver/anotar eventos abiertos con seguridad.ver, cerrar con seguridad.administrar y cerrado inmutable. p-19/T4-2: auditoría generada por servidor; retirar security.logAudit como escritura pública. Video real queda en Fase 8. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/security.ts` (reglas 1–3 en cabecera, `ZONES`, `WAITING_CAPACITY`, `OPEN_EVENT`, `SEVERITIES`) · `src/services/contracts.ts` (`SecurityService`) · `src/services/mock/security.ts` · `src/lib/security-store.tsx` (`usePrivacy`) · `src/components/security/*` (`camera-dialog.tsx`, `events.tsx`, `devices.tsx`, `zones.tsx`, `monitoring.tsx`, `page-shell.tsx`)

> Llegadas al hall y sala de espera (`listAccess`, `listWaiting`, `checkIn`, `callFromWaiting`) se documentan en [agenda-y-atencion](agenda-y-atencion.md) aunque vivan en `SecurityService`.

## Propósito
Monitoreo de la clínica por zonas con cámaras, protección de la privacidad de las atenciones (boxes y quirófano), acceso auditado a grabaciones, control de cerraduras y alarma, y gestión de eventos/incidentes de seguridad.

Pantallas: `/seguridad/monitoreo` (centro de monitoreo, alarma), `/seguridad/hall`, `/seguridad/sala-espera`, `/seguridad/boxes`, `/seguridad/tienda`, `/seguridad/eventos`, `/seguridad/dispositivos` (cámaras, dispositivos, ajustes, auditoría). Toda la sección exige `seguridad.ver` (`page-shell.tsx`).

## Entidades

### Camera
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | id | sí | |
| name, location | string | sí | |
| zone | `Zone` | sí | `hall \| espera \| boxes \| tienda \| bodega \| farmacia`. |
| scene | `Scene` | sí | Ilustración del prototipo (no aplica con video real). |
| roomId | id | no | Box/sala que vigila → regla de privacidad. |
| status | `CameraStatus` | sí | `En línea \| Sin señal \| Mantención`. |
| recording | `"Continua" \| "Por movimiento"` | sí | |
| resolution | `"1080p" \| "2K" \| "4K"` | sí | |
| ptz, audio | bool | sí | |
| lastMotion | `HH:mm` | no | Telemetría. |
| firmware | string | sí | |
| *(nuevo)* streamRef / nvrChannel | string | — | Referencia técnica al NVR/VMS (no exponer). |

### Device
`{ id, name, kind: DeviceKind, zone, status: "Operativo"|"Batería baja"|"Sin conexión", locked?: bool (cerraduras), battery?: 0–100, lastSeen, firmware }`. `DeviceKind`: `Cerradura | Botón de pánico | Sensor de humo | Sensor de movimiento | Grabador (NVR)`.

### NvrStorage
`{ usedTb, totalTb, daysRecorded }` (telemetría del grabador).

### SecurityEvent
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| at | datetime | sí | Servidor. |
| zone | `Zone` | sí | |
| cameraId | id | no | La UI asigna la primera cámara de la zona al crear manualmente (`events.tsx`). |
| type | `EventType` | sí | `Movimiento fuera de horario \| Puerta forzada \| Puerta abierta \| Acceso no autorizado \| Aforo excedido \| Cámara sin señal \| Caja abierta sin venta \| Botón de pánico \| Marcado manual`. |
| severity | `Severity` | sí | `Crítica \| Alta \| Media \| Baja`. |
| status | `EventStatus` | sí | `Nuevo` al crear. |
| assignee | userId | no | Hoy nombre. |
| notes | `EventNote[]` | sí | `{ by, at, text }`, append-only, `by`/`at` del servidor. |
| resolvedAt | datetime | no | Al pasar a `Resuelto`/`Falsa alarma`. |

### AuditEntry
`{ id, at, user, role, action: AuditAction, cameraId, reason? }`. `AuditAction`: `Vio en vivo | Abrió grabación | Exportó clip | Desactivó privacidad`. Append-only; `user`, `role`, `at` del servidor.

### SecuritySettings (por clínica)
| Campo | Tipo | Descripción |
|---|---|---|
| retentionDays | `15 \| 30 \| 60 \| 90` | Retención de grabaciones. |
| privacyInBoxes | bool | Activa la regla de privacidad. |
| afterHoursFrom / afterHoursTo | `HH:mm` | Ventana "fuera de horario" (para eventos de movimiento). |
| autoArm | bool | Armado automático de alarma fuera de horario. |
| alarmArmed | bool | Estado actual de la alarma. |

## Reglas de negocio
1. **Privacidad de boxes**: una cámara con `roomId` está en privacidad si `settings.privacyInBoxes && room.status == "ocupado"`. Fuente: `src/lib/security-store.tsx:usePrivacy`, `src/domain/security.ts` regla 1. *(regla)* — **DEBE** aplicarse en el servidor al emitir el stream (no entregar video).
2. **Ver cámara**: requiere `seguridad.ver`; cámaras de zona `boxes` requieren además `seguridad.boxes`. Fuente: `src/components/security/camera-dialog.tsx` (`view: "locked"`). *(regla)*
3. **Forzar vista en privacidad**: exige motivo no vacío y registra `Desactivó privacidad` con el motivo; requiere `seguridad.boxes`. Fuente: `camera-dialog.tsx` (Guard `seguridad.boxes`, `disabled={!reason.trim()}`, `logAudit`). *(regla)* — backend: 422 sin motivo; la excepción vale solo para esa sesión de visualización.
4. **Grabaciones**: abrir y exportar requieren `seguridad.grabaciones`; no disponibles si la cámara está offline o bloqueada; cada acción se audita (`Abrió grabación`, `Exportó clip`). Fuente: `camera-dialog.tsx`, `events.tsx` (export de clip del evento). *(regla)* — **DEBE** auditar el servidor al servir el recurso (hoy el cliente llama `logAudit` voluntariamente). **Pregunta**: ¿grabaciones de un box ocupado en el momento grabado también requieren motivo? → `preguntas-abiertas.md#p-09`.
5. **"Vio en vivo"** nunca se registra en el prototipo. *(hallazgo)* → registrar al abrir stream de boxes (mínimo) o de toda cámara.
6. **Auditoría visible** solo con `seguridad.administrar`. Fuente: `devices.tsx` (`RequirePermission permission="seguridad.administrar"`). *(regla)*
7. **Eventos** siguen `Nuevo → En revisión → Resuelto | Falsa alarma`. Fuente: `src/domain/security.ts` regla 3. Asignar responsable a un evento `Nuevo` lo pasa a `En revisión` (`events.tsx`). `resolvedAt = ahora` al pasar a `Resuelto`/`Falsa alarma` (`mock/security.ts:updateEvent`). *(regla)* — **Hallazgo**: la UI ofrece un select con **todos** los estados (permite volver de `Resuelto` a `Nuevo`) y `resolvedAt` no se limpia al reabrir. Backend DEBE validar transiciones (ver `estados.md#evento-de-seguridad`).
8. **Evento abierto** = `Nuevo` o `En revisión` (`OPEN_EVENT`); genera tarea en Pendientes (Alta si severidad Crítica/Alta). Fuente: `src/lib/tasks.ts`. *(regla)*
9. **Marcar evento manual** desde una cámara: `Marcado manual`, severidad `Media`, nota "Marcado desde la vista de cámara". Fuente: `camera-dialog.tsx`. Crear evento manual desde Eventos con zona, tipo, severidad, nota. Fuente: `events.tsx`. *(regla)*
10. **Cerraduras**: `toggleLock` invierte `locked`; requiere `seguridad.administrar`. Fuente: `mock/security.ts:toggleLock`, `zones.tsx`, `devices.tsx`. *(regla)* — no aplica a dispositivos que no son `Cerradura` (validar: 409/400). Recomendado enviar estado deseado.
11. **Alarma**: `setAlarm(armed)`; requiere `seguridad.administrar`. Fuente: `monitoring.tsx`, `mock/security.ts:setAlarm`. *(regla)*
12. **Ajustes** (retención, privacidad, fuera de horario, auto-armado): requieren `seguridad.administrar`. Fuente: `devices.tsx` (`disabled={!admin}`). *(regla)* — desactivar `privacyInBoxes` debería auditarse (impacta privacidad de pacientes).
13. **Estado de cámara**: la UI permite "Reiniciar" (`→ En línea`) y "Mantención" con `seguridad.administrar`. Fuente: `devices.tsx`. *(regla)* — `Sin señal` debe provenir de telemetría, no del usuario; "Reiniciar" en producción es un comando al dispositivo, no un cambio de estado.
14. **Reportar cámara a soporte** desde la cámara/dispositivos usa `soporte.crear` (crea ticket). Fuente: `camera-dialog.tsx`, `devices.tsx`. *(regla)*
15. **Aforo** sala de espera `WAITING_CAPACITY = 12`; existe el tipo `Aforo excedido`. *(regla; generación automática no implementada)*.

## Estados
- SecurityEvent: `Nuevo → En revisión → Resuelto | Falsa alarma`.
- Camera: `En línea ↔ Mantención`; `Sin señal` por sistema.
- Device lock: `locked ↔ unlocked`; alarma `armada ↔ desarmada`.
Ver [`../estados.md`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `security.listCameras` | `GET /api/v1/security/cameras` | `?zone` | `Camera[]` (recomendado incluir `private: bool` calculado) | `seguridad.ver` | 403 | — |
| `security.setCameraStatus` | `PATCH /api/v1/security/cameras/:id` | `{ status }` | `Camera` | `seguridad.administrar` | 400 (`Sin señal` no asignable), 404 | Auditoría administrativa |
| `security.listDevices` | `GET /api/v1/security/devices` | — | `Device[]` | `seguridad.ver` | 403 | — |
| `security.toggleLock` | `POST /api/v1/security/devices/:id/toggle-lock` | — (recomendado `{ locked }`) | `Device` | `seguridad.administrar` | 404, 409 (no es cerradura / sin conexión) | Auditoría; comando al dispositivo |
| `security.getNvrStorage` | `GET /api/v1/security/nvr` | — | `NvrStorage` | `seguridad.ver` | 403 | — |
| `security.listEvents` | `GET /api/v1/security/events` | `?status&severity&zone&from&to` | `SecurityEvent[]` | `seguridad.ver` | 403 | — |
| `security.createEvent` | `POST /api/v1/security/events` | `{ zone, cameraId?, type, severity, note? }` | `SecurityEvent` | `seguridad.ver` (propuesto) | 400 | Evento `EventoSeguridadCreado`; si Crítica → notificación urgente |
| `security.updateEvent` | `PATCH /api/v1/security/events/:id` | `{ status?, assignee? }` | `SecurityEvent` | `seguridad.ver` (propuesto; ¿`seguridad.administrar` para cerrar?) | 404, 409 (transición) | `resolvedAt`; notificar al asignado |
| `security.addEventNote` | `POST /api/v1/security/events/:id/notes` | `{ text }` | `SecurityEvent` | `seguridad.ver` (propuesto) | 400 (vacío), 404 | — |
| `security.listAudit` | `GET /api/v1/security/audit` | `?cameraId&user&from&to&action` | `AuditEntry[]` | `seguridad.administrar` | 403 | — |
| `security.logAudit` | `POST /api/v1/security/audit` | `{ cameraId, action, reason? }` | `AuditEntry` | según acción: `seguridad.boxes` (`Desactivó privacidad`, `Vio en vivo` en boxes), `seguridad.grabaciones` (`Abrió grabación`, `Exportó clip`), `seguridad.ver` (`Vio en vivo`) | 403, 422 (motivo faltante) | **Recomendación**: reemplazar por auditoría generada al emitir stream/segmento/clip; mantener solo para registrar motivo |
| `security.getSettings` | `GET /api/v1/security/settings` | — | `SecuritySettings` | `seguridad.ver` | 403 | — |
| `security.updateSettings` | `PATCH /api/v1/security/settings` | `Partial<SecuritySettings>` (excluir `alarmArmed`) | `SecuritySettings` | `seguridad.administrar` | 400 (retención no permitida, horas inválidas) | Auditoría administrativa; cambio de retención afecta NVR |
| `security.setAlarm` | `PUT /api/v1/security/alarm` | `{ armed }` | `SecuritySettings` | `seguridad.administrar` | 403 | Auditoría; comando a central de alarma |

## Efectos en otros dominios
- Estado de boxes (agenda-y-atencion) determina privacidad de cámaras.
- Eventos abiertos → Pendientes.
- Reportar cámara → ticket de soporte.

## Datos de referencia / semilla
`ZONES` (con rutas), cámaras (`src/mocks/security.ts:seedCameras`, 15), dispositivos (8), NVR, eventos, auditoría y accesos semilla, ajustes por defecto (`seedSecuritySettings`).

## Notas para el dev
- No hay video real, ni integración con NVR, cerraduras, sensores ni central de alarma: todo es estado simulado (`#p-09`).
- Eventos automáticos (fuera de horario, puerta forzada, sin señal, aforo, caja sin venta, pánico) requieren ingesta desde dispositivos (`#p-09`).
- `security.updateSettings` permite hoy cambiar `alarmArmed` vía PATCH (es parte de `SecuritySettings`): restringir para que solo `setAlarm` lo haga.
