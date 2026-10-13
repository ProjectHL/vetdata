# Fase 7 — Preparación antes del VPS

Estado al 2026-10-13: preparación técnica local verificada. Este documento permite reunir las decisiones y accesos sin confundir el ensayo local con el cierre del piloto. No contiene credenciales ni aprueba políticas.

## Listo para trasladar

| Área | Preparación y evidencia |
|---|---|
| Aplicación | `infra/docker-compose.production.yml` configura Next.js en modo HTTP con URL de API relativa, API Go, PostgreSQL 17 privado y Caddy como único servicio con puertos publicados. `docker compose config --quiet` pasó; el JSON resuelto confirmó `ports=proxy`, `APP_ENV=production` y red de datos interna. Imágenes `api` y `web` compiladas con el Compose productivo. |
| Datos | Bootstrap transaccional sin semillas demo, migraciones, backup con manifiesto y checksum, restauración que rechaza base no vacía o dump corrupto. Suite PostgreSQL completa pasó el 2026-10-13. |
| Recuperación y acceso | Ensayo `verify-phase7.ps1` pasó el 2026-10-13 con fixtures: backup/restauración, reinicio de DB/API, Caddy con CA interna, web Next.js real, login por HTTPS y cookie segura. Cinco condiciones de alerta se detectaron en el ensayo. |
| Funciones sin datos de mockup | Tienda y farmacia leyeron y escribieron contra API/PostgreSQL desechables; recepción parcial, ajustes por lote y conflictos de stock verificados. Ver [evidencia](evidencia-fase-07.md). |
| Fiscal | Contrato y persistencia DTE preparados, sin adaptador ni emisión habilitada. Proveedor y certificación pasan a T8-7. |
| Privacidad | Exportación autenticada por clínica y simulaciones read-only de anonimización/retención. Las operaciones destructivas siguen deshabilitadas hasta aprobar D-01/D-07. |

## Información que debe quedar definida antes de activar el piloto

Registrar responsable, fecha y decisión en el [índice de decisiones](README.md#decisiones-y-dependencias-diferidas), sin pegar secretos en Git.

| Decisión | Datos concretos que faltan |
|---|---|
| D-06, operación | Proveedor y acceso administrativo al VPS; dominio y DNS; clínica(s) y módulos del piloto; responsables de despliegue, soporte y respuesta a incidentes; ventana de mantenimiento; objetivos RPO/RTO; frecuencia/destino cifrado de backups y prueba de recuperación; canal externo de alertas. |
| Correo transaccional | Remitente y servidor SMTP con STARTTLS, cuenta y secreto en gestor seguro; destinatarios de prueba; procedimiento para verificar entrega y fallos. |
| D-01, lecturas | Plazo exacto entre 2 y 3 años para auditoría de lecturas compartidas; tratamiento de evidencia de consentimiento y aprobación del responsable de privacidad. Hasta entonces no hay purga. |
| D-07, privacidad | Alcance por clínica y global de solicitudes del titular; verificación de identidad, responsable de autorización, plazo clínico aprobado, tratamiento de contacto, textos libres, adjuntos, auditorías, exportaciones y backups; contrato de encargado y procedimiento de atención. Hasta entonces no hay anonimización destructiva. |

El proveedor DTE, cuenta emisora y credenciales de certificación son D-05 de fase 8 y no condicionan el piloto sin DTE.

## Comprobaciones al disponer del VPS

Seguir [despliegue](produccion-despliegue.md) y [recuperación](produccion-recuperacion.md). Registrar commit, identificador RELEASE, digests, versiones, responsable, fecha, comandos y resultado en [validación](validacion.md).

1. Preparar secretos fuera de Git, validar permisos de lectura del UID 10001 y ejecutar `docker compose -f infra/docker-compose.production.yml config --quiet`. Confirmar firewall y que solo 80/443 sean públicos.
2. Arrancar y verificar DNS/TLS público, cookies seguras, API y web reales, login/2FA Admin, SMTP transaccional y ausencia de acceso público a PostgreSQL. La CA interna del ensayo no sustituye este paso.
3. Programar backup externo cifrado y alertas; provocar cada condición de alerta y confirmar recepción por el responsable. Restaurar en base nueva, medir tiempo y contrastar datos de usuarios, grants, stock y documentos con el backup.
4. Ensayar rollback con dos releases reales compatibles y documentar el tratamiento de migraciones. El build `pre-vps-check` no es un release del piloto.
5. Ejecutar el piloto en las clínicas y módulos acordados, registrar incidencias y obtener acta con alcance sin DTE. Solo entonces revisar el cierre de T7 y la subida de la rama con el responsable del proyecto.

## Límite del estado actual

No hay VPS/dominio, SMTP externo, destino de backups, canal de alertas, políticas D-01/D-07 aprobadas ni acta de piloto. La fase 7 permanece en curso; la evidencia local acredita preparación, no operación productiva.
