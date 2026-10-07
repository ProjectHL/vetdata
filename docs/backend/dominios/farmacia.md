# Farmacia (inventario de medicamentos, derivaciones/recetas, compras)

> Fuentes: `src/domain/medications.ts` (`stockStatus`, `expiryStatus`, `EXPIRY_WARNING_DAYS`) · `src/domain/pharmacy.ts` (`COST_RATIO`) · `src/domain/referrals.ts` (`INTERNAL_PHARMACY`) · `src/services/contracts.ts` (`PharmacyService`, `ReferralsService`) · `src/services/mock/pharmacy.ts` (`recordMovements`) · `src/services/mock/clinic.ts:referrals` · `src/lib/store.tsx` (farmacia) · `src/lib/metrics/pharmacy.ts` · `src/components/pharmacy/*` · `src/components/care-actions/referral-form.tsx`

## Propósito
Inventario de medicamentos de la clínica con kardex, alertas de stock bajo y vencimiento, cola de recetas derivadas a la farmacia interna para dispensar, y órdenes de compra a proveedores.

Pantallas: `/farmacia/medicamentos`, `/farmacia/movimientos` (kardex + cola de dispensación), `/farmacia/proveedores` (proveedores, sugerencia de reposición, OCs), vista rápida del paciente → "Derivar medicamentos".

## Entidades

### Medication
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | id | sí | |
| name, activeIngredient, presentation, unit | string | sí | |
| category | `MedCategory` | sí | `Antibiótico \| Antiparasitario \| Antiinflamatorio \| Analgésico \| Anestésico \| Vacuna \| Cardiológico \| Gastrointestinal`. |
| stock | int ≥ 0 | sí | **Solo cambia por movimientos** (nunca por PATCH). |
| minStock | int ≥ 0 | sí | Umbral de stock bajo. |
| expiry | date | sí | Vencimiento del lote. |
| lot | string | sí | **Un solo lote por medicamento** *(supuesto del prototipo, `preguntas-abiertas.md#p-24`)*. |
| prescription | bool | sí | Requiere receta. |
| price | int CLP | sí | Precio de venta unitario (neto/bruto ambiguo, `#p-17`). |
| supplierId | id | sí | Proveedor habitual. |

### StockMovement (kardex)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| date | date | sí | Servidor (recomendado datetime). |
| medicationId | id | sí | |
| type | `MovementType` | sí | `Entrada \| Salida \| Ajuste`. |
| reason | `MovementReason` | sí | `Compra \| Dispensación \| Venta \| Merma \| Vencimiento \| Transferencia`. |
| qty | int ≠ 0 | sí | Positivo entra, negativo sale. |
| ref | string | no | Documento origen: "Factura 1234", "OC 17", "Derivación Luna" → recomendado `{refType, refId}`. |
| user | userId | sí | Servidor (hoy nombre). |

Append-only (no se edita ni borra; se corrige con otro ajuste).

### Supplier (proveedor farmacia)
`{ id, name, rut, contact, phone, email, categories[], leadTimeDays, paymentTerms }`. Solo lectura en el prototipo. RUT con puntos en semilla → normalizar y validar.

### PurchaseOrder (OC farmacia)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| number | int | sí | Correlativo por clínica (servidor). |
| supplierId | id | sí | |
| date | date | sí | Creación. |
| items | `{ medicationId, qty, unitCost }[]` | sí | ≥ 1; `unitCost` lo calcula el servidor. |
| status | `PurchaseOrderStatus` | sí | `Borrador` al crear. |
| receivedAt | date | no | Al recibir. |

### Referral (derivación / ficha de medicamentos)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| id | uuid | sí | |
| patientId | id | sí | Con acceso. |
| date | date | sí | |
| doctorId | id | sí | Prescriptor (la UI usa el profesional del usuario actual). |
| destination | string | sí | `"Farmacia interna"` o **nombre** de una clínica de la red (→ `clinicId` o enum `INTERNAL`). |
| items | `ReferralItem[]` | sí | ≥ 1; cada uno con `dose` obligatorio (`referral-form.tsx`). |
| notes | string | sí | Puede ser vacío. |
| status | `ReferralStatus` | sí | `Enviada` al crear. |

