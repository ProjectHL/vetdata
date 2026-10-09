import type { Idea, Release, Ticket } from "@/domain/support";
import type { ProposeIdeaResult, SupportService } from "../contracts";
import { ApiError, apiFetch } from "./client";

export const support: SupportService = {
  /** GET /api/v1/support/tickets */
  listTickets: () => apiFetch<Ticket[]>("/api/v1/support/tickets"),
  /** GET /api/v1/support/tickets/:id */
  getTicket: (id) =>
    apiFetch<Ticket>(`/api/v1/support/tickets/${encodeURIComponent(id)}`).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }),
  /** POST /api/v1/support/tickets */
  createTicket: (input) => apiFetch<Ticket>("/api/v1/support/tickets", { method: "POST", body: input }),
  /** POST /api/v1/support/tickets/:id/messages — el backend usa {body}. */
  reply: (id, body) =>
    apiFetch<Ticket>(`/api/v1/support/tickets/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: { body },
    }),
  /** PATCH /api/v1/support/tickets/:id/status — el backend usa {status}. */
  changeStatus: (id, status) =>
    apiFetch<Ticket>(`/api/v1/support/tickets/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }),
  /** POST /api/v1/support/tickets/:id/rating — el backend usa {rating}. */
  rate: (id, rating) =>
    apiFetch<Ticket>(`/api/v1/support/tickets/${encodeURIComponent(id)}/rating`, {
      method: "POST",
      body: { rating },
    }),
  /** GET /api/v1/support/ideas */
  listIdeas: () => apiFetch<Idea[]>("/api/v1/support/ideas"),
  /** POST /api/v1/support/ideas/:id/vote */
  vote: (id) => apiFetch<Idea>(`/api/v1/support/ideas/${encodeURIComponent(id)}/vote`, { method: "POST" }),
  /** POST /api/v1/support/ideas — el backend devuelve {idea, ticket}. */
  proposeIdea: (input) =>
    apiFetch<ProposeIdeaResult>("/api/v1/support/ideas", { method: "POST", body: input }),
  /** GET /api/v1/support/releases */
  listReleases: () => apiFetch<Release[]>("/api/v1/support/releases"),
};
