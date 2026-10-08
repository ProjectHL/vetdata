# Fase 8 — Integraciones posteriores al MVP

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Añadir integraciones independientes con habilitación gradual y trazabilidad; el MVP sigue operando si una integración está deshabilitada.

**Dependencia:** Producción estabilizada; cada paquete exige selección/contrato del proveedor correspondiente.

**Estado inicial:** pendiente. Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T8-1 | p-08 | pendiente | Mensajería WhatsApp y plantillas sobre notifications; preferencias y opt-out. | Callbacks duplicados/fallidos y reintentos; plantilla/remitente autorizado y entrega verificada. |
| T8-2 | p-11 | pendiente | Pasarela/terminal, voucher, arqueo y devoluciones con conciliación. | No marcar pagado por respuesta del navegador; callbacks autenticados; doble notificación no duplica abono. |
| T8-3 | p-20 | pendiente | Elegir almacenamiento, carga de pdf/jpg/png hasta 10 MB, cuarentena y análisis AV; descarga autorizada. | Archivo falso, infectado o excesivo rechazado; acceso revocado impide nuevas descargas. |
| T8-4 | p-09 | pendiente | Proxy NVR/ONVIF/RTSP, URLs de corta duración, auditoría previa y privacidad; audio desactivado. | Enlace vencido, origen directo inaccesible, box privado y permiso insuficiente; dispositivos reales verificados. |
| T8-5 | p-13 | pendiente | Receta avanzada y controlados con proveedor/validación correspondiente; vincular prescripción y derivación. | Firma y vigencia verificables; no habilitar sin validación externa necesaria. |
| T8-6 | p-16, p-22, p-24 | pendiente | Catálogo diagnóstico seleccionado, equivalencias con texto existente, FEFO, extensiones de compras y listas de precios por convenio. | Diagnósticos previos conservados; selección de lotes por vencimiento y cantidades reconciliadas; recepción parcial existente no se reimplementa; precios de convenio resueltos en servidor. |

## Contratos e interfaces

- Adaptadores versionados y configuración por integración; documentar capacidades, credenciales, cuotas, costos y fallos esperados antes de habilitar.
- Webhooks autenticados, replay controlado y eventos idempotentes; recepción durable antes de confirmar al proveedor.
- Adjuntos heredan permiso/alcance de su recurso. No publicar objetos por conocer su identificador.
- Exponer estado de integración y pendientes de conciliación a operadores, sin mostrar credenciales.

## Migraciones, compatibilidad y recuperación

Tablas de referencias externas, eventos recibidos, conciliación y capacidades por clínica; preservar registros internos y correlacionarlos por claves estables. Migrar lotes/datos diagnósticos sin perder historial. Cada paquete lleva procedimiento de deshabilitación y recuperación independiente.

## Pruebas de fase

- Matriz por adaptador: éxito, timeout, indisponibilidad, duplicados, orden invertido, firma inválida y permisos revocados.
- Sandbox más prueba real controlada para acreditar integración; un mock no certifica proveedor.
- Reconciliación posterior a interrupción y rollback de configuración sin pérdida de operaciones.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Cerrar cada T8 por separado con proveedor y pruebas reales; la fase completa requiere todos sus paquetes validados. Diferir uno no equivale a darlo por terminado.

## Dependencias externas y decisiones de implementación

D-08 a D-12: selección, contratos, credenciales, dispositivos o licencias por paquete. Registrar responsable y evidencia sin inventar disponibilidad.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
