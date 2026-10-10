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
  retailSuppliers as mockRetailSuppliers,
  seedProducts,
  seedRetailMovements,
  seedRetailOrders,
  seedSales,
} from "@/mocks/retail";
import { owners as mockOwners } from "@/mocks/owners";
import { publish, read } from "@/lib/server-state";
import { dataSource, newIdempotencyKey, runInBackground, services } from "@/services";
import { NOW_TIME, TODAY, addDays, realNowTime, realToday } from "@/lib/format";
import { useStore } from "@/lib/store";

/**
 * Sellos de fecha/hora para escrituras (T5-5): en modo http la fecha real del
 * navegador (las mutaciones siempre corren post-mount: no hay riesgo de
 * hidratación); en modo mock el fijo de la demo reproducible.
 */
function stampToday() {
  return dataSource === "http" ? realToday() : TODAY;
}

function stampNowTime() {
  return dataSource === "http" ? realNowTime() : NOW_TIME;
}

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

/** TODO(api): services.owners.get(rut) */
const getOwner = (rut: string) => {
  return read("owners", mockOwners).find((o) => o.rut === rut);
};

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
  // Catálogo publicado al registro de lib (no se expone: la UI lo lee vía useRetailSuppliers de server-state).
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>(read("retailSuppliers", mockRetailSuppliers)); // http: se hidrata con services.retail.listSuppliers()

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

  /** Registra movimientos y aplica el delta al stock. Devuelve los creados (para revertir en modo http). */
  const record = (list: Omit<RetailMovement, "id" | "date" | "user">[]) => {
    if (list.length === 0) return [];
    const created = list.map((m) => ({ ...m, id: newId("rm"), date: stampToday(), user: currentUser.name }));
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
    return created;
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
        date: stampToday(),
        time: stampNowTime(),
        items,
        ownerRut,
        payment,
        deliveryFee: fee,
        total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + fee,
        seller: currentUser.name,
        channel: "Mesón",
      };
      setSales((prev) => [...prev, sale]);
      const createdMovements = record(items.map((i) => ({ productId: i.productId, type: "Salida", reason: "Venta", location: "sala", qty: -i.qty, ref: `Boleta ${sale.number}` })));
      let shipmentId: string | null = null;
      if (delivery && owner) {
        const shipment: Shipment = {
          id: newId("sh"),
          saleId: sale.id,
          ownerRut: owner.rut,
          address: owner.address,
          sector: owner.sector,
          courier: delivery.courier,
          scheduledFor: addDays(stampToday(), 1),
          status: "Por preparar",
        };
        shipmentId = shipment.id;
        setShipments((prev) => [...prev, shipment]);
      }
      const input = { items, ownerRut, payment, delivery };
      if (dataSource !== "http") {
        runInBackground(services.retail.checkout(input));
        return sale;
      }
      // T5-4: UNA key por venta; se reconcilian venta y despacho canónicos, al fallar se revierte todo.
      newIdempotencyKey();
      const movementIds = new Set(createdMovements.map((m) => m.id));
      runInBackground(
        services.retail.checkout(input).then(
          ({ sale: savedSale, shipment: savedShipment }) => {
            setSales((prev) => prev.map((s) => (s.id === sale.id ? savedSale : s)));
            setShipments((prev) => {
              const withoutOptimistic = shipmentId ? prev.filter((sh) => sh.id !== shipmentId) : prev;
              return savedShipment
                ? [...withoutOptimistic.filter((sh) => sh.id !== savedShipment.id), savedShipment]
                : withoutOptimistic;
            });
          },
          () => {
            setSales((prev) => prev.filter((s) => s.id !== sale.id));
            setMovements((prev) => prev.filter((m) => !movementIds.has(m.id)));
            setProducts((prev) =>
              prev.map((p) => {
                const back = createdMovements
                  .filter((m) => m.productId === p.id)
                  .reduce((sum, m) => sum + m.qty, 0);
                if (!back) return p;
                const stock = { ...p.stock };
                stock.sala = Math.max(0, stock.sala - back);
                return { ...p, stock };
              })
            );
            if (shipmentId) setShipments((prev) => prev.filter((sh) => sh.id !== shipmentId));
            setError("No se pudo registrar la venta. Se revirtieron los movimientos.");
          }
        )
      );
      return sale;
    },
    transferToSala: (productId, qty) => {
      const createdMovements = record([{ productId, type: "Transferencia", reason: "Reposición sala", location: "sala", from: "central", qty }]);
      const movementId = createdMovements[0]?.id;
      if (dataSource !== "http" || !movementId) {
        runInBackground(services.retail.transferToSala(productId, qty));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.retail.transferToSala(productId, qty).then(
          (saved) => setMovements((prev) => prev.map((m) => (m.id === movementId ? saved : m))),
          () => {
            setMovements((prev) => prev.filter((m) => m.id !== movementId));
            setProducts((prev) =>
              prev.map((p) => {
                if (p.id !== productId) return p;
                const stock = { ...p.stock };
                stock.central += qty;
                stock.sala = Math.max(0, stock.sala - qty);
                return { ...p, stock };
              })
            );
            setError("No se pudo transferir el stock a sala. Se restauró el estado anterior.");
          }
        )
      );
    },
    adjust: (productId, location, qty, reason) => {
      record([{ productId, type: "Ajuste", reason, location, qty }]);
      // T5-4: POST /api/v1/retail/adjustments aún NotImplemented (exige lotId);
      // se conserva el optimista local sin key ni reconcile.
      runInBackground(services.retail.adjust({ productId, location, qty, reason }));
    },
    createOrder: (supplierId, items, leadTimeDays) => {
      const order: RetailOrder = {
        id: newId("ro"),
        number: Math.max(0, ...orders.map((o) => o.number)) + 1,
        supplierId,
        date: stampToday(),
        expected: addDays(stampToday(), leadTimeDays),
        items: items.map((i) => ({ ...i, unitCost: products.find((p) => p.id === i.productId)?.cost ?? 0 })),
        status: "Borrador",
      };
      setOrders((prev) => [...prev, order]);
      if (dataSource !== "http") {
        runInBackground(services.retail.createOrder({ supplierId, items, leadTimeDays }));
        return order;
      }
      newIdempotencyKey();
      runInBackground(
        services.retail.createOrder({ supplierId, items, leadTimeDays }).then(
          (saved) => setOrders((prev) => prev.map((o) => (o.id === order.id ? saved : o))),
          () => {
            setOrders((prev) => prev.filter((o) => o.id !== order.id));
            setError("No se pudo crear la orden de compra. Se descartó el cambio local.");
          }
        )
      );
      return order;
    },
    sendOrder: (id) => {
      const prev = orders.find((o) => o.id === id);
      setOrders((prevList) => prevList.map((o) => (o.id === id && o.status === "Borrador" ? { ...o, status: "Enviada" } : o)));
      if (dataSource !== "http" || !prev) {
        runInBackground(services.retail.sendOrder(id));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.retail.sendOrder(id).then(
          (saved) => setOrders((prevList) => prevList.map((o) => (o.id === saved.id ? saved : o))),
          () => {
            setOrders((prevList) => prevList.map((o) => (o.id === id ? prev : o)));
            setError("No se pudo enviar la orden de compra. Se restauró el estado anterior.");
          }
        )
      );
    },
    receiveOrder: (id) => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status !== "Enviada") return;
      record(order.items.map((i) => ({ productId: i.productId, type: "Entrada", reason: "Compra", location: "central", qty: i.qty, ref: `OC ${order.number}` })));
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Recibida", receivedAt: stampToday() } : o)));
      // T5-4: POST /api/v1/retail/purchase-orders/:id/receive aún NotImplemented
      // (exige body items con lote/vencimiento); se conserva el optimista sin key ni reconcile.
      runInBackground(services.retail.receiveOrder(id));
    },
    advanceShipment: (id) => {
      const prev = shipments.find((s) => s.id === id);
      const next = prev ? SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(prev.status) + 1] : undefined;
      setShipments((prevList) =>
        prevList.map((s) => {
          if (s.id !== id) return s;
          const nextStatus = SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(s.status) + 1];
          return nextStatus ? { ...s, status: nextStatus } : s;
        })
      );
      if (dataSource !== "http" || !prev || !next) {
        runInBackground(services.retail.advanceShipment(id));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.retail.advanceShipment(id).then(
          (saved) => setShipments((prevList) => prevList.map((s) => (s.id === saved.id ? saved : s))),
          () => {
            setShipments((prevList) => prevList.map((s) => (s.id === id ? prev : s)));
            setError("No se pudo avanzar el despacho. Se restauró el estado anterior.");
          }
        )
      );
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
