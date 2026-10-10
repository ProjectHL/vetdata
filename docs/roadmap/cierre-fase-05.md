# Cierre técnico de Fase 5

Fecha: 2026-10-10. Rama: `review/fase-5-integracion` (commits T5-1..T5-6 sobre `e4fcc89`).

## Alcance

Integración del prototipo Next.js con la API real: capa `services/http` implementada, stores hidratados desde servidor, `lib/lookups.ts` eliminado, mutations con idempotencia y reconcile, sesión y fechas reales. `backend/` intacto en toda la fase.

## Matriz T5

| Tarea | Estado técnico | Evidencia verificable |
|---|---|---|
| T5-1 | validada | 87 métodos http vía `apiFetch` (cookie sesión); 21 faltantes anotados no inventados (sin endpoint o contrato sin `lotId`/`prescriptionId`); `lint`+`tsc` limpios. |
| T5-2 | validada | 4 stores hidratan en `http` con `loading/error/retry`; semilla intacta en `mock` e inicial (protege `currentUser!`). |
| T5-3 | validada | 49 archivos migrados en slices a–g; `lookups.ts` borrado; `grep lookups src/` vacío; cero `@/mocks` en componentes. Deuda: `billableServices`/`NVR` en semilla local (sin endpoint). |
| T5-4 | validada | `Idempotency-Key` por intención (cola FIFO un solo uso, GET nunca consume); reconcile de `-new-N` a canónico; revert + error al fallar; `mock` intacto. |
| T5-5 | validada | `currentUser`/`role`/`currentClinic` desde `GET /me` con fallback semilla; fechas reales con hooks SSR-safe (`useToday/useNowTime/useNowIso`, `stampToday()` en escrituras); threading completo incl. `expiryStatus(m, today)`. |
| T5-6 | validada con límite | `NEXT_PUBLIC_DATA_SOURCE=http NEXT_PUBLIC_API_URL=... npm run build` verde (todas las rutas compilan); todo el estado baja del servidor con `loading/error`. Límite: pasada manual de recarga con backend arriba queda pendiente (requiere entorno vivo). |

## Comandos de aceptación

Desde `frontend/`:

```powershell
npm run lint        # exit 0, sin errores
npx tsc --noEmit    # exit 0, limpio
NEXT_PUBLIC_DATA_SOURCE=http NEXT_PUBLIC_API_URL=http://localhost:8080 npm run build   # verde
```

Suite backend intacta (Fase 5 no tocó `backend/`).

## Revisión y límites

- Sin runner de tests en frontend: verificación estructural (`lint`+`tsc`+`grep`) en cada tarea, registrada en `odd/tasks/fase-5-integracion.md`.
- Decisiones aplicadas: key de idempotencia viaja store→cola→apiFetch (las firmas del contrato no la aceptan); hooks de fecha fijos en SSR y reales post-mount; `slaState` exige ISO (`useNowIso`); `useDoctors()` no sustituye al catálogo completo; helpers de módulo reciben listas por parámetro.
- Pendiente fuera de alcance: 21 métodos http sin endpoint; pasada manual de recarga; smoke `verify.yml`; spinner/error en UI (los componentes aún no consumen `loading/error` de los stores).
- El próximo cierre es Fase 6 (endurecimiento).
