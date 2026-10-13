# Fix Dokploy primer deploy — puerto 3000 ya asignado

## Objetivo
Desbloquear el primer deployment en Dokploy (autodeploy desde `main`) eliminando el conflicto `Bind for :::3000 failed: port is already allocated` en `vetdata-app-*-web-1`.

## Problema
El log muestra `api` y `db` healthy, pero `web-1 Starting` falla porque el compose publica `${PORT:-3000}:3000` en el host. Dokploy ocupa el 3000 para su propio panel, así que cualquier app que publique el host 3000 choca siempre. `api: 4000:4000` y `db: 5435:5432` tienen el mismo riesgo en el host compartido.

## Por qué
- Dokploy enruta por dominios (Traefik); los servicios no deben publicar puertos de host fijos.
- El compose local (`infra/docker-compose.yml`) sí necesita puertos para `localhost`, así que no se toca su comportamiento: se agrega un compose específico para Dokploy.

## Alcance autorizado
- `infra/docker-compose.dokploy.yml` (nuevo)
- `infra/README.md` (sección Dokploy)
- Nada más. No tocar `infra/docker-compose.yml`, Dockerfiles, código, ni secretos.

## Restricciones
- Sin `ports:` con host fijo en el compose Dokploy; `expose` interno + dominios de Dokploy.
- `NEXT_PUBLIC_*` se bakea en build: documentar que cambiar la URL pública exige rebuild.
- Autodeploy sigue en `main`; esta rama se mergea a `main` para desplegar.

## Tareas
- [x] D1 — Diagnóstico causa raíz (-inline, evidencia: compose + log Dokploy; trigger: dentro del budget inline)
- [x] D2 — Crear `infra/docker-compose.dokploy.yml` sin puertos host (delegated direct; trigger: write rule 2+ archivos con D3)
- [x] D3 — Documentar deploy Dokploy en `infra/README.md` (delegated direct, mismo worker que D2)
- [x] D4 — Verificación: `docker compose -f infra/docker-compose.dokploy.yml config` OK + `config` local intacto (worker, reporte `<comando>: <resultado>`)

## Criterios de aceptación
- `config` del compose Dokploy no contiene `3000:3000`, `4000:4000` ni `5435:5432` en host.
- README indica compose path, dominios web/api, variables obligatorias y nota de rebuild por `NEXT_PUBLIC_*`.
- Rama `fix/dokploy-first-deploy-port-conflict` lista para PR a `main`.

## Checks aplicables
- `docker compose -f infra/docker-compose.dokploy.yml config`
- `docker compose -f infra/docker-compose.yml config` (regresión local)

## Progreso
- 2026-10-13: rama creada desde `main` actualizado; diagnóstico completo.
- Ruta: D1 inline / D2+D3 delegated direct (writer trigger) / D4 worker self-verification.
- 2026-10-13: D2+D3 cerradas — writer creó `infra/docker-compose.dokploy.yml` (expose-only, sin `ports:`) y sección Dokploy en `infra/README.md`; `config` dokploy OK, `config` local intacto.
- 2026-10-13: verificación independiente PASS (4/4: sin ports, README completo, local intacto, `config` exit 0). RDD off; tier high/unassessable → writer + verifier.

## Siguiente paso
- Delegar D2+D3 a un writer acotado, verificar D4, reportar.
