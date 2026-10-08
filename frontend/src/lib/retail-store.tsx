"use client";

import { createContext, useContext, useState } from "react";
import {
  type Location,
  type PaymentMethod,
  type Product,
  type RetailMovement,
  type RetailOrder,
  type Sale,
  type SaleItem,
  type Shipment,
  SHIPMENT_FLOW,
  deliveryFee,
} from "@/domain/retail";
import { getOwner } from "@/lib/lookups";
import {
  buildSeedShipments,
  seedProducts,
  seedRetailMovements,
  seedRetailOrders,
  seedSales,
} from "@/mocks/retail";
import { runInBackground, services } from "@/services";
import { NOW_TIME, TODAY, addDays } from "@/lib/format";
import { useStore } from "@/lib/store";

/**
 * Estado de sesión de la Tienda: inventario por ubicación, ventas, compras y despachos.
 * Cada mutación actualiza el estado local y llama a `services.retail.*` en segundo plano.
 */
type RetailStore = {
  products: Product[];
  sales: Sale[];
  movements: RetailMovement[];
  orders: RetailOrder[];
  shipments: Shipment[];
  /** Vende desde la sala; si hay despacho crea la orden de reparto. */
  checkout: (input: {
    items: SaleItem[];
    ownerRut?: string;
    payment: PaymentMethod;
    delivery?: { courier: string };
  }) => Sale;
  /** Mueve unidades de bodega central a sala de ventas. */
  transferToSala: (productId: string, qty: number) => void;
  adjust: (productId: string, location: Location, qty: number, reason: "Merma" | "Conteo") => void;
  createOrder: (supplierId: string, items: { productId: string; qty: number }[], leadTimeDays: number) => RetailOrder;
  sendOrder: (id: string) => void;
  /** Recibe la orden: entrada a bodega central. */
  receiveOrder: (id: string) => void;
  advanceShipment: (id: string) => void;
};

const RetailContext = createContext<RetailStore | null>(null);

let seq = 0;
const newId = (prefix: string) => `${prefix}-new-${++seq}`;

const addressOf = (rut: string) => {
  const o = getOwner(rut);
  return { address: o?.address ?? "", sector: o?.sector ?? "" };
};

export function RetailProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useStore();
  const [products, setProducts] = useState(seedProducts); // TODO(api): reemplazar por services.retail.listProducts()
  const [sales, setSales] = useState(seedSales); // TODO(api): reemplazar por services.retail.listSales()
  const [movements, setMovements] = useState(seedRetailMovements); // TODO(api): reemplazar por services.retail.listMovements()
  const [orders, setOrders] = useState(seedRetailOrders); // TODO(api): reemplazar por services.retail.listOrders()
  const [shipments, setShipments] = useState(() => buildSeedShipments(seedSales, addressOf)); // TODO(api): reemplazar por services.retail.listShipments()

  const record = (list: Omit<RetailMovement, "id" | "date" | "user">[]) => {
    const created = list.map((m) => ({ ...m, id: newId("rm"), date: TODAY, user: currentUser.name }));
    setMovements((prev) => [...prev, ...created]);
    setProducts((prev) =>
      prev.map((p) => {
        const mine = created.filter((m) => m.productId === p.id);
        if (mine.length === 0) return p;
        const stock = { ...p.stock };
        for (const m of mine) {
          if (m.type === "Transferencia" && m.from) {
            stock[m.from] -= m.qty;
            stock[m.location] += m.qty;
          } else {
            stock[m.location] = Math.max(0, stock[m.location] + m.qty);
          }
        }
        return { ...p, stock };
      })
    );
  };

  const store: RetailStore = {
    products,
    sales,
    movements,
    orders,
    shipments,
    checkout: ({ items, ownerRut, payment, delivery }) => {
      const owner = ownerRut ? getOwner(ownerRut) : undefined;
      const fee = delivery && owner ? deliveryFee(owner.sector) : 0;
      const sale: Sale = {
        id: newId("s"),
        number: Math.max(...sales.map((s) => s.number)) + 1,
        date: TODAY,
        time: NOW_TIME,
        items,
        ownerRut,
        payment,
        deliveryFee: fee,
        total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + fee,
        seller: currentUser.name,
        channel: "Mesón",
      };
      setSales((prev) => [...prev, sale]);
      record(items.map((i) => ({ productId: i.productId, type: "Salida", reason: "Venta", location: "sala", qty: -i.qty, ref: `Boleta ${sale.number}` })));
      if (delivery && owner) {
        setShipments((prev) => [
          ...prev,
          {
            id: newId("sh"),
            saleId: sale.id,
            ownerRut: owner.rut,
            address: owner.address,
            sector: owner.sector,
            courier: delivery.courier,
            scheduledFor: addDays(TODAY, 1),
            status: "Por preparar",
          },
        ]);
      }
      runInBackground(services.retail.checkout({ items, ownerRut, payment, delivery }));
      return sale;
    },
    transferToSala: (productId, qty) => {
      record([{ productId, type: "Transferencia", reason: "Reposición sala", location: "sala", from: "central", qty }]);
      runInBackground(services.retail.transferToSala(productId, qty));
    },
    adjust: (productId, location, qty, reason) => {
      record([{ productId, type: "Ajuste", reason, location, qty }]);
      runInBackground(services.retail.adjust({ productId, location, qty, reason }));
    },
    createOrder: (supplierId, items, leadTimeDays) => {
      const order: RetailOrder = {
        id: newId("ro"),
        number: Math.max(...orders.map((o) => o.number)) + 1,
        supplierId,
        date: TODAY,
        expected: addDays(TODAY, leadTimeDays),
        items: items.map((i) => ({ ...i, unitCost: products.find((p) => p.id === i.productId)?.cost ?? 0 })),
        status: "Borrador",
      };
      setOrders((prev) => [...prev, order]);
      runInBackground(services.retail.createOrder({ supplierId, items, leadTimeDays }));
      return order;
    },
    sendOrder: (id) => {
      setOrders((prev) => prev.map((o) => (o.id === id && o.status === "Borrador" ? { ...o, status: "Enviada" } : o)));
      runInBackground(services.retail.sendOrder(id));
    },
    receiveOrder: (id) => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status !== "Enviada") return;
      record(order.items.map((i) => ({ productId: i.productId, type: "Entrada", reason: "Compra", location: "central", qty: i.qty, ref: `OC ${order.number}` })));
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Recibida", receivedAt: TODAY } : o)));
      runInBackground(services.retail.receiveOrder(id));
    },
    advanceShipment: (id) => {
      setShipments((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const next = SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(s.status) + 1];
          return next ? { ...s, status: next } : s;
        })
      );
      runInBackground(services.retail.advanceShipment(id));
    },
  };

  return <RetailContext.Provider value={store}>{children}</RetailContext.Provider>;
}

export function useRetail() {
  const store = useContext(RetailContext);
  if (!store) throw new Error("useRetail debe usarse dentro de <RetailProvider>");
  return store;
}
