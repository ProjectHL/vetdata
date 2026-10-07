import { type RetailMovement, SHIPMENT_FLOW, type Sale, type Shipment, deliveryFee } from "@/domain/retail";
import { NOW_TIME, TODAY, addDays } from "@/lib/format";
import type { RetailService } from "../contracts";
import { actor, db, mockId, nextNumber, notFound, ok, patchById } from "./db";

/** Registra movimientos de tienda y aplica el delta por ubicación (igual que el store). */
function record(list: Omit<RetailMovement, "id" | "date" | "user">[]) {
  const created = list.map((m) => ({ ...m, id: mockId("rm"), date: TODAY, user: actor().name }));
  db.retailMovements.push(...created);
  for (const m of created) {
    patchById(db.products, m.productId, (p) => {
      const stock = { ...p.stock };
      if (m.type === "Transferencia" && m.from) {
        stock[m.from] -= m.qty;
        stock[m.location] += m.qty;
      } else {
        stock[m.location] = Math.max(0, stock[m.location] + m.qty);
      }
      return { ...p, stock };
    });
  }
  return created;
}

export const retail: RetailService = {
  listProducts: () => ok(db.products),
  listSuppliers: () => ok(db.retailSuppliers),
  listSales: () => ok(db.sales),
  checkout: ({ items, ownerRut, payment, delivery }) => {
    const owner = ownerRut ? db.owners.find((o) => o.rut === ownerRut) : undefined;
    const fee = delivery && owner ? deliveryFee(owner.sector) : 0;
    const sale: Sale = {
      id: mockId("s"),
      number: nextNumber(db.sales.map((s) => s.number)),
      date: TODAY,
      time: NOW_TIME,
      items,
      ownerRut,
      payment,
      deliveryFee: fee,
      total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + fee,
      seller: actor().name,
      channel: "Mesón",
    };
    db.sales.push(sale);
    record(items.map((i) => ({ productId: i.productId, type: "Salida", reason: "Venta", location: "sala", qty: -i.qty, ref: `Boleta ${sale.number}` })));
    let shipment: Shipment | undefined;
    if (delivery && owner) {
      shipment = {
        id: mockId("sh"),
        saleId: sale.id,
        ownerRut: owner.rut,
        address: owner.address,
        sector: owner.sector,
        courier: delivery.courier,
        scheduledFor: addDays(TODAY, 1),
        status: "Por preparar",
      };
      db.shipments.push(shipment);
    }
    return ok({ sale, shipment });
  },
  listMovements: () => ok(db.retailMovements),
  transferToSala: (productId, qty) =>
    ok(record([{ productId, type: "Transferencia", reason: "Reposición sala", location: "sala", from: "central", qty }])[0]),
  adjust: ({ productId, location, qty, reason }) => ok(record([{ productId, type: "Ajuste", reason, location, qty }])[0]),
  listOrders: () => ok(db.retailOrders),
  createOrder: ({ supplierId, items, leadTimeDays }) => {
    const order = {
      id: mockId("ro"),
      number: nextNumber(db.retailOrders.map((o) => o.number)),
      supplierId,
      date: TODAY,
      expected: addDays(TODAY, leadTimeDays),
      items: items.map((i) => ({ ...i, unitCost: db.products.find((p) => p.id === i.productId)?.cost ?? 0 })),
      status: "Borrador" as const,
    };
    db.retailOrders.push(order);
    return ok(order);
  },
  sendOrder: (id) => {
    const order = patchById(db.retailOrders, id, (o) => (o.status === "Borrador" ? { ...o, status: "Enviada" as const } : o));
    return order ? ok(order) : notFound("Orden de compra", id);
  },
  receiveOrder: (id) => {
    const order = db.retailOrders.find((o) => o.id === id);
    if (!order) return notFound("Orden de compra", id);
    if (order.status !== "Enviada") return ok(order);
    record(order.items.map((i) => ({ productId: i.productId, type: "Entrada", reason: "Compra", location: "central", qty: i.qty, ref: `OC ${order.number}` })));
    return ok(patchById(db.retailOrders, id, (o) => ({ ...o, status: "Recibida", receivedAt: TODAY }))!);
  },
  listShipments: () => ok(db.shipments),
  advanceShipment: (id) => {
    const shipment = patchById(db.shipments, id, (s) => {
      const next = SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(s.status) + 1];
      return next ? { ...s, status: next } : s;
    });
    return shipment ? ok(shipment) : notFound("Despacho", id);
  },
};
