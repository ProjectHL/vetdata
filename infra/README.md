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

## Deploy en Dokploy

Causa del error: el compose local publica `${PORT:-3000}:3000` en el host y
Dokploy ya ocupa el puerto 3000 para su propio panel, así que `web-1`
falla con `Bind for :::3000 failed: port is already allocated`
(`4000:4000` y `5435:5432` tienen el mismo riesgo en el host compartido).

En Dokploy se usa el compose `infra/docker-compose.dokploy.yml`, que no
lleva ningún bloque `ports:`: solo `expose: ["3000"]` en `web`,
`expose: ["4000"]` en `api` y nada expuesto en `db` (tráfico interno vía
nombres de servicio).

Dominios: `web` y `api` se asignan en la UI de Dokploy (ej.
`https://vetdata.tu-dominio` y `https://api.tu-dominio`); `db` no lleva
dominio.

Variables obligatorias en Dokploy:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `http` |
| `NEXT_PUBLIC_API_URL` | `https://<dominio-api>` |
| `DATABASE_URL` | `postgresql://vetdata:vetdata@db:5432/vetdata` (o el secreto gestionado) |
| `PUBLIC_WEB_URL` | `https://<dominio-web>` |

Nota: `NEXT_PUBLIC_*` se bakea en el build del front; cambiar la URL
pública exige rebuild, no basta con reiniciar.

Autodeploy corre desde `main`; esta rama se mergea a `main` para desplegar.
