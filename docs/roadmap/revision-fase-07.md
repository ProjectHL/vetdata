# Revisión de Fase 7 — Chile y producción

> Revisión histórica anterior al cambio del 2026-10-12: proveedor, adaptador y certificación DTE se trasladaron a T8-7. Las referencias DTE de este inventario reflejan el plan original y no son gates del piloto de fase 7.

Fecha: 2026-10-11. Rama revisada: `review/fase-7-produccion`. Base: `33f2445`.

## Alcance y resultado

Revisión estática de código, migraciones, infraestructura y documentos de cierre. No se ejecutaron pruebas, despliegues, emisiones fiscales ni operaciones sobre datos. La evidencia de suites anteriores corresponde a sus documentos de cierre; no es una nueva validación.

La Fase 7 está pendiente. Existen fundamentos reutilizables, pero no hay evidencia de cierre de ninguno de sus cuatro paquetes. Esta revisión no modifica estados de aceptación en TAREAS.

| Paquete | Base disponible | Trabajo pendiente | Dependencia externa |
|---|---|---|---|
| T7-1 / p-12 | Facturas internas y pagos en `backend/internal/handler/billing.go` | Adaptador DTE, persistencia de estados y referencias, reconciliación, callbacks autenticados e idempotentes, pruebas de 39/33 | D-05: proveedor, credenciales y certificación |
| T7-2 / p-14 | Dueños globales, vínculos por clínica y auditoría | Inventario de datos personales y copias, autorización, exportación aislada, procedimiento manual de anonimización con evidencia | D-07: alcance y política aprobados |
| T7-3 / p-07 y p-19 | Auditoría inmutable y configuración de retención de seguridad | Políticas separadas, simulación de vencimientos y conteos; diseño compatible con inmutabilidad | D-01 y D-07: plazos y autorización de eliminación |
| T7-4 / p-00 | Compose local, healthchecks, migraciones y validaciones básicas de configuración | Compose de producción, TLS, secretos, DB privada, backups y restauración, alertas, rollback y piloto | D-06: VPS, dominio, responsables y RPO/RTO |

## Hallazgos que condicionan el piloto

1. **El Compose actual es de desarrollo.** `infra/docker-compose.yml` publica Postgres en 5435 y API en 4000, usa credenciales de desarrollo y construye el frontend en modo mock por defecto. Preparar un archivo separado de producción y verificar su configuración efectiva. `backend/internal/config/config.go` ya exige origen HTTPS, SMTP y clave de outbox con `APP_ENV=production`; esto no instala TLS ni reemplaza la configuración de despliegue.
2. **2FA necesita completar su recorrido de acceso.** `backend/internal/handler/auth.go` solo desafía a Admin si está enrolado; utiliza códigos de recuperación. La búsqueda de `mfa` y `twoFactorRequired` en `frontend/src` no encontró integración. El cierre de Fase 6 reconoce la limitación. Antes del piloto se debe validar enrolamiento, desafío, recuperación y acceso desde navegador, además del cumplimiento de p-01.
3. **La aceptación funcional del frontend sigue abierta.** `cierre-fase-05.md` declara pendientes la pasada manual de recarga, 21 métodos HTTP y consumo visual de carga/error. Verificar el estado actual de esos pendientes y ejecutar los recorridos que se habilitarán al piloto; compilar no demuestra su funcionamiento.
4. **Retención no equivale a borrar filas por fecha.** `003_foundations.sql` impide UPDATE/DELETE en `audit_events` mediante trigger. Diseñar el mantenimiento autorizado sin debilitar la inmutabilidad de la API. Mantener la simulación separada de cualquier ejecución destructiva; los plazos clínicos no están aprobados por este documento.
5. **Anonimización requiere considerar al dueño global.** `clinic_owners` vincula un dueño con varias clínicas. Una solicitud originada en una clínica no debe alterar datos compartidos globalmente sin el alcance y autorización correspondientes. Inventariar también snapshots, mensajes, auditorías y backups antes de definir el procedimiento.
6. **La documentación de infraestructura está desactualizada.** `infra/README.md` todavía documenta `http://api:4000` como URL del frontend y trata la integración de Fase 5 como futura. El Compose ya usa `http://localhost:4000` como valor público predeterminado. Corregirlo junto con el runbook de despliegue.

## Orden de ejecución propuesto

1. **T7-4, preparación local:** configuración de producción validable sin VPS, separación de secretos y datos, scripts de backup/restauración, ensayo sobre fixtures y runbooks Markdown. Registrar qué validaciones requieren dominio y host reales.
2. **T7-2 y T7-3, preparación:** mapa de datos, contratos de exportación y autorización, políticas versionadas y simulación de retención. Documentar decisiones pendientes; no activar anonimización o purga sin resolver su alcance.
3. **T7-1:** seleccionar proveedor antes de desarrollar su adaptador. Mantener explícita la diferencia entre factura interna y DTE. Probar timeout, duplicado, rechazo y reconciliación en su ambiente habilitado.
4. **Aceptación:** resolver los límites de acceso/frontend que afecten al piloto, ejecutar pruebas con dos clínicas, restauración, HTTPS y alertas; registrar certificación y acta del piloto.

Los paquetes se trabajan secuencialmente. Una dependencia externa bloquea únicamente su entrega dependiente; no permite declarar validada la fase.

## Decisiones para revisar con el desarrollador

- D-05: proveedor DTE y acceso a certificación para tipos 39/33.
- D-06: dominio/VPS, operación, destino y protección de backups, objetivos de recuperación.
- D-01: duración exacta de auditoría de lecturas y consentimiento.
- D-07: retención clínica, alcance de anonimización, copias y procedimiento de privacidad.
- Recorrido operativo de 2FA para Admin y módulos habilitados en el piloto.

Registrar respuestas, responsable y fecha en Markdown. Referencias: [Fase 7](fase-07.md), [registro de decisiones](README.md#decisiones-y-dependencias-diferidas), [pendientes del desarrollador](pendientes-dev.md) y [validación](validacion.md).
