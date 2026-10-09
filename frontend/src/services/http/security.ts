import type {
  AccessEntry,
  AuditEntry,
  Camera,
  Device,
  NvrStorage,
  SecurityEvent,
  SecuritySettings,
  WaitingEntry,
} from "@/domain/security";
import type { CallFromWaitingResult, CheckInResult, SecurityService } from "../contracts";
import { apiFetch, NotImplementedError } from "./client";

export const security: SecurityService = {
  /** GET /api/v1/security/cameras — FALTANTE: sin endpoint en el backend. */
  listCameras: async (): Promise<Camera[]> => {
    throw new NotImplementedError("GET /api/v1/security/cameras");
  },
  /** PATCH /api/v1/security/cameras/:id — FALTANTE: sin endpoint en el backend. */
  setCameraStatus: async () => {
    throw new NotImplementedError("PATCH /api/v1/security/cameras/:id");
  },
  /** GET /api/v1/security/devices — FALTANTE: sin endpoint en el backend. */
  listDevices: async (): Promise<Device[]> => {
    throw new NotImplementedError("GET /api/v1/security/devices");
  },
  /** POST /api/v1/security/devices/:id/toggle-lock — FALTANTE: sin endpoint en el backend. */
  toggleLock: async () => {
    throw new NotImplementedError("POST /api/v1/security/devices/:id/toggle-lock");
  },
  /** GET /api/v1/security/nvr — FALTANTE: sin endpoint en el backend. */
  getNvrStorage: async (): Promise<NvrStorage> => {
    throw new NotImplementedError("GET /api/v1/security/nvr");
  },
  /** GET /api/v1/security/events */
  listEvents: () => apiFetch<SecurityEvent[]>("/api/v1/security/events"),
  /** POST /api/v1/security/events — el backend usa cameraRef (opcional). */
  createEvent: ({ zone, cameraId, type, severity, note }) =>
    apiFetch<SecurityEvent>("/api/v1/security/events", {
      method: "POST",
      body: { zone, cameraRef: cameraId, type, severity, note },
    }),
  /** PATCH /api/v1/security/events/:id */
  updateEvent: (id, patch) =>
    apiFetch<SecurityEvent>(`/api/v1/security/events/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  /** POST /api/v1/security/events/:id/notes — el backend usa {text}. */
  addEventNote: (id, text) =>
    apiFetch<SecurityEvent>(`/api/v1/security/events/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      body: { text },
    }),
  /** GET /api/v1/security/audit — FALTANTE: la auditoría la genera el servidor (sin endpoint de lectura para clínica). */
  listAudit: async (): Promise<AuditEntry[]> => {
    throw new NotImplementedError("GET /api/v1/security/audit");
  },
  /** POST /api/v1/security/audit — FALTANTE (solo prototipo; retirar): la auditoría la genera el servidor al ejecutar cada acción. */
  logAudit: async () => {
    throw new NotImplementedError("POST /api/v1/security/audit");
  },
  /** GET /api/v1/security/access */
  listAccess: () => apiFetch<AccessEntry[]>("/api/v1/security/access"),
  /** GET /api/v1/security/waiting */
  listWaiting: () => apiFetch<WaitingEntry[]>("/api/v1/security/waiting"),
  /** POST /api/v1/security/waiting — el backend usa {appointmentId}. */
  checkIn: (appointmentId) =>
    apiFetch<CheckInResult>("/api/v1/security/waiting", { method: "POST", body: { appointmentId } }),
  /** POST /api/v1/security/waiting/:id/call — el backend usa {roomId}. */
  callFromWaiting: (entryId, roomId) =>
    apiFetch<CallFromWaitingResult>(`/api/v1/security/waiting/${encodeURIComponent(entryId)}/call`, {
      method: "POST",
      body: { roomId },
    }),
  /** GET /api/v1/security/settings */
  getSettings: () => apiFetch<SecuritySettings>("/api/v1/security/settings"),
  /** PATCH /api/v1/security/settings — el backend rechaza alarmArmed por PATCH (tiene control propio). */
  updateSettings: (patch) => {
    const { alarmArmed: _alarmArmed, ...rest } = patch;
    void _alarmArmed;
    return apiFetch<SecuritySettings>("/api/v1/security/settings", { method: "PATCH", body: rest });
  },
  /** PUT /api/v1/security/alarm — FALTANTE: sin endpoint en el backend. */
  setAlarm: async () => {
    throw new NotImplementedError("PUT /api/v1/security/alarm");
  },
};
