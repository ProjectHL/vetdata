# T7-4 — Backup y recuperación

## Backup

Ejecutar `docker compose -f infra/docker-compose.production.yml run --rm backup`. Produce en `infra/backups/<UTC>` un dump custom, versiones de migraciones, manifiesto de release y SHA256SUMS. Solo el marcador COMPLETE indica finalización. No hay borrado automático.

El dump contiene datos personales. Directorios restrictivos, disco cifrado y copia externa cifrada con acceso limitado son requisitos del operador (D-06); el checksum detecta corrupción, no sustituye autenticación ni cifrado. No almacenar claves de outbox o secretos dentro del dump. Conservar imágenes, configuración y claves en sus respectivos repositorios protegidos. Definir frecuencia, retención de backups y RPO/RTO antes de operar.

## Restauración

1. Crear un PostgreSQL 17 aislado y una base vacía; no reutilizar el volumen productivo.
2. Montar el backup como solo lectura y `infra/production` como `/ops`. Configurar PGHOST, PGDATABASE, PGUSER y PGPASSFILE/PGPASSWORD de la base destino; BACKUP_DIR apunta al directorio con COMPLETE.
3. Ejecutar `sh /ops/restore.sh`. Rechaza checksums incorrectos y destinos con tablas/vistas/secuencias. Restaura en transacción sin owner/ACL del origen. Usar el rol de aplicación destino como propietario.
4. Arrancar la imagen del RELEASE respaldado contra la copia, con salida SMTP deshabilitada o capturada en el ensayo y sin tráfico externo. Recuperar claves mediante el procedimiento autorizado.
5. Verificar migraciones, usuarios/membresías, grants, stock, documentos y saldo; probar login y lecturas. Registrar duración, conteos y resultado antes de conmutar tráfico.

La recuperación real necesita aprobación operativa del corte y tratamiento de operaciones posteriores al backup. El ensayo usa exclusivamente fixtures y nunca elimina datos de desarrollo o producción.
