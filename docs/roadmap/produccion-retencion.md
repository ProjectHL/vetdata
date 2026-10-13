# T7-3 — Retención

Ejecutar `ops --kind retention --as-of 2026-10-11T00:00:00Z` contra una base autorizada. Herramienta read-only, snapshot consistente, timeout un minuto. No aplica migraciones ni escribe/borrra datos.

Política `retention-v1`: auditoría general cinco años calendario (p-19), candidatos estrictamente anteriores al corte UTC. La igualdad se conserva. Lecturas, consentimientos y clínica mantienen todos los registros hasta aprobar D-01/D-07. Video: treinta días por defecto según p-19; no hay repositorio real de grabaciones antes de Fase 8, por lo que no se simulan grabaciones inexistentes ni purga.

Salida JSON: versión, fecha evaluada, dryRun=true y categorías con total/candidatos/corte/motivo. Candidatos no son autorización de eliminación. Guardar el reporte en almacenamiento operativo restringido y resumir resultado en Markdown.

Los triggers inmutables permanecen vigentes. Un futuro mantenimiento deberá definir rol restringido, autorización de política, manejo de referencias, evidencia previa/posterior y tratamiento de backups. No desactivar triggers en la API. Cambio de plazo requiere decisión documentada y nueva versión de política; no se programa purga automática.
