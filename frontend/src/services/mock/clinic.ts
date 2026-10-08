import { invoiceTotals } from "@/domain/invoices";
import { INTERNAL_PHARMACY } from "@/domain/referrals";
import { currentClinic } from "@/mocks/network";
import type {
  AppointmentsService,
  ClinicService,
  InvoicesService,
  NetworkService,
  OwnersService,
  PatientsService,
  ReferralsService,
} from "../contracts";
import { db, mockId, nextNumber, notFound, ok, patchById } from "./db";
import { recordMovements } from "./pharmacy";

export const patients: PatientsService = {
  list: () => ok(db.patients),
  get: (id) => ok(db.patients.find((p) => p.id === id)),
  listByOwner: (ownerRut) => ok(db.patients.filter((p) => p.ownerRut === ownerRut)),
};

export const owners: OwnersService = {
  list: () => ok(db.owners),
  get: (rut) => ok(db.owners.find((o) => o.rut === rut)),
};

export const clinic: ClinicService = {
  listDoctors: () => ok(db.doctors),
  listRooms: () => ok(db.rooms),
  updateRoom: (id, patch) => {
    const room = patchById(db.rooms, id, (r) => ({ ...r, ...patch }));
    return room ? ok(room) : notFound("Box", id);
  },
  listServices: () => ok(db.services),
};

export const appointments: AppointmentsService = {
  list: () => ok(db.appointments),
  create: (input) => {
    const created = { ...input, id: mockId("a") };
    db.appointments.push(created);
    return ok(created);
  },
  update: (id, patch) => {
    const appt = patchById(db.appointments, id, (a) => ({ ...a, ...patch }));
    return appt ? ok(appt) : notFound("Cita", id);
  },
};

export const invoices: InvoicesService = {
  list: () => ok(db.invoices),
  create: (input) => {
    const folio = nextNumber(db.invoices.map((i) => i.folio));
    const created = { ...input, ...invoiceTotals(input.items), id: mockId("f"), folio };
    db.invoices.push(created);
    recordMovements(
      input.items
        .filter((item) => item.medicationId)
        .map((item) => ({ medicationId: item.medicationId!, type: "Salida", reason: "Venta", qty: -item.qty, ref: `Factura ${folio}` }))
    );
    return ok(created);
  },
};

export const referrals: ReferralsService = {
  list: () => ok(db.referrals),
  create: (input) => {
    const created = { ...input, id: mockId("r") };
    db.referrals.push(created);
    return ok(created);
  },
  dispense: (id) => {
    const ref = db.referrals.find((r) => r.id === id);
    if (!ref) return notFound("Derivación", id);
    if (ref.destination !== INTERNAL_PHARMACY || ref.status === "Dispensada") return ok(ref);
    const patient = db.patients.find((p) => p.id === ref.patientId);
    recordMovements(
      ref.items.map((item) => ({
        medicationId: item.medicationId,
        type: "Salida",
        reason: "Dispensación",
        qty: -item.qty,
        ref: `Derivación ${patient?.name ?? ""}`.trim(),
      }))
    );
    return ok(patchById(db.referrals, id, (r) => ({ ...r, status: "Dispensada" }))!);
  },
};

export const network: NetworkService = {
  getCurrentClinic: () => ok(currentClinic),
  listClinics: () => ok(db.clinics),
};
