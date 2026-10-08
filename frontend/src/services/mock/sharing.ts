import type { AccessGrant, AccessRequest } from "@/domain/sharing";
import { currentClinic } from "@/mocks/network";
import { TODAY, addDays } from "@/lib/format";
import type { SharingService } from "../contracts";
import { actor, db, mockId, notFound, ok, patchById } from "./db";

export const sharing: SharingService = {
  listRequests: () => ok(db.requests),
  listGrants: () => ok(db.grants),
  sendRequests: ({ patientIds, scope, duration, reason }) => {
    const created: AccessRequest[] = patientIds
      .map((id) => db.patients.find((p) => p.id === id))
      .filter((p) => p !== undefined)
      .filter(
        (p) =>
          p.clinic !== currentClinic &&
          !db.requests.some((r) => r.patientId === p.id && r.from === currentClinic && r.status === "Pendiente")
      )
      .map((p) => ({
        id: mockId("q"),
        patientId: p.id,
        ownerRut: p.ownerRut,
        from: currentClinic,
        to: p.clinic,
        requestedBy: actor().name,
        date: TODAY,
        reason,
        scope,
        duration,
        status: "Pendiente",
      }));
    db.requests.push(...created);
    return ok(created);
  },
  respond: (id, { approve, terms }) => {
    const req = db.requests.find((r) => r.id === id);
    if (!req) return notFound("Solicitud", id);
    if (req.status !== "Pendiente") return ok({ request: req });
    const request = patchById(db.requests, id, (r) => ({ ...r, status: approve ? ("Aprobada" as const) : ("Rechazada" as const), respondedAt: TODAY }))!;
    if (!approve) return ok({ request });
    const duration = terms ? terms.duration : req.duration;
    const grant: AccessGrant = {
      id: mockId("g"),
      patientId: req.patientId,
      ownerClinic: req.to,
      grantedTo: req.from,
      scope: terms?.scope ?? req.scope,
      since: TODAY,
      until: duration ? addDays(TODAY, duration) : null,
      revoked: false,
    };
    db.grants.push(grant);
    return ok({ request, grant });
  },
  revoke: (grantId) => {
    const grant = patchById(db.grants, grantId, (g) => ({ ...g, revoked: true }));
    return grant ? ok(grant) : notFound("Acceso", grantId);
  },
};
