# VetData API — backend (Go + Postgres)

Fase 1 validada técnicamente para desarrollo por API. Ver [cierre y evidencia](../docs/roadmap/cierre-fase-01.md), [instalación local completa](../docs/backend/instalacion-fase1.md), [OpenAPI](../docs/backend/openapi-fase1.md), [tareas](../docs/TAREAS.md) y [decisiones](../docs/DECISIONES.md). Hay avances parciales de fases 2–3; el frontend aún no está integrado a estos endpoints.

## Desarrollo

Requiere Go 1.26 + Postgres (o el servicio `db` del compose).

```bash
go build ./...
DATABASE_URL=postgresql://vetdata:vetdata@localhost:5435/vetdata go run ./cmd/api  # :4000
```

## Endpoints

- `GET /healthz` — con ping a DB (200 ok / 503 si cae)
- `GET /api/v1/health` — `{status, service}` sin DB

Autenticación, usuarios, pacientes, consentimiento, agenda e inventario: consultar [contratos incorporados](../docs/roadmap/avance-backend.md#contratos-incorporados). Las escrituras de negocio exigen `Origin`, cookie de sesión e `Idempotency-Key`.

## Pruebas con Postgres aislado

Desde la raíz del repositorio:

```powershell
docker compose -f infra/docker-compose.test.yml run --rm test
```

La suite no usa la base `vetdata` ni sus volúmenes. El workflow `.github/workflows/backend.yml` ejecuta el mismo comando. Las pruebas sin `TEST_DATABASE_URL` omiten integración salvo que `REQUIRE_INTEGRATION=1`; no usar una ejecución con integración omitida como gate.

## Configuración adicional

- `PUBLIC_WEB_URL`: origen exacto permitido para cookies/CSRF, por defecto `http://localhost:3000`.
- `APP_ENV=production`: exige origen HTTPS, correo configurado y cookies Secure.
- `SMTP_ADDR`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`: transporte de correo.
- `OUTBOX_KEY`: clave de 32 bytes codificada en base64 para cifrar mensajes pendientes. Conservarla de forma segura; perderla impide descifrar mensajes pendientes.
- `SMTP_ALLOW_PLAIN=true`: solo para un capturador SMTP local en desarrollo; producción exige TLS.

Sin transporte/clave de correo, los flujos que necesitan enviar enlaces no se habilitan. `infra/docker-compose.mail.yml` ofrece Mailpit local; `cmd/setup` permite migrar, aplicar seeds opcionales y preparar administrador por stdin. Seguir la guía completa. Proveedor de correo público y modo HTTP del frontend siguen en sus gates de despliegue/integración.

## Migraciones

SQL embebido en `migrations/*.sql`, aplicado al arrancar con advisory lock. Nueva migración = nuevo archivo numerado (`002_....sql`).

## Convenciones (de `docs/backend/transversales.md`)

REST `/api/v1`, errores 400/401/403/404/409/422, tenant desde sesión, `clinicId` estable, RUT con DV módulo 11, CLP enteros, IVA 19% neto, fechas ISO con offset `America/Santiago`, UUIDs + `Idempotency-Key` en POSTs.

## Docker

```bash
docker compose -f ../infra/docker-compose.yml up --build api
```
