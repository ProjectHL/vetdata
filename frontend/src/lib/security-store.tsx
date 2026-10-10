"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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
import {
  getOwner,
  getPatient,
  seedAccess,
  seedAudit,
  seedCameras,
  seedDevices,
  seedEvents,
  seedSecuritySettings,
  seedWaiting,
} from "@/lib/lookups";
import { dataSource, runInBackground, services } from "@/services";
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
  // Hidratación desde el servidor (T5-2): en modo mock siempre loading=false y error=null.
  loading: boolean;
  error: string | null;
  /** Reintenta la carga inicial desde el servidor (solo modo http). */
  retry: () => void;
};

const SecurityContext = createContext<SecurityStore | null>(null);

let seq = 0;
const newId = (prefix: string) => `${prefix}-new-${++seq}`;

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, role, appointments, updateRoom } = useStore();
  // Sin endpoints en el backend (NotImplemented: cámaras, dispositivos, NVR, auditoría): se conserva la semilla mock.
  const [cameras, setCameras] = useState(seedCameras);
  const [devices, setDevices] = useState(seedDevices);
  const [events, setEvents] = useState(seedEvents); // http: se hidrata con services.security.listEvents()
  const [access, setAccess] = useState(seedAccess); // http: se hidrata con services.security.listAccess()
  const [waiting, setWaiting] = useState(seedWaiting); // http: se hidrata con services.security.listWaiting()
  const [audit, setAudit] = useState(seedAudit);
  const [settings, setSettings] = useState(seedSecuritySettings); // http: se hidrata con services.security.getSettings()

  // Hidratación inicial solo en modo http; en mock la semilla es el estado final.
  const [loading, setLoading] = useState(dataSource === "http");
  const [error, setError] = useState<string | null>(null);

  /** Carga inicial desde el servidor. Si falla, se conserva la semilla y se expone el error. */
  const load = useCallback(async () => {
    if (dataSource !== "http") return;
    try {
      const [eventsData, accessData, waitingData, settingsData] = await Promise.all([
        services.security.listEvents(),
        services.security.listAccess(),
        services.security.listWaiting(),
        services.security.getSettings(),
      ]);
      setEvents(eventsData);
      setAccess(accessData);
      setWaiting(waitingData);
      setSettings(settingsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información de seguridad");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hidratación inicial al montar: el fetch resuelve en continuaciones async, no es un render en cascada.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount intencional del store en modo http
    if (dataSource === "http") void load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    setError(null);
    void load();
  };

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
    loading,
    error,
    retry,
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

