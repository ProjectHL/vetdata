# Fase 7 — Chile y producción

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Habilitar un piloto verificable sin emisión DTE, con operación recuperable y políticas de datos aprobadas. La integración y certificación DTE se retoman en fase 8 por decisión del responsable del proyecto del 2026-10-12.

**Dependencia:** Fase 6 validada y proveedores/entorno de piloto disponibles.

**Estado actual (2026-10-13):** en curso. Preparación local implementada; suite PostgreSQL, ensayo aislado de recuperación/HTTPS/reinicio y 2FA local aprobados. Tienda y farmacia se recorrieron contra una API y base PostgreSQL desechables, incluidas escrituras y conflictos de stock. El cierre operativo sigue sujeto a D-01/D-06/D-07, infraestructura real y piloto. D-05 queda en fase 8. Ver [evidencia](evidencia-fase-07.md). Ningún paquete se considera completo por existir su código.

La [preparación previa al VPS](preparacion-vps-fase-07.md) enumera lo ya probado y los datos necesarios para activar el piloto.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T7-1 | p-12 | en curso | Contrato y migración DTE desacoplados, sin adaptador productivo. La selección, implementación con proveedor y certificación pasan a T8-7. | Pruebas locales de idempotencia/reconciliación; verificar que el piloto no habilita emisión DTE. No acredita certificación. |
| T7-2 | p-14 | en curso | Flujo manual autenticado de exportación/anonimización del dueño, evidencia y revisión de retención clínica/contrato encargado. | Exportación aislada; anonimización preserva registros que deban retenerse; validación de responsables antes de ejecutar. |
| T7-3 | p-07, p-19 | en curso | Configurar retenciones separadas: general cinco años, lecturas según D-01 y video treinta días predeterminado. | Dry-run con conteos verificables; sin borrado automático para categorías sin política aprobada. |
| T7-4 | p-00 | en curso | VPS/Compose con TLS, secretos, DB privada, backups, métricas/alertas y runbooks; piloto 1–2 clínicas. | Restauración en entorno limpio, reinicio y rollback de app demostrados; smoke test HTTPS y responsables operativos. |

## Contratos e interfaces

- Adaptador DTE desacoplado de factura interna: estado local, referencia de proveedor y reconciliación. Webhooks autenticados/idempotentes; timeouts no se resuelven emitiendo de nuevo a ciegas.
- Los tipos 61/52 quedan como extensión posterior documentada, sin simularlos como certificados en el piloto.
- Exponer públicamente solo los servicios necesarios detrás de TLS; DB con credenciales propias y acceso privado. Separar secretos, tenants y datos de prueba.
- Los plazos de p-14 son requisitos del proyecto a validar por responsables competentes; este roadmap no certifica cumplimiento normativo.

## Migraciones, compatibilidad y recuperación

Migraciones aditivas antes de desplegar app compatible; backup previo y restauración ensayada. No reutilizar vetdata/vetdata ni seeds de demo en producción. Registrar versiones de imágenes/migraciones, configuración y procedimiento de reversión; operaciones destructivas de retención requieren política aprobada.

## Pruebas de fase

- Contrato DTE local: rechazo, timeout, callback fuera de orden, duplicado y reconciliación posterior; certificación con proveedor en T8-7.
- Restaurar backup y verificar usuarios, grants, stock y documentos; medir recuperación y registrar objetivos acordados.
- TLS/cookies, healthchecks, alertas, secretos ausentes de logs e inaccesibilidad pública de DB.
- Piloto de dos clínicas con alcance de módulos habilitados explícito y canal de incidencias.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Restauración demostrada, validación de políticas y acta de piloto con alcance sin DTE explícito. El piloto debe impedir emitir DTE y no debe presentar facturación fiscal como funcionalidad disponible. La certificación del proveedor queda como gate de T8-7.

## Dependencias externas y decisiones de implementación

D-06 infraestructura/dominio/operación del piloto y D-01/D-07 políticas de retención y privacidad siguen pendientes. D-05 proveedor DTE/credenciales se difiere a T8-7; no inventar aprobación ni habilitar emisión mientras tanto.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
