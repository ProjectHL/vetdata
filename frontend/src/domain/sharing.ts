import { TODAY } from "@/lib/format";
import type { Patient } from "./patients";

/**
 * Lógica de datos compartidos (3 reglas):
 * 1. Cada mascota tiene una clínica de origen (patient.clinic), dueña del dato.
 * 2. Otra clínica solo ve la ficha si tiene un acceso vigente, que se obtiene
 *    solicitándolo a la clínica de origen (con consentimiento del dueño).
 * 3. Todo acceso tiene alcance y vigencia, y el origen puede revocarlo.
 */

export type AccessScope = "Ficha completa" | "Resumen clínico";
/** Días de vigencia; null = permanente. */
export type AccessDuration = 30 | 90 | null;

export const SCOPES: AccessScope[] = ["Ficha completa", "Resumen clínico"];
export const DURATIONS: { value: AccessDuration; label: string }[] = [
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: null, label: "Permanente" },
];

export function durationLabel(d: AccessDuration) {
  return DURATIONS.find((x) => x.value === d)!.label;
}

export type RequestStatus = "Pendiente" | "Aprobada" | "Rechazada";

export type AccessRequest = {
  id: string;
  patientId: string;
  ownerRut: string;
  /** Clínica que pide el acceso. */
  from: string;
  /** Clínica de origen de la mascota (la que aprueba). */
  to: string;
  requestedBy: string;
  date: string;
  reason: string;
  scope: AccessScope;
  duration: AccessDuration;
  status: RequestStatus;
  respondedAt?: string;
};

export type AccessGrant = {
  id: string;
  patientId: string;
  ownerClinic: string;
  grantedTo: string;
  scope: AccessScope;
  since: string;
  /** null = permanente. */
  until: string | null;
  revoked: boolean;
};

export type GrantStatus = "Vigente" | "Vencido" | "Revocado";

export function grantStatus(g: AccessGrant, today = TODAY): GrantStatus {
  if (g.revoked) return "Revocado";
  if (g.until && g.until < today) return "Vencido";
  return "Vigente";
}

export type AccessLevel = "propio" | "compartido" | "ninguno";

export function accessLevel(
  patient: Pick<Patient, "id" | "clinic">,
  grants: AccessGrant[],
  clinic: string,
  today = TODAY
): { level: AccessLevel; grant?: AccessGrant } {
  if (patient.clinic === clinic) return { level: "propio" };
  const grant = grants.find(
    (g) => g.patientId === patient.id && g.grantedTo === clinic && grantStatus(g, today) === "Vigente"
  );
  return grant ? { level: "compartido", grant } : { level: "ninguno" };
}
