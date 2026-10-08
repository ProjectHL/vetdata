# Fase 3 — Operación clínica

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Entregar el flujo clínico y financiero interno completo mediante operaciones transaccionales.

**Dependencia:** Fase 2 validada.

**Estado inicial:** pendiente. Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T3-1 | p-15 | pendiente | Agenda y disponibilidad, ingreso, espera, paso a box y finalización atómica; historial de ocupación. | Dos reservas simultáneas no ocupan el mismo recurso; finalizar libera paciente/profesional y deja box en limpieza. |
| T3-2 | p-22 | pendiente | Crear pacientes, dueños y registros clínicos append-only; correcciones/anulaciones vinculadas; PatientStatus calculado. | Corrección conserva original y autor; clínicas con acceso no sobrescriben registros ajenos. |
| T3-3 | p-12, p-17 | pendiente | Documento interno con correlativo, catálogo servidor y movimientos por medicamentos vendidos. | Factura y stock se confirman juntos; reintento no duplica folio/movimiento; sin stock devuelve 409. |
| T3-4 | p-16 | pendiente | Descuento porcentual por línea aplicado a precios del catálogo servidor. | Precio/totales manipulados se ignoran o rechazan; descuento inválido falla. |
| T3-5 | p-13, p-24 | pendiente | Prescripción vigente, derivaciones, dispensación, compras, ajustes, costo real, movement_lot y recepción parcial. | Recepciones acumulan cantidades sin sobrepasar pedido; fallo revierte stock, movimiento y recepción. |
| T3-6 | p-11 | pendiente | Abonos manuales por factura, medio y saldo por clínica/dueño; estado Pagada al completar importe. | Abonos parciales y concurrentes consistentes; no duplicar ni mezclar saldo de otras clínicas. |
| T3-7 | p-08 | pendiente | Recordatorios de citas mediante notifications y correo; preferencias, opt-out y registro de entrega. | Reintento no duplica recordatorio; cancelación y opt-out suprimen envíos correspondientes. |
| T3-8 | p-20 | pendiente | Modelo attachments con recurso clínico vinculado y herencia de alcance/tenant. | Un adjunto no amplía acceso al recurso padre; almacenamiento real permanece diferido. |
| T3-9 | p-13, p-17, p-22 | pendiente | Validar agenda → atención → deriva → dispensa → factura → abono. | Escenario completo por API con evidencia SQL de atomicidad. |

## Contratos e interfaces

- Añadir escritura clínica, correcciones/anulaciones, pagos, disponibilidad y finalización compuesta; documentar DTO y transiciones antes del handler.
- Compras aceptan recepción por líneas con cantidades y costo real; respuesta incluye recibido acumulado, pendiente y estado. Agregar estado Parcialmente recibida sin tratar un pedido parcial como cerrado.
- Definir derivaciones recibidas con clínica destino, autorización, aceptación y relación receta/dispensación en D-02 antes de implementar ese paquete.
- Facturas y comprobantes son internos; los identificadores tributarios del proveedor se agregan en Fase 7. No presentar correlativos internos como folios SII.
- Las notificaciones de autenticación/consentimiento de fases anteriores siguen activas; el alcance p-08 de esta fase añade recordatorios de citas.

## Migraciones, compatibilidad y recuperación

Añadir agenda, rooms, eventos clínicos, documentos internos, pagos, órdenes, recepciones, inventario/lotes y attachments. El libro de movimientos es trazable. Evitar doble salida al facturar una dispensación ya descontada: vincular líneas con movimiento origen y comprobar unicidad. Migrar los saldos demo al ámbito de clínica solo como fixtures, sin asumir deuda real.

## Pruebas de fase

- Concurrencia de agenda, boxes, dispensación, facturación y recepción; rollback de fallos intermedios.
- Recibir parcialmente en dos entregas, recibir repetido, cantidad excesiva, lote vencido y costo real.
- Receta vencida, consumo ya registrado y repetición de factura/dispensación no descuentan dos veces.
- Abonos parciales, importes inválidos y recibos internos; reporte consistente por tenant.
- Correcciones preservan historial; cálculo de estado de paciente y recordatorios con reloj controlado.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

Flujo clínico completo por API y pruebas de atomicidad, stock y pagos aprobadas. Recepción parcial pertenece a esta fase según p-24.

## Dependencias externas y decisiones de implementación

D-02: contrato de derivaciones recibidas. D-03: reglas exactas de PatientStatus y prioridad clínica antes de cerrar T3-2. Proveedor de adjuntos no bloquea T3-8.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
