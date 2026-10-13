# VetData web — frontend (Next.js 16 + pnpm)

Frontend con modo HTTP predeterminado y modo demo `mock` explícito. En HTTP las listas provienen de la API; las operaciones sin contrato compatible deben indicar que no están disponibles, sin crear documentos locales. Ver [../ARCHITECTURE.md](../ARCHITECTURE.md) y [la validación del roadmap](../docs/roadmap/validacion.md).

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
| `NEXT_PUBLIC_DATA_SOURCE` | `http` | API real; `mock` habilita la demo explícitamente |
| `NEXT_PUBLIC_API_URL` | vacío | URL base API: vacío con proxy `/api/*` en Compose; `http://localhost:4000` solo si el navegador puede acceder directamente a la API en desarrollo |

## Docker

Se buildea desde `infra/` con contexto en este directorio:

```bash
docker compose -f ../infra/docker-compose.yml up --build web
```
