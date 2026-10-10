"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  type Location,
  type PaymentMethod,
  type Product,
  type RetailMovement,
  type RetailOrder,
  type RetailSupplier,
  type Sale,
  type SaleItem,
  type Shipment,
  SHIPMENT_FLOW,
  deliveryFee,
} from "@/domain/retail";
import {
  buildSeedShipments,
  getOwner,
  seedProducts,
  seedRetailMovements,
  seedRetailOrders,
  seedSales,
  retailSuppliers as seedRetailSuppliers,
} from "@/lib/lookups";
import { publish } from "@/lib/server-state";
import { dataSource, runInBackground, services } from "@/services";
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
  // Hidratación desde el servidor (T5-2): en modo mock siempre loading=false y error=null.
  loading: boolean;
  error: string | null;
  /** Reintenta la carga inicial desde el servidor (solo modo http). */
  retry: () => void;
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
  const [products, setProducts] = useState(seedProducts); // http: se hidrata con services.retail.listProducts()
  const [sales, setSales] = useState(seedSales); // http: se hidrata con services.retail.listSales()
  const [movements, setMovements] = useState(seedRetailMovements); // http: se hidrata con services.retail.listMovements()
  const [orders, setOrders] = useState(seedRetailOrders); // http: se hidrata con services.retail.listOrders()
  const [shipments, setShipments] = useState(() => buildSeedShipments(seedSales, addressOf)); // http: se hidrata con services.retail.listShipments()
  // Catálogo publicado al registro de lib (no se expone: la UI lo lee vía lookups.retailSuppliers).
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>(seedRetailSuppliers); // http: se hidrata con services.retail.listSuppliers()

  // Hidratación inicial solo en modo http; en mock la semilla es el estado final.
  const [loading, setLoading] = useState(dataSource === "http");
  const [error, setError] = useState<string | null>(null);

  /** Carga inicial desde el servidor. Si falla, se conserva la semilla y se expone el error. */
  const load = useCallback(async () => {
    if (dataSource !== "http") return;
    try {
      const [productsData, salesData, movementsData, ordersData, shipmentsData, suppliersData] = await Promise.all([
        services.retail.listProducts(),
        services.retail.listSales(),
        services.retail.listMovements(),
        services.retail.listOrders(),
        services.retail.listShipments(),
        services.retail.listSuppliers(),
      ]);
      // Publica antes de los setState para que el re-render ya lea el registro fresco.
      publish("retailSuppliers", suppliersData);
      setProducts(productsData);
      setSales(salesData);
      setMovements(movementsData);
      setOrders(ordersData);
      setShipments(shipmentsData);
      setSuppliers(suppliersData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información de la tienda");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hidratación inicial al montar: el fetch resuelve en continuaciones async, no es un render en cascada.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount intencional del store en modo http
    if (dataSource === "http") void load();
  }, [load]);

  // T5-3a: publica el catálogo hidratado al registro de lib cuando cambia.
  // Solo http; en mock `publish` no hace nada. No hace setState: no hay cascada.
  useEffect(() => {
    publish("retailSuppliers", suppliers);
  }, [suppliers]);

  const retry = () => {
    setLoading(true);
    setError(null);
    void load();
  };

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
        number: Math.max(0, ...sales.map((s) => s.number)) + 1,
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
        number: Math.max(0, ...orders.map((o) => o.number)) + 1,
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
    loading,
    error,
    retry,
  };

  return <RetailContext.Provider value={store}>{children}</RetailContext.Provider>;
}

export function useRetail() {
  const store = useContext(RetailContext);
  if (!store) throw new Error("useRetail debe usarse dentro de <RetailProvider>");
  return store;
}
