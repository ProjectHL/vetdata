"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Idea, Release, Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/domain/support";
import { seedIdeas, seedTickets, releases as mockReleases } from "@/mocks/support";
import { currentClinic as mockCurrentClinic } from "@/mocks/network";
import { publish, read, readScalar } from "@/lib/server-state";
import { dataSource, runInBackground, services } from "@/services";
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
  // Hidratación desde el servidor (T5-2): en modo mock siempre loading=false y error=null.
  loading: boolean;
  error: string | null;
  /** Reintenta la carga inicial desde el servidor (solo modo http). */
  retry: () => void;
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
  const [tickets, setTickets] = useState(seedTickets); // http: se hidrata con services.support.listTickets()
  const [ideas, setIdeas] = useState(seedIdeas); // http: se hidrata con services.support.listIdeas()
  // Catálogo publicado al registro de lib (no se expone: la UI lo lee vía useLiveList("releases") de server-state).
  const [releases, setReleases] = useState<Release[]>(read("releases", mockReleases)); // http: se hidrata con services.support.listReleases()

  // Hidratación inicial solo en modo http; en mock la semilla es el estado final.
  const [loading, setLoading] = useState(dataSource === "http");
  const [error, setError] = useState<string | null>(null);

  /** Carga inicial desde el servidor. Si falla, se conserva la semilla y se expone el error. */
  const load = useCallback(async () => {
    if (dataSource !== "http") return;
    try {
      const [ticketsData, ideasData, releasesData] = await Promise.all([
        services.support.listTickets(),
        services.support.listIdeas(),
        services.support.listReleases(),
      ]);
      // Publica antes de los setState para que el re-render ya lea el registro fresco.
      publish("releases", releasesData);
      setTickets(ticketsData);
      setIdeas(ideasData);
      setReleases(releasesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información de soporte");
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
    publish("releases", releases);
  }, [releases]);

  const retry = () => {
    setLoading(true);
    setError(null);
    void load();
  };

  const update = (id: string, fn: (t: Ticket) => Ticket) => setTickets((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));

  /** Alta optimista local del ticket (sin llamar al servicio). */
  const addTicket: SupportStore["createTicket"] = ({ title, category, priority, module, body, route, ideaId }) => {
    const ticket: Ticket = {
      id: newId("tk"),
      number: Math.max(0, ...tickets.map((t) => t.number)) + 1,
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
      const idea: Idea = { id: newId("id"), title, description, module, status: "En evaluación", votes: 1, votedByMe: true, proposedBy: readScalar("currentClinic", mockCurrentClinic) };
      setIdeas((prev) => [...prev, idea]);
      runInBackground(services.support.proposeIdea({ title, description, module }));
      return addTicket({ title, category: "Mejora", priority: "Baja", module, body: description, route: "/soporte/mejoras", ideaId: idea.id });
    },
    loading,
    error,
    retry,
  };

  return <SupportContext.Provider value={store}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const store = useContext(SupportContext);
  if (!store) throw new Error("useSupport debe usarse dentro de <SupportProvider>");
  return store;
}
