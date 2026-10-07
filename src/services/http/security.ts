import type { SecurityService } from "../contracts";
import { NotImplementedError } from "./client";

export const security: SecurityService = {
  /** GET /api/v1/security/cameras */
  listCameras: async () => {
    throw new NotImplementedError("GET /api/v1/security/cameras");
  },
  /** PATCH /api/v1/security/cameras/:id */
  setCameraStatus: async () => {
    throw new NotImplementedError("PATCH /api/v1/security/cameras/:id");
  },
  /** GET /api/v1/security/devices */
  listDevices: async () => {
    throw new NotImplementedError("GET /api/v1/security/devices");
  },
  /** POST /api/v1/security/devices/:id/toggle-lock */
  toggleLock: async () => {
    throw new NotImplementedError("POST /api/v1/security/devices/:id/toggle-lock");
  },
  /** GET /api/v1/security/nvr */
  getNvrStorage: async () => {
    throw new NotImplementedError("GET /api/v1/security/nvr");
  },
  /** GET /api/v1/security/events */
  listEvents: async () => {
    throw new NotImplementedError("GET /api/v1/security/events");
  },
  /** POST /api/v1/security/events */
  createEvent: async () => {
    throw new NotImplementedError("POST /api/v1/security/events");
  },
  /** PATCH /api/v1/security/events/:id */
  updateEvent: async () => {
    throw new NotImplementedError("PATCH /api/v1/security/events/:id");
  },
  /** POST /api/v1/security/events/:id/notes */
  addEventNote: async () => {
    throw new NotImplementedError("POST /api/v1/security/events/:id/notes");
  },
  /** GET /api/v1/security/audit */
  listAudit: async () => {
    throw new NotImplementedError("GET /api/v1/security/audit");
  },
  /** POST /api/v1/security/audit */
  logAudit: async () => {
    throw new NotImplementedError("POST /api/v1/security/audit");
  },
  /** GET /api/v1/security/access */
  listAccess: async () => {
    throw new NotImplementedError("GET /api/v1/security/access");
  },
  /** GET /api/v1/security/waiting */
  listWaiting: async () => {
    throw new NotImplementedError("GET /api/v1/security/waiting");
  },
  /** POST /api/v1/security/waiting */
  checkIn: async () => {
    throw new NotImplementedError("POST /api/v1/security/waiting");
  },
  /** POST /api/v1/security/waiting/:id/call */
  callFromWaiting: async () => {
    throw new NotImplementedError("POST /api/v1/security/waiting/:id/call");
  },
  /** GET /api/v1/security/settings */
  getSettings: async () => {
    throw new NotImplementedError("GET /api/v1/security/settings");
  },
  /** PATCH /api/v1/security/settings */
  updateSettings: async () => {
    throw new NotImplementedError("PATCH /api/v1/security/settings");
  },
  /** PUT /api/v1/security/alarm */
  setAlarm: async () => {
    throw new NotImplementedError("PUT /api/v1/security/alarm");
  },
};
