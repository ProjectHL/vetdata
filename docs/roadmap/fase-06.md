# Fase 6 — Endurecimiento

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Cerrar los riesgos de concurrencia, autorización y seguridad antes del piloto.

**Dependencia:** Fase 5 validada.

**Estado:** validada técnicamente. Evidencia en [cierre-fase-06.md](cierre-fase-06.md).

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T6-1 | T6-1 | validada | Consolidar las doce operaciones atómicas de transversales y las añadidas por consentimiento/pagos/recepciones. | Fallo inyectado en cada efecto deja rollback completo; pruebas concurrentes aprobadas. |
| T6-2 | T6-2 | validada | PATCH con lista blanca, transiciones 409, estado deseado en toggles y errores explícitos. | Campos actor/tenant/totales no controlables; no-op no se presenta como éxito. |
| T6-3 | p-01, p-07, p-19 | validada | 2FA para Admin/cámaras; recuperación, revocación y auditoría de acciones protegidas. | Sin segundo factor no se accede; recuperación no permite saltar el control ni dejar al último Admin bloqueado. |
| T6-4 | p-02, p-04, p-10 | validada | Suite de aislamiento, red, permisos, stock y protección del administrador sobre DB real. | Dos tenants/grupos y todos los roles; pruebas sobre listas, detalle, búsqueda, tareas y analítica. |
| T6-5 | T6-5 | validada | Revisar defectos y cerrar gate de producción. | Suite verde; cero defectos abiertos de filtración, doble operación, stock negativo o escalamiento. |

## Contratos e interfaces

- 2FA agrega enrolamiento, desafío y recuperación con códigos de un uso; documentar política antes de exponer rutas.
- Hacer inventario de todos los endpoints, permisos, límites y campos editables. Las comprobaciones se ejecutan en servidor aun si el frontend oculta botones.
- La auditoría debe excluir contraseñas, cookies y tokens. Las exportaciones se autorizan como las lecturas que originan los datos.

## Migraciones, compatibilidad y recuperación

Añadir credenciales 2FA y recovery sin valores demo; conservar sesiones existentes solo según política documentada de reenrolamiento. Probar despliegue/reversión de aplicación compatible con migraciones aditivas; no recomendar down destructivo para recuperar un deploy.

## Pruebas de fase

- Repetición y concurrencia de todos los POST sensibles; key distinta/mismo contenido y misma key/contenido distinto.
- Expiración/revocación mientras se consulta un recurso; eliminación de permisos durante sesión.
- Campos inesperados en PATCH y payloads inválidos; pruebas de origen/CSRF, limitación y errores sin secretos.
- Pruebas E2E tras reiniciar servicios y restaurar snapshot de prueba.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Controles críticos aprobados con evidencia reproducible. No sustituir esta suite por una compilación satisfactoria.

## Dependencias externas y decisiones de implementación

Defectos de las categorías críticas bloquean Fase 7. Política 2FA/recuperación debe registrarse antes de cerrar T6-3.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
