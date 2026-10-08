# Preparación ejecutable de Fase 2

Fecha: 2026-10-08. Base: commit `29f5e3d`, publicado en `codex/backend-phases`. Dependencia de entrada: [cierre técnico de Fase 1](cierre-fase-01.md).

Estado: **en curso, preparación completada; cierre funcional pendiente**. Este documento procede de revisar handlers, migraciones, pruebas y el prototipo de tareas. No acredita implementación de los pendientes aquí enumerados. Autoridad: [DECISIONES](../DECISIONES.md), p-01 a p-07, p-10, p-23 y p-25.

## Inventario de partida

| Área | Base existente | Brecha que debe cerrarse |
|---|---|---|
| Usuarios/permisos | `settings.go`: invitaciones, aceptación, roles, lastAccess y guarda de Admin. | Probar cuenta nueva/existente, expiración y uso concurrente del token; dos administradores intentando retirarse permisos simultáneamente. |
| Desactivación de veterinario | `appointments_test.go`: 409 con citas afectadas; cancelación permite desactivar. | Cubrir reasignación, usuario en dos clínicas, creación automática de doctor y atención en curso. |
| Lectura clínica | `clinical.go`: acceso propio/compartido, proyección según grant, búsqueda mínima y auditoría. | Verificar `ficha.ver` en toda información clínica. Actualmente `full=false` conserva alergias, condiciones y vacunas; falta una prueba que descarte acceso clínico de un rol sin ese permiso. |
| Consentimiento | `sharing.go`: solicitud, correo, RUT, token 72 h, decisión, cancelación y reenvío. | Completar expiración, concurrencia, fallo de notificación y reenvío invalidando enlace anterior. |
| Renovación | `sharing_requests.previous_request_id` existe; handlers bloquean un grant aún vigente. | Falta endpoint de renovación y regla de coexistencia/sucesión; registrar decisión pendiente D-14 antes de activar renovaciones anticipadas. |
| Vencimiento | Comprobación de fechas en lecturas y estados derivados. | Falta aviso siete días antes; probar borde de fecha en Santiago y deduplicación/reintentos del job. |
| Revocación/suspensión | Sesión de dueño, revocación, Admin origen, motivo, restauración y outbox. | Matriz completa de roles, dueño ajeno, grant vencido y suspendido; coherencia cuando correo está deshabilitado/falla. |
| Auditoría | Registro inmutable de lecturas y consulta por origen/dueño. | Demostrar aislamiento de auditoría y rechazo de respuesta clínica si su auditoría falla; revisar exposición en listas y derivados. |
| Tareas | Tabla `task_meta`; prototipo `frontend/src/lib/tasks.ts`. | Faltan handlers y cálculo servidor. El prototipo aún usa `red.aprobar` y solicitudes respondidas por clínica; adaptar a consentimiento del dueño según p-05. |

Pruebas existentes que se reutilizan: `TestOwnerConsentProjectionSuspensionAndRevocation`, `TestDeactivateVetReturnsAppointments`, `auth_test.go`, `sharing_test.go`, `foundations_test.go`. La suite de Fase 1 sigue siendo un gate de regresión.

## Orden de ejecución

### Paquete 2A — Usuarios, roles y desactivación · T2-1/T2-9

1. Documentar en OpenAPI los endpoints de usuarios/invitaciones y permisos ya implementados, incluidos datos requeridos y expiración.
2. Añadir pruebas de invitado nuevo y cuenta existente: aceptación no cambia la contraseña de una cuenta existente y solo habilita la membresía invitada.
3. Resolver cualquier fallo de consumo único/expiración y ejecutar cambios concurrentes de administradores.
4. Probar creación del doctor una sola vez, citas futuras y en curso, cancelación/reasignación explícitas y aislamiento de membresías.

**Salida:** pruebas aprobadas por API, credenciales y roles efectivos por clínica, sin pérdida del último administrador. Primer paquete a implementar; sin dependencia de D-14.

