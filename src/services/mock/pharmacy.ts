import { COST_RATIO, type StockMovement } from "@/domain/pharmacy";
import { TODAY } from "@/lib/format";
import type { PharmacyService } from "../contracts";
import { actor, db, mockId, nextNumber, notFound, ok, patchById } from "./db";

/** Registra movimientos y aplica el delta al stock (igual que el store). */
export function recordMovements(list: Omit<StockMovement, "id" | "date" | "user">[]) {
  const created = list.map((m) => ({ ...m, id: mockId("mv"), date: TODAY, user: actor().name }));
  db.movements.push(...created);
  for (const m of created) {
    patchById(db.medications, m.medicationId, (med) => ({ ...med, stock: Math.max(0, med.stock + m.qty) }));
  }
  return created;
}

export const pharmacy: PharmacyService = {
  listMedications: () => ok(db.medications),
  listMovements: () => ok(db.movements),
  adjustStock: ({ medicationId, qty, reason }) => ok(recordMovements([{ medicationId, type: "Ajuste", reason, qty }])[0]),
  listSuppliers: () => ok(db.suppliers),
  listPurchaseOrders: () => ok(db.purchaseOrders),
  createPurchaseOrder: ({ supplierId, items }) => {
    const created = {
      id: mockId("oc"),
      number: nextNumber(db.purchaseOrders.map((o) => o.number)),
      supplierId,
      date: TODAY,
      items: items.map((i) => ({
        ...i,
        unitCost: Math.round((db.medications.find((m) => m.id === i.medicationId)?.price ?? 0) * COST_RATIO),
      })),
      status: "Borrador" as const,
    };
    db.purchaseOrders.push(created);
    return ok(created);
  },
  sendPurchaseOrder: (id) => {
    const order = patchById(db.purchaseOrders, id, (o) => (o.status === "Borrador" ? { ...o, status: "Enviada" as const } : o));
    return order ? ok(order) : notFound("Orden de compra", id);
  },
  receivePurchaseOrder: (id) => {
    const order = db.purchaseOrders.find((o) => o.id === id);
    if (!order) return notFound("Orden de compra", id);
    if (order.status !== "Enviada") return ok(order);
    recordMovements(
      order.items.map((i) => ({ medicationId: i.medicationId, type: "Entrada", reason: "Compra", qty: i.qty, ref: `OC ${order.number}` }))
    );
    return ok(patchById(db.purchaseOrders, id, (o) => ({ ...o, status: "Recibida", receivedAt: TODAY }))!);
  },
};
