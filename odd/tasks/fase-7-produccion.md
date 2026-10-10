# Fase 7 — Chile + producción (tracking)

Objetivo: preparar Chile + producción: SII/DTE, privacidad/ARCO, retención y despliegue piloto.
Rama: `review/fase-7-produccion` (desde `main` @ `33f2445`). Ruta: explorar primero; ejecución por tareas con test-first cuando aplique.
Entrada: Fase 6 firmada (`docs/roadmap/cierre-fase-06.md`).

## Alcance autorizado inicial

`backend/` + `infra/` + `docs/backend/` + `docs/roadmap/` + este archivo. `frontend/` solo si una tarea lo exige explícitamente.

## Tareas

- [ ] T7-1 SII p-12: proveedor DTE, tipos 39/33 primero (61/52 después), folio/tipo/PDF/estado SII guardados, anulaciones
- [ ] T7-2 Privacidad p-14: ARCO manual (exportar/borrar dueño con auditoría), contrato encargado, ficha retenida ~10 años con contacto anonimizado, RUT normalizado global
- [ ] T7-3 Retención p-07+p-19: auditoría general 5 años exportable; lecturas compartidas 2–3 años con duración exacta por validar; video 30 días default. Políticas separadas; sin purga automática para categorías sin política aprobada
- [ ] T7-4 Infra prod: compose front+api+db, backups, TLS, logs, alertas, runbook piloto 1-2 clínicas

## Progreso

- 2026-10-10: rama creada desde main tras merge/push de Fase 6 (`33f2445`). Sin implementación aún.
