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
  seedAccess,
  seedAudit,
  seedCameras,
  seedDevices,
  seedEvents,
  seedSecuritySettings,
  seedWaiting,
} from "@/mocks/security";
import { owners as mockOwners } from "@/mocks/owners";
import { patients as mockPatients } from "@/mocks/patients";
import { read } from "@/lib/server-state";
import { dataSource, newIdempotencyKey, runInBackground, services } from "@/services";
import { NOW_ISO, NOW_TIME, realNowIso, realNowTime } from "@/lib/format";
import { useStore } from "@/lib/store";

/**
 * Sellos de fecha/hora para escrituras (T5-5): en modo http el momento real del
 * navegador (las mutaciones siempre corren post-mount: no hay riesgo de
 * hidratación); en modo mock el fijo de la demo reproducible.
 */
function stampNowIso() {
  return dataSource === "http" ? realNowIso() : NOW_ISO;
}

function stampNowTime() {
  return dataSource === "http" ? realNowTime() : NOW_TIME;
}

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

/** TODO(api): services.patients.get(id) */
function getPatient(id: string) {
  return read("patients", mockPatients).find((p) => p.id === id);
}

/** TODO(api): services.owners.get(rut) */
function getOwner(rut: string) {
  return read("owners", mockOwners).find((o) => o.rut === rut);
}

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, role, appointments, rooms, updateRoom } = useStore();
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
      const prev = events.find((e) => e.id === id);
      setEvents((prevList) =>
        prevList.map((e) =>
          e.id === id
            ? { ...e, ...patch, resolvedAt: patch.status === "Resuelto" || patch.status === "Falsa alarma" ? stampNowIso() : e.resolvedAt }
            : e
        )
      );
      if (dataSource !== "http" || !prev) {
        runInBackground(services.security.updateEvent(id, patch));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.security.updateEvent(id, patch).then(
          (saved) => setEvents((prevList) => prevList.map((e) => (e.id === saved.id ? saved : e))),
          () => {
            setEvents((prevList) => prevList.map((e) => (e.id === id ? prev : e)));
            setError("No se pudo actualizar el evento. Se restauró el estado anterior.");
          }
        )
      );
    },
    addEventNote: (id, text) => {
      const prev = events.find((e) => e.id === id);
      setEvents((prevList) => prevList.map((e) => (e.id === id ? { ...e, notes: [...e.notes, { by: currentUser.name, at: stampNowIso(), text }] } : e)));
      if (dataSource !== "http" || !prev) {
        runInBackground(services.security.addEventNote(id, text));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.security.addEventNote(id, text).then(
          (saved) => setEvents((prevList) => prevList.map((e) => (e.id === saved.id ? saved : e))),
          () => {
            setEvents((prevList) => prevList.map((e) => (e.id === id ? prev : e)));
            setError("No se pudo agregar la nota. Se restauró el estado anterior.");
          }
        )
      );
    },
    createEvent: ({ zone, cameraId, type, severity, note }) => {
      const event: SecurityEvent = {
        id: newId("ev"),
        at: stampNowIso(),
        zone,
        cameraId,
        type,
        severity,
        status: "Nuevo",
        notes: note ? [{ by: currentUser.name, at: stampNowIso(), text: note }] : [],
      };
      setEvents((prev) => [event, ...prev]);
      if (dataSource !== "http") {
        runInBackground(services.security.createEvent({ zone, cameraId, type, severity, note }));
        return event;
      }
      newIdempotencyKey();
      runInBackground(
        services.security.createEvent({ zone, cameraId, type, severity, note }).then(
          (saved) => setEvents((prev) => prev.map((e) => (e.id === event.id ? saved : e))),
          () => {
            setEvents((prev) => prev.filter((e) => e.id !== event.id));
            setError("No se pudo crear el evento. Se descartó el cambio local.");
          }
        )
      );
      return event;
    },
    logAudit: (cameraId, action, reason) => {
      setAudit((prev) => [{ id: newId("au"), at: stampNowIso(), user: currentUser.name, role, action, cameraId, reason }, ...prev]);
      // T5-4: POST /api/v1/security/audit aún NotImplemented (la auditoría la genera el
      // servidor al ejecutar cada acción); se conserva el optimista sin key ni reconcile.
      runInBackground(services.security.logAudit({ cameraId, action, reason }));
    },
    toggleLock: (deviceId) => {
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, locked: !d.locked } : d)));
      // T5-4: POST /api/v1/security/devices/:id/toggle-lock aún NotImplemented (sin endpoint
      // en el backend); se conserva el optimista sin key ni reconcile.
      runInBackground(services.security.toggleLock(deviceId));
    },
    setAlarm: (armed) => {
      setSettings((prev) => ({ ...prev, alarmArmed: armed }));
      // T5-4: PUT /api/v1/security/alarm aún NotImplemented (sin endpoint en el backend);
      // se conserva el optimista sin key ni reconcile.
      runInBackground(services.security.setAlarm(armed));
    },
    checkIn: (appointmentId) => {
      const appt = appointments.find((a) => a.id === appointmentId);
      const patient = appt && getPatient(appt.patientId);
      const owner = patient && getOwner(patient.ownerRut);
      if (!appt || !patient || !owner || waiting.some((w) => w.appointmentId === appointmentId)) return;
      const accessEntry: AccessEntry = {
        id: newId("ac"),
        time: stampNowTime(),
        direction: "Ingreso",
        kind: "Cliente",
        who: ownerName(owner),
        detail: `${patient.name} · ${appt.reason.toLowerCase()}`,
        ownerRut: owner.rut,
        patientId: patient.id,
        appointmentId,
      };
      const waitingEntry: WaitingEntry = { id: newId("w"), appointmentId, arrivedAt: stampNowTime(), people: 1 };
      setAccess((prev) => [...prev, accessEntry]);
      setWaiting((prev) => [...prev, waitingEntry]);
      if (dataSource !== "http") {
        runInBackground(services.security.checkIn(appointmentId));
        return;
      }
      // T5-4: UNA key por check-in; se reconcilian acceso y espera canónicos.
      newIdempotencyKey();
      runInBackground(
        services.security.checkIn(appointmentId).then(
          ({ access, waiting }) => {
            setAccess((prev) => prev.map((a) => (a.id === accessEntry.id ? access : a)));
            setWaiting((prev) => prev.map((w) => (w.id === waitingEntry.id ? waiting : w)));
          },
          () => {
            setAccess((prev) => prev.filter((a) => a.id !== accessEntry.id));
            setWaiting((prev) => prev.filter((w) => w.id !== waitingEntry.id));
            setError("No se pudo registrar el ingreso. Se descartó el cambio local.");
          }
        )
      );
    },
    callFromWaiting: (entryId, roomId) => {
      const entry = waiting.find((w) => w.id === entryId);
      const appt = entry && appointments.find((a) => a.id === entry.appointmentId);
      if (!entry || !appt) return;
      const prevRoom = rooms.find((r) => r.id === roomId);
      // Solo estado local del mapa: el backend ocupa el box dentro de callFromWaiting.
      updateRoom(roomId, { status: "ocupado", doctorId: appt.doctorId, patientId: appt.patientId, since: stampNowTime() }, { sync: false });
      setWaiting((prev) => prev.filter((w) => w.id !== entryId));
      if (dataSource !== "http" || !prevRoom) {
        runInBackground(services.security.callFromWaiting(entryId, roomId));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.security.callFromWaiting(entryId, roomId).then(
          ({ room }) => updateRoom(room.id, room, { sync: false }),
          () => {
            updateRoom(roomId, prevRoom, { sync: false });
            setWaiting((prev) => [...prev, entry]);
            setError("No se pudo llamar al paciente. Se restauró el estado anterior.");
          }
        )
      );
    },
    updateSettings: (patch) => {
      const prev = settings;
      setSettings((prevSettings) => ({ ...prevSettings, ...patch }));
      if (dataSource !== "http") {
        runInBackground(services.security.updateSettings(patch));
        return;
      }
      newIdempotencyKey();
      runInBackground(
        services.security.updateSettings(patch).then(
          (saved) => setSettings(saved),
          () => {
            setSettings(prev);
            setError("No se pudo guardar la configuración. Se restauró el estado anterior.");
          }
        )
      );
    },
    setCameraStatus: (id, status) => {
      setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      // T5-4: PATCH /api/v1/security/cameras/:id aún NotImplemented (sin endpoint en el
      // backend); se conserva el optimista sin key ni reconcile.
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

