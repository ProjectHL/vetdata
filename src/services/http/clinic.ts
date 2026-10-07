import type {
  AppointmentsService,
  ClinicService,
  InvoicesService,
  NetworkService,
  OwnersService,
  PatientsService,
  ReferralsService,
} from "../contracts";
import { NotImplementedError } from "./client";

export const patients: PatientsService = {
  /** GET /api/v1/patients */
  list: async () => {
    throw new NotImplementedError("GET /api/v1/patients");
  },
  /** GET /api/v1/patients/:id */
  get: async () => {
    throw new NotImplementedError("GET /api/v1/patients/:id");
  },
  /** GET /api/v1/owners/:rut/patients */
  listByOwner: async () => {
    throw new NotImplementedError("GET /api/v1/owners/:rut/patients");
  },
};

export const owners: OwnersService = {
  /** GET /api/v1/owners */
  list: async () => {
    throw new NotImplementedError("GET /api/v1/owners");
  },
  /** GET /api/v1/owners/:rut */
  get: async () => {
    throw new NotImplementedError("GET /api/v1/owners/:rut");
  },
};

export const clinic: ClinicService = {
  /** GET /api/v1/doctors */
  listDoctors: async () => {
    throw new NotImplementedError("GET /api/v1/doctors");
  },
  /** GET /api/v1/rooms */
  listRooms: async () => {
    throw new NotImplementedError("GET /api/v1/rooms");
  },
  /** PATCH /api/v1/rooms/:id */
  updateRoom: async () => {
    throw new NotImplementedError("PATCH /api/v1/rooms/:id");
  },
  /** GET /api/v1/billable-services */
  listServices: async () => {
    throw new NotImplementedError("GET /api/v1/billable-services");
  },
};

export const appointments: AppointmentsService = {
  /** GET /api/v1/appointments */
  list: async () => {
    throw new NotImplementedError("GET /api/v1/appointments");
  },
  /** POST /api/v1/appointments */
  create: async () => {
    throw new NotImplementedError("POST /api/v1/appointments");
  },
  /** PATCH /api/v1/appointments/:id */
  update: async () => {
    throw new NotImplementedError("PATCH /api/v1/appointments/:id");
  },
};

export const invoices: InvoicesService = {
  /** GET /api/v1/invoices */
  list: async () => {
    throw new NotImplementedError("GET /api/v1/invoices");
  },
  /** POST /api/v1/invoices */
  create: async () => {
    throw new NotImplementedError("POST /api/v1/invoices");
  },
};

export const referrals: ReferralsService = {
  /** GET /api/v1/referrals */
  list: async () => {
    throw new NotImplementedError("GET /api/v1/referrals");
  },
  /** POST /api/v1/referrals */
  create: async () => {
    throw new NotImplementedError("POST /api/v1/referrals");
  },
  /** POST /api/v1/referrals/:id/dispense */
  dispense: async () => {
    throw new NotImplementedError("POST /api/v1/referrals/:id/dispense");
  },
};

export const network: NetworkService = {
  /** GET /api/v1/me/clinic */
  getCurrentClinic: async () => {
    throw new NotImplementedError("GET /api/v1/me/clinic");
  },
  /** GET /api/v1/network/clinics */
  listClinics: async () => {
    throw new NotImplementedError("GET /api/v1/network/clinics");
  },
};
