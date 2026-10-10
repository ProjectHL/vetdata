import { NOW_ISO, hoursBetween } from "@/lib/format";

/**
 * Soporte a VetData: la clínica (cliente de VetData) reporta incidencias,
 * hace consultas y propone mejoras del software. Las ideas se votan entre
 * las clínicas de la red y las lanzadas aparecen en Novedades.
 */

export type TicketCategory = "Incidencia" | "Mejora" | "Consulta" | "Integración / datos" | "Facturación del servicio";
export const TICKET_CATEGORIES: TicketCategory[] = ["Incidencia", "Mejora", "Consulta", "Integración / datos", "Facturación del servicio"];

export type TicketPriority = "Crítica" | "Alta" | "Media" | "Baja";
export const PRIORITIES: TicketPriority[] = ["Crítica", "Alta", "Media", "Baja"];

/** Horas para la primera respuesta de VetData. */
export const SLA_HOURS: Record<TicketPriority, number> = { Crítica: 4, Alta: 24, Media: 72, Baja: 168 };

export type TicketStatus = "Nuevo" | "En revisión" | "En progreso" | "Esperando cliente" | "Resuelto" | "Cerrado";
export const TICKET_FLOW: TicketStatus[] = ["Nuevo", "En revisión", "En progreso", "Esperando cliente", "Resuelto", "Cerrado"];
export const OPEN_STATUSES: TicketStatus[] = ["Nuevo", "En revisión", "En progreso", "Esperando cliente"];

export type TicketMessage = { author: string; side: "Clínica" | "VetData"; body: string; at: string };

export type Ticket = {
  id: string;
  number: number;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  /** "Canal › Módulo" afectado. */
  module: string;
  status: TicketStatus;
  createdBy: string;
  createdAt: string;
  firstResponseAt?: string;
  messages: TicketMessage[];
  context: { route: string; role: string };
  rating?: number;
  ideaId?: string;
};

export type SlaState = "En plazo" | "En riesgo" | "Vencido" | "Cumplido" | "Incumplido";

/** Lógica intacta (T5-5): `now` solo permite evaluar con el momento real en modo http; por defecto es el fijo. */
export function slaState(t: Ticket, now = NOW_ISO): { state: SlaState; hoursLeft: number } {
  const limit = SLA_HOURS[t.priority];
  if (t.firstResponseAt) {
    const took = hoursBetween(t.createdAt, t.firstResponseAt);
    return { state: took <= limit ? "Cumplido" : "Incumplido", hoursLeft: limit - took };
  }
  const left = limit - hoursBetween(t.createdAt, now);
  if (left < 0) return { state: "Vencido", hoursLeft: left };
  if (left < limit * 0.25) return { state: "En riesgo", hoursLeft: left };
  return { state: "En plazo", hoursLeft: left };
}

export type IdeaStatus = "En evaluación" | "Planificada" | "En desarrollo" | "Lanzada";
export const IDEA_FLOW: IdeaStatus[] = ["En evaluación", "Planificada", "En desarrollo", "Lanzada"];

export type Idea = {
  id: string;
  title: string;
  description: string;
  module: string;
  status: IdeaStatus;
  votes: number;
  votedByMe: boolean;
  proposedBy: string;
  releaseId?: string;
};

export type Release = {
  id: string;
  version: string;
  date: string;
  items: { type: "Nuevo" | "Mejora" | "Corrección"; text: string; ideaId?: string }[];
};
