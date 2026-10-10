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
- [x] T5-2 Hidratar 4 stores (`store`, `retail-store`, `security-store`, `support-store`) con loading/error desde `http` en vez de semilla en memoria
- [x] T5-3 Matar `lib/lookups.ts`: migrar 75 archivos consumidores + `tasks.ts` + `analytics/metrics` a estado servidor (T5-3a: nivel `lib` via registry; T5-3b: retail/farmacia/agenda/care-actions; T5-3c: analytics/dashboard/search/activity + hooks vivos; T5-3d: sharing/network/owners/pets/patients; T5-3e: security/support/app/topbar + `nvr.ts` local; T5-3f: últimos 9 de `lib/*` + borrado de `lookups.ts`; T5-3g: 16 comentarios mocks + resto en `nvr.ts`; `grep lookups src/` vacío, `tsc`+`lint` limpios)
- [x] T5-4 Reconciliar ids optimistas (`-new-N` → canónico), revertir/avisar en error, `Idempotency-Key` desde UI
- [x] T5-5 Fechas reales sin romper hidratación, `currentClinic/currentUser/role` desde sesión (sesión vía `GET /me` con fallback semilla + guardia anti-`Ver como`; fechas con hooks post-mount SSR-safe + threading en todos los llamadores incl. `expiryStatus(m, today)`; `lint`+`tsc` limpios)
- [x] T5-6 Salida fase: con `NEXT_PUBLIC_DATA_SOURCE=http`, recargar no pierde nada (build http verde + todo el estado del servidor; pasada manual con backend arriba: pendiente, ver cierre-fase-05.md)

## Progreso

- 2026-10-09: documento creado, sin writes aún. Mapa: 10 archivos en `services/http` (todos esqueleto), 4 stores, 75 archivos con `lib/lookups`, 0 imports `@/mocks` en componentes.
- 2026-10-09: T5-1 cerrada — 87 métodos http vía `apiFetch` (cookie sesión, sin headers extra), 21 faltantes anotados no inventados, `npm run lint` exit 0, `npx tsc --noEmit` exit 0. Riesgo: selects Go traen claves distintas a `src/domain` (cast `apiFetch<T>` compila pero UI puede ver `undefined` hasta T5-3 con adaptadores).
- 2026-10-09: T5-2 cerrada — 4 stores hidratan en modo `http` con `loading/error/retry`, semilla intacta en `mock` y como estado inicial (protege `currentUser!`); sin adaptadores (http ya devuelve tipos de dominio); `lint`+`tsc` limpios. Pendiente: componentes aún no consumen `loading/error` (sin spinner).
- 2026-10-10: T5-3a cerrada — nuevo `server-state.ts` (registry + `ensureServerCatalogs` con allSettled), `lookups.ts` lee registry con fallback mock, stores publican en `http`, `tasks/analytics/metrics` sin cambios (ya leían vía lookups); `grep @/mocks src/lib` solo en lookups; `lint`+`tsc` limpios. Riesgo: primer render puede mostrar semilla de catálogos hasta que resuelve el fetch.
- 2026-10-10: T5-3b cerrada — 15 archivos (retail/farmacia/agenda/care-actions) sin `lookups`, con `read()` + fallbacks `@/mocks` (deuda registrada, la corrige T5-3c).
- 2026-10-10: T5-3c cerrada — hooks vivos en `server-state.ts` (`usePatients`, `useOwners`, `useDoctorsAll`, `useClinics`, series analytics…), 14 archivos T5-3b sin `@/mocks`, 11 archivos (analytics/dashboard/search/activity) sin `lookups`; cero `@/mocks` en componentes; `lint`+`tsc` limpios. Patrón: helpers de módulo reciben la lista por parámetro.
- 2026-10-10: T5-3d cerrada — 12 archivos (sharing/network/owners/pets/patients) sin `lookups` ni `@/mocks`, finders como closures sobre hooks; cada subcomponente se suscribe con su propio hook.
- 2026-10-10: T5-3e/f/g cerradas — últimos 11 (security/support/app/topbar, 4 pages server→client) + 9 de `lib/*` via `read()` + `lookups.ts` borrado + 16 comentarios mocks + resto `nvr.ts`; `grep -rn lookups src/` vacío; `tsc`+`lint` limpios. Deuda: `billableServices` y `NVR` siguen semilla (sin endpoint).
- 2026-10-10: T5-4 cerrada — `apiFetch` envía `Idempotency-Key` (cola FIFO un solo uso, GET nunca consume), stores reconcilian canónico y revierten al fallar con error en el store; `mock` intacto; `lint`+`tsc` limpios. Diseño documentado: key viaja store→cola→apiFetch porque las firmas del contrato no la aceptan.
- 2026-10-10: T5-5 cerrada — `currentUser` de `GET /me`, `role` inicial del membership (guardia anti-retry), fechas reales con hooks SSR-safe (`useToday/useNowTime/useNowIso`, `stampToday()` en escrituras), threading completo de llamadores (T5-5b/c/d + fix `expiryStatus` inline); `mock` idéntico; `lint`+`tsc` limpios. Nota: `slaState` exige ISO (`useNowIso`, no `useNowTime`).
- 2026-10-10: T5-6 cerrada — build en modo `http` verde (todas las rutas), TAREAS T5-1..T5-6 a [x], `cierre-fase-05.md` creado. Límite honesto: pasada manual de recarga con backend vivo queda pendiente.
