---
name: documentacion-backend
description: Genera y mantiene la documentación de requerimientos de backend de VetData en docs/backend/ a partir del prototipo (contratos de servicio, tipos de dominio, stores y reglas). Úsala cuando cambie una operación de src/services/contracts.ts, un tipo o estado de src/domain, un permiso, o cuando el dev de backend necesite saber qué construir. No diseña el esquema de BD ni escribe código de servidor.
---

# Documentación de backend VetData

El prototipo define **qué** necesita la UI; esta skill lo traduce a requerimientos para el dev que construirá la API. Salida en `docs/backend/`.

## Estructura de salida
```
docs/backend/
  README.md               Cómo leer la doc, alcance, glosario, mapa dominio → archivo
  transversales.md        Multi-clínica, red y compartición, auth y roles, auditoría,
                          fechas/zona horaria, RUT, CLP/IVA, archivos/grabaciones, notificaciones
  dominios/
    <dominio>.md          Uno por dominio (ver plantilla)
  api.md                  Todos los endpoints sugeridos (tabla) ↔ operación de servicio
  estados.md              Máquinas de estado con transiciones válidas y quién puede ejecutarlas
  permisos.md             Permiso → operaciones que habilita → roles por defecto
  eventos.md              Eventos de dominio y notificaciones que el backend debería emitir
  preguntas-abiertas.md   Decisiones pendientes para el dev / negocio
```

Dominios esperados (ajusta si el código cambia): red-y-acceso, pacientes-y-propietarios, agenda-y-atencion (citas, boxes, sala de espera), facturacion, farmacia, tienda, seguridad, soporte, usuarios-y-permisos, analitica (métricas derivadas).

## Procedimiento
1. **Inventario**: lee `src/services/contracts.ts` (operaciones), `src/domain/*` (tipos, enums/estados), `src/lib/*store*.tsx` (efectos de cada mutación) y reglas puras (`accessLevel`, `grantStatus`, `slaState`, `stockStatus`, `expiryStatus`, `appointmentStage`, métricas en `src/lib/metrics/*`).
2. **Por dominio**, completa `references/plantilla-dominio.md`:
   - Entidades: campo, tipo, obligatorio, descripción, restricciones (únicos, rangos, formatos como RUT), relaciones.
   - Reglas de negocio numeradas, cada una con **fuente** (`ruta:función`) y si es *regla* o *supuesto del prototipo*.
   - Estados y transiciones (también en `estados.md`).
   - Operaciones → endpoint sugerido (método, ruta, cuerpo, respuesta, errores, permiso, auditoría, efectos colaterales en otros dominios).
   - Datos semilla/referenciales necesarios (catálogos: servicios con precio, categorías, especies…).
3. **Efectos cruzados**: documenta cuando una operación toca varios dominios en una sola acción de negocio (p. ej. *checkout* descuenta stock de sala y crea despacho; *dispensar* crea movimientos y cambia estado de la receta; *pasar a box* ocupa el box y saca de la sala de espera). Indica que el backend debe hacerlo de forma **atómica**.
4. **Seguridad y privacidad**: autorización por permiso **en el servidor** (la UI solo oculta), aislamiento por clínica, regla de acceso de la red (alcance y vigencia), auditoría obligatoria (grabaciones, privacidad de boxes), consentimiento del dueño.
5. **Consistencia** (obligatorio al final):
   - Cada operación de `contracts.ts` aparece en `api.md` y viceversa.
   - Cada estado/enum de `src/domain` aparece en `estados.md`.
   - Cada `Permission` aparece en `permisos.md`.
   Reporta diferencias explícitamente.
6. **Preguntas abiertas**: todo lo que el prototipo simula o no resuelve (pagos reales, envío real de WhatsApp/email, video real, firma electrónica, facturación electrónica SII, zona horaria, borrado de datos personales…).

## Convenciones de API sugeridas
- REST JSON, prefijo `/api/v1`, recursos en plural y en inglés o español de forma consistente (recomendado: inglés para rutas, español para la doc).
- Toda ruta está en el contexto de la clínica autenticada (tenant); recursos de otra clínica solo vía la regla de acceso de la red.
- Errores: `400` validación, `401` no autenticado, `403` sin permiso o sin acceso de red, `404`, `409` conflicto de estado (transición inválida, horario ocupado, stock insuficiente).
- Listas con paginación y filtros que la UI ya usa (fecha, estado, clínica, especie, RUT).
- Montos en CLP enteros; fechas ISO 8601 con zona horaria `America/Santiago`.
