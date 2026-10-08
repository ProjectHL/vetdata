# VetData API — backend (Go + Postgres)

API en construcción (Fase 1, ver [../../docs/TAREAS.md](../../docs/TAREAS.md)). Stack decidido en [../../docs/DECISIONES.md](../../docs/DECISIONES.md) (p-00): Go + Postgres, VPS con compose.

## Desarrollo

Requiere Go 1.26 + Postgres (o el servicio `db` del compose).

```bash
go build ./...
DATABASE_URL=postgresql://vetdata:vetdata@localhost:5435/vetdata go run ./cmd/api  # :4000
```

## Endpoints

- `GET /healthz` — con ping a DB (200 ok / 503 si cae)
- `GET /api/v1/health` — `{status, service}` sin DB

## Migraciones

SQL embebido en `migrations/*.sql`, aplicado al arrancar con advisory lock. Nueva migración = nuevo archivo numerado (`002_....sql`).

## Convenciones (de `docs/backend/transversales.md`)

REST `/api/v1`, errores 400/401/403/404/409/422, tenant desde sesión, `clinicId` estable, RUT con DV módulo 11, CLP enteros, IVA 19% neto, fechas ISO con offset `America/Santiago`, UUIDs + `Idempotency-Key` en POSTs.

## Docker

```bash
docker compose -f ../infra/docker-compose.yml up --build api
```
