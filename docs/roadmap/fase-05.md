# Fase 5 — Integración frontend

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Sustituir el estado demo por datos persistidos y conectar los flujos de la interfaz, incluido el enlace del dueño.

**Dependencia:** Fases 1–4 validadas por API y contratos aprobados.

**Estado inicial:** pendiente. Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T5-1 | p-01, p-02 | pendiente | Reconciliar contratos TypeScript y clientes HTTP con APIs reales; cookies, permisos y contexto de sesión. | Inventario completo de operaciones implementadas/sustituidas; sin NotImplementedError en rutas habilitadas. |
| T5-2 | T5-2 | pendiente | Hidratar cuatro stores desde servidor con carga, error y reintento; login, logout y cambio de clínica. | Recarga conserva estado; cambio de clínica limpia datos/caché del tenant anterior. |
| T5-3 | p-21, p-23 | pendiente | Reemplazar lookups y métricas sobre semillas por estado servidor y consultas autorizadas. | Pantallas, búsqueda, tareas y analítica no muestran datos de mocks en modo HTTP. |
| T5-4 | T1-8 | pendiente | Esperar respuestas canónicas, reconciliar ids/folios, Idempotency-Key y errores visibles. | No navegar a ticket con id temporal; errores revierten estado optimista o recargan recurso. |
| T5-5 | p-01, p-15 | pendiente | Fechas reales sin errores de hidratación; sesión y permisos desde /me; retirar Ver como del modo real. | Navegación y roles sobreviven recarga; fechas civiles y hora local correctas. |
| T5-6 | p-05, p-06 | pendiente | Adaptar red al dueño: enlace, decisión, cancelación, renovación y suspensión. Verificar persistencia de todos los flujos habilitados. | E2E en navegador; recarga conserva datos; no existe aprobación por clínica ni consentimiento ajeno por checkbox. |

## Contratos e interfaces

- Consultar guías instaladas en `frontend/node_modules/next/dist/docs/` antes de cambiar código Next.js.
- La URL pública de API debe ser accesible desde navegador; `http://api:4000` solo es nombre interno Compose. Documentar configuración de origen/cookies y probar local más despliegue HTTPS.
- Elegir DTO de API como contrato y adaptar tipos/servicios/mocks/componentes juntos. No publicar endpoints antiguos de aprobación de clínica para conservar el demo.
- La página del dueño usa credencial limitada al flujo correspondiente, sin exigir cuenta de personal de clínica ni exponer tokens en logs/analítica.
- Mantener modo mock solo como demo explícita; el modo HTTP no puede recuperarse de un error mostrando semillas.

## Migraciones, compatibilidad y recuperación

No resetear la base al integrar. Cambios incompatibles de DTO se documentan y coordinan entre API y web; reconstruir imagen para NEXT_PUBLIC_* porque se incorporan al build. Conservar fixtures para pruebas, sin importarlos en rutas de producción.

## Pruebas de fase

- E2E de sesión, dueño que autoriza, acceso resumido/completo, agenda, dispensación, compra parcial, abono, POS y soporte.
- Red lenta/fallida, 401/403/409, recarga durante mutación, doble clic y reintento.
- Cierre/cambio de sesión no deja datos de otro tenant visibles. Revisar JSON recibido, no solo UI oculta.
- Build/lint frontend y errores de hidratación; rutas y recursos canónicos después de navegación.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Modo HTTP persistente y flujos habilitados sin semillas ni simulación. Pantallas reflejan errores y alcance real.

## Dependencias externas y decisiones de implementación

API o DTO faltante bloquea el flujo correspondiente; no se cierra con mocks. Origen público y configuración de cookies deben validarse en ambiente de integración.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
