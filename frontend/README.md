# VetData web — frontend (Next.js 16 + pnpm)

Prototipo funcional con datos simulados en memoria. Ver [../../ARCHITECTURE.md](../../ARCHITECTURE.md) para el mapa completo y [../../docs/backend/](../../docs/backend/) para los requerimientos de la API futura.

## Desarrollo

Requiere Node.js 22+ y pnpm 11.

```bash
pnpm install
pnpm dev    # http://localhost:3000 → redirige a /login
pnpm build  # verificación mínima tras cambios
pnpm lint
```

## Variables

En `.env.local` (ver `.env.example`):

| Variable | Default | Uso |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` | `mock` (semillas) o `http` (API real) |
| `NEXT_PUBLIC_API_URL` | — | URL base API: `http://localhost:4000` en dev local, `http://api:4000` en compose |

## Docker

Se buildea desde `infra/` con contexto en este directorio:

```bash
docker compose -f ../infra/docker-compose.yml up --build web
```
