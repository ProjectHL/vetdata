import type { Medication } from "@/domain/medications";
import type { PurchaseOrder, StockMovement, Supplier } from "@/domain/pharmacy";
import type { PharmacyService } from "../contracts";
import { apiFetch, NotImplementedError } from "./client";

export const pharmacy: PharmacyService = {
  /** GET /api/v1/pharmacy/medications */
  listMedications: () => apiFetch<Medication[]>("/api/v1/pharmacy/medications"),
  /** GET /api/v1/pharmacy/movements */
  listMovements: () => apiFetch<StockMovement[]>("/api/v1/pharmacy/movements"),
  /** POST /api/v1/pharmacy/movements — FALTANTE: el backend exige lotId (lote) y el contrato trae medicationId; sin resolución de lote no se puede armar el body. */
  adjustStock: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/movements");
  },
  /** GET /api/v1/pharmacy/suppliers */
  listSuppliers: () => apiFetch<Supplier[]>("/api/v1/pharmacy/suppliers"),
  /** GET /api/v1/pharmacy/purchase-orders */
  listPurchaseOrders: () => apiFetch<PurchaseOrder[]>("/api/v1/pharmacy/purchase-orders"),
  /** POST /api/v1/pharmacy/purchase-orders — el backend usa items[{itemId, qty}]. */
  createPurchaseOrder: ({ supplierId, items }) =>
    apiFetch<PurchaseOrder>("/api/v1/pharmacy/purchase-orders", {
      method: "POST",
      body: { supplierId, items: items.map(({ medicationId, qty }) => ({ itemId: medicationId, qty })) },
    }),
  /** POST /api/v1/pharmacy/purchase-orders/:id/send */
  sendPurchaseOrder: (id) =>
    apiFetch<PurchaseOrder>(`/api/v1/pharmacy/purchase-orders/${encodeURIComponent(id)}/send`, { method: "POST" }),
  /** POST /api/v1/pharmacy/purchase-orders/:id/receive — FALTANTE: el backend exige body items[{itemId, qty, lot, expiry}] y el contrato solo trae el id; no se puede inventar lote/vencimiento. */
  receivePurchaseOrder: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/purchase-orders/:id/receive");
  },
};
