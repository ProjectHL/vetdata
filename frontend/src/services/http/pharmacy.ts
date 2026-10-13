import type { Medication, MedCategory } from "@/domain/medications";
import type { MovementReason, PurchaseOrder, StockMovement, Supplier } from "@/domain/pharmacy";
import type { PharmacyService } from "../contracts";
import { apiFetch } from "./client";

type ApiLot = { id: string; location: string; lot: string; expiry: string | null; qty: number };
type ApiMedication = {
  id: string; name: string; category: string; details: Record<string, unknown> | null;
  stock: number; minStock: number; priceNet: number; unitCost: number; supplierId: string;
  prescriptionRequired: boolean; lots: ApiLot[] | null;
};
type ApiMovement = {
  id: string; itemId: string; lotId: string; qty: number; reason: string;
  referenceId: string | null; actorId: string; at: string;
};
type ApiSupplier = { id: string; name: string; rut: string; email: string; phone: string };
type ApiOrder = {
  id: string; number: number; supplierId: string; status: PurchaseOrder["status"];
  createdAt: string;
  items: { itemId: string; qty: number; received: number; pending: number; unitCost: number }[] | null;
};

const detail = (value: unknown) => typeof value === "string" ? value : "";
const date = (value: string | null | undefined) => value?.slice(0, 10) ?? "";

function mapMedication(raw: ApiMedication): Medication {
  const lots = raw.lots ?? [];
  const first = lots.filter((lot) => lot.qty > 0 && lot.expiry).sort((a, b) => date(a.expiry).localeCompare(date(b.expiry)))[0];
  const details = raw.details ?? {};
  return {
    id: raw.id,
    name: raw.name,
    activeIngredient: detail(details.activeIngredient),
    category: raw.category as MedCategory,
    presentation: detail(details.presentation),
    stock: Number(raw.stock),
    minStock: raw.minStock,
    unit: detail(details.unit),
    expiry: date(first?.expiry),
    lot: first?.lot ?? "",
    prescription: raw.prescriptionRequired,
    price: Number(raw.priceNet),
    unitCost: Number(raw.unitCost),
    supplierId: raw.supplierId,
    lots,
  };
}

function mapMovement(raw: ApiMovement): StockMovement {
  return {
    id: raw.id,
    medicationId: raw.itemId,
    date: date(raw.at),
    type: raw.reason === "Merma" || raw.reason === "Vencimiento" ? "Ajuste" : raw.qty > 0 ? "Entrada" : "Salida",
    reason: raw.reason as MovementReason,
    qty: raw.qty,
    ref: raw.referenceId ?? undefined,
    user: raw.actorId,
  };
}

function mapSupplier(raw: ApiSupplier): Supplier {
  return { ...raw, contact: "", categories: [], leadTimeDays: 0, paymentTerms: "" };
}

function mapOrder(raw: ApiOrder): PurchaseOrder {
  return {
    id: raw.id,
    number: raw.number,
    supplierId: raw.supplierId,
    date: date(raw.createdAt),
    items: (raw.items ?? []).map((item) => ({
      medicationId: item.itemId,
      qty: item.qty,
      received: item.received,
      pending: item.pending,
      unitCost: Number(item.unitCost),
    })),
    status: raw.status,
  };
}

export const pharmacy: PharmacyService = {
  listMedications: async () => (await apiFetch<ApiMedication[]>("/api/v1/pharmacy/medications")).map(mapMedication),
  listMovements: async () => (await apiFetch<ApiMovement[]>("/api/v1/pharmacy/movements")).map(mapMovement),
  adjustStock: async ({ lotId, qty, reason }) => {
    if (!lotId) throw new Error("Selecciona un lote para ajustar el stock.");
    const saved = await apiFetch<{ id: string; itemId: string; lotId: string; qty: number; reason: string }>("/api/v1/pharmacy/movements", {
      method: "POST", body: { lotId, qty, reason },
    });
    return mapMovement({ ...saved, referenceId: null, actorId: "", at: new Date().toISOString() });
  },
  listSuppliers: async () => (await apiFetch<ApiSupplier[]>("/api/v1/pharmacy/suppliers")).map(mapSupplier),
  listPurchaseOrders: async () => (await apiFetch<ApiOrder[]>("/api/v1/pharmacy/purchase-orders")).map(mapOrder),
  createPurchaseOrder: async ({ supplierId, items }) => mapOrder(await apiFetch<ApiOrder>("/api/v1/pharmacy/purchase-orders", {
    method: "POST",
    body: { supplierId, items: items.map(({ medicationId, qty }) => ({ itemId: medicationId, qty })) },
  })),
  sendPurchaseOrder: async (id) => mapOrder(await apiFetch<ApiOrder>(`/api/v1/pharmacy/purchase-orders/${encodeURIComponent(id)}/send`, { method: "POST" })),
  receivePurchaseOrder: async (id, items) => {
    if (!items?.length) throw new Error("Indica los lotes recibidos.");
    return mapOrder(await apiFetch<ApiOrder>(`/api/v1/pharmacy/purchase-orders/${encodeURIComponent(id)}/receive`, {
      method: "POST",
      body: { items: items.map(({ medicationId, qty, lot, expiry }) => ({ itemId: medicationId, qty, lot: lot.trim(), expiry })) },
    }));
  },
};
