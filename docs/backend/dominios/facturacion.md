# Facturación (clínica)

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-16/p-17: precios servidor, netos y descuento por línea. Pagos manuales en Fase 3; estos documentos internos no son DTE hasta validar proveedor en Fase 7. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/invoices.ts` (`invoiceTotals`) · `src/domain/services.ts` (`Service`, `IVA_RATE`) · `src/services/contracts.ts` (`InvoicesService`, `ClinicService.listServices`) · `src/services/mock/clinic.ts:invoices` · `src/lib/store.tsx:addInvoice` · `src/components/care-actions/invoice-form.tsx` · `src/lib/metrics/customers.ts`

## Propósito
Emitir facturas por atención a un dueño/mascota con prestaciones (catálogo de servicios) y medicamentos vendidos (que salen del inventario de farmacia). Seguimiento de cobranza. Las ventas de tienda usan **boletas** (ver [tienda](tienda.md)).

Pantallas: vista rápida del paciente → "Facturar" (`care-actions/invoice-form.tsx`), registros del paciente/dueño (`care-actions/records.tsx`), Pendientes ("Cobrar factura"), Análisis → Clientes (cobranza) y Reportes.

## Entidades

### Invoice
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | uuid | sí | Servidor. |
| folio | int | sí | Correlativo por clínica, asignado por el servidor (mock: max+1, `mock/db.ts:nextNumber`). |
| patientId | id | sí | Mascota con acceso. |
| ownerRut | RUT | sí | Dueño de la mascota (el servidor debería tomarlo de la mascota, no del cliente). |
| date | date | sí | Hoy (servidor). |
| items | `InvoiceItem[]` | sí | ≥ 1 línea (`invoice-form.tsx`: botón deshabilitado sin líneas). |
| net | int CLP | sí | Calculado. |
| iva | int CLP | sí | Calculado. |
| total | int CLP | sí | Calculado. |
| status | `InvoiceStatus` | sí | `Emitida` al crear. |

### InvoiceItem
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| description | string | sí | Nombre del servicio o medicamento. |
| qty | int > 0 | sí | |
| unitPrice | int CLP | sí | **Neto**. Debe salir del catálogo. |
| medicationId | id | no | Si es medicamento → genera salida de stock. |
| *(recomendado)* serviceId | id | no | Hoy no se guarda; solo descripción. |

### Service (prestación facturable)
`{ id, name, price }` — precio **neto** CLP (`src/domain/services.ts`). Catálogo semilla de 14 prestaciones (`src/mocks/services.ts`).

## Reglas de negocio
1. **Totales**: `net = Σ qty·unitPrice`; `iva = round(net·0,19)`; `total = net + iva`. Fuente: `src/domain/invoices.ts:invoiceTotals`. *(regla; IVA 19 % supuesto del prototipo parametrizable)*. El mock los **recalcula** e ignora los del cliente (`mock/clinic.ts:invoices.create`); el backend DEBE hacer lo mismo.
2. **Folio** correlativo por clínica asignado por el servidor. Fuente: `mock/clinic.ts:invoices.create` (`nextNumber`), `store.tsx:addInvoice` (provisorio). *(regla)*
3. **Medicamentos facturados salen del inventario**: por cada línea con `medicationId`, `StockMovement { type: Salida, reason: Venta, qty: −qty, ref: "Factura <folio>" }` y descuento de stock. Fuente: `mock/clinic.ts:invoices.create`, `store.tsx:addInvoice`. *(regla)* — **atómico** con la factura; con stock insuficiente → 409 (hoy se aplana a 0: `Math.max(0, …)`). La UI solo ofrece medicamentos con `stock > 0` (`invoice-form.tsx`), pero no valida la cantidad.
4. **Precio de medicamento** en factura = `Medication.price` tratado como neto. *(supuesto del prototipo — ambiguo, `preguntas-abiertas.md#p-17`)*.
5. **Estado**: nace `Emitida`; `Pagada` existe pero **no hay operación** para registrar pago. Fuente: `domain/invoices.ts:InvoiceStatus`; `Pagada` solo aparece en semillas y en `records.tsx`. *(hallazgo)* → `preguntas-abiertas.md#p-11`.
6. **Cobranza**: facturas `Emitida` + `Owner.balance > 0`, por antigüedad (0–30, 31–60, > 60 días; factura desde emisión, saldo desde última visita). Fuente: `src/lib/metrics/customers.ts:receivables`. *(regla de reporte)*. Tarea "Cobrar factura N°" por cada factura emitida (`lib/tasks.ts`).
7. **Factura no es DTE**: no hay integración SII, ni RUT/razón social del receptor (solo `ownerRut` persona), ni giro, ni timbre. *(supuesto del prototipo)* → `preguntas-abiertas.md#p-12`.

## Estados
`Emitida → Pagada` (sin operación). Anulación/nota de crédito no existe. Ver [`../estados.md`](../estados.md#factura).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `clinic.listServices` | `GET /api/v1/billable-services` | — | `Service[]` | sesión | 401 | — |
| `invoices.list` | `GET /api/v1/invoices` | `?ownerRut&patientId&status&from&to` | `Invoice[]` | `facturas.emitir` o `reportes.financiero` (propuesto) | 401, 403 | — |
| `invoices.create` | `POST /api/v1/invoices` | `NewInvoice` = `{ patientId, ownerRut, date, items, net, iva, total, status }` (el servidor ignora `date`, `net`, `iva`, `total`, `status`; recomendado aceptar solo `{ patientId, items:[{serviceId|medicationId, qty}] }`) | `Invoice` con folio | `facturas.emitir` | 400, 403 (mascota sin acceso), 409 (stock insuficiente) | Atómico con kardex de farmacia. Evento `FacturaEmitida`; posible `StockBajo` |

## Efectos en otros dominios
- **Farmacia**: salida de stock por medicamento (kardex `Venta`), puede disparar `StockBajo`/tarea `stockmed`.
- **Analítica**: ingresos de servicios/farmacia, gasto por cliente (`customerSpend`), cobranza.
- **Pendientes**: tarea "Cobrar factura".

## Datos de referencia / semilla
Catálogo de prestaciones con precio neto (`src/mocks/services.ts`). Facturas semilla (`src/mocks/invoices.ts`).

## Notas para el dev
- Faltan: registrar pago (método, fecha, monto parcial), anular/nota de crédito, PDF, envío por email, datos tributarios del receptor, descuentos.
- `ownerRut` debería derivarse de la mascota en el servidor (hoy lo envía el cliente).
