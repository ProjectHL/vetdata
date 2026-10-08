# Fase 4 — Tienda, seguridad, soporte y analítica

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Completar dominios operativos y agregación de red con autorización, auditoría y privacidad en servidor.

**Dependencia:** Fase 3 validada.

**Estado inicial:** pendiente. Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T4-1 | p-16, p-17, p-24 | pendiente | POS, stock central/sala, transferencias, compras y despachos; reutilizar recepciones y costos reales. | Venta concurrente no produce stock negativo; checkout crea venta/movimientos/despacho juntos. |
| T4-2 | p-19, p-26 | pendiente | Eventos: ver/anotar con seguridad.ver, cerrar con seguridad.administrar; cierre inmutable y auditoría servidor. | No se edita/reabre evento cerrado; caso nuevo vinculado; auditoría no depende de un POST del navegador. |
| T4-3 | p-18 | pendiente | Tickets, ideas/votos, releases y admin VetData fuera de tenant; SLA en horas corridas. | Clínica no se hace pasar por Staff; idea y ticket se crean juntos; transiciones autorizadas. |
| T4-4 | p-21 | pendiente | KPIs servidor, agregados diarios por sector del dueño, k≥5, participación predeterminada anónima y opt-out. | Cortes menores a cinco no se publican; respuestas no llevan fichas/contactos ajenos; exclusión comprobable. |
| T4-5 | p-10 | pendiente | Evaluar roles personalizados y documentar decisión; mantener cuatro fijos en MVP. | Acta de evaluación; si se difiere, no incluirlo como funcionalidad faltante del MVP. |
| T4-6 | T4-6 | pendiente | Verificar cobertura de los diez dominios y operaciones autorizadas. | Matriz de rutas, roles, errores y pruebas por dominio completada. |

## Contratos e interfaces

- Mantener rutas de tienda/soporte del inventario salvo cambios documentados; operaciones toggle envían estado deseado y devuelven estado canónico.
- Administración VetData tiene autorización separada de Admin de clínica. Ningún parámetro de cliente convierte una sesión de clínica en Staff.
- `POST /security/audit` del prototipo se retira del contrato objetivo: la acción autorizada produce su propio registro.
- Analítica recibe filtros acotados y devuelve agregados precomputados; los cortes permitidos deben impedir reconstrucción mediante diferencias (D-04).
- Video permanece simulado: no afirmar grabación, exportación o control real de dispositivos hasta Fase 8.

## Migraciones, compatibilidad y recuperación

Agregar ventas, movimientos por ubicación, despachos, eventos/notas, tickets/mensajes, ideas/votos, releases, auditoría general y agregados diarios. Auditoría append-only con credenciales de aplicación sin edición/borrado; política de retención administrada aparte. Indexar filtros por tenant y ventana temporal.

## Pruebas de fase

- Dos ventas de la última unidad; transferencia sin saldo; recepción repetida; fallo al crear despacho.
- Eventos cerrados inmutables, permisos de cierre y anotación; Staff sin escalamiento desde tenant.
- SLA alrededor de fines de semana: horas corridas, sin simulación de respuesta.
- Agregados de 4 y 5 fichas, opt-out, filtros superpuestos y sector; no publicar datos identificables.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Diez dominios cubiertos por API y permisos; stock consistente; eventos inmutables; agregados y aislamiento revisados.

## Dependencias externas y decisiones de implementación

D-04: fórmula exacta de cobertura y cortes publicables antes de T4-4. Roles personalizados se evalúan aquí, pero no bloquean el MVP si se mantienen los cuatro roles.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