### Paquete 2B — Acceso uniforme y proyección · T2-2/T2-3

1. Elaborar matriz ruta × permiso × relación con paciente: detalle, listas, búsqueda, pacientes por dueño, agenda y boxes.
2. Aplicar `ficha.ver` y alcance en todas las respuestas clínicas, también cuando existe grant completo. La búsqueda mínima conserva su permiso `red.solicitar` y solo incluye los campos de p-04.
3. Verificar que después de perder un grant se conserven citas/facturas propias y se excluya información clínica ajena añadida a esas respuestas.
4. Resolver el vínculo dueño-clínica sin convertir el conocimiento de un RUT en autenticación ni revelar contactos de otro tenant. Los identificadores del dueño son globales; saldos y notas siguen aislados.

**Salida:** ninguna ruta probada permite ampliar permisos mediante un grant, parámetro cliente, listado o consulta indirecta.

### Paquete 2C — Solicitudes y consentimiento · T2-4/T2-5

1. Probar solicitud única pendiente por mascota/receptora, rechazo de ficha propia y token de 72 horas.
2. Probar aprobación/denegación, RUT incorrecto, reducción de alcance, intento de ampliación y respuestas simultáneas.
3. Verificar cancelación y reenvío: token anterior inválido y plazo original conservado conforme al contrato actual; documentar límite de reenvíos.
4. Cubrir outbox y reintentos. Comprobar que cada transición conserva la intención de notificar; no considerar una notificación entregada solo porque está encolada.
5. Implementar renovación vinculada y aviso de siete días. La activación anticipada depende de D-14; mientras esté pendiente, su subpaquete permanece bloqueado y los demás continúan.

**Salida:** un token produce como máximo una decisión y un grant; no se amplía una vigencia por reenviar o solicitar renovación. Renovación requiere nuevo consentimiento.

### Paquete 2D — Revocación, suspensión y auditoría · T2-6/T2-7

1. Probar sesión independiente de dueño y rechazo de acceso con RUT solamente, token usado o dueño ajeno.
2. Probar suspensión/restauración por Admin de origen con motivo y notificaciones al dueño/receptora.
3. Revocar, vencer o suspender durante solicitudes concurrentes de lectura: después de confirmar la transición no debe iniciarse una lectura autorizada con ese grant.
4. Verificar auditoría previa a entregar datos, inmutabilidad y consultas del dueño/origen aisladas.

**Salida:** restaurar una suspensión no revive un consentimiento revocado ni un grant vencido. Las lecturas ya entregadas no pueden retirarse del navegador; las nuevas respuestas vuelven a verificar acceso. Retención sin purga automática, pendiente D-01.

### Paquete 2E — Bandeja calculada en servidor · T2-8

1. Definir DTO: `id`, `channel`, `title`, `detail`, `priority`, `since`, `href`, `permission`, `meta`. Las acciones rápidas se representan mediante identificadores de acción; el servidor no entrega funciones JavaScript.
2. Añadir `GET /api/v1/tasks`, `PUT /api/v1/tasks/{taskId}/assignee` y `PUT /api/v1/tasks/{taskId}/done`. El contrato actual también tiene `GET /api/v1/tasks/meta`: mantenerlo como vista autorizada de la misma metadata y documentar los cuerpos `{assignee: UUID|null}` / `{done: boolean}` antes de implementarlos. Los recordatorios de vacunas presentes en ese servicio requieren reconciliación con p-08 (recordatorio de citas en el slice MVP), sin habilitar envío por copiar el mock.
3. Calcular fuentes realmente disponibles: seguimiento de solicitud al dueño y accesos por vencer; integrar las fuentes operativas adelantadas solo si sus datos y permisos están verificados. Documentar explícitamente qué fuentes requieren fases 3/4.
4. Sustituir el concepto de “aprobar solicitud como clínica” por seguimiento del consentimiento. Conservar IDs estables `fuente:UUID` y codificación URL de `:`.
5. Validar que asignado pertenece a la clínica y sigue activo, tarea existe y es visible para el actor; cambiar `done` no ejecuta la operación de negocio subyacente.

