import type { Product, ProductCategory, TargetSpecies, RetailMovement, RetailOrder, RetailSupplier, Sale, Shipment } from "@/domain/retail";
import { IVA } from "@/domain/retail";
import type { CheckoutResult, RetailService } from "../contracts";
import { apiFetch } from "./client";

type ApiProduct = { id: string; name: string; category: string; details: Record<string, unknown> | null; priceNet: number; unitCost: number; minStock: number; supplierId: string; lots: { id: string; location: string; lot: string; expiry: string | null; qty: number }[] | null };
type ApiSupplier = { id: string; name: string; rut: string; email: string; phone: string };
type ApiMovement = { id: string; itemId: string; location: string; qty: number; reason: string; referenceId: string | null; actorId: string; at: string };
type ApiOrder = { id: string; number: number; supplierId: string; status: RetailOrder["status"]; createdAt: string; items: { itemId: string; qty: number; received: number; pending: number; unitCost: number }[] | null };
type ApiSale = { id: string; number: number; ownerRut: string | null; payment: Sale["payment"]; deliveryFeeNet: number; total: number; channel: Sale["channel"]; actorId: string; createdAt: string; items: { itemId: string; qty: number; unitPriceNet: number }[] | null };
type ApiShipment = { id: string; saleId: string; ownerRut: string | null; address: string; sector: string; courier: string; scheduledFor: string; status: Shipment["status"] };
const label = (value: unknown) => typeof value === "string" ? value : "";
const date = (value: string) => value.slice(0, 10);
const saleClock = (value: string) => new Date(value).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false });
const saleDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const gross = (net: number) => Math.round(Number(net) * (1 + IVA));

function mapProduct(raw: ApiProduct): Product {
  const details = raw.details ?? {};
  const lots = raw.lots ?? [];
  return {
    id: raw.id, sku: label(details.sku), name: raw.name, brand: label(details.brand),
    category: raw.category as ProductCategory, species: (label(details.species) || "Sin registrar") as TargetSpecies,
    price: gross(raw.priceNet), cost: Number(raw.unitCost),
    stock: {
      central: lots.filter((l) => l.location === "central").reduce((n, l) => n + Number(l.qty), 0),
      sala: lots.filter((l) => l.location === "sala").reduce((n, l) => n + Number(l.qty), 0),
    },
    reorderPoint: Number(raw.minStock), shelfMin: Number(details.shelfMin) || 0,
    supplierId: raw.supplierId, bin: label(details.bin), lots: lots as Product["lots"],
  };
}
const mapSupplier = (raw: ApiSupplier): RetailSupplier => ({ ...raw, contact: "", categories: [], leadTimeDays: 0, minOrder: 0, paymentTerms: "" });
const mapMovement = (raw: ApiMovement): RetailMovement => ({
  id: raw.id, date: date(raw.at), productId: raw.itemId,
  type: raw.reason === "Transferencia" ? "Transferencia" : raw.reason === "Merma" || raw.reason === "Conteo" ? "Ajuste" : raw.qty > 0 ? "Entrada" : "Salida",
  reason: raw.reason === "Transferencia" ? "Reposición sala" : raw.reason as RetailMovement["reason"], location: raw.location as RetailMovement["location"],
  qty: Number(raw.qty), ref: raw.referenceId ?? undefined, user: raw.actorId,
});
const mapOrder = (raw: ApiOrder): RetailOrder => ({
  id: raw.id, number: raw.number, supplierId: raw.supplierId, date: date(raw.createdAt), expected: "",
  items: (raw.items ?? []).map((i) => ({ productId: i.itemId, qty: i.qty, received: i.received, pending: i.pending, unitCost: Number(i.unitCost) })), status: raw.status,
});
const mapSale = (raw: ApiSale): Sale => ({
  id: raw.id, number: raw.number, date: saleDate(raw.createdAt), time: saleClock(raw.createdAt),
  items: (raw.items ?? []).map((i) => ({ productId: i.itemId, qty: i.qty, unitPrice: gross(i.unitPriceNet) })),
  ownerRut: raw.ownerRut ?? undefined, payment: raw.payment, deliveryFee: gross(raw.deliveryFeeNet),
  total: Number(raw.total), seller: raw.actorId, channel: raw.channel,
});
const mapShipment = (raw: ApiShipment): Shipment => ({
  id: raw.id, saleId: raw.saleId, ownerRut: raw.ownerRut ?? "", address: raw.address,
  sector: raw.sector, courier: raw.courier, scheduledFor: raw.scheduledFor, status: raw.status,
});

export const retail: RetailService = {
  listProducts: async () => (await apiFetch<ApiProduct[]>("/api/v1/retail/products")).map(mapProduct),
  listSuppliers: async () => (await apiFetch<ApiSupplier[]>("/api/v1/retail/suppliers")).map(mapSupplier),
  listSales: async () => (await apiFetch<ApiSale[]>("/api/v1/retail/sales")).map(mapSale),
  checkout: async ({ items, ownerRut, payment, delivery, idempotencyKey }): Promise<CheckoutResult> => {
    const raw = await apiFetch<{ sale: ApiSale; shipment?: ApiShipment }>("/api/v1/retail/sales", {
      method: "POST", idempotencyKey, body: { items: items.map(({ productId, qty }) => ({ productId, qty })), ownerRut, payment, delivery },
    });
    return { sale: mapSale(raw.sale), shipment: raw.shipment ? mapShipment(raw.shipment) : undefined };
  },
  listMovements: async () => (await apiFetch<ApiMovement[]>("/api/v1/retail/movements")).map(mapMovement),
  transferToSala: async (productId, qty) => { await apiFetch("/api/v1/retail/transfers", { method: "POST", body: { productId, qty } }); },
  adjust: async ({ lotId, qty, reason }) => {
    if (!lotId) throw new Error("Selecciona un lote para ajustar el stock.");
    await apiFetch("/api/v1/retail/adjustments", { method: "POST", body: { lotId, qty, reason } });
  },
  listOrders: async () => (await apiFetch<ApiOrder[]>("/api/v1/retail/purchase-orders")).map(mapOrder),
  createOrder: async ({ supplierId, items }) => mapOrder(await apiFetch<ApiOrder>("/api/v1/retail/purchase-orders", {
    method: "POST", body: { supplierId, items: items.map(({ productId, qty }) => ({ itemId: productId, qty })) },
  })),
  sendOrder: async (id) => mapOrder(await apiFetch<ApiOrder>(`/api/v1/retail/purchase-orders/${encodeURIComponent(id)}/send`, { method: "POST" })),
  receiveOrder: async (id, items) => {
    if (!items?.length) throw new Error("Indica los lotes recibidos.");
    return mapOrder(await apiFetch<ApiOrder>(`/api/v1/retail/purchase-orders/${encodeURIComponent(id)}/receive`, {
      method: "POST", body: { items: items.map(({ productId, qty, lot, expiry }) => ({ itemId: productId, qty, lot: lot.trim(), expiry: expiry ?? "" })) },
    }));
  },
  listShipments: async () => (await apiFetch<ApiShipment[]>("/api/v1/retail/shipments")).map(mapShipment),
  advanceShipment: async (id) => mapShipment(await apiFetch<ApiShipment>(`/api/v1/retail/shipments/${encodeURIComponent(id)}/advance`, { method: "POST" })),
};