`ReferralItem { medicationId, dose, frequency, duration, qty }`.

## Reglas de negocio
1. **Estado de stock**: `stock == 0 → Sin stock`; `stock < minStock → Stock bajo`; si no `Disponible`. Fuente: `src/domain/medications.ts:stockStatus`. *(regla)*
2. **Estado de vencimiento**: `días < 0 → vencido`; `≤ 60 → por vencer`; si no `ok`. Fuente: `src/domain/medications.ts:expiryStatus`, `EXPIRY_WARNING_DAYS = 60`. *(regla; 60 días supuesto del prototipo parametrizable)*.
3. **Movimientos aplican delta al stock**; hoy `stock = max(0, stock + qty)`. Fuente: `src/services/mock/pharmacy.ts:recordMovements`, `store.tsx:recordMovements`. *(regla)* — **DEBE**: rechazar con 409 si el stock resultante sería negativo (en vez de aplanar a 0 y dejar el kardex descuadrado).
4. **Ajuste manual** (UI): solo motivos `Merma` o `Vencimiento`, solo descuenta, `1 ≤ qty ≤ stock`. Fuente: `src/components/pharmacy/adjust-stock-dialog.tsx` (`REASONS`, `max`). *(regla)* — el contrato `AdjustStockInput` acepta cualquier `reason` y signo: el backend DEBE restringir `reason ∈ {Merma, Vencimiento}` (y quizá `Conteo` futuro), `qty < 0` y tipo `Ajuste`. `Compra`, `Dispensación`, `Venta` solo los generan sus operaciones.
5. **Derivar** (crear referral): destino farmacia interna o clínica de la red distinta de la actual; nace `Enviada`. Fuente: `src/components/care-actions/referral-form.tsx` (`destinations`), `mock/clinic.ts:referrals.create`. *(regla)* — se permite derivar medicamentos sin stock (solo muestra badge).
6. **Dispensar**: solo si `destination == "Farmacia interna"` y `status != Dispensada`; genera `Salida/Dispensación` por ítem (`ref = "Derivación <mascota>"`) y pasa a `Dispensada`. Fuente: `mock/clinic.ts:referrals.dispense`, `store.tsx:dispenseReferral`. *(regla)* — la UI bloquea si algún ítem no tiene stock suficiente (`dispense-queue.tsx` `blocked`; `lib/tasks.ts` sin acción rápida). Backend: 409 si destino externo, ya dispensada o stock insuficiente (hoy el mock devuelve la derivación sin cambios). **Atómico**.
7. **Estado `Recibida`** de derivación: existe en el tipo y en una semilla (`src/mocks/referrals.ts`), pero **ninguna operación** lo asigna. Interpretación: la clínica de destino (externa) acusó recibo. *(hallazgo)* → `preguntas-abiertas.md#p-13`.
8. **OC farmacia**: crear en `Borrador` con `unitCost = round(Medication.price × COST_RATIO)`, `COST_RATIO = 0,55`. Fuente: `mock/pharmacy.ts:createPurchaseOrder`, `src/domain/pharmacy.ts:COST_RATIO`. *(supuesto del prototipo: costo estimado como 55 % del precio de venta; en producción debe venir de la lista de precios del proveedor o del último costo)*.
9. **Sugerencia de reposición**: medicamentos no `Disponible` sin OC abierta (`status != Recibida`), agrupados por proveedor habitual, cantidad sugerida `max(0, 2·minStock − stock)`. Fuente: `src/components/pharmacy/purchasing.tsx:suggestedQty`. *(regla de UI; candidata a endpoint calculado)*.
10. **Enviar OC**: solo `Borrador → Enviada`. Fuente: `mock/pharmacy.ts:sendPurchaseOrder`. *(regla)* → 409 en otro estado.
11. **Recibir OC**: solo `Enviada → Recibida`; `Entrada/Compra` por ítem (`ref = "OC <n>"`), `receivedAt = hoy`. Fuente: `mock/pharmacy.ts:receivePurchaseOrder`, `store.tsx:receivePurchaseOrder`. *(regla)* — recepción total; no hay recepción parcial ni actualización de lote/vencimiento al recibir (`#p-24`).
12. **Venta por factura** descuenta stock (ver [facturacion](facturacion.md)). *(regla)*
13. **Valor por vencer** = Σ stock × round(price × COST_RATIO) de medicamentos `vencido`/`por vencer` con stock. Fuente: `src/lib/metrics/pharmacy.ts:expiringValue`. *(métrica)*

