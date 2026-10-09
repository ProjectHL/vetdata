# Tienda (productos, punto de venta, bodega, compras, despachos)

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. Precios persistidos netos y presentación bruta según p-17. Reutilizar recepción por cantidades/lotes de Fase 3; el flujo de recepción total del mock no limita el backend. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/retail.ts` (`deliveryFee`, `ivaIncluded`, `totalStock`, `stockLevel`, `margin`, `SHIPMENT_FLOW`, `LOCATIONS`, `COURIERS`) · `src/services/contracts.ts` (`RetailService`) · `src/services/mock/retail.ts` · `src/lib/retail-store.tsx` · `src/lib/metrics/retail.ts` · `src/components/retail/*`

## Propósito
Venta de productos para mascotas (alimentos, accesorios, ropa, juguetes…) en mesón, con dos ubicaciones de stock (bodega central y sala de ventas), reposición de sala, órdenes de compra a proveedores y despachos a domicilio.

Pantallas: `/tienda/productos`, `/tienda/venta` (POS), `/tienda/ventas`, `/tienda/bodega` (stock por ubicación, transferencias, ajustes, kardex), `/tienda/compras`, `/tienda/despachos`, `/analisis/tienda`.

## Entidades

### Product
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | id | sí | |
| sku | string | sí | Único por clínica. |
| name, brand | string | sí | |
| category | `ProductCategory` | sí | `Alimentos \| Snacks \| Accesorios \| Ropa \| Juguetes \| Higiene \| Camas y transporte`. |
| species | `TargetSpecies` | sí | `Perro \| Gato \| Ave \| Conejo \| Todas`. |
| price | int CLP | sí | **Con IVA**. |
| cost | int CLP | sí | **Neto**. |
| stock | `{ central: int≥0, sala: int≥0 }` | sí | Solo cambia por movimientos. |
| reorderPoint | int | sí | Mínimo total (central + sala) antes de comprar. |
| shelfMin | int | sí | Mínimo exhibido en sala. |
| supplierId | id | sí | |
| bin | string | sí | Pasillo/estante en bodega central. |

### RetailSupplier
`{ id, name, rut, contact, phone, email, categories: ProductCategory[], leadTimeDays, minOrder, paymentTerms }`. Solo lectura. `minOrder` (monto mínimo) **no se valida** en la UI ni en el mock.

### Sale (boleta)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| number | int | sí | N° de boleta, correlativo por clínica (servidor). |
| date, time | date, `HH:mm` | sí | Servidor (→ datetime). |
| items | `SaleItem[]` | sí | `{ productId, qty, unitPrice }`, `unitPrice` con IVA (del catálogo). |
| ownerRut | RUT | no | Cliente identificado (opcional). |
| payment | `PaymentMethod` | sí | `Efectivo \| Débito \| Crédito \| Transferencia`. |
| deliveryFee | int CLP | sí | Con IVA; 0 si retiro. |
| total | int CLP | sí | `Σ qty·unitPrice + deliveryFee`. |
| seller | userId | sí | Servidor (hoy nombre). |
| channel | `SaleChannel` | sí | `Mesón` (POS) \| `Web` (solo semillas; no hay canal web). |

### Shipment (despacho)
`{ id, saleId, ownerRut, address, sector, courier, scheduledFor: date, status: ShipmentStatus }`. Dirección y sector copiados del dueño al vender. Couriers: `Reparto propio`, `Pedidos Ya Envíos`, `Chilexpress` (`COURIERS`).

### RetailMovement (kardex tienda)
| Campo | Tipo | Descripción |
|---|---|---|
| id, date, productId, user | | |
| type | `RetailMovementType` | `Entrada \| Salida \| Transferencia \| Ajuste`. |
| reason | `RetailMovementReason` | `Compra \| Venta \| Reposición sala \| Merma \| Conteo`. |
| location | `Location` | Ubicación afectada; en transferencias, el **destino**. |
| from | `Location` | Solo transferencias (origen). |
| qty | int | Signo según tipo; en transferencia, positivo (unidades movidas). |
| ref | string | "Boleta 123", "OC 45". |

### RetailOrder (OC tienda)
`{ id, number, supplierId, date, expected: date, items: {productId, qty, unitCost}[], status: RetailOrderStatus, receivedAt? }`.

## Reglas de negocio
1. **Nivel de stock**: `total == 0 → Agotado`; `total ≤ reorderPoint → Comprar`; `sala < shelfMin → Reponer sala`; si no `OK`. Fuente: `src/domain/retail.ts:stockLevel`, `totalStock`. *(regla)*
2. **Margen** % = `round(((price/1,19 − cost) / (price/1,19)) × 100)`. Fuente: `retail.ts:margin`. *(regla)*
3. **IVA incluido** en boleta = `round(gross − gross/1,19)`. Fuente: `retail.ts:ivaIncluded`; mostrado en POS (`pos.tsx`). *(regla)*
4. **Costo de despacho**: gratis si el sector del dueño es `"Providencia"` (comuna de la clínica), si no tarifa plana **$3.990** (con IVA). Fuente: `retail.ts:deliveryFee`. *(supuesto del prototipo: comuna y tarifa hardcodeadas; deben salir del perfil de la clínica / tabla de tarifas)*.
5. **Despacho requiere cliente identificado** (`ownerRut` existente). Sin dueño, el despacho se ignora silenciosamente. Fuente: `mock/retail.ts:checkout` (`delivery && owner`), `pos.tsx` (checkbox deshabilitado sin cliente). *(regla)* → backend: 400 si `delivery` sin `ownerRut` válido.
6. **Checkout**: vende desde **sala**; por ítem `Salida/Venta` en sala con `ref = "Boleta <n>"`; si despacho → `Shipment { status: Por preparar, scheduledFor: mañana }`. Fuente: `mock/retail.ts:checkout`, `retail-store.tsx:checkout`. *(regla)* — **atómico**; stock de sala insuficiente → 409 (la UI limita la cantidad a `stock.sala`, `pos.tsx:setQty`; el servidor hoy aplana a 0). `scheduledFor = hoy + 1` es *(supuesto del prototipo)*.
7. **Precios desde catálogo**: el cliente envía `unitPrice`; el servidor DEBE usar `Product.price` vigente. *(regla)*
8. **Transferencia a sala**: `central −= qty`, `sala += qty`, tipo `Transferencia`, motivo `Reposición sala`. Fuente: `mock/retail.ts:transferToSala` / `record`. *(regla)* — hoy **sin** clamp: central puede quedar negativa; DEBE 409 si `qty > central`. La UI deshabilita si `central == 0`. Cantidad sugerida `min(central, max(0, 2·shelfMin − sala))` (`warehouse.tsx:refillQty`, `lib/tasks.ts`).
9. **Ajuste**: motivo `Conteo` (delta = contado − sistema, puede ser + o −) o `Merma` (siempre negativo); en una ubicación. Fuente: `src/components/retail/warehouse.tsx` (diálogo de ajuste), `mock/retail.ts:adjust`. *(regla)* — backend: `reason ∈ {Merma, Conteo}`, `Merma ⇒ qty < 0`, `qty ≠ 0`, no dejar negativo.
10. **OC tienda**: crea `Borrador` con `unitCost = Product.cost` y `expected = hoy + leadTimeDays` (el cliente envía `leadTimeDays`; el servidor debería tomarlo del proveedor). Fuente: `mock/retail.ts:createOrder`. *(regla)*
11. **Enviar OC**: `Borrador → Enviada`; **Recibir**: `Enviada → Recibida`, `Entrada/Compra` a **central** por ítem, `receivedAt = hoy`. Fuente: `mock/retail.ts:sendOrder, receiveOrder`. *(regla)* → 409 en otros estados.
12. **Despacho avanza linealmente** por `SHIPMENT_FLOW` (`Por preparar → Preparado → En ruta → Entregado`); en `Entregado` no cambia. Fuente: `mock/retail.ts:advanceShipment`. *(regla)* → 409 al avanzar desde `Entregado`. No hay retroceso ni cancelación.
13. **Despachos atrasados**: no `Entregado` y `scheduledFor < hoy`; "a tiempo" = entregados / (entregados + atrasados). Fuente: `src/lib/metrics/retail.ts:shipmentKpis`. *(supuesto del prototipo: no se guarda fecha real de entrega → agregar `deliveredAt`)*.

## Estados
- RetailOrder: `Borrador → Enviada → Recibida`.
- Shipment: `Por preparar → Preparado → En ruta → Entregado`.
- `StockLevel` derivado.
Ver [`../estados.md`](../estados.md).

## Operaciones y endpoints

> Estado T4-1: implementados `retail.checkout`, `retail.listSales`, `retail.transferToSala`, `retail.adjust` (retail), `retail.listShipments`, `retail.advanceShipment` + OC retail (`createOrder`/`sendOrder`/`receiveOrder` a central con recepción parcial). Migración `009_retail_sales.sql` (`retail_sales`, `retail_sale_lines`, `shipments`).

| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `retail.listProducts` | `GET /api/v1/retail/products` | — | `Product[]` con stock y lotes | `tienda.inventario` | 401, 403 | — |
| `retail.listSuppliers` | `GET /api/v1/retail/suppliers` | — | `RetailSupplier[]` | `tienda.inventario` | 401, 403 | — |
| `retail.listSales` ✅ | `GET /api/v1/retail/sales` | `?from&to&ownerRut&payment` | `Sale[]` con líneas | `tienda.vender` o `reportes.financiero` | 400 (RUT/fecha/medio), 403, 404 (dueño) | — |
| `retail.checkout` ✅ | `POST /api/v1/retail/sales` | `{ items, ownerRut?, payment, delivery?: {courier, address?} }` (precios siempre desde catálogo) | `{ sale, shipment? }` | `tienda.vender` | 400 (RUT inválido, courier desconocido, despacho sin cliente), 404 (producto/dueño), 409 (stock sala/inactivo) | Atómico: boleta + folio + kardex `Venta` FEFO en sala + despacho opcional. Eventos `sale.created`, `shipment.created` |
| `retail.listMovements` | `GET /api/v1/retail/movements` | — | movimientos de productos | `tienda.inventario` | 401, 403 | — |
| `retail.transferToSala` ✅ | `POST /api/v1/retail/transfers` | `{ productId, qty>0 }` | `{ productId, qty, to: sala }` | `tienda.inventario` | 400, 404, 409 (central insuficiente) | Kardex `Transferencia` (salida central + entrada sala). Evento `inventory.transferred` |
| `retail.adjust` ✅ | `POST /api/v1/retail/adjustments` | `{ lotId, qty≠0, reason: Merma\|Conteo }` | movimiento | `tienda.inventario` | 400 (Merma positiva, razón), 404, 409 (dejaría negativo) | Kardex. Evento `inventory.adjusted` |
| `retail.listOrders` | `GET /api/v1/retail/orders` | `?status` | `RetailOrder[]` | `tienda.compras` (propuesto) | 401, 403 | — |
| `retail.createOrder` | `POST /api/v1/retail/orders` | `{ supplierId, items, leadTimeDays }` | `RetailOrder` | `tienda.compras` | 400, 404 | — |
| `retail.sendOrder` | `POST /api/v1/retail/orders/:id/send` | — | `RetailOrder` | `tienda.compras` | 404, 409 | Envío al proveedor no existe |
| `retail.receiveOrder` | `POST /api/v1/retail/orders/:id/receive` | — | `RetailOrder` | `tienda.compras` | 404, 409 | Atómico con kardex. Evento `OCRecibida` |
| `retail.listShipments` ✅ | `GET /api/v1/retail/shipments` | `?status&date` | `Shipment[]` | `tienda.inventario` | 400, 403 | — |
| `retail.advanceShipment` ✅ | `POST /api/v1/retail/shipments/:id/advance` | — | `Shipment` | `tienda.inventario` | 404, 409 (ya entregado) | `delivered_at` al entregar. Evento `shipment.advanced` |

## Efectos en otros dominios
- Analítica: ventas, margen por categoría (`marginByCategory`), rotación (`productTurnover`), venta cruzada por especie (`crossSellBySpecies`), gasto por cliente (clínica + tienda), omnicanalidad.
- Pendientes: `despacho:*`, `sala:*`, `octda:*`.
- Seguridad: existe el tipo de evento "Caja abierta sin venta" (zona tienda) sin integración con el POS.

## Datos de referencia / semilla
Productos (`src/mocks/retail.ts:seedProducts`), proveedores, ventas deterministas, OCs, movimientos, despachos generados (`buildSeedShipments`), `CATEGORIES`, `PAYMENT_METHODS`, `COURIERS`, `LOCATIONS`.

## Notas para el dev
- Boleta no es DTE (SII), no hay pago con pasarela ni cierre de caja (`#p-11`, `#p-12`).
- No hay devoluciones/anulaciones de venta ni cancelación de despachos.
- `Sale.channel = "Web"` aparece en semillas pero no existe e-commerce.
