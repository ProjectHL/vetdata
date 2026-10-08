"use client";

import { createContext, useContext, useState } from "react";
import type { Idea, Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/domain/support";
import { currentClinic } from "@/lib/lookups";
import { seedIdeas, seedTickets } from "@/mocks/support";
import { runInBackground, services } from "@/services";
import { NOW_ISO } from "@/lib/format";
import { useStore } from "@/lib/store";

type NewTicket = { title: string; category: TicketCategory; priority: TicketPriority; module: string; body: string; route: string };

type SupportStore = {
  tickets: Ticket[];
  ideas: Idea[];
  createTicket: (t: NewTicket & { ideaId?: string }) => Ticket;
  replyTicket: (id: string, body: string) => void;
  changeStatus: (id: string, status: TicketStatus) => void;
  rateTicket: (id: string, rating: number) => void;
  /** Demo: responde como el equipo de VetData (marca la primera respuesta). */
  simulateSupportReply: (id: string) => void;
  voteIdea: (id: string) => void;
  /** Crea la idea en el tablero de la red y su ticket "Mejora" vinculado. */
  proposeIdea: (input: { title: string; description: string; module: string }) => Ticket;
};

const SupportContext = createContext<SupportStore | null>(null);

let seq = 0;
const newId = (prefix: string) => `${prefix}-new-${++seq}`;

const REPLIES = [
  "Gracias por el reporte. Ya lo estamos revisando y te mantenemos al tanto por aquí.",
  "Pudimos reproducirlo. El equipo de producto trabaja en la corrección.",
  "¿Nos puedes indicar si ocurre con otros usuarios de la clínica?",
];

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, role } = useStore();
  const [tickets, setTickets] = useState(seedTickets); // TODO(api): reemplazar por services.support.listTickets()
  const [ideas, setIdeas] = useState(seedIdeas); // TODO(api): reemplazar por services.support.listIdeas()

  const update = (id: string, fn: (t: Ticket) => Ticket) => setTickets((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));

  /** Alta optimista local del ticket (sin llamar al servicio). */
  const addTicket: SupportStore["createTicket"] = ({ title, category, priority, module, body, route, ideaId }) => {
    const ticket: Ticket = {
      id: newId("tk"),
      number: Math.max(...tickets.map((t) => t.number)) + 1,
      title,
      category,
      priority,
      module,
      status: "Nuevo",
      createdBy: currentUser.name,
      createdAt: NOW_ISO,
      messages: [{ author: currentUser.name, side: "Clínica", body, at: NOW_ISO }],
      context: { route, role },
      ideaId,
    };
    setTickets((prev) => [...prev, ticket]);
    return ticket;
  };

  const store: SupportStore = {
    tickets,
    ideas,
    createTicket: (input) => {
      const ticket = addTicket(input);
      runInBackground(services.support.createTicket(input));
      return ticket;
    },
    replyTicket: (id, body) => {
      update(id, (t) => ({
        ...t,
        // Si soporte esperaba al cliente, la respuesta lo devuelve a "En progreso".
        status: t.status === "Esperando cliente" ? "En progreso" : t.status,
        messages: [...t.messages, { author: currentUser.name, side: "Clínica", body, at: NOW_ISO }],
      }));
      runInBackground(services.support.reply(id, body));
    },
    changeStatus: (id, status) => {
      update(id, (t) => ({ ...t, status }));
      runInBackground(services.support.changeStatus(id, status));
    },
    rateTicket: (id, rating) => {
      update(id, (t) => ({ ...t, rating, status: "Cerrado" }));
      runInBackground(services.support.rate(id, rating));
    },
    // Solo demo: simula la respuesta del equipo de VetData. Sin operación de
    // servicio; con backend real las respuestas llegan al recargar el ticket.
    simulateSupportReply: (id) =>
      update(id, (t) => ({
        ...t,
        firstResponseAt: t.firstResponseAt ?? NOW_ISO,
        status: t.status === "Nuevo" ? "En revisión" : t.status === "En revisión" ? "En progreso" : t.status,
        messages: [
          ...t.messages,
          { author: "Soporte VetData · Ignacia", side: "VetData", body: REPLIES[t.messages.length % REPLIES.length], at: NOW_ISO },
        ],
      })),
    voteIdea: (id) => {
      setIdeas((prev) =>
        prev.map((i) => (i.id === id ? { ...i, votedByMe: !i.votedByMe, votes: i.votes + (i.votedByMe ? -1 : 1) } : i))
      );
      runInBackground(services.support.vote(id));
    },
    proposeIdea: ({ title, description, module }) => {
      const idea: Idea = { id: newId("id"), title, description, module, status: "En evaluación", votes: 1, votedByMe: true, proposedBy: currentClinic };
      setIdeas((prev) => [...prev, idea]);
      runInBackground(services.support.proposeIdea({ title, description, module }));
      return addTicket({ title, category: "Mejora", priority: "Baja", module, body: description, route: "/soporte/mejoras", ideaId: idea.id });
    },
  };

  return <SupportContext.Provider value={store}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const store = useContext(SupportContext);
  if (!store) throw new Error("useSupport debe usarse dentro de <SupportProvider>");
  return store;
}
