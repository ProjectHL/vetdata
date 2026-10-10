"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Appointment } from "@/domain/appointments";
import type { Room } from "@/domain/clinic";
import type { Invoice } from "@/domain/invoices";
import type { Medication } from "@/domain/medications";
import { COST_RATIO, type MovementReason, type PurchaseOrder, type StockMovement } from "@/domain/pharmacy";
import { INTERNAL_PHARMACY, type Referral } from "@/domain/referrals";
import type { ClinicProfile, Permission, Role, SharingPolicy, User } from "@/domain/settings";
import {
  type AccessDuration,
  type AccessGrant,
  type AccessRequest,
  type AccessScope,
  accessLevel,
} from "@/domain/sharing";
import type { TaskMeta } from "@/domain/tasks";
import { seedAppointments } from "@/mocks/appointments";
import { doctors as mockDoctors, rooms as mockRooms } from "@/mocks/clinic";
import { medications as mockMedications } from "@/mocks/medications";
import { currentClinic as mockCurrentClinic } from "@/mocks/network";
import { seedInvoices } from "@/mocks/invoices";
import { patients as mockPatients } from "@/mocks/patients";
import { seedMovements, seedPurchaseOrders } from "@/mocks/pharmacy";
import { seedReferrals } from "@/mocks/referrals";
import {
  defaultRolePermissions,
  demoUserByRole,
  seedClinicProfile,
  seedSharingPolicy,
  seedUsers,
} from "@/mocks/settings";
import { seedGrants, seedRequests } from "@/mocks/sharing";
import { ensureServerCatalogs, publish, read, readScalar } from "@/lib/server-state";
import { dataSource, runInBackground, services } from "@/services";
import { TODAY, addDays } from "@/lib/format";

/**
 * Estado de sesión del prototipo: lo que se crea desde la UI
 * (citas, facturas, derivaciones, solicitudes y accesos) vive aquí hasta recargar.
 *
 * Cada mutación aplica primero la actualización optimista local (la UI no espera)
 * y luego llama a `services.<dominio>.<operación>()` en segundo plano.
 */
type Store = {
  appointments: Appointment[];
  invoices: Invoice[];
  referrals: Referral[];
  requests: AccessRequest[];
  grants: AccessGrant[];
  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, patch: Partial<Omit<Appointment, "id">>) => void;
  addInvoice: (i: Omit<Invoice, "id" | "folio">) => Invoice;
  addReferral: (r: Omit<Referral, "id">) => Referral;
  /** La clínica actual pide acceso a mascotas de otras clínicas (una solicitud por mascota). */
  sendRequest: (patientIds: string[], scope: AccessScope, duration: AccessDuration, reason: string) => number;
  /** La clínica de origen responde; si aprueba se crea el acceso. */
  respondRequest: (id: string, approve: boolean, terms?: { scope: AccessScope; duration: AccessDuration }) => void;
  revokeGrant: (id: string) => void;

  // Mapa de la clínica (compartido por Actividad y Seguridad)
  rooms: Room[];
  /** `sync: false` solo actualiza el mapa local (cuando otra operación de servicio ya ocupa el box). */
  updateRoom: (id: string, patch: Partial<Room>, options?: { sync?: boolean }) => void;

  // Farmacia
  medications: Medication[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  /** Entrega una derivación a farmacia interna: salida de stock por cada ítem. */
  dispenseReferral: (id: string) => void;
  adjustStock: (medicationId: string, qty: number, reason: MovementReason) => void;
  /** Crea una orden de compra en borrador con costo estimado. */
  createPurchaseOrder: (supplierId: string, items: { medicationId: string; qty: number }[]) => PurchaseOrder;
  sendPurchaseOrder: (id: string) => void;
  /** Recibe la orden: entrada de stock por cada ítem. */
  receivePurchaseOrder: (id: string) => void;

  // Análisis
  reminders: string[];

  // Pendientes: asignación y estado manual de tareas derivadas
  taskMeta: Record<string, TaskMeta>;
  assignTask: (taskId: string, assignee: string | undefined) => void;
  completeTask: (taskId: string, done: boolean) => void;
  sendReminder: (patientId: string) => void;

  // Ajustes
  role: Role;
  setRole: (role: Role) => void;
  currentUser: User;
  users: User[];
  inviteUser: (u: Pick<User, "name" | "email" | "role" | "specialty">) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  rolePermissions: Record<Role, Permission[]>;
  togglePermission: (role: Role, permission: Permission) => void;
  clinicProfile: ClinicProfile;
  setClinicProfile: (p: ClinicProfile) => void;
  sharingPolicy: SharingPolicy;
  setSharingPolicy: (p: SharingPolicy) => void;

  // Hidratación desde el servidor (T5-2): en modo mock siempre loading=false y error=null.
  loading: boolean;
  error: string | null;
  /** Reintenta la carga inicial desde el servidor (solo modo http). */
  retry: () => void;
};