## Estados
- Referral: `Enviada → Dispensada` (interna) · `Enviada → Recibida` (externa, sin operación).
- PurchaseOrder: `Borrador → Enviada → Recibida`.
- Derivados: `StockStatus`, `ExpiryStatus`.
Ver [`../estados.md`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `pharmacy.listMedications` | `GET /api/v1/pharmacy/medications` | `?category&stockStatus&expiryStatus` | `Medication[]` (recomendado incluir `stockStatus`, `expiryStatus`) | sesión | 401 | — |
| `pharmacy.listMovements` | `GET /api/v1/pharmacy/movements` | `?medicationId&from&to&type` (kardex con saldo) | `StockMovement[]` | `farmacia.dispensar` o `farmacia.inventario` (propuesto) | 401, 403 | — |
| `pharmacy.adjustStock` | `POST /api/v1/pharmacy/movements` | `{ medicationId, qty, reason }` | `StockMovement` | `farmacia.inventario` | 400 (reason/sign), 404, 409 (stock negativo) | Kardex; posible `StockBajo` |
| `pharmacy.listSuppliers` | `GET /api/v1/pharmacy/suppliers` | — | `Supplier[]` | sesión | 401 | — |
| `pharmacy.listPurchaseOrders` | `GET /api/v1/pharmacy/purchase-orders` | `?status` | `PurchaseOrder[]` | `farmacia.inventario` (propuesto) | 401, 403 | — |
| `pharmacy.createPurchaseOrder` | `POST /api/v1/pharmacy/purchase-orders` | `{ supplierId, items:[{medicationId, qty>0}] }` | `PurchaseOrder` (Borrador) | `farmacia.inventario` | 400, 404 | — |
| `pharmacy.sendPurchaseOrder` | `POST /api/v1/pharmacy/purchase-orders/:id/send` | — | `PurchaseOrder` | `farmacia.inventario` | 404, 409 | Envío real al proveedor no existe (`#p-08`) |
| `pharmacy.receivePurchaseOrder` | `POST /api/v1/pharmacy/purchase-orders/:id/receive` | — (futuro: cantidades/lotes recibidos) | `PurchaseOrder` | `farmacia.inventario` | 404, 409 | Atómico con kardex. Evento `OCRecibida` |
| `referrals.list` | `GET /api/v1/referrals` | `?status&destination&patientId` | `Referral[]` (de mi clínica; las dirigidas a mí desde otra clínica: ver notas) | sesión | 401 | — |
| `referrals.create` | `POST /api/v1/referrals` | `NewReferral` (status ignorado → `Enviada`) | `Referral` | `medicamentos.derivar` | 400, 403 (sin acceso a la mascota) | Evento `RecetaDerivada` (a farmacia interna o clínica destino) |
| `referrals.dispense` | `POST /api/v1/referrals/:id/dispense` | — | `Referral` | `farmacia.dispensar` | 404, 409 (externa, ya dispensada, sin stock) | Atómico con kardex. Evento `RecetaDispensada` |

## Efectos en otros dominios
- Factura (clínica) genera salidas `Venta`.
- Tareas: `receta:*`, `stockmed:*`, `ocfar:*`.
- Analítica: rotación, cobertura, valor por vencer, ingresos farmacia.

## Datos de referencia / semilla
Medicamentos (`src/mocks/medications.ts`), proveedores, OCs y movimientos semilla (`src/mocks/pharmacy.ts`), derivaciones (`src/mocks/referrals.ts`), categorías `MedCategory`.

## Notas para el dev
- Derivación a otra clínica: no está definido cómo la ve la clínica de destino (no hay `referrals` recibidas ni operación de recibir). `#p-13`.
- Medicamentos controlados/receta retenida y firma electrónica del prescriptor no existen (`#p-13`).
- Un lote por medicamento: para vencimientos reales se necesita stock por lote (FEFO).
