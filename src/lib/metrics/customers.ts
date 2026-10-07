import { ownerLastVisit, owners } from "@/lib/lookups";
import type { Invoice } from "@/domain/invoices";
import { type Owner } from "@/domain/owners";
import { type Patient, lastVisit } from "@/domain/patients";
import type { Sale } from "@/domain/retail";
import { daysUntil } from "@/lib/format";

export function patientKpis(visible: Patient[]) {
  const active = visible.filter((p) => daysUntil(lastVisit(p)) >= -365);
  const firstVisit = (p: Patient) => p.consultations.reduce((min, c) => (c.date < min ? c.date : min), "9999");
  const newOnes = visible.filter((p) => daysUntil(firstVisit(p)) >= -90);
  const returning = visible.filter((p) => p.consultations.length >= 2);
  return {
    active: active.length,
    new90: newOnes.length,
    returnPct: Math.round((returning.length / Math.max(1, visible.length)) * 100),
  };
}

export function speciesDistribution(visible: Patient[]) {
  const counts = visible.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.species]: (acc[p.species] ?? 0) + 1 }), {});
  return Object.entries(counts)
    .map(([species, count]) => ({ species, count, pct: Math.round((count / Math.max(1, visible.length)) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/** Dueños con al menos una mascota visible para la clínica. */
export function visibleOwners(visible: Patient[]) {
  const ruts = new Set(visible.map((p) => p.ownerRut));
  return owners.filter((o) => ruts.has(o.rut));
}

export function petsPerOwner(visible: Patient[]) {
  const counts = visibleOwners(visible).map((o) => visible.filter((p) => p.ownerRut === o.rut).length);
  return [
    { bucket: "1 mascota", owners: counts.filter((n) => n === 1).length },
    { bucket: "2 mascotas", owners: counts.filter((n) => n === 2).length },
    { bucket: "3 o más", owners: counts.filter((n) => n >= 3).length },
  ];
}

export type CustomerSpend = { owner: Owner; clinic: number; store: number; total: number };

/** Gasto por cliente en clínica (facturas) y tienda (boletas). */
export function customerSpend(visible: Patient[], invoices: Invoice[], sales: Sale[]): CustomerSpend[] {
  return visibleOwners(visible)
    .map((owner) => {
      const clinic = invoices.filter((i) => i.ownerRut === owner.rut).reduce((s, i) => s + i.total, 0);
      const store = sales.filter((s) => s.ownerRut === owner.rut).reduce((s, x) => s + x.total, 0);
      return { owner, clinic, store, total: clinic + store };
    })
    .sort((a, b) => b.total - a.total);
}

export function omnichannel(spend: CustomerSpend[], visible: Patient[]) {
  const withVisits = new Set(visible.filter((p) => p.consultations.length > 0).map((p) => p.ownerRut));
  const both = spend.filter((c) => withVisits.has(c.owner.rut) && c.store > 0);
  return { count: both.length, pct: Math.round((both.length / Math.max(1, spend.length)) * 100) };
}

export type Receivable = { owner: Owner; source: string; amount: number; age: number };

/** Por cobrar: facturas emitidas (antigüedad = fecha de emisión) y saldos de dueños (antigüedad = última visita). */
export function receivables(visible: Patient[], invoices: Invoice[]) {
  const ownersList = visibleOwners(visible);
  const rows: Receivable[] = [
    ...invoices
      .filter((i) => i.status === "Emitida")
      .map((i) => ({ owner: ownersList.find((o) => o.rut === i.ownerRut)!, source: `Factura ${i.folio}`, amount: i.total, age: -daysUntil(i.date) }))
      .filter((r) => r.owner),
    ...ownersList
      .filter((o) => o.balance > 0)
      .map((o) => ({ owner: o, source: "Saldo pendiente", amount: o.balance, age: -daysUntil(ownerLastVisit(o.rut)) })),
  ].sort((a, b) => b.age - a.age);
  const bucket = (min: number, max: number) => rows.filter((r) => r.age >= min && r.age <= max).reduce((s, r) => s + r.amount, 0);
  return {
    rows,
    buckets: [
      { bucket: "0–30 días", amount: bucket(0, 30) },
      { bucket: "31–60 días", amount: bucket(31, 60) },
      { bucket: "Más de 60 días", amount: bucket(61, 100000) },
    ],
    total: rows.reduce((s, r) => s + r.amount, 0),
  };
}
