"use client";

import { dueVaccines, visiblePatients } from "@/lib/analytics";
import { read, readScalar } from "@/lib/server-state";
import { currentClinic as mockCurrentClinic } from "@/mocks/network";
import { owners as mockOwners } from "@/mocks/owners";
import { patients as mockPatients } from "@/mocks/patients";
import { stockStatus } from "@/domain/medications";
import { ownerName } from "@/domain/owners";
import { INTERNAL_PHARMACY } from "@/domain/referrals";
import { OPEN_EVENT, ZONES } from "@/domain/security";
import type { Permission } from "@/domain/settings";
import { daysUntil, formatDate, formatRut, useNowTime, useToday } from "@/lib/format";
import { expectedArrivals } from "@/lib/metrics/day";
import { useRetail } from "@/lib/retail-store";
import { useSecurity } from "@/lib/security-store";
import { useCan, useStore } from "@/lib/store";
import { useSupport } from "@/lib/support-store";

export type TaskChannel = "Clínica" | "Red" | "Farmacia" | "Tienda" | "Seguridad" | "Soporte";
export const TASK_CHANNELS: TaskChannel[] = ["Clínica", "Red", "Farmacia", "Tienda", "Seguridad", "Soporte"];
export type TaskPriority = "Alta" | "Media" | "Baja";
const PRIORITY_ORDER: Record<TaskPriority, number> = { Alta: 0, Media: 1, Baja: 2 };

export type Task = {
  /** "fuente:id" estable, para asignar o marcar hecho. */
  id: string;
  channel: TaskChannel;
  title: string;
  detail: string;
  priority: TaskPriority;
  since: string;
  href: string;
  permission: Permission;
  quick?: { label: string; run: () => void };
};

