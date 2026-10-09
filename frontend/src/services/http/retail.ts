import type {
  Product,
  RetailMovement,
  RetailOrder,
  RetailSupplier,
  Sale,
  Shipment,
} from "@/domain/retail";
import type { CheckoutResult, RetailService } from "../contracts";
import { apiFetch, NotImplementedError } from "./client";

export const retail: RetailService = {
  /** GET /api/v1/retail/products */
  listProducts: () => apiFetch<Product[]>("/api/v1/retail/products"),
  /** GET /api/v1/retail/suppliers */
  listSuppliers: () => apiFetch<RetailSupplier[]>("/api/v1/retail/suppliers"),
  /** GET /api/v1/retail/sales */
  listSales: () => apiFetch<Sale[]>("/api/v1/retail/sales"),
  /** POST /api/v1/retail/sales — el backend acepta items[{productId, qty}] (sin unitPrice). */
  checkout: ({ items, ownerRut, payment, delivery }) =>
    apiFetch<CheckoutResult>("/api/v1/retail/sales", {
      method: "POST",
      body: {
        items: items.map(({ productId, qty }) => ({ productId, qty })),
        ownerRut,
        payment,
        delivery,
      },
    }),
  /** GET /api/v1/retail/movements */
  listMovements: () => apiFetch<RetailMovement[]>("/api/v1/retail/movements"),
  /** POST /api/v1/retail/transfers */
  transferToSala: (productId, qty) =>
    apiFetch<RetailMovement>("/api/v1/retail/transfers", { method: "POST", body: { productId, qty } }),
  /** POST /api/v1/retail/adjustments — FALTANTE: el backend exige lotId (lote) y el contrato trae productId + location; sin resolución de lote no se puede armar el body. */
  adjust: async () => {
    throw new NotImplementedError("POST /api/v1/retail/adjustments");
  },
  /** GET /api/v1/retail/purchase-orders (ruta real del backend) */
  listOrders: () => apiFetch<RetailOrder[]>("/api/v1/retail/purchase-orders"),
  /** POST /api/v1/retail/purchase-orders — el backend usa items[{itemId, qty}] (sin leadTimeDays). */
  createOrder: ({ supplierId, items }) =>
    apiFetch<RetailOrder>("/api/v1/retail/purchase-orders", {
      method: "POST",
      body: { supplierId, items: items.map(({ productId, qty }) => ({ itemId: productId, qty })) },
    }),
  /** POST /api/v1/retail/purchase-orders/:id/send (ruta real del backend) */
  sendOrder: (id) =>
    apiFetch<RetailOrder>(`/api/v1/retail/purchase-orders/${encodeURIComponent(id)}/send`, { method: "POST" }),
  /** POST /api/v1/retail/purchase-orders/:id/receive — FALTANTE: el backend exige body items[{itemId, qty, lot, expiry}] y el contrato solo trae el id; no se puede inventar lote/vencimiento. */
  receiveOrder: async () => {
    throw new NotImplementedError("POST /api/v1/retail/purchase-orders/:id/receive");
  },
  /** GET /api/v1/retail/shipments */
  listShipments: () => apiFetch<Shipment[]>("/api/v1/retail/shipments"),
  /** POST /api/v1/retail/shipments/:id/advance */
  advanceShipment: (id) =>
    apiFetch<Shipment>(`/api/v1/retail/shipments/${encodeURIComponent(id)}/advance`, { method: "POST" }),
};
