---
name: arquitectura-vetdata
description: Arquitectura del prototipo VetData (Next 16 + Tailwind v4 + shadcn). Úsala antes de agregar o mover un canal, módulo, componente, store u operación de servicio; cuando haya que ordenar el código; o para regenerar/actualizar ARCHITECTURE.md y sus referencias (mapa de módulos y conexiones entre canales).
---

# Arquitectura VetData

VetData es un **prototipo de frontend** de un dashboard de datos de mascotas compartido entre clínicas veterinarias. No hay backend: los datos son semilla en memoria y el estado vive en stores de sesión. La arquitectura está pensada para que un dev conecte una API real **reemplazando solo la capa de servicios**.

## Capas (de arriba hacia abajo)

```
src/app/(dashboard)/<canal>/<módulo>/page.tsx   Rutas: páginas delgadas (server components)
        ↓ componen
src/components/<dominio>/*.tsx                   UI (client components con estado/interacción)
src/components/layout/*                          PageContainer, PageHeader, EmptyState, clickableRow
        ↓ leen/escriben estado con hooks         (catálogos de solo lectura: src/lib/lookups.ts — deuda)
src/lib/*store*.tsx  (useStore, useRetail,       Estado de sesión (React context) + hooks
                      useSupport, useSecurity)    de reglas (useCan, useCanView, useAccess, usePrivacy…)
src/lib/tasks.ts     (useTasks, useNavBadges)     Pendientes derivados de los 4 stores
        ↓ cada mutación llama a
src/services/  contracts.ts · index.ts            Contratos async por dominio
               mock/  (hoy)   http/ (futuro)      Implementaciones intercambiables
        ↓ el mock usa
src/mocks/*.ts                                    Datos semilla
src/domain/*.ts                                   Tipos y constantes de dominio (usados por todas las capas)
src/lib/lookups.ts                                Puente temporal a src/mocks (currentClinic, getPatient,
                                                  getOwner, petsOf, doctors, catálogos…) con TODO(api)
src/lib/format.ts · analytics.ts · metrics/*      Utilidades y reglas (sin estado)
```

**Reglas de importación**
| Capa | Puede importar | No debe importar |
|---|---|---|
| `app/` | `components/`, `domain/`, `lib/format`, `lib/nav` | stores (salvo los *Providers* en `(dashboard)/layout.tsx`), `mocks/`, `services/`; `lib/lookups` es deuda |
| `components/` | stores/hooks, `domain/`, `lib/` puros, `components/ui`, `components/layout` | `services/` directamente, `mocks/`. Leer catálogos vía `lib/lookups` está tolerado pero es deuda (registrarla en ARCHITECTURE.md §12) |
| stores (`lib/*store*`) | `services/`, `domain/`, `lib/` | componentes. Hoy importan `mocks/` solo para el estado inicial, marcado `// TODO(api)` |
| `lib/lookups.ts` | `mocks/`, `domain/` | stores, componentes |
| `services/mock` | `mocks/`, `domain/` | stores, componentes |
| `domain/` | solo `lib/format` (fecha fija para reglas como `grantStatus`, `expiryStatus`, `slaState`) | todo lo demás |

## Convenciones
- **Fecha y hora "actuales" fijas**: `TODAY`, `NOW_TIME`, `NOW_ISO` en `src/lib/format.ts` (evitan desajustes de hidratación y hacen la demo reproducible).
- **Formatos**: `formatCLP`, `formatDate`, `formatDateTime`, `formatRut`, `normalizeRut`, `ageFrom` (`src/lib/format.ts`). IVA 19 %.
- **Clínica actual**: `currentClinic`, se importa desde `src/lib/lookups.ts` (re-exporta la constante de `src/mocks/network.ts`; TODO(api): `services.network.getCurrentClinic()`). Multi-clínica = cada dato tiene clínica de origen.
- **Regla de acceso de la red**: una mascota es *propia*, *compartida* (acceso vigente) o *sin acceso*. Usa `accessLevel` / `useCanView` / `useAccess`; la ficha se envuelve en `AccessGate`.
- **Permisos por rol**: catálogo `PERMISSIONS`/`Permission`/`ROLES` en `src/domain/settings.ts`; matriz inicial `defaultRolePermissions` y usuarios demo (`demoUserByRole`) en `src/mocks/settings.ts`. Uso: `useCan()(permiso)`; acciones con `<Guard permission>`, vistas con `<RequirePermission>` (`src/components/settings/guard.tsx`). El rol activo se cambia con "Ver como" (menú del avatar en `src/components/topbar.tsx`).
- **Gráficos**: shadcn Charts + skill `dataviz`; colores `--viz-1/2/3` validados (CVD y contraste) en `globals.css`.
- **Layout de página** (`src/components/layout/`): `PageContainer` (`page-container.tsx`), `PageHeader` (`page-header.tsx`), `EmptyState` (`empty-state.tsx`), `clickableRow` (`clickable-row.ts`). Las páginas de Seguridad usan `SecurityPage` (`src/components/security/page-shell.tsx`).
- **UI**: español (Chile), shadcn en `components/ui` (no editar), íconos lucide, estados de badge con ícono + texto.

## Procedimiento: actualizar ARCHITECTURE.md
1. Lista rutas: `find src/app -name page.tsx`.
2. Lee `src/lib/nav.ts` (canales → ítems) y cruza cada ítem con su página y componentes.
3. Lista operaciones de `src/services/contracts.ts` y qué store las llama (`grep -n "services\." src/lib/*store*.tsx`).
4. Detecta deuda: `grep -rn "@/mocks" src/components src/app` (debe dar 0), `grep -rn "@/lib/lookups" src` (lecturas de catálogos a reemplazar por servicios; cada export de `lookups.ts` indica su operación) y `grep -rn "from \"@/" src/domain` (dependencias de `domain/`).
5. Reescribe `ARCHITECTURE.md` (raíz) con: resumen, capas, árbol de carpetas, tabla de canales/módulos, stores y qué dominio cubren, servicios, conexiones entre módulos, convenciones, cómo conectar el backend, deuda técnica.
6. Actualiza `references/modulos.md` (canal → módulo → ruta → componentes → store → operaciones) y `references/conexiones.md` (flujos que cruzan canales).

## Checklists

**Agregar un módulo a un canal existente**
1. Ítem en `src/lib/nav.ts` (título, href, ícono lucide).
2. `src/app/(dashboard)/<canal>/<módulo>/page.tsx` con `PageContainer` + `PageHeader` (`src/components/layout/`).
3. Componentes en `src/components/<dominio>/`.
4. Si necesita datos nuevos: tipo en `src/domain`, semilla en `src/mocks`, operación en `services` (contrato + mock + http), estado en el store del dominio.
5. Permiso (si aplica) en `PERMISSIONS`/`Permission` de `src/domain/settings.ts` + matriz por rol `defaultRolePermissions` en `src/mocks/settings.ts`.
6. Actualizar `ARCHITECTURE.md`, `references/` y pedir a `backend-assistant` que documente.

**Agregar un canal**: igual que módulo, más el canal en `nav.ts` (ícono del rail), y si tiene estado propio, un store `src/lib/<canal>-store.tsx` montado en `src/app/(dashboard)/layout.tsx`.

**Agregar una operación de servicio**
1. Firma async en `src/services/contracts.ts` (entrada/salida con tipos de `src/domain`).
2. Implementación en `src/services/mock/<dominio>.ts`.
3. Esqueleto en `src/services/http/<dominio>.ts` con el endpoint REST esperado.
4. Llamada desde el store con actualización optimista.
5. Documentar en `docs/backend/api.md` (skill `documentacion-backend`).