function ago(date: string, today: string) {
  const d = -daysUntil(date.slice(0, 10), today);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} d`;
}

/** TODO(api): services.patients.get(id) */
function getPatient(id: string) {
  return read("patients", mockPatients).find((p) => p.id === id);
}

/** TODO(api): services.owners.get(rut) */
function getOwner(rut: string) {
  return read("owners", mockOwners).find((o) => o.rut === rut);
}

/** Clínica de la sesión. TODO(api): services.network.getCurrentClinic() */
function getCurrentClinic() {
  return readScalar("currentClinic", mockCurrentClinic);
}

/**
 * Bandeja única: deriva los pendientes del estado de todos los módulos.
 * Un pendiente desaparece cuando se resuelve en su módulo (o se marca hecho).
 */
export function useTasks() {
  const store = useStore();
  const retail = useRetail();
  const security = useSecurity();
  const support = useSupport();
  const can = useCan();
  // T5-5: fecha real del navegador tras el montaje en modo http (fijo en mock);
  // se pasa explícita a cada regla para no tocar su lógica.
  const today = useToday();
  const now = useNowTime();
  const tasks: Task[] = [];

  // Clínica — llegadas esperadas de hoy
  for (const a of expectedArrivals(store.appointments, security.access, security.waiting, store.rooms, today, now)) {
    const p = getPatient(a.patientId);
    if (!p) continue;
    tasks.push({
      id: `llegada:${a.id}`, channel: "Clínica", priority: "Media", since: today, permission: "agenda.gestionar",
      title: `Llegada de ${p.name} a las ${a.time}`,
      detail: `${ownerName(getOwner(p.ownerRut)!)} · ${a.reason}`,
      href: "/inicio/agenda",
      quick: { label: "Llegó", run: () => security.checkIn(a.id) },
    });
  }

  // Clínica — vacunas vencidas sin recordatorio (una tarea por mascota)
  const visible = visiblePatients(store.grants, getCurrentClinic(), today);
  const overdue = dueVaccines(visible, today).filter((d) => d.state === "vencida");
  for (const pid of [...new Set(overdue.map((d) => d.patient.id))]) {
    if (store.reminders.includes(pid)) continue;
    const items = overdue.filter((d) => d.patient.id === pid);
    const p = items[0].patient;
    const owner = getOwner(p.ownerRut)!;
    tasks.push({
      id: `vacuna:${pid}`, channel: "Clínica", priority: "Media", since: items[0].vaccine.nextDose!, permission: "agenda.gestionar",
      title: `Avisar vacunas vencidas de ${p.name}`,
      detail: `${items.map((i) => i.vaccine.name).join(", ")} · ${owner.preferredContact} ${owner.phone}`,
      href: "/analisis/vacunacion",
      quick: { label: "Recordatorio", run: () => store.sendReminder(pid) },
    });
  }

  // Clínica — facturas emitidas sin pagar
  for (const inv of store.invoices.filter((i) => i.status === "Emitida")) {
    const owner = getOwner(inv.ownerRut);
    tasks.push({
      id: `factura:${inv.id}`, channel: "Clínica", priority: "Baja", since: inv.date, permission: "facturas.emitir",
      title: `Cobrar factura N° ${inv.folio}`,
      detail: `${owner ? `${ownerName(owner)} · ${formatRut(owner.rut)}` : ""} · emitida ${formatDate(inv.date)}`,
      href: `/pacientes/propietarios/${inv.ownerRut}`,
    });
  }

  // Red — solicitudes recibidas
  for (const r of store.requests.filter((r) => r.to === getCurrentClinic() && r.status === "Pendiente")) {
    tasks.push({
      id: `solicitud:${r.id}`, channel: "Red", priority: daysUntil(r.date, today) <= -1 ? "Alta" : "Media", since: r.date, permission: "red.aprobar",
      title: `Responder solicitud de ${r.from}`,
      detail: `Acceso a ${getPatient(r.patientId)?.name} · ${r.scope}`,
      href: "/clinicas/solicitudes",
    });
  }

  // Farmacia — recetas por dispensar
  for (const ref of store.referrals.filter((r) => r.destination === INTERNAL_PHARMACY && r.status !== "Dispensada")) {
    const blocked = ref.items.some((i) => (store.medications.find((m) => m.id === i.medicationId)?.stock ?? 0) < i.qty);
    tasks.push({
      id: `receta:${ref.id}`, channel: "Farmacia", priority: "Alta", since: ref.date, permission: "farmacia.dispensar",
      title: `Dispensar receta de ${getPatient(ref.patientId)?.name}`,
      detail: `${ref.items.length} medicamento(s)${blocked ? " · stock insuficiente" : ""}`,
      href: "/farmacia/movimientos",
      quick: blocked ? undefined : { label: "Dispensar", run: () => store.dispenseReferral(ref.id) },
    });
  }

  // Farmacia — stock bajo sin orden abierta, y órdenes por recibir
  const onOrder = new Set(store.purchaseOrders.filter((o) => o.status !== "Recibida").flatMap((o) => o.items.map((i) => i.medicationId)));
  for (const m of store.medications.filter((m) => stockStatus(m) !== "Disponible" && !onOrder.has(m.id))) {
    tasks.push({
      id: `stockmed:${m.id}`, channel: "Farmacia", priority: m.stock === 0 ? "Alta" : "Media", since: today, permission: "farmacia.inventario",
      title: `Reponer ${m.name}`,
      detail: `Stock ${m.stock} · mínimo ${m.minStock}`,
      href: "/farmacia/proveedores",
    });
  }
  for (const o of store.purchaseOrders.filter((o) => o.status === "Enviada")) {
    tasks.push({
      id: `ocfar:${o.id}`, channel: "Farmacia", priority: "Baja", since: o.date, permission: "farmacia.inventario",
      title: `Recibir orden de compra N° ${o.number}`, detail: `${o.items.length} producto(s)`, href: "/farmacia/proveedores",
      quick: { label: "Recibir", run: () => store.receivePurchaseOrder(o.id) },
    });
  }

  // Tienda — despachos, reposición de sala, órdenes
  for (const s of retail.shipments.filter((s) => s.status === "Por preparar" || s.status === "Preparado")) {
    const owner = getOwner(s.ownerRut);
    const next = s.status === "Por preparar" ? "Preparado" : "En ruta";
    tasks.push({
      id: `despacho:${s.id}`, channel: "Tienda", priority: s.scheduledFor <= today ? "Alta" : "Media", since: s.scheduledFor, permission: "tienda.inventario",
      title: `${s.status === "Por preparar" ? "Preparar" : "Entregar al courier"} despacho de ${owner ? ownerName(owner) : ""}`,
      detail: `${s.sector} · ${s.courier} · ${formatDate(s.scheduledFor)}`,
      href: "/tienda/despachos",
      quick: { label: next, run: () => retail.advanceShipment(s.id) },
    });
  }
  for (const p of retail.products.filter((p) => p.stock.sala < p.shelfMin && p.stock.central > 0)) {
    const qty = Math.min(p.stock.central, p.shelfMin * 2 - p.stock.sala);
    tasks.push({
      id: `sala:${p.id}`, channel: "Tienda", priority: p.stock.sala === 0 ? "Alta" : "Media", since: today, permission: "tienda.inventario",
      title: `Reponer sala: ${p.name}`, detail: `Sala ${p.stock.sala}/${p.shelfMin} · bodega ${p.stock.central} · ${p.bin}`,
      href: "/tienda/bodega",
      quick: { label: `Llevar ${qty}`, run: () => retail.transferToSala(p.id, qty) },
    });
  }
  for (const o of retail.orders.filter((o) => o.status === "Enviada")) {
    tasks.push({
      id: `octda:${o.id}`, channel: "Tienda", priority: o.expected <= today ? "Media" : "Baja", since: o.date, permission: "tienda.compras",
      title: `Recibir orden de tienda N° ${o.number}`, detail: `Llegada estimada ${formatDate(o.expected)}`, href: "/tienda/compras",
      quick: { label: "Recibir", run: () => retail.receiveOrder(o.id) },
    });
  }

  // Seguridad — eventos abiertos
  for (const e of security.events.filter((e) => OPEN_EVENT.includes(e.status))) {
    tasks.push({
      id: `evento:${e.id}`, channel: "Seguridad", priority: e.severity === "Crítica" || e.severity === "Alta" ? "Alta" : "Media", since: e.at, permission: "seguridad.ver",
      title: `Revisar: ${e.type}`, detail: `${ZONES[e.zone].label} · ${e.at.slice(11)} · ${e.status}`,
      href: `/seguridad/eventos?id=${e.id}`,
    });
  }

  // Soporte — VetData espera respuesta de la clínica
  for (const t of support.tickets.filter((t) => t.status === "Esperando cliente")) {
    tasks.push({
      id: `ticket:${t.id}`, channel: "Soporte", priority: "Media", since: t.createdAt, permission: "soporte.crear",
      title: `Responder a VetData: ticket #${t.number}`, detail: t.title, href: `/soporte/tickets/${t.id}`,
    });
  }

  const allowed = tasks
    .filter((t) => can(t.permission))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.since.localeCompare(b.since))
    .map((t) => ({ ...t, ageLabel: ago(t.since, today), meta: store.taskMeta[t.id] ?? {} }));

  const me = store.currentUser.name;
  const open = allowed.filter((t) => !t.meta.done);
  return {
    all: allowed,
    open,
    mine: open.filter((t) => !t.meta.assignee || t.meta.assignee === me),
    done: allowed.filter((t) => t.meta.done),
  };
}

export type TaskWithMeta = ReturnType<typeof useTasks>["all"][number];

/** Contadores del menú lateral. */
export function useNavBadges(): Record<string, number> {
  const { requests } = useStore();
  const { mine } = useTasks();
  return {
    "/inicio/pendientes": mine.length,
    "/clinicas/solicitudes": requests.filter((r) => r.to === getCurrentClinic() && r.status === "Pendiente").length,
  };
}
