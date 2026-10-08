# Fase 2 — Identidad y acceso entre clínicas

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Implementar el diferencial de red: el dueño autoriza el acceso y el servidor aplica su alcance en todas las lecturas.

**Dependencia:** Fase 1 validada.

**Estado inicial:** pendiente. Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T2-1 | p-01, p-10 | pendiente | Invitaciones con expiración, roles por clínica, lastAccess y protección del último administrador. Sustituir permisos antiguos por red.suspender restringido a Admin origen. | Intentos concurrentes de retirar el último administrador rechazados; invitaciones de un uso. |
| T2-2 | p-03, p-04 | pendiente | Completar relaciones dueño-clínica, pacientes, custodia e historial de lectura. Centralizar propio/compartido/ninguno en listas, detalle, búsqueda, agenda, boxes, tareas y analítica. | Ningún camino de lectura expone clínico ajeno sin acceso; se conservan documentos propios. |
| T2-3 | p-04 | pendiente | Proyección de resumen en servidor; tarjeta mínima sin contacto; límites y registro de búsquedas. | Resumen excluye consultas, exámenes y recetas incluso en respuestas JSON; búsqueda no enumera contactos. |
| T2-4 | p-05 | pendiente | Solicitud por mascota, correo al dueño, token hasheado de un uso de 72 h, cancelación, expiración, reenvío y renovación vinculada; aviso siete días antes. | Doble respuesta concurrente crea un solo grant; token vencido/reutilizado falla; renovación no amplía acceso por sí sola. |
| T2-5 | p-06 | pendiente | Dueño verifica RUT y aprueba/deniega con alcance igual o menor. Evidencia por grant y revocación de consentimiento. | Checkbox de clínica no autoriza; revocación corta lecturas y no borra evidencia. |
| T2-6 | p-10 | pendiente | Suspender/restablecer acceso por Admin origen con motivo, auditoría y aviso al dueño/receptora. | Vet o Admin de otra clínica recibe 403; restablecer no revive consentimiento revocado ni vigencia vencida. |
| T2-7 | p-07 | pendiente | Auditar lecturas compartidas; consulta por origen y dueño con autorización propia. | Auditoría persiste antes de entregar datos; evidencia aislada y sin token/RUT en logs generales. |
| T2-8 | p-23 | pendiente | GET /tasks calculado por servidor; asignación y estado por clínica; taskId codificado. | Fuentes disponibles producen tareas reales; permisos filtran bandeja; fuentes futuras se incorporan en fases 3/4. |
| T2-9 | p-25 | pendiente | Vincular doctor al alta de veterinario y controlar desactivación con citas futuras. | 409 con citas afectadas; reasignación/cancelación explícita previa a desactivar. |
| T2-10 | p-03 a p-07 | pendiente | Ejecutar escenario de dos clínicas con ficha compartida, consentimiento y vigencia real. | Prueba de extremo a extremo por API, con solicitudes, auditoría y pérdida inmediata de acceso. |

## Contratos e interfaces

- Contrato de red objetivo: [red-y-acceso](../backend/dominios/red-y-acceso.md). Añadir cancelación, reenvío, renovación vinculada, decisión del dueño y suspensión/restablecimiento.
- `RequestStatus`: Esperando dueño, Aprobada, Denegada, Expirada, Cancelada. `GrantStatus` incorpora Suspendido; solo Vigente permite compartir.
- `GET /api/v1/me` centraliza identidad. El dueño accede mediante credencial temporal verificada, independiente de la sesión de la clínica; un RUT por sí solo no autentica.
- Owner global por RUT con vínculo por clínica; separar saldos y notas operativas de cada tenant. Consentimiento y auditoría son entidades trazables, no un booleano global que habilite acceso.

## Migraciones, compatibilidad y recuperación

Añadir solicitudes, tokens, grants, consentimientos, vínculos y auditoría mediante nuevas migraciones. Eliminar concesiones de red.aprobar/red.revocar de matrices reales; conceder red.suspender únicamente al rol Admin según p-10. No convertir un checkbox o un grant demo en evidencia válida. Agregar datos de prueba de dos clínicas con consentimientos sintéticos identificables como fixtures.

## Pruebas de fase

- Todas las rutas de lectura bajo resumen, completo, sin acceso, vencido, suspendido y revocado.
- Token usado dos veces, vencido, cancelado, respuesta concurrente y fallo de correo con reintento.
- Revocación y suspensión invalidan acceso aunque el navegador conserve datos/caché; nuevas respuestas se filtran en servidor.
- Dueño y origen consultan auditoría autorizada; otra persona no puede usar RUT conocido para verla.
- Alta/desactivación y cambios simultáneos de administrador; la regla de agenda se repite con agenda real al cerrar Fase 3.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Dos clínicas comparten mediante autorización del dueño; proyección y auditoría comprobadas por API. La pantalla del enlace del dueño se conecta en Fase 5.

## Dependencias externas y decisiones de implementación

Elegir duración exacta de retención de lecturas antes de habilitar su purga (D-01). Contrato de acceso temporal del dueño y parámetros de reenvío se revisan en T2-4/T2-7; registrar en OpenAPI antes de implementar esos endpoints.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
