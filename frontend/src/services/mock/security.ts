import { ownerName } from "@/domain/owners";
import type { SecurityEvent } from "@/domain/security";
import { NOW_ISO, NOW_TIME } from "@/lib/format";
import type { SecurityService } from "../contracts";
import { actor, db, mockId, notFound, ok, patchById } from "./db";

const updateEvent = (id: string, fn: (e: SecurityEvent) => SecurityEvent) => {
  const event = patchById(db.events, id, fn);
  return event ? ok(event) : notFound("Evento", id);
};

export const security: SecurityService = {
  listCameras: () => ok(db.cameras),
  setCameraStatus: (id, status) => {
    const camera = patchById(db.cameras, id, (c) => ({ ...c, status }));
    return camera ? ok(camera) : notFound("Cámara", id);
  },
  listDevices: () => ok(db.devices),
  toggleLock: (deviceId) => {
    const device = patchById(db.devices, deviceId, (d) => ({ ...d, locked: !d.locked }));
    return device ? ok(device) : notFound("Dispositivo", deviceId);
  },
  getNvrStorage: () => ok(db.nvr),
  listEvents: () => ok(db.events),
  createEvent: ({ zone, cameraId, type, severity, note }) => {
    const by = actor().name;
    const event: SecurityEvent = {
      id: mockId("ev"),
      at: NOW_ISO,
      zone,
      cameraId,
      type,
      severity,
      status: "Nuevo",
      notes: note ? [{ by, at: NOW_ISO, text: note }] : [],
    };
    db.events.unshift(event);
    return ok(event);
  },
  updateEvent: (id, patch) =>
    updateEvent(id, (e) => ({
      ...e,
      ...patch,
      resolvedAt: patch.status === "Resuelto" || patch.status === "Falsa alarma" ? NOW_ISO : e.resolvedAt,
    })),
  addEventNote: (id, text) => updateEvent(id, (e) => ({ ...e, notes: [...e.notes, { by: actor().name, at: NOW_ISO, text }] })),
  listAudit: () => ok(db.audit),
  logAudit: ({ cameraId, action, reason }) => {
    const user = actor();
    const entry = { id: mockId("au"), at: NOW_ISO, user: user.name, role: user.role, action, cameraId, reason };
    db.audit.unshift(entry);
    return ok(entry);
  },
  listAccess: () => ok(db.access),
  listWaiting: () => ok(db.waiting),
  checkIn: (appointmentId) => {
    const appt = db.appointments.find((a) => a.id === appointmentId);
    const patient = appt && db.patients.find((p) => p.id === appt.patientId);
    const owner = patient && db.owners.find((o) => o.rut === patient.ownerRut);
    if (!appt || !patient || !owner) return notFound("Cita", appointmentId);
    const access = {
      id: mockId("ac"),
      time: NOW_TIME,
      direction: "Ingreso" as const,
      kind: "Cliente" as const,
      who: ownerName(owner),
      detail: `${patient.name} · ${appt.reason.toLowerCase()}`,
      ownerRut: owner.rut,
      patientId: patient.id,
      appointmentId,
    };
    const waiting = { id: mockId("w"), appointmentId, arrivedAt: NOW_TIME, people: 1 };
    db.access.push(access);
    db.waiting.push(waiting);
    return ok({ access, waiting });
  },
  callFromWaiting: (entryId, roomId) => {
    const entry = db.waiting.find((w) => w.id === entryId);
    const appt = entry && db.appointments.find((a) => a.id === entry.appointmentId);
    if (!entry || !appt) return notFound("Entrada de sala de espera", entryId);
    const room = patchById(db.rooms, roomId, (r) => ({
      ...r,
      status: "ocupado" as const,
      doctorId: appt.doctorId,
      patientId: appt.patientId,
      since: NOW_TIME,
    }));
    if (!room) return notFound("Box", roomId);
    db.waiting = db.waiting.filter((w) => w.id !== entryId);
    return ok({ room });
  },
  getSettings: () => ok(db.securitySettings),
  updateSettings: (patch) => {
    db.securitySettings = { ...db.securitySettings, ...patch };
    return ok(db.securitySettings);
  },
  setAlarm: (armed) => {
    db.securitySettings = { ...db.securitySettings, alarmArmed: armed };
    return ok(db.securitySettings);
  },
};
