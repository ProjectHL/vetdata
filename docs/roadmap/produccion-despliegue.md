# T7-4 — Despliegue y operación

Estado: preparación; VPS/dominio y operación real pendientes D-06. Compose: `infra/docker-compose.production.yml`, proyecto `vetdata-production`. Nunca combinarlo con el Compose de desarrollo.

La [lista previa al VPS](preparacion-vps-fase-07.md) reúne la preparación verificada, las decisiones pendientes y los controles que se ejecutan al disponer del servidor.

## Preparación

1. En VPS Linux instalar Docker Engine/Compose. Reservar la subred 172.30.77.0/24 o cambiar conjuntamente subred, IP del proxy y TRUSTED_PROXY_CIDRS. Firewall: solo 80/443 públicos y acceso administrativo restringido por operación.
2. Crear `infra/secrets` con permisos restrictivos. Archivos: `db_password`, `database_url` (URL PostgreSQL para vetdata en db:5432, password URL-encoded), `smtp_password` y `outbox_key` (32 bytes aleatorios en base64). Sin valores en Git; UID 10001 debe poder leer los secretos de API. Respaldar claves por canal separado del dump.
3. Exportar RELEASE (identificador único de entrega), DOMAIN, SMTP_ADDR, SMTP_FROM y SMTP_USER. SMTP debe ofrecer STARTTLS. No usar credenciales demo.
4. Revisar configuración con `docker compose -f infra/docker-compose.production.yml config --quiet`; construir con `build`. Conservar las imágenes y sus digests para rollback. No reutilizar un RELEASE para otra compilación.
5. Iniciar DB con `up -d db`. Para instalación nueva definir BOOTSTRAP_GROUP_ID/GROUP_NAME, CLINIC_ID/CLINIC_NAME, SECTOR, ADDRESS, PHONE, LEGAL_NAME, RUT, NAME y EMAIL (todos con prefijo BOOTSTRAP_). IDs UUID estables, RUT válido. Ejecutar `run --rm -T setup --admin`, suministrando password por stdin desde el gestor de secretos, nunca en argumentos o historial. Crea grupo/clínica/Admin en transacción; una repetición no cambia credenciales existentes.
6. Ejecutar `up -d api web proxy`. DNS del dominio debe apuntar al VPS para certificados. Frontend usa modo HTTP y rutas relativas; `/api/*` va a Go, resto a Next. Solo proxy publica puertos. No exponer `api:4000` como URL de navegador.

## Operación y alertas

Health de DB/API/web en Compose. `production/check.sh` verifica API, backup reciente con checksum íntegro, espacio y outbox con tres o más fallos. Ejecutar dentro de red privada con psql, wget y credenciales por archivo/PGPASSFILE; registrar salida y exit code en el scheduler del host. Valores iniciales para ensayo: backup máximo 1500 minutos y disco 85%; no constituyen RPO/RTO aprobados. Programación y canal externo de alertas requieren D-06. Probar fallo de cada comprobación antes del piloto.

Ejecutar comprobaciones con `docker compose -f infra/docker-compose.production.yml run --rm check`. Ejecutar simulaciones con `run --rm ops --kind retention --as-of 2026-10-11T00:00:00Z` usando el mismo archivo Compose.

No registrar secretos, cuerpos de consentimiento ni exportaciones en logs. El proxy sobrescribe X-Forwarded-For; API solo confía en su IP exacta. No configurar rangos públicos como proxies confiables.

## Actualización y rollback

Hacer backup y verificarlo antes de actualizar. Registrar commit, RELEASE, digests, versión PostgreSQL y migraciones. La API aplica migraciones al arrancar; detener escrituras durante la ventana de actualización. Volver a las imágenes anteriores solo cuando sean compatibles con el esquema actual. Si no lo son, usar recuperación en base nueva y acordar el corte; nunca ejecutar migraciones hacia atrás a ciegas.

Piloto bloqueado hasta validar SMTP real, TLS, acceso/2FA desde navegador, alertas, backup externo, responsables y módulos habilitados. El Compose no certifica estos controles por existir.
