# Fase 5 — Integración frontend (tracking)

Objetivo: conectar el prototipo Next.js a la API real implementando la capa `services/http`, hidratando stores desde servidor y eliminando `lib/lookups.ts`, sin perder nada al recargar en modo `http`.
Rama: `review/fase-5-integracion` (desde `main` @ `e4fcc89`). Ruta: un writer delegado por tarea.
Entrada: Fase 4 firmada (`docs/roadmap/cierre-fase-04.md`).

## Alcance autorizado

`frontend/src/services/http/` + `frontend/src/lib/*store*.tsx` + `frontend/src/lib/lookups.ts` + `frontend/src/lib/tasks.ts` + `frontend/src/lib/analytics.ts` + `frontend/src/lib/metrics/*` + componentes que lean lookups/mocks + este archivo. `backend/` intacto salvo que un endpoint falte (entonces se documenta, no se improvisa).

## Política de verificación (excepción test-first)

El frontend no tiene runner de tests (`dev/build/start/lint` solamente). No hay RED runnable: se aplica verificación estructural proporcional por tarea — `npm run lint` + `npx tsc --noEmit` en `frontend/`, y `npm run build` al cerrar cada tarea. Cada tarea registra la salida observada abajo. Si una tarea agrega un runner, pasa a RED→GREEN.

## Tareas

- [x] T5-1 `http/client.ts`: auth por cookie (`credentials: include` ya está) + `apiFetch` real; 87 métodos cableados a endpoints de `docs/backend/api.md`, 21 quedan con `NotImplementedError` anotado (sin endpoint o contrato sin datos requeridos: lotId, prescriptionId, cámaras/NVR, alarma, audit POST, sharing-policy, reminders) — firmas intactas, `tsc`+`lint` limpios
- [ ] T5-2 Hidratar 4 stores (`store`, `retail-store`, `security-store`, `support-store`) con loading/error desde `http` en vez de semilla en memoria
- [ ] T5-3 Matar `lib/lookups.ts`: migrar 75 archivos consumidores + `tasks.ts` + `analytics/metrics` a estado servidor
- [ ] T5-4 Reconciliar ids optimistas (`-new-N` → canónico), revertir/avisar en error, `Idempotency-Key` desde UI
- [ ] T5-5 Fechas reales sin romper hidratación, `currentClinic/currentUser/role` desde sesión
- [ ] T5-6 Salida fase: con `NEXT_PUBLIC_DATA_SOURCE=http`, recargar no pierde nada

## Progreso

- 2026-10-09: documento creado, sin writes aún. Mapa: 10 archivos en `services/http` (todos esqueleto), 4 stores, 75 archivos con `lib/lookups`, 0 imports `@/mocks` en componentes.
- 2026-10-09: T5-1 cerrada — 87 métodos http vía `apiFetch` (cookie sesión, sin headers extra), 21 faltantes anotados no inventados, `npm run lint` exit 0, `npx tsc --noEmit` exit 0. Riesgo: selects Go traen claves distintas a `src/domain` (cast `apiFetch<T>` compila pero UI puede ver `undefined` hasta T5-3 con adaptadores).
