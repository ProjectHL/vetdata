# Cierre técnico de Fase 1

Fecha: 2026-10-08. Rama: `codex/backend-phases`.

## Alcance

Validación de las fundaciones mediante API, Postgres e imagen Docker. La integración de pantallas permanece en Fase 5. El código adelantado de fases 2–3 se conserva sin declarar cerradas esas fases.

Correo seleccionado para desarrollo: SMTP estándar con Mailpit como buzón local. Se verifican transporte, entrega al buzón, consumo del enlace y cambio de contraseña mediante API. El proveedor/remitente público y su entregabilidad requieren credenciales del despliegue; no están acreditados ni se han enviado mensajes a destinatarios externos. Esta evidencia permite la entrega de desarrollo para `git pull`, no habilita producción.

## Matriz T1

| Tarea | Estado técnico | Evidencia verificable |
|---|---|---|
| T1-1 | validada | Migraciones 001/002 conservadas; 003–005 incrementales; DDL + ledger + lock en transacción. Pruebas `TestConcurrentMigrationsAndUpgrade` con datos previos, `TestMigrationFailureRollsBackDDLAndLedger`, `TestCompleteSeedsReapply`. Seeds: 8 grupos/clínicas, 12 dueños, 19 pacientes, usuarios/settings/horarios. Setup de administrador sin contraseña por defecto ni reseteo al repetir. |
| T1-2 | validada | Login, cookies httpOnly/Secure en producción/SameSite Lax, access 15 min, sesión absoluta 30 días, refresh rotativo y revocación por replay, logout, recovery 30 min y `/me`. `auth_test.go`, `TestPhaseOneSessionLifecycle`, `TestRecoveryExpiryEnumerationAndRateLimit`, `TestDockerInstallationAndSMTPRecovery`. |
| T1-3 | validada | Tenant desde sesión; pertenencia activa y rol comprobados. `TestPhaseOneSessionLifecycle`: mismo usuario Admin en una clínica y Farmacia en otra; query clinicId no cambia contexto, permisos no se trasladan, cookie anterior queda inválida. Fixtures con grupos distintos. |
| T1-4 | validada | [OpenAPI en Markdown](../backend/openapi-fase1.md), JSON estricto, errores estructurados, paginación acotada, filtros de catálogos base y recursos ajenos. `TestFoundationsRUTProfileFilteringAndIdempotency`, pruebas de origen/JSON y aislamiento. Filtros de módulos posteriores se completan con cada módulo. |
| T1-5 | validada | RUT módulo 11 en dueño/proveedor/perfil, normalización y unicidad de dueño. `TestRUT`, prueba de duplicado normalizado 409, perfil con DV inválido 400; todos los RUT de seeds verificados. |
| T1-6 | validada | `domain.Totals`, `MoneyFromNet`, `DiscountedLine`: enteros CLP, constante única de IVA, límites de overflow y desglose net/vat/total/ivaIncluded. `TestMoney` cubre redondeo y entradas inválidas. Emisión de facturas/boletas se conecta en Fases 3/4; DTE en Fase 7. |
| T1-7 | validada | Reloj de negocio inyectable por solicitud, TZ America/Santiago en pool, instantes ISO y fechas civiles. `TestCivilDatesAcrossDST` y `TestHealthUnavailableAndBusinessClock`. La validez de credenciales usa reloj de DB, no valores del cliente. Constantes demo frontend se retiran en Fase 5. |
| T1-8 | validada | UUID servidor, correlativos por clínica transaccionales y clave de idempotencia por actor/clínica/método/ruta/cuerpo. `TestCorrelativesConcurrentAndRollback`, reintentos concurrentes de perfil, recepción sin doble movimiento y respuesta canónica de dueño. |
| T1-9 | validada | `scripts/check.sh`: gofmt + go vet + tests, Postgres obligatorio en gate. Workflow GitHub con suite y prueba de imagen/SMTP; health 503 si DB no disponible. CI local equivalente ejecutado; ejecución remota de GitHub se observa después del push. Logs de error no imprimen detalles de consultas ni secretos; X-Request-ID. |
| T1-10 | validada | Horarios clínica/profesional, feriados, duración configurable, disponibilidad consultable y urgencia explícita. `TestSchedulesConcurrentBookingAndTenant`, `TestWaitingRoomLifecycle`: restricción profesional/feriado, conflicto concurrente y urgencia de hoy. |

## Comandos de aceptación

Desde la raíz:

```powershell
docker compose -f infra/docker-compose.test.yml run --rm test
docker compose -f infra/docker-compose.verify.yml up --build --abort-on-container-exit --exit-code-from smoke smoke
```

Resultados: salida 0 en la suite de Go/Postgres y en `TestDockerInstallationAndSMTPRecovery`. Este último construye la imagen final, arranca DB vacía, aplica migrations/seeds, crea administrador, verifica `/me`, lee pacientes, solicita correo real a SMTP local, recupera el token del buzón Mailpit y completa reset/login/logout por HTTP.

Para repetir la prueba de imagen, limpiar **solo el proyecto de verificación** antes de ejecutar el segundo comando:

```powershell
docker compose -f infra/docker-compose.verify.yml down --volumes
```

Los proyectos `vetdata-tests` y `vetdata-verify` usan bases efímeras aisladas. La validación no migra la base `vetdata` del usuario. Las contraseñas y clave públicas del archivo verify son fixtures exclusivas de ese entorno privado sin puertos publicados.

## Revisión y límites

- Revisor técnico automatizado: Codex, pruebas reproducibles anteriores. Revisión humana del desarrollador: pendiente; registrar observaciones aquí.
- La aceptación de desarrollo no acredita correo público, restauración de backups, TLS de VPS, 2FA ni producción. Esos gates permanecen en sus fases.
- [Pendientes de producto](pendientes-dev.md): PatientStatus, derivaciones externas, retenciones y fórmulas analíticas. No bloquean las fundaciones entregadas ni se resolvieron por suposición.
- Los RUT sintéticos de los mocks tenían DV inconsistentes: el generador de seeds corrige sus dígitos para desarrollo, conserva IDs y no modifica los mocks. Los correos de dueños/clínicas se redirigen a `example.test`; no se importan deudas demo ni consentimientos como grants.
- Migraciones de avance incluyen tablas de fases siguientes, pero su presencia no acredita esas funcionalidades. El próximo cierre es Fase 2.

## Observaciones del desarrollador

Pendiente de revisión humana. Añadir fecha, escenario, resultado y decisión sin eliminar la evidencia técnica.
