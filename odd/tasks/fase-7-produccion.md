# Fase 7 — Chile + producción (tracking)

Objetivo: preparar Chile + producción: contrato DTE sin emisión, privacidad/ARCO, retención y despliegue piloto. Proveedor, integración y certificación DTE se retoman en T8-7 por decisión del 2026-10-12.
Rama: `review/fase-7-produccion` (desde `main` @ `33f2445`). Ruta: explorar primero; ejecución por tareas con test-first cuando aplique.
Entrada: Fase 6 firmada (`docs/roadmap/cierre-fase-06.md`).

## Alcance autorizado inicial

`backend/` + `infra/` + `docs/backend/` + `docs/roadmap/` + este archivo. `frontend/` solo si una tarea lo exige explícitamente.

## Tareas

- [ ] T7-1 SII p-12: contrato y persistencia local DTE sin emisión; proveedor, tipos 39/33, certificación y habilitación diferidos a T8-7
- [ ] T7-2 Privacidad p-14: ARCO manual (exportar/borrar dueño con auditoría), contrato encargado, ficha retenida ~10 años con contacto anonimizado, RUT normalizado global
- [ ] T7-3 Retención p-07+p-19: auditoría general 5 años exportable; lecturas compartidas 2–3 años con duración exacta por validar; video 30 días default. Políticas separadas; sin purga automática para categorías sin política aprobada
- [ ] T7-4 Infra prod: compose front+api+db, backups, TLS, logs, alertas, runbook piloto 1-2 clínicas

## Progreso

- 2026-10-10: rama creada desde main tras merge/push de Fase 6 (`33f2445`). Sin implementación aún.
- 2026-10-12: preparación local de T7-1 a T7-4 en el árbol de trabajo; suite PostgreSQL, ensayo de recuperación/HTTPS y recorrido local de login/2FA aprobados. Ver `docs/roadmap/evidencia-fase-07.md`. Falta política aprobada D-01/D-07, VPS/operación/piloto D-06, SMTP externo y rollback con releases reales. Ninguna T7 está cerrada.
- 2026-10-13: tienda y farmacia se validaron desde Next.js contra API y PostgreSQL desechables, con recepción parcial, ajustes por lote y rechazos por stock obsoleto. El frontend se recompiló después de corregir el mensaje y refresco de farmacia. Ver `docs/roadmap/evidencia-fase-07.md`. El stack de ensayo se retiró; siguen pendientes las decisiones y el piloto indicados arriba.
- 2026-10-13: revisión previa al VPS: suite PostgreSQL, configuración y build de imágenes productivas, y ensayo de recuperación/HTTPS con Next.js real detrás de Caddy pasaron. La lista de entradas y validaciones del servidor quedó en `docs/roadmap/preparacion-vps-fase-07.md`. T7 permanece abierta por D-01/D-06/D-07 y piloto.
