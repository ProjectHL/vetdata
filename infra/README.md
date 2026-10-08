# Infra — VetData (frontend + api + db)

Levanta el stack completo con Docker Compose.

## Estructura

```text
vetdata/
  frontend/   # Next.js 16 + pnpm (Dockerfile standalone, puerto 3000)
  backend/    # API Go + Postgres (Dockerfile, puerto 4000)
  infra/      # docker-compose.yml + este README
  docs/       # DECISIONES.md, TAREAS.md, backend/
```

## Uso

Desde la raíz del repo:

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Web: http://localhost:3000 (redirige a /login)
- API: http://localhost:4000/healthz · http://localhost:4000/api/v1/health
- Postgres: localhost:5435 (usuario/db `vetdata`)

El front levanta cuando la API está healthy (`depends_on` + healthcheck).

## Variables

| Variable | Default | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto host → 3000 del web |
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` | `mock` (semillas) o `http` (API real). Se bakea en el build |
| `NEXT_PUBLIC_API_URL` | `http://api:4000` | URL base API para el front en compose. Fuera de compose (pnpm dev): `http://localhost:4000` |
| `DATABASE_URL` | `postgresql://vetdata:vetdata@db:5432/vetdata` | Conexión API → Postgres (nombre de servicio `db`) |

Ejemplo apuntando a una API externa:

```bash
NEXT_PUBLIC_DATA_SOURCE=http NEXT_PUBLIC_API_URL=https://api.vetdata.cl \
  docker compose -f infra/docker-compose.yml up --build
```

## Notas

- El nombre de proyecto compose es fijo (`vetdata`): no colisiona con Forge/Synaptia aunque todos vivan en carpetas `infra`.
- Postgres host usa el puerto **5435** (5432 Forge, 5433 Forge réplica, 5434 Synaptia).
- La API aplica migraciones embebidas al arrancar (advisory lock, sin runner externo).
- El front sigue funcionando con `mock` hasta que se implementen los endpoints (Fase 5).
