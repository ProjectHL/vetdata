import { OPEN_STATUSES, type Ticket, slaState } from "@/domain/support";
import { hoursBetween } from "@/lib/format";

export function supportKpis(tickets: Ticket[]) {
  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const atRisk = open.filter((t) => ["En riesgo", "Vencido"].includes(slaState(t).state));
  const responded = tickets.filter((t) => t.firstResponseAt);
  const avgFirst = responded.length
    ? responded.reduce((s, t) => s + hoursBetween(t.createdAt, t.firstResponseAt!), 0) / responded.length
    : 0;
  const rated = tickets.filter((t) => t.rating);
  return {
    open: open.length,
    atRisk: atRisk.length,
    critical: open.filter((t) => t.priority === "Crítica").length,
    avgFirstResponseHours: avgFirst,
    csat: rated.length ? Math.round((rated.reduce((s, t) => s + t.rating!, 0) / rated.length) * 10) / 10 : null,
  };
}
