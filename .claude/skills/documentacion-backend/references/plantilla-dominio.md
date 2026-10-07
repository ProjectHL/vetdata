# <Dominio>

> Fuentes: `src/domain/<…>.ts` · `src/services/contracts.ts` (`<Servicio>`) · `src/lib/<store>.tsx` · <reglas puras>

## Propósito
Qué resuelve este dominio en VetData y qué pantallas lo usan (rutas).

## Entidades

### <Entidad>
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | string (uuid) | sí | |
| clinicId | string | sí | Clínica dueña del dato (tenant) |
| … | | | |

Relaciones: <Entidad> N—1 <Otra> (por `campo`).

## Reglas de negocio
1. **<Regla>** — <descripción>. Fuente: `src/…:función`. *(regla | supuesto del prototipo)*

## Estados
`EstadoA → EstadoB → EstadoC` (detalle en `../estados.md`). Quién puede ejecutar cada transición.

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `dominio.operacion` | `POST /api/v1/...` | `{…}` | `Entidad` | `permiso.x` | 403, 409 | … |

## Efectos en otros dominios
- <operación> también <efecto> en <dominio> (debe ser atómico).

## Datos de referencia / semilla
Catálogos que el backend debe proveer.

## Notas para el dev
Supuestos del prototipo, límites, decisiones pendientes (enlazar a `../preguntas-abiertas.md`).
