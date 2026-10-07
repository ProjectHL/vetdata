export type ReferralItem = {
  medicationId: string;
  dose: string;
  frequency: string;
  duration: string;
  qty: number;
};

export type ReferralStatus = "Enviada" | "Recibida" | "Dispensada";

export type Referral = {
  id: string;
  patientId: string;
  date: string;
  doctorId: string;
  /** "Farmacia interna" o el nombre de una clínica de la red. */
  destination: string;
  items: ReferralItem[];
  notes: string;
  status: ReferralStatus;
};

export const INTERNAL_PHARMACY = "Farmacia interna";
