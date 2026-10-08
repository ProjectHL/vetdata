import type { SharingService } from "../contracts";
import { NotImplementedError } from "./client";

export const sharing: SharingService = {
  /** GET /api/v1/sharing/requests */
  listRequests: async () => {
    throw new NotImplementedError("GET /api/v1/sharing/requests");
  },
  /** GET /api/v1/sharing/grants */
  listGrants: async () => {
    throw new NotImplementedError("GET /api/v1/sharing/grants");
  },
  /** POST /api/v1/sharing/requests */
  sendRequests: async () => {
    throw new NotImplementedError("POST /api/v1/sharing/requests");
  },
  /** POST /api/v1/sharing/requests/:id/response */
  respond: async () => {
    throw new NotImplementedError("POST /api/v1/sharing/requests/:id/response");
  },
  /** POST /api/v1/sharing/grants/:id/revoke */
  revoke: async () => {
    throw new NotImplementedError("POST /api/v1/sharing/grants/:id/revoke");
  },
};
