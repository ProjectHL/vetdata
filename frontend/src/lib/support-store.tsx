"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Idea, Release, Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/domain/support";
import { seedIdeas, seedTickets, releases as mockReleases } from "@/mocks/support";
import { currentClinic as mockCurrentClinic } from "@/mocks/network";
import { publish, read, readScalar } from "@/lib/server-state";
import { dataSource, newIdempotencyKey, runInBackground, services } from "@/services";
import { NOW_ISO, realNowIso } from "@/lib/format";
import { useStore } from "@/lib/store";

/**
 * Sello de momento para escrituras (T5-5): en modo http el momento real del
 * navegador (las mutaciones siempre corren post-mount: no hay riesgo de
 * hidratación); en modo mock el fijo de la demo reproducible.
 */
function stampNowIso() {
  return dataSource === "http" ? realNowIso() : NOW_ISO;
}

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
      createdAt: stampNowIso(),
      messages: [{ author: currentUser.name, side: "Clínica", body, at: stampNowIso() }],
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
      if (dataSource !== "http") {
        runInBackground(services.support.createTicket(input));
        return ticket;
      }
      newIdempotencyKey();
      runInBackground(
        services.support.createTicket(input).then(
          (saved) => update(ticket.id, () => saved),
          () => {
            setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
            setError("No se pudo crear el ticket. Se descartó el cambio local.");
          }
        )
      );
      return ticket;
    },
    replyTicket: (id, body) => {
      const prev = tickets.find((t) => t.id === id);
      update(id, (t) => ({
        ...t,
        // Si soporte esperaba al cliente, la respuesta lo devuelve a "En progreso".
        status: t.status === "Esperando cliente" ? "En progreso" : t.status,
        messages: [...t.messages, { author: currentUser.name, side: "Clínica", body, at: stampNowIso() }],
      }));
      if (dataSource !== "http" || !prev) {
        runInBackground(services.support.reply(id, body));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.support.reply(id, body).then(
          (saved) => update(id, () => saved),
          () => {
            update(id, () => prev);
            setError("No se pudo enviar la respuesta. Se restauró el estado anterior.");
          }
        )
      );
    },
    changeStatus: (id, status) => {
      const prev = tickets.find((t) => t.id === id);
      update(id, (t) => ({ ...t, status }));
      if (dataSource !== "http" || !prev) {
        runInBackground(services.support.changeStatus(id, status));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.support.changeStatus(id, status).then(
          (saved) => update(id, () => saved),
          () => {
            update(id, () => prev);
            setError("No se pudo cambiar el estado del ticket. Se restauró el estado anterior.");
          }
        )
      );
    },
    rateTicket: (id, rating) => {
      const prev = tickets.find((t) => t.id === id);
      update(id, (t) => ({ ...t, rating, status: "Cerrado" }));
      if (dataSource !== "http" || !prev) {
        runInBackground(services.support.rate(id, rating));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.support.rate(id, rating).then(
          (saved) => update(id, () => saved),
          () => {
            update(id, () => prev);
            setError("No se pudo calificar el ticket. Se restauró el estado anterior.");
          }
        )
      );
    },
    // Solo demo: simula la respuesta del equipo de VetData. Sin operación de
    // servicio; con backend real las respuestas llegan al recargar el ticket.
    simulateSupportReply: (id) =>
      update(id, (t) => ({
        ...t,
        firstResponseAt: t.firstResponseAt ?? stampNowIso(),
        status: t.status === "Nuevo" ? "En revisión" : t.status === "En revisión" ? "En progreso" : t.status,
        messages: [
          ...t.messages,
          { author: "Soporte VetData · Ignacia", side: "VetData", body: REPLIES[t.messages.length % REPLIES.length], at: stampNowIso() },
        ],
      })),
    voteIdea: (id) => {
      const prev = ideas.find((i) => i.id === id);
      // Optimista: invierte el voto con el estado deseado.
      setIdeas((prevIdeas) =>
        prevIdeas.map((i) => (i.id === id ? { ...i, votedByMe: !i.votedByMe, votes: i.votes + (i.votedByMe ? -1 : 1) } : i))
      );
      if (dataSource !== "http" || !prev) {
        runInBackground(services.support.vote(id, !prev?.votedByMe));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.support.vote(id, !prev.votedByMe).then(
          (saved) => setIdeas((prevIdeas) => prevIdeas.map((i) => (i.id === saved.id ? saved : i))),
          () => {
            setIdeas((prevIdeas) => prevIdeas.map((i) => (i.id === id ? prev : i)));
            setError("No se pudo registrar el voto. Se restauró el estado anterior.");
          }
        )
      );
    },
    proposeIdea: ({ title, description, module }) => {
      const idea: Idea = { id: newId("id"), title, description, module, status: "En evaluación", votes: 1, votedByMe: true, proposedBy: readScalar("currentClinic", mockCurrentClinic) };
      setIdeas((prev) => [...prev, idea]);
      const ticketInput = { title, category: "Mejora" as const, priority: "Baja" as const, module, body: description, route: "/soporte/mejoras", ideaId: idea.id };
      if (dataSource !== "http") {
        runInBackground(services.support.proposeIdea({ title, description, module }));
        return addTicket(ticketInput);
      }
      // T5-4: UNA key por propuesta; el servidor devuelve {idea, ticket} canónicos
      // (el ticket ya enlaza el id canónico de la idea).
      const ticket = addTicket(ticketInput);
      newIdempotencyKey();
      runInBackground(
        services.support.proposeIdea({ title, description, module }).then(
          ({ idea: savedIdea, ticket: savedTicket }) => {
            setIdeas((prev) => prev.map((i) => (i.id === idea.id ? savedIdea : i)));
            setTickets((prev) => prev.map((t) => (t.id === ticket.id ? savedTicket : t)));
          },
          () => {
            setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
            setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
            setError("No se pudo proponer la mejora. Se descartaron los cambios locales.");
          }
        )
      );
      return ticket;
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
