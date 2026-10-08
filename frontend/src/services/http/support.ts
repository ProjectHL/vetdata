import type { SupportService } from "../contracts";
import { NotImplementedError } from "./client";

export const support: SupportService = {
  /** GET /api/v1/support/tickets */
  listTickets: async () => {
    throw new NotImplementedError("GET /api/v1/support/tickets");
  },
  /** GET /api/v1/support/tickets/:id */
  getTicket: async () => {
    throw new NotImplementedError("GET /api/v1/support/tickets/:id");
  },
  /** POST /api/v1/support/tickets */
  createTicket: async () => {
    throw new NotImplementedError("POST /api/v1/support/tickets");
  },
  /** POST /api/v1/support/tickets/:id/messages */
  reply: async () => {
    throw new NotImplementedError("POST /api/v1/support/tickets/:id/messages");
  },
  /** PATCH /api/v1/support/tickets/:id/status */
  changeStatus: async () => {
    throw new NotImplementedError("PATCH /api/v1/support/tickets/:id/status");
  },
  /** POST /api/v1/support/tickets/:id/rating */
  rate: async () => {
    throw new NotImplementedError("POST /api/v1/support/tickets/:id/rating");
  },
  /** GET /api/v1/support/ideas */
  listIdeas: async () => {
    throw new NotImplementedError("GET /api/v1/support/ideas");
  },
  /** POST /api/v1/support/ideas/:id/vote */
  vote: async () => {
    throw new NotImplementedError("POST /api/v1/support/ideas/:id/vote");
  },
  /** POST /api/v1/support/ideas */
  proposeIdea: async () => {
    throw new NotImplementedError("POST /api/v1/support/ideas");
  },
  /** GET /api/v1/support/releases */
  listReleases: async () => {
    throw new NotImplementedError("GET /api/v1/support/releases");
  },
};
