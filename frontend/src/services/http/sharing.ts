import type { AccessGrant, AccessRequest } from "@/domain/sharing";
import type { RespondAccessRequestResult, SharingService } from "../contracts";
import { apiFetch, NotImplementedError } from "./client";

export const sharing: SharingService = {
  /** GET /api/v1/sharing/requests */
  listRequests: () => apiFetch<AccessRequest[]>("/api/v1/sharing/requests"),
  /** GET /api/v1/sharing/grants */
  listGrants: () => apiFetch<AccessGrant[]>("/api/v1/sharing/grants"),
  /** POST /api/v1/sharing/requests */
  sendRequests: async (input) => {
    const created = await apiFetch<{ id: string }[]>("/api/v1/sharing/requests", { method: "POST", body: input });
    const ids = new Set(created.map((request) => request.id));
    const requests = await apiFetch<AccessRequest[]>("/api/v1/sharing/requests");
    return requests.filter((request) => ids.has(request.id));
  },
  /** POST /api/v1/sharing/requests/:id/response — FALTANTE: el backend no expone respuesta de clínica (solo cancel/resend y decisión del dueño en /api/v1/owner/sharing/requests/:id/decision). */
  respond: async (): Promise<RespondAccessRequestResult> => {
    throw new NotImplementedError("POST /api/v1/sharing/requests/:id/response");
  },
  /** POST /api/v1/sharing/grants/:id/revoke — FALTANTE: el backend expone suspend/restore (y revoke del dueño), no revocación por clínica. */
  revoke: async () => {
    throw new NotImplementedError("POST /api/v1/sharing/grants/:id/revoke");
  },
};
