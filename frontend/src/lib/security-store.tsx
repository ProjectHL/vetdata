"use client";

import { createContext, useContext, useState } from "react";
import { ownerName } from "@/domain/owners";
import type {
  AccessEntry,
  AuditAction,
  AuditEntry,
  Camera,
  CameraStatus,
  Device,
  EventType,
  SecurityEvent,
  SecuritySettings,
  Severity,
  WaitingEntry,
  Zone,
} from "@/domain/security";
import { getOwner, getPatient } from "@/lib/lookups";
import {
  seedAccess,
  seedAudit,
  seedCameras,
  seedDevices,
  seedEvents,
  seedSecuritySettings,
  seedWaiting,
} from "@/mocks/security";
import { runInBackground, services } from "@/services";
import { NOW_ISO, NOW_TIME } from "@/lib/format";
import { useStore } from "@/lib/store";

type SecurityStore = {
  cameras: Camera[];
  devices: Device[];
  events: SecurityEvent[];
  access: AccessEntry[];
  waiting: WaitingEntry[];
  audit: AuditEntry[];
  settings: SecuritySettings;
  updateEvent: (id: string, patch: Partial<Pick<SecurityEvent, "status" | "assignee">>) => void;
  addEventNote: (id: string, text: string) => void;
  createEvent: (input: { zone: Zone; cameraId?: string; type: EventType; severity: Severity; note?: string }) => SecurityEvent;
  logAudit: (cameraId: string, action: AuditAction, reason?: string) => void;
  toggleLock: (deviceId: string) => void;
  setAlarm: (armed: boolean) => void;
  /** Registra la llegada de una cita de hoy: entra al hall y pasa a la sala de espera. */
  checkIn: (appointmentId: string) => void;
  /** Llama al paciente desde la sala de espera a un box: el box queda ocupado en Actividad. */
  callFromWaiting: (entryId: string, roomId: string) => void;
  updateSettings: (patch: Partial<SecuritySettings>) => void;
  setCameraStatus: (id: string, status: CameraStatus) => void;
};

const SecurityContext = createContext<SecurityStore | null>(null);

let seq = 0;
const newId = (prefix: string) => `${prefix}-new-${++seq}`;

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, role, appointments, updateRoom } = useStore();
  const [cameras, setCameras] = useState(seedCameras); // TODO(api): reemplazar por services.security.listCameras()
  const [devices, setDevices] = useState(seedDevices); // TODO(api): reemplazar por services.security.listDevices()
  const [events, setEvents] = useState(seedEvents); // TODO(api): reemplazar por services.security.listEvents()
  const [access, setAccess] = useState(seedAccess); // TODO(api): reemplazar por services.security.listAccess()
  const [waiting, setWaiting] = useState(seedWaiting); // TODO(api): reemplazar por services.security.listWaiting()
  const [audit, setAudit] = useState(seedAudit); // TODO(api): reemplazar por services.security.listAudit()
  const [settings, setSettings] = useState(seedSecuritySettings); // TODO(api): reemplazar por services.security.getSettings()

  const store: SecurityStore = {
    cameras,
    devices,
    events,
    access,
    waiting,
    audit,
    settings,
    updateEvent: (id, patch) => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, ...patch, resolvedAt: patch.status === "Resuelto" || patch.status === "Falsa alarma" ? NOW_ISO : e.resolvedAt }
            : e
        )
      );
      runInBackground(services.security.updateEvent(id, patch));
    },
    addEventNote: (id, text) => {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, notes: [...e.notes, { by: currentUser.name, at: NOW_ISO, text }] } : e)));
      runInBackground(services.security.addEventNote(id, text));
    },
    createEvent: ({ zone, cameraId, type, severity, note }) => {
      const event: SecurityEvent = {
        id: newId("ev"),
        at: NOW_ISO,
        zone,
        cameraId,
        type,
        severity,
        status: "Nuevo",
        notes: note ? [{ by: currentUser.name, at: NOW_ISO, text: note }] : [],
      };
      setEvents((prev) => [event, ...prev]);
      runInBackground(services.security.createEvent({ zone, cameraId, type, severity, note }));
      return event;
    },
    logAudit: (cameraId, action, reason) => {
      setAudit((prev) => [{ id: newId("au"), at: NOW_ISO, user: currentUser.name, role, action, cameraId, reason }, ...prev]);
      runInBackground(services.security.logAudit({ cameraId, action, reason }));
    },
    toggleLock: (deviceId) => {
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, locked: !d.locked } : d)));
      runInBackground(services.security.toggleLock(deviceId));
    },
    setAlarm: (armed) => {
      setSettings((prev) => ({ ...prev, alarmArmed: armed }));
      runInBackground(services.security.setAlarm(armed));
    },
    checkIn: (appointmentId) => {
      const appt = appointments.find((a) => a.id === appointmentId);
      const patient = appt && getPatient(appt.patientId);
      const owner = patient && getOwner(patient.ownerRut);
      if (!appt || !patient || !owner || waiting.some((w) => w.appointmentId === appointmentId)) return;
      setAccess((prev) => [
        ...prev,
        {
          id: newId("ac"),
          time: NOW_TIME,
          direction: "Ingreso",
          kind: "Cliente",
          who: ownerName(owner),
          detail: `${patient.name} · ${appt.reason.toLowerCase()}`,
          ownerRut: owner.rut,
          patientId: patient.id,
          appointmentId,
        },
      ]);
      setWaiting((prev) => [...prev, { id: newId("w"), appointmentId, arrivedAt: NOW_TIME, people: 1 }]);
      runInBackground(services.security.checkIn(appointmentId));
    },
    callFromWaiting: (entryId, roomId) => {
      const entry = waiting.find((w) => w.id === entryId);
      const appt = entry && appointments.find((a) => a.id === entry.appointmentId);
      if (!entry || !appt) return;
      // Solo estado local del mapa: el backend ocupa el box dentro de callFromWaiting.
      updateRoom(roomId, { status: "ocupado", doctorId: appt.doctorId, patientId: appt.patientId, since: NOW_TIME }, { sync: false });
      setWaiting((prev) => prev.filter((w) => w.id !== entryId));
      runInBackground(services.security.callFromWaiting(entryId, roomId));
    },
    updateSettings: (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      runInBackground(services.security.updateSettings(patch));
    },
    setCameraStatus: (id, status) => {
      setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      runInBackground(services.security.setCameraStatus(id, status));
    },
  };

  return <SecurityContext.Provider value={store}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const store = useContext(SecurityContext);
  if (!store) throw new Error("useSecurity debe usarse dentro de <SecurityProvider>");
  return store;
}

/** Cámara de un box ocupado + privacidad activada = sin vista en vivo. */
export function usePrivacy(camera: Camera) {
  const { rooms } = useStore();
  const { settings } = useSecurity();
  const room = camera.roomId ? rooms.find((r) => r.id === camera.roomId) : undefined;
  return { private: !!(settings.privacyInBoxes && room?.status === "ocupado"), room };
}

