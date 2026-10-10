import type { Idea, Ticket } from "@/domain/support";
import { currentClinic } from "@/mocks/network";
import { NOW_ISO } from "@/lib/format";
import type { NewTicket, SupportService } from "../contracts";
import { actor, db, mockId, nextNumber, notFound, ok, patchById } from "./db";

function createTicket({ title, category, priority, module, body, route, ideaId }: NewTicket): Ticket {
  const user = actor();
  const ticket: Ticket = {
    id: mockId("tk"),
    number: nextNumber(db.tickets.map((t) => t.number)),
    title,
    category,
    priority,
    module,
    status: "Nuevo",
    createdBy: user.name,
    createdAt: NOW_ISO,
    messages: [{ author: user.name, side: "Clínica", body, at: NOW_ISO }],
    context: { route, role: user.role },
    ideaId,
  };
  db.tickets.push(ticket);
  return ticket;
}

const updateTicket = (id: string, fn: (t: Ticket) => Ticket) => {
  const ticket = patchById(db.tickets, id, fn);
  return ticket ? ok(ticket) : notFound("Ticket", id);
};

export const support: SupportService = {
  listTickets: () => ok(db.tickets),
  getTicket: (id) => ok(db.tickets.find((t) => t.id === id)),
  createTicket: (input) => ok(createTicket(input)),
  reply: (id, body) =>
    updateTicket(id, (t) => ({
      ...t,
      status: t.status === "Esperando cliente" ? "En progreso" : t.status,
      messages: [...t.messages, { author: actor().name, side: "Clínica", body, at: NOW_ISO }],
    })),
  changeStatus: (id, status) => updateTicket(id, (t) => ({ ...t, status })),
  rate: (id, rating) => updateTicket(id, (t) => ({ ...t, rating, status: "Cerrado" })),
  listIdeas: () => ok(db.ideas),
  vote: (id, voted) => {
    const idea = patchById(db.ideas, id, (i) => {
      if (i.votedByMe === voted) return i; // no-op idempotente
      return { ...i, votedByMe: voted, votes: i.votes + (voted ? 1 : -1) };
    });
    return idea ? ok(idea) : notFound("Idea", id);
  },
  proposeIdea: ({ title, description, module }) => {
    const idea: Idea = { id: mockId("id"), title, description, module, status: "En evaluación", votes: 1, votedByMe: true, proposedBy: currentClinic };
    db.ideas.push(idea);
    const ticket = createTicket({ title, category: "Mejora", priority: "Baja", module, body: description, route: "/soporte/mejoras", ideaId: idea.id });
    return ok({ idea, ticket });
  },
  listReleases: () => ok(db.releases),
};