export type { TaskMeta };

const StoreContext = createContext<Store | null>(null);

let seq = 0;
const newId = (prefix: string) => `${prefix}-new-${++seq}`;

/** TODO(api): services.patients.get(id) */
function getPatient(id: string) {
  return read("patients", mockPatients).find((p) => p.id === id);
}

/** Clínica de la sesión. TODO(api): services.network.getCurrentClinic() */
function getCurrentClinic() {
  return readScalar("currentClinic", mockCurrentClinic);
}


export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState(seedAppointments); // http: se hidrata con services.appointments.list()
  const [invoices, setInvoices] = useState(seedInvoices); // http: se hidrata con services.invoices.list()
  const [referrals, setReferrals] = useState(seedReferrals); // http: se hidrata con services.referrals.list()
  const [requests, setRequests] = useState(seedRequests); // http: se hidrata con services.sharing.listRequests()
  const [grants, setGrants] = useState(seedGrants); // http: se hidrata con services.sharing.listGrants()
  const [rooms, setRooms] = useState(read("rooms", mockRooms)); // http: se hidrata con services.clinic.listRooms()
  const [medications, setMedications] = useState(read("medications", mockMedications)); // http: se hidrata con services.pharmacy.listMedications()
  const [movements, setMovements] = useState(seedMovements); // http: se hidrata con services.pharmacy.listMovements()
  const [purchaseOrders, setPurchaseOrders] = useState(seedPurchaseOrders); // http: se hidrata con services.pharmacy.listPurchaseOrders()
  // Sin endpoint en el backend (NotImplemented: GET /api/v1/reminders): se conserva el estado local.
  const [reminders, setReminders] = useState<string[]>([]);
  const [taskMeta, setTaskMeta] = useState<Record<string, TaskMeta>>({}); // http: se hidrata con services.tasks.listMeta()
  const [role, setRole] = useState<Role>("Veterinario"); // Demo: "Ver como". TODO(api): el rol sale de services.settings.getCurrentUser()
  const [users, setUsers] = useState(seedUsers); // http: se hidrata con services.settings.listUsers()
  const [rolePermissions, setRolePermissions] = useState(defaultRolePermissions); // http: se hidrata con services.settings.getRolePermissions()
  const [clinicProfile, setClinicProfile] = useState(seedClinicProfile); // http: se hidrata con services.settings.getClinicProfile()
  // Sin endpoint en el backend (NotImplemented: GET/PUT /api/v1/settings/sharing-policy): se conserva la semilla mock.
  const [sharingPolicy, setSharingPolicy] = useState(seedSharingPolicy);

  // Hidratación inicial solo en modo http; en mock la semilla es el estado final.
  const [loading, setLoading] = useState(dataSource === "http");
  const [error, setError] = useState<string | null>(null);

  /** Carga inicial desde el servidor. Si falla, se conserva la semilla y se expone el error. */
  const load = useCallback(async () => {
    if (dataSource !== "http") return;
    try {
      const core = Promise.all([
        services.appointments.list(),
        services.invoices.list(),
        services.referrals.list(),
        services.sharing.listRequests(),
        services.sharing.listGrants(),
        services.clinic.listRooms(),
        services.pharmacy.listMedications(),
        services.pharmacy.listMovements(),
        services.pharmacy.listPurchaseOrders(),
        services.tasks.listMeta(),
        services.settings.listUsers(),
        services.settings.getRolePermissions(),
        services.settings.getClinicProfile(),
      ]);
      // Catálogos sin store dueño + series de analytics: publican en el
      // registro de lib sin romper esta carga (nunca lanza; ver server-state).
      const catalogs = ensureServerCatalogs();
      const [
        appointmentsData,
        invoicesData,
        referralsData,
        requestsData,
        grantsData,
        roomsData,
        medicationsData,
        movementsData,
        purchaseOrdersData,
        taskMetaData,
        usersData,
        rolePermissionsData,
        clinicProfileData,
      ] = await core;
      await catalogs;
      // Publica antes de los setState para que el re-render ya lea el registro fresco.
      publish("rooms", roomsData);
      publish("medications", medicationsData);
      setAppointments(appointmentsData);
      setInvoices(invoicesData);
      setReferrals(referralsData);
      setRequests(requestsData);
      setGrants(grantsData);
      setRooms(roomsData);
      setMedications(medicationsData);
      setMovements(movementsData);
      setPurchaseOrders(purchaseOrdersData);
      setTaskMeta(taskMetaData);
      if (usersData.length > 0) setUsers(usersData);
      setRolePermissions(rolePermissionsData);
      setClinicProfile(clinicProfileData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información de la clínica");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hidratación inicial al montar: el fetch resuelve en continuaciones async, no es un render en cascada.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount intencional del store en modo http
    if (dataSource === "http") void load();
  }, [load]);

  // T5-3a: publica las listas hidratadas al registro de lib cuando cambian
  // (mutaciones post-carga como updateRoom o dispenseReferral). Solo http;
  // en mock `publish` no hace nada. No hacen setState: no hay cascada.
  useEffect(() => {
    publish("rooms", rooms);
  }, [rooms]);
  useEffect(() => {
    publish("medications", medications);
  }, [medications]);

  const retry = () => {
    setLoading(true);
    setError(null);
    void load();
  };

  const currentUser = users.find((u) => u.id === demoUserByRole[role])!;

  /** Registra movimientos y aplica el delta al stock. */
  const recordMovements = (list: Omit<StockMovement, "id" | "date" | "user">[]) => {
    if (list.length === 0) return;
    const created = list.map((m) => ({ ...m, id: newId("mv"), date: TODAY, user: currentUser.name }));
    setMovements((prev) => [...prev, ...created]);
    setMedications((prev) =>
      prev.map((med) => {
        const delta = created.filter((m) => m.medicationId === med.id).reduce((sum, m) => sum + m.qty, 0);
        return delta ? { ...med, stock: Math.max(0, med.stock + delta) } : med;
      })
    );
  };

  const store: Store = {
    appointments,
    invoices,
    referrals,
    requests,
    grants,
    updateAppointment: (id, patch) => {
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      runInBackground(services.appointments.update(id, patch));
    },
    addAppointment: (a) => {
      const created = { ...a, id: newId("a") };
      setAppointments((prev) => [...prev, created]);
      runInBackground(services.appointments.create(a));
      return created;
    },
    addInvoice: (i) => {
      const folio = Math.max(0, ...invoices.map((x) => x.folio)) + 1;
      const created = { ...i, id: newId("f"), folio };
      setInvoices((prev) => [...prev, created]);
      // Los medicamentos vendidos salen del inventario.
      recordMovements(
        i.items
          .filter((item) => item.medicationId)
          .map((item) => ({
            medicationId: item.medicationId!,
            type: "Salida" as const,
            reason: "Venta" as const,
            qty: -item.qty,
            ref: `Factura ${folio}`,
          }))
      );
      runInBackground(services.invoices.create(i));
      return created;
    },
    addReferral: (r) => {
      const created = { ...r, id: newId("r") };
      setReferrals((prev) => [...prev, created]);
      runInBackground(services.referrals.create(r));
      return created;
    },
    sendRequest: (patientIds, scope, duration, reason) => {
      const created: AccessRequest[] = patientIds
        .map((id) => getPatient(id))
        .filter((p) => p !== undefined)
        .filter(
          (p) =>
            p.clinic !== getCurrentClinic() &&
            !requests.some((r) => r.patientId === p.id && r.from === getCurrentClinic() && r.status === "Pendiente")
        )
        .map((p) => ({
          id: newId("q"),
          patientId: p.id,
          ownerRut: p.ownerRut,
          from: getCurrentClinic(),
          to: p.clinic,
          requestedBy: currentUser.name,
          date: TODAY,
          reason,
          scope,
          duration,
          status: "Pendiente",
        }));
      setRequests((prev) => [...prev, ...created]);
      if (created.length > 0) {
        runInBackground(
          services.sharing.sendRequests({ patientIds: created.map((r) => r.patientId), scope, duration, reason })
        );
      }
      return created.length;
    },
    respondRequest: (id, approve, terms) => {
      const req = requests.find((r) => r.id === id);
      if (!req || req.status !== "Pendiente") return;
      runInBackground(services.sharing.respond(id, { approve, terms }));
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: approve ? "Aprobada" : "Rechazada", respondedAt: TODAY } : r))
      );
      if (!approve) return;
      const scope = terms?.scope ?? req.scope;
      const duration = terms ? terms.duration : req.duration;
      setGrants((prev) => [
        ...prev,
        {
          id: newId("g"),
          patientId: req.patientId,
          ownerClinic: req.to,
          grantedTo: req.from,
          scope,
          since: TODAY,
          until: duration ? addDays(TODAY, duration) : null,
          revoked: false,
        },
      ]);
    },
    revokeGrant: (id) => {
      setGrants((prev) => prev.map((g) => (g.id === id ? { ...g, revoked: true } : g)));
      runInBackground(services.sharing.revoke(id));
    },

    rooms,
    updateRoom: (id, patch, options) => {
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      if (options?.sync !== false) runInBackground(services.clinic.updateRoom(id, patch));
    },

    medications,
    movements,
    purchaseOrders,
    dispenseReferral: (id) => {
      const ref = referrals.find((r) => r.id === id);
      if (!ref || ref.destination !== INTERNAL_PHARMACY || ref.status === "Dispensada") return;
      const patient = getPatient(ref.patientId);
      recordMovements(
        ref.items.map((item) => ({
          medicationId: item.medicationId,
          type: "Salida" as const,
          reason: "Dispensación" as const,
          qty: -item.qty,
          ref: `Derivación ${patient?.name ?? ""}`.trim(),
        }))
      );
      setReferrals((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Dispensada" } : r)));
      runInBackground(services.referrals.dispense(id));
    },
    adjustStock: (medicationId, qty, reason) => {
      recordMovements([{ medicationId, type: "Ajuste", reason, qty }]);
      runInBackground(services.pharmacy.adjustStock({ medicationId, qty, reason }));
    },
    createPurchaseOrder: (supplierId, items) => {
      const created: PurchaseOrder = {
        id: newId("oc"),
        number: Math.max(0, ...purchaseOrders.map((o) => o.number)) + 1,
        supplierId,
        date: TODAY,
        items: items.map((i) => ({
          ...i,
          unitCost: Math.round((medications.find((m) => m.id === i.medicationId)?.price ?? 0) * COST_RATIO),
        })),
        status: "Borrador",
      };
      setPurchaseOrders((prev) => [...prev, created]);
      runInBackground(services.pharmacy.createPurchaseOrder({ supplierId, items }));
      return created;
    },
    sendPurchaseOrder: (id) => {
      setPurchaseOrders((prev) => prev.map((o) => (o.id === id && o.status === "Borrador" ? { ...o, status: "Enviada" } : o)));
      runInBackground(services.pharmacy.sendPurchaseOrder(id));
    },
    receivePurchaseOrder: (id) => {
      const order = purchaseOrders.find((o) => o.id === id);
      if (!order || order.status !== "Enviada") return;
      recordMovements(
        order.items.map((i) => ({
          medicationId: i.medicationId,
          type: "Entrada" as const,
          reason: "Compra" as const,
          qty: i.qty,
          ref: `OC ${order.number}`,
        }))
      );
      setPurchaseOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Recibida", receivedAt: TODAY } : o)));
      runInBackground(services.pharmacy.receivePurchaseOrder(id));
    },

    reminders,
    taskMeta,
    assignTask: (taskId, assignee) => {
      setTaskMeta((prev) => ({ ...prev, [taskId]: { ...prev[taskId], assignee } }));
      runInBackground(services.tasks.assign(taskId, assignee));
    },
    completeTask: (taskId, done) => {
      setTaskMeta((prev) => ({ ...prev, [taskId]: { ...prev[taskId], done } }));
      runInBackground(services.tasks.complete(taskId, done));
    },
    sendReminder: (patientId) => {
      setReminders((prev) => (prev.includes(patientId) ? prev : [...prev, patientId]));
      runInBackground(services.tasks.sendReminder(patientId));
    },

    role,
    setRole,
    currentUser,
    users,
    inviteUser: (u) => {
      setUsers((prev) => [...prev, { ...u, id: newId("u"), status: "Invitado", lastAccess: "—" }]);
      runInBackground(services.settings.inviteUser(u));
    },
    updateUser: (id, patch) => {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
      runInBackground(services.settings.updateUser(id, patch));
    },
    rolePermissions,
    togglePermission: (r, permission) => {
      setRolePermissions((prev) => ({
        ...prev,
        [r]: prev[r].includes(permission) ? prev[r].filter((p) => p !== permission) : [...prev[r], permission],
      }));
      runInBackground(services.settings.togglePermission(r, permission));
    },
    clinicProfile,
    setClinicProfile: (p) => {
      setClinicProfile(p);
      runInBackground(services.settings.updateClinicProfile(p));
    },
    sharingPolicy,
    setSharingPolicy: (p) => {
      setSharingPolicy(p);
      runInBackground(services.settings.updateSharingPolicy(p));
    },
    loading,
    error,
    retry,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return store;
}

/** Nivel de acceso de la clínica actual a una mascota. */
export function useAccess(patientId: string) {
  const { grants } = useStore();
  const patient = getPatient(patientId);
  if (!patient) return { level: "ninguno" as const };
  return accessLevel(patient, grants, getCurrentClinic());
}

/** Función para filtrar listas por acceso (propio o compartido vigente). */
export function useCanView() {
  const { grants } = useStore();
  return (patientId: string) => {
    const patient = getPatient(patientId);
    return !!patient && accessLevel(patient, grants, getCurrentClinic()).level !== "ninguno";
  };
}

export function usePendingRequest(patientId: string) {
  const { requests } = useStore();
  return requests.find((r) => r.patientId === patientId && r.from === getCurrentClinic() && r.status === "Pendiente");
}

/** ¿El rol activo tiene este permiso? */
export function useCan() {
  const { role, rolePermissions } = useStore();
  return (permission: Permission) => rolePermissions[role].includes(permission);
}

/** Profesionales disponibles para agenda y mapa: usuarios activos con rol Veterinario. */
export function useDoctors() {
  const { users } = useStore();
  const activeIds = new Set(
    users.filter((u) => u.role === "Veterinario" && u.status === "Activo" && u.doctorId).map((u) => u.doctorId)
  );
  return read("doctors", mockDoctors).filter((d) => activeIds.has(d.id));
}
