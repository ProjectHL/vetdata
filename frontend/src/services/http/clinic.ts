import type { Appointment } from "@/domain/appointments";
import type { Doctor, Room } from "@/domain/clinic";
import type { Invoice } from "@/domain/invoices";
import type { Clinic } from "@/domain/network";
import type { Owner } from "@/domain/owners";
import type { Patient } from "@/domain/patients";
import type { Referral } from "@/domain/referrals";
import type { Service } from "@/domain/services";
import type {
  AppointmentsService,
  ClinicService,
  InvoicesService,
  NetworkService,
  OwnersService,
  PatientsService,
  ReferralsService,
} from "../contracts";
import { ApiError, apiFetch, NotImplementedError } from "./client";

export const patients: PatientsService = {
  /** GET /api/v1/patients */
  list: () => apiFetch<Patient[]>("/api/v1/patients"),
  /** GET /api/v1/patients/:id */
  get: (id) =>
    apiFetch<Patient>(`/api/v1/patients/${encodeURIComponent(id)}`).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }),
  /** GET /api/v1/owners/:rut/patients */
  listByOwner: (ownerRut) => apiFetch<Patient[]>(`/api/v1/owners/${encodeURIComponent(ownerRut)}/patients`),
};

export const owners: OwnersService = {
  /** GET /api/v1/owners */
  list: () => apiFetch<Owner[]>("/api/v1/owners"),
  /** GET /api/v1/owners/:rut */
  get: (rut) =>
    apiFetch<Owner>(`/api/v1/owners/${encodeURIComponent(rut)}`).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }),
};

export const clinic: ClinicService = {
  /** GET /api/v1/doctors */
  listDoctors: () => apiFetch<Doctor[]>("/api/v1/doctors"),
  /** GET /api/v1/rooms */
  listRooms: () => apiFetch<Room[]>("/api/v1/rooms"),
  /** PATCH /api/v1/rooms/:id */
  updateRoom: (id, patch) =>
    apiFetch<Room>(`/api/v1/rooms/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  /** GET /api/v1/billable-services — FALTANTE: sin endpoint en el backend. */
  listServices: async (): Promise<Service[]> => {
    throw new NotImplementedError("GET /api/v1/billable-services");
  },
};

export const appointments: AppointmentsService = {
  /** GET /api/v1/appointments */
  list: () => apiFetch<Appointment[]>("/api/v1/appointments"),
  /** POST /api/v1/appointments — el backend solo acepta patientId/doctorId/date/time/reason (+emergency); status se fuerza a Agendada. */
  create: ({ patientId, doctorId, date, time, reason }) =>
    apiFetch<Appointment>("/api/v1/appointments", { method: "POST", body: { patientId, doctorId, date, time, reason } }),
  /** PATCH /api/v1/appointments/:id */
  update: (id, patch) =>
    apiFetch<Appointment>(`/api/v1/appointments/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
};

export const invoices: InvoicesService = {
  /** GET /api/v1/invoices */
  list: () => apiFetch<Invoice[]>("/api/v1/invoices"),
  /** POST /api/v1/invoices — FALTANTE: el backend exige ownerId + lines[{itemId, qty, discount}] y el contrato trae ownerRut + items[{description, qty, unitPrice}]; sin resolución de ítems no se puede armar el body. */
  create: async () => {
    throw new NotImplementedError("POST /api/v1/invoices");
  },
};

export const referrals: ReferralsService = {
  /** GET /api/v1/pharmacy/referrals (ruta real del backend) */
  list: () => apiFetch<Referral[]>("/api/v1/pharmacy/referrals"),
  /** POST /api/v1/pharmacy/referrals — FALTANTE: el backend exige prescriptionId (receta vigente) y el contrato no lo trae; tampoco mapea items[{medicationId, dose…}] a items[{itemId, qty}]. */
  create: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/referrals");
  },
  /** POST /api/v1/pharmacy/referrals/:id/dispense (ruta real del backend) */
  dispense: (id) =>
    apiFetch<Referral>(`/api/v1/pharmacy/referrals/${encodeURIComponent(id)}/dispense`, { method: "POST" }),
};

export const network: NetworkService = {
  /** GET /api/v1/me/clinic — el backend devuelve el nombre como string JSON. */
  getCurrentClinic: () => apiFetch<string>("/api/v1/me/clinic"),
  /** GET /api/v1/network/clinics */
  listClinics: () => apiFetch<Clinic[]>("/api/v1/network/clinics"),
};
