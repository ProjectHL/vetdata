# Fase 7 — Chile y producción

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Habilitar un piloto verificable con DTE, operación recuperable y políticas de datos aprobadas.

**Dependencia:** Fase 6 validada y proveedores/entorno de piloto disponibles.

**Estado inicial:** pendiente. Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T7-1 | p-12 | pendiente | Seleccionar proveedor DTE; tipos 39/33, identificadores/folio/PDF/estado, reconciliación y anulaciones según capacidades autorizadas. | Certificación/sandbox aprobados; reintento y callback duplicado no emiten dos documentos. |
| T7-2 | p-14 | pendiente | Flujo manual autenticado de exportación/anonimización del dueño, evidencia y revisión de retención clínica/contrato encargado. | Exportación aislada; anonimización preserva registros que deban retenerse; validación de responsables antes de ejecutar. |
| T7-3 | p-07, p-19 | pendiente | Configurar retenciones separadas: general cinco años, lecturas según D-01 y video treinta días predeterminado. | Dry-run con conteos verificables; sin borrado automático para categorías sin política aprobada. |
| T7-4 | p-00 | pendiente | VPS/Compose con TLS, secretos, DB privada, backups, métricas/alertas y runbooks; piloto 1–2 clínicas. | Restauración en entorno limpio, reinicio y rollback de app demostrados; smoke test HTTPS y responsables operativos. |

## Contratos e interfaces

- Adaptador DTE desacoplado de factura interna: estado local, referencia de proveedor y reconciliación. Webhooks autenticados/idempotentes; timeouts no se resuelven emitiendo de nuevo a ciegas.
- Los tipos 61/52 quedan como extensión posterior documentada, sin simularlos como certificados en el piloto.
- Exponer públicamente solo los servicios necesarios detrás de TLS; DB con credenciales propias y acceso privado. Separar secretos, tenants y datos de prueba.
- Los plazos de p-14 son requisitos del proyecto a validar por responsables competentes; este roadmap no certifica cumplimiento normativo.

## Migraciones, compatibilidad y recuperación

Migraciones aditivas antes de desplegar app compatible; backup previo y restauración ensayada. No reutilizar vetdata/vetdata ni seeds de demo en producción. Registrar versiones de imágenes/migraciones, configuración y procedimiento de reversión; operaciones destructivas de retención requieren política aprobada.

## Pruebas de fase

- DTE rechazado, timeout, callback fuera de orden, duplicado y reconciliación posterior.
- Restaurar backup y verificar usuarios, grants, stock y documentos; medir recuperación y registrar objetivos acordados.
- TLS/cookies, healthchecks, alertas, secretos ausentes de logs e inaccesibilidad pública de DB.
- Piloto de dos clínicas con alcance de módulos habilitados explícito y canal de incidencias.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Certificación del proveedor, restauración demostrada, validación de políticas y acta de piloto. Credenciales ausentes o certificación pendiente mantienen el paquete bloqueado.

## Dependencias externas y decisiones de implementación

D-05 proveedor DTE/credenciales y D-06 infraestructura/dominio/operación del piloto. D-01/D-07 políticas de retención y privacidad; solo bloquear operaciones dependientes, sin inventar aprobación.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
