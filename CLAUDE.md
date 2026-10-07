@AGENTS.md

# VetData

Prototipo de frontend (sin backend) de un dashboard veterinario multi-clínica. Antes de cambiar código lee `ARCHITECTURE.md`; los requerimientos de backend están en `docs/backend/`.

- Para ordenar o extender la estructura (canal, módulo, store, operación de servicio) usa la skill `arquitectura-vetdata` y mantén `ARCHITECTURE.md` al día.
- Si cambias `src/services/contracts.ts`, `src/domain/*` o permisos, actualiza `docs/backend/` con la skill `documentacion-backend` (o el agente `backend-assistant`).
- Agentes del proyecto: `nextjs-expert` (rutas, servicios, build), `frontend-expert` (UI, accesibilidad, gráficos con la skill `dataviz`), `backend-assistant` (especificación de backend, sin código de servidor).
- Verificación mínima tras cambios: `pnpm build` y `pnpm lint` en verde. UI en español.
