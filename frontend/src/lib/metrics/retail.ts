import { read } from "@/lib/server-state";
import { owners as mockOwners } from "@/mocks/owners";
import { patients as mockPatients } from "@/mocks/patients";
import { CATEGORIES, IVA, type PaymentMethod, type Product, type Sale, type Shipment, SHIPMENT_FLOW } from "@/domain/retail";
import { TODAY } from "@/lib/format";

const net = (gross: number) => gross / (1 + IVA);
const DAYS = 14;

/** TODO(api): services.owners.get(rut) */
function getOwner(rut: string) {
  return read("owners", mockOwners).find((o) => o.rut === rut);
}

/** TODO(api): services.patients.listByOwner(rut) */
function petsOf(ownerRut: string) {
  return read("patients", mockPatients).filter((p) => p.ownerRut === ownerRut);
}

export function retailKpis(sales: Sale[], products: Product[], today = TODAY) {
  const todaySales = sales.filter((s) => s.date === today);
  return {
    todayTotal: todaySales.reduce((s, x) => s + x.total, 0),
    todayCount: todaySales.length,
    refill: products.filter((p) => p.stock.sala < p.shelfMin && p.stock.central > 0).length,
  };
}

/** Ventas netas de la tienda en el mes en curso (sin despacho). */
export function retailMonthNet(sales: Sale[], today = TODAY) {
  const month = today.slice(0, 7);
  return Math.round(
    sales.filter((s) => s.date.startsWith(month)).reduce((s, x) => s + net(x.total - x.deliveryFee), 0)
  );
}

export function salesBreakdown(sales: Sale[]) {
  const total = sales.reduce((s, x) => s + x.total, 0);
  const byChannel = (["Mesón", "Web"] as const).map((c) => {
    const list = sales.filter((s) => s.channel === c);
    return { channel: c, count: list.length, total: list.reduce((s, x) => s + x.total, 0) };
  });
  const byPayment = (["Débito", "Crédito", "Efectivo", "Transferencia"] as PaymentMethod[]).map((p) => {
    const list = sales.filter((s) => s.payment === p);
    return { payment: p, count: list.length, total: list.reduce((s, x) => s + x.total, 0) };
  });
  const withCustomer = sales.filter((s) => s.ownerRut);
  const perCustomer = withCustomer.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.ownerRut!]: (acc[s.ownerRut!] ?? 0) + 1 }), {});
  const customers = Object.keys(perCustomer).length;
  return {
    total,
    count: sales.length,
    ticket: Math.round(total / Math.max(1, sales.length)),
    byChannel,
    byPayment,
    withCustomerPct: Math.round((withCustomer.length / Math.max(1, sales.length)) * 100),
    customers,
    repeatPct: Math.round((Object.values(perCustomer).filter((n) => n >= 2).length / Math.max(1, customers)) * 100),
  };
}

export function marginByCategory(sales: Sale[], products: Product[]) {
  const productOf = (id: string) => products.find((p) => p.id === id)!;
  const rows = CATEGORIES.map((category) => {
    const items = sales.flatMap((s) => s.items).filter((i) => productOf(i.productId).category === category);
    const revenue = items.reduce((s, i) => s + net(i.qty * i.unitPrice), 0);
    const cost = items.reduce((s, i) => s + i.qty * productOf(i.productId).cost, 0);
    return {
      category,
      revenue: Math.round(revenue),
      margin: Math.round(revenue - cost),
      pct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0,
    };
  }).filter((r) => r.revenue > 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const margin = rows.reduce((s, r) => s + r.margin, 0);
  return { rows: rows.sort((a, b) => b.margin - a.margin), revenue, margin, pct: revenue ? Math.round((margin / revenue) * 100) : 0 };
}

export type ProductTurnover = {
  product: Product;
  sold: number;
  rotation: number;
  coverageDays: number | null;
};

/** Rotación y días de cobertura con la venta de los últimos 14 días. */
export function productTurnover(sales: Sale[], products: Product[]): ProductTurnover[] {
  return products.map((product) => {
    const sold = sales.flatMap((s) => s.items).filter((i) => i.productId === product.id).reduce((s, i) => s + i.qty, 0);
    const stock = product.stock.central + product.stock.sala;
    const avgStock = (stock + stock + sold) / 2;
    return {
      product,
      sold,
      rotation: avgStock > 0 ? Math.round((sold / avgStock) * 10) / 10 : 0,
      coverageDays: sold > 0 ? Math.round(stock / (sold / DAYS)) : null,
    };
  });
}

export function shipmentKpis(shipments: Shipment[], today = TODAY) {
  const delivered = shipments.filter((s) => s.status === "Entregado");
  const late = shipments.filter((s) => s.status !== "Entregado" && s.scheduledFor < today);
  // En el prototipo una entrega es "a tiempo" si se marcó entregada (las semillas se entregan en la fecha programada).
  const onTimePct = Math.round((delivered.length / Math.max(1, delivered.length + late.length)) * 100);
  return {
    byStatus: SHIPMENT_FLOW.map((status) => ({ status, count: shipments.filter((s) => s.status === status).length })),
    bySector: Object.entries(shipments.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.sector]: (acc[s.sector] ?? 0) + 1 }), {}))
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count),
    late,
    onTimePct,
  };
}

/** Qué categorías compran los clientes según la especie de sus mascotas. */
export function crossSellBySpecies(sales: Sale[], products: Product[]) {
  const map: Record<string, Record<string, number>> = {};
  for (const s of sales) {
    if (!s.ownerRut || !getOwner(s.ownerRut)) continue;
    const species = [...new Set(petsOf(s.ownerRut).map((p) => p.species))];
    for (const sp of species) {
      for (const i of s.items) {
        const cat = products.find((p) => p.id === i.productId)!.category;
        map[sp] ??= {};
        map[sp][cat] = (map[sp][cat] ?? 0) + i.qty;
      }
    }
  }
  return Object.entries(map).map(([species, cats]) => ({
    species,
    top: Object.entries(cats)
      .map(([category, units]) => ({ category, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 3),
  }));
}
