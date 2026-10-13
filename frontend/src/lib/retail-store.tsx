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
    idempotencyKey?: string;
  }) => Promise<Sale>;
  /** Mueve unidades de bodega central a sala de ventas. */
  transferToSala: (productId: string, qty: number) => void;
  adjust: (productId: string, location: Location, qty: number, reason: "Merma" | "Conteo", lotId?: string) => Promise<void>;
  createOrder: (supplierId: string, items: { productId: string; qty: number }[], leadTimeDays: number) => Promise<RetailOrder>;
  sendOrder: (id: string) => Promise<void>;
  /** Recibe la orden: entrada a bodega central. */
  receiveOrder: (id: string, items?: { productId: string; qty: number; lot: string; expiry?: string }[]) => Promise<void>;
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
  const { currentUser, rolePermissions } = useStore();
  const [products, setProducts] = useState(dataSource === "http" ? [] : seedProducts);
  const [sales, setSales] = useState(dataSource === "http" ? [] : seedSales);
  const [movements, setMovements] = useState(dataSource === "http" ? [] : seedRetailMovements);
  const [orders, setOrders] = useState(dataSource === "http" ? [] : seedRetailOrders);
  const [shipments, setShipments] = useState(dataSource === "http" ? [] : buildSeedShipments(seedSales, addressOf));
  // Catálogo publicado al registro de lib (no se expone: la UI lo lee vía useRetailSuppliers de server-state).
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>(dataSource === "http" ? [] : read("retailSuppliers", mockRetailSuppliers));

  // Hidratación inicial solo en modo http; en mock la semilla es el estado final.
  const [loading, setLoading] = useState(dataSource === "http");
  const [error, setError] = useState<string | null>(null);

  /** Carga inicial desde el servidor. Si falla, se conserva la semilla y se expone el error. */
  const load = useCallback(async () => {
    if (dataSource !== "http") return;
    try {
      const permitted = (permission: "tienda.vender" | "tienda.inventario" | "tienda.compras" | "reportes.financiero") =>
        rolePermissions[currentUser.role]?.includes(permission) ?? false;
      const [productsData, salesData, movementsData, ordersData, shipmentsData, suppliersData] = await Promise.all([
        permitted("tienda.inventario") ? services.retail.listProducts() : Promise.resolve([]),
        permitted("tienda.vender") || permitted("reportes.financiero") ? services.retail.listSales() : Promise.resolve([]),
        permitted("tienda.inventario") ? services.retail.listMovements() : Promise.resolve([]),
        permitted("tienda.compras") ? services.retail.listOrders() : Promise.resolve([]),
        permitted("tienda.inventario") ? services.retail.listShipments() : Promise.resolve([]),
        permitted("tienda.inventario") ? services.retail.listSuppliers() : Promise.resolve([]),
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
  }, [currentUser.role, rolePermissions]);

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
    checkout: async ({ items, ownerRut, payment, delivery, idempotencyKey }) => {
      const input = { items, ownerRut, payment, delivery, idempotencyKey };
      if (dataSource === "http") {
        if (!idempotencyKey) newIdempotencyKey();
        const { sale: savedSale, shipment: savedShipment } = await services.retail.checkout(input);
        setSales((prev) => [...prev, savedSale]);
        if (savedShipment) setShipments((prev) => [...prev, savedShipment]);
        try {
          const [freshProducts, freshMovements] = await Promise.all([services.retail.listProducts(), services.retail.listMovements()]);
          setProducts(freshProducts);
          setMovements(freshMovements);
        } catch {
          setError("Venta registrada. No se pudo actualizar el inventario; recarga la página.");
        }
        return savedSale;
      }
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
      record(items.map((i) => ({ productId: i.productId, type: "Salida", reason: "Venta", location: "sala", qty: -i.qty, ref: `Boleta ${sale.number}` })));
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
        setShipments((prev) => [...prev, shipment]);
      }
      runInBackground(services.retail.checkout(input));
      return sale;
    },
    transferToSala: (productId, qty) => {
      if (dataSource === "http") {
        newIdempotencyKey();
        runInBackground(services.retail.transferToSala(productId, qty).then(async () => {
          try {
            const [freshProducts, freshMovements] = await Promise.all([services.retail.listProducts(), services.retail.listMovements()]);
            setProducts(freshProducts);
            setMovements(freshMovements);
          } catch {
            setError("Transferencia registrada. No se pudo actualizar el inventario; recarga la página.");
          }
        }, () => setError("No se pudo transferir el stock a sala.")));
        return;
      }
      const createdMovements = record([{ productId, type: "Transferencia", reason: "Reposición sala", location: "sala", from: "central", qty }]);
      if (createdMovements.length) runInBackground(services.retail.transferToSala(productId, qty));
    },
    adjust: async (productId, location, qty, reason, lotId) => {
      if (dataSource === "http") {
        if (!lotId) throw new Error("Selecciona un lote para ajustar el stock.");
        newIdempotencyKey();
        await services.retail.adjust({ productId, location, lotId, qty, reason });
        try {
          const [freshProducts, freshMovements] = await Promise.all([services.retail.listProducts(), services.retail.listMovements()]);
          setProducts(freshProducts);
          setMovements(freshMovements);
        } catch {
          setError("Ajuste registrado. No se pudo actualizar el inventario; recarga la página.");
        }
        return;
      }
      record([{ productId, type: "Ajuste", reason, location, qty }]);
      await services.retail.adjust({ productId, location, qty, reason });
    },
    createOrder: async (supplierId, items, leadTimeDays) => {
      if (dataSource === "http") {
        newIdempotencyKey();
        const saved = await services.retail.createOrder({ supplierId, items, leadTimeDays });
        setOrders((prev) => [...prev, saved]);
        return saved;
      }
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
      runInBackground(services.retail.createOrder({ supplierId, items, leadTimeDays }));
      return order;
    },
    sendOrder: async (id) => {
      const prev = orders.find((o) => o.id === id);
      if (dataSource === "http") {
        if (!prev || prev.status !== "Borrador") return;
        newIdempotencyKey();
        const saved = await services.retail.sendOrder(id);
        setOrders((prevList) => prevList.map((o) => o.id === id ? saved : o));
        return;
      }
      setOrders((prevList) => prevList.map((o) => (o.id === id && o.status === "Borrador" ? { ...o, status: "Enviada" } : o)));
      runInBackground(services.retail.sendOrder(id));
    },
    receiveOrder: async (id, items) => {
      if (dataSource === "http") {
        if (!items?.length) throw new Error("Indica los lotes recibidos.");
        newIdempotencyKey();
        const saved = await services.retail.receiveOrder(id, items);
        setOrders((prev) => prev.map((order) => order.id === id ? saved : order));
        try {
          const [freshProducts, freshMovements] = await Promise.all([services.retail.listProducts(), services.retail.listMovements()]);
          setProducts(freshProducts);
          setMovements(freshMovements);
        } catch {
          setError("Recepción registrada. No se pudo actualizar el inventario; recarga la página.");
        }
        return;
      }
      const order = orders.find((o) => o.id === id);
      if (!order || order.status !== "Enviada") return;
      record(order.items.map((i) => ({ productId: i.productId, type: "Entrada", reason: "Compra", location: "central", qty: i.qty, ref: `OC ${order.number}` })));
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Recibida", receivedAt: stampToday() } : o)));
      await services.retail.receiveOrder(id);
    },
    advanceShipment: (id) => {
      const prev = shipments.find((s) => s.id === id);
      const next = prev ? SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(prev.status) + 1] : undefined;
      if (dataSource === "http") {
        if (!prev || !next) return;
        newIdempotencyKey();
        runInBackground(services.retail.advanceShipment(id).then(
          (saved) => setShipments((list) => list.map((shipment) => shipment.id === id ? saved : shipment)),
          () => setError("No se pudo avanzar el despacho."),
        ));
        return;
      }
      setShipments((prevList) =>
        prevList.map((s) => {
          if (s.id !== id) return s;
          const nextStatus = SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(s.status) + 1];
          return nextStatus ? { ...s, status: nextStatus } : s;
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