**Salida:** respuesta filtrada por clínica, rol y acceso vigente; cerrar/asignar una tarea no modifica otra clínica ni revela información ajena. Ningún resultado depende de mocks o de TODAY fijo.

### Paquete 2F — Aceptación integral y entrega · T2-10

1. Fixture con dos clínicas de grupos distintos, Admin/Vet/Recepción/Farmacia y dueño autenticado por correo local.
2. Solicitud B → correo → consentimiento reducido → lectura resumida → auditoría → suspensión/restauración → revocación y denegación de nuevas lecturas.
3. Segundo escenario de acceso completo, vencimiento y renovación según regla revisada; pruebas adversarias de tokens y carreras.
4. Ejecutar suite Postgres y escenario Docker/SMTP; registrar resultados, revisión y commit en `cierre-fase-02.md` únicamente cuando pasen todos los gates.
5. Marcar T2 completas con evidencia; commit y push a la rama de trabajo para el siguiente pull.

## Matriz mínima de aceptación

| Caso | Resultado exigido |
|---|---|
| Credencial ausente/expirada | 401, sin datos del recurso. |
| Rol sin permiso en su clínica | 403; los grants no añaden permisos al rol. |
| Recurso de otro tenant fuera del alcance | 404 para evitar confirmar existencia; se documenta por endpoint. |
| Sin grant en búsqueda permitida | Solo tarjeta mínima de p-04, sin contactos ni clínico. |
| Grant resumen + permiso clínico | Alergias, crónicas y vacunas; consultas, exámenes y recetas ausentes incluso del JSON. |
| Grant completo + permiso clínico | Campos del contrato completo; lectura auditada. |
| Grant revocado, suspendido o vencido | Sin nuevas lecturas clínicas compartidas. |
| Token inválido/RUT erróneo | Error genérico sin revelar dueño ni token. |
| Token ya usado/cancelado/vencido | Sin nuevo grant ni notificación duplicada por transición. |
| Dos aprobaciones simultáneas | Una sola transición y grant; segunda operación rechazada. |
| Renovación pendiente | Grant anterior mantiene únicamente sus propias condiciones. |
| Dos jobs de vencimiento | Una intención de notificación por grant/hito en outbox. |
| Fallo al insertar auditoría | No se entrega la respuesta clínica compartida. |
| Asignar tarea ajena/invisible | Rechazado; no se crea metadata huérfana aprovechable para enumeración. |

## Migraciones y contratos

- 001–005 ya publicadas: no reescribirlas. Cualquier cambio de esquema irá en 006 o posterior.
- Reutilizar `previous_request_id`, `task_meta`, `notification_outbox` y auditorías; añadir índices/restricciones solo ante una consulta/invariante concreta.
- Jobs con reloj inyectable y deduplicación transaccional; conservar payload cifrado del correo.
- Extender OpenAPI en un documento `.md` para Fase 2 antes de nuevas rutas; mantener separados contrato implementado y propuesta.
- Probar actualización desde la revisión de Fase 1 con datos y base vacía. Rollback por fallo no elimina evidencia ni consentimientos previos.

## Pendientes del desarrollador

Consultar [pendientes-dev.md](pendientes-dev.md). D-01 bloquea purga, no auditoría. D-02/D-03/D-04 corresponden a fases posteriores. D-14 afecta únicamente la activación de renovaciones anticipadas; la fase no se declarará cerrada si ese subpaquete sigue sin regla/prueba.

No se inicia integración frontend, 2FA, DTE ni proveedores de producción en esta preparación. No se fijan fechas ni estimaciones sin capacidad acordada.
