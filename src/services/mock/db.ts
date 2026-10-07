/**
 * "Base de datos" en memoria del mock: copias de las semillas de `src/mocks`.
 * Las mutaciones del mock escriben aquí; vive mientras dure la pestaña.
 *
 * Nota: los stores de sesión siguen siendo la fuente del estado que ve la UI.
 * Este estado solo existe para que el mock responda como lo haría el backend.
 */
import { seedAppointments } from "@/mocks/appointments";
import { doctors, rooms } from "@/mocks/clinic";
import { seedInvoices } from "@/mocks/invoices";
import { medications } from "@/mocks/medications";
import { networkClinics } from "@/mocks/network";
import { owners } from "@/mocks/owners";
import { patients } from "@/mocks/patients";
import { seedMovements, seedPurchaseOrders, suppliers } from "@/mocks/pharmacy";
import { seedReferrals } from "@/mocks/referrals";
import {
  buildSeedShipments,
  retailSuppliers,
  seedProducts,
  seedRetailMovements,
  seedRetailOrders,
  seedSales,
} from "@/mocks/retail";
import {
  NVR,
  seedAccess,
  seedAudit,
  seedCameras,
  seedDevices,
  seedEvents,
  seedSecuritySettings,
  seedWaiting,
} from "@/mocks/security";
import { services } from "@/mocks/services";
import {
  defaultRolePermissions,
  demoUserByRole,
  seedClinicProfile,
  seedSharingPolicy,
  seedUsers,
} from "@/mocks/settings";
import { seedGrants, seedRequests } from "@/mocks/sharing";
import { releases, seedIdeas, seedTickets } from "@/mocks/support";
import type { TaskMeta } from "@/domain/tasks";

const clone = <T>(value: T): T => structuredClone(value);

const addressOf = (rut: string) => {
  const o = owners.find((x) => x.rut === rut);
  return { address: o?.address ?? "", sector: o?.sector ?? "" };
};

export const db = {
  patients: clone(patients),
  owners: clone(owners),
  doctors: clone(doctors),
  rooms: clone(rooms),
  services: clone(services),
  appointments: clone(seedAppointments),
  invoices: clone(seedInvoices),
  referrals: clone(seedReferrals),
  clinics: clone(networkClinics),
  requests: clone(seedRequests),
  grants: clone(seedGrants),
  medications: clone(medications),
  movements: clone(seedMovements),
  suppliers: clone(suppliers),
  purchaseOrders: clone(seedPurchaseOrders),
  products: clone(seedProducts),
  retailSuppliers: clone(retailSuppliers),
  sales: clone(seedSales),
  retailMovements: clone(seedRetailMovements),
  retailOrders: clone(seedRetailOrders),
  shipments: buildSeedShipments(seedSales, addressOf),
  tickets: clone(seedTickets),
  ideas: clone(seedIdeas),
  releases: clone(releases),
  cameras: clone(seedCameras),
  devices: clone(seedDevices),
  nvr: clone(NVR),
  events: clone(seedEvents),
  audit: clone(seedAudit),
  access: clone(seedAccess),
  waiting: clone(seedWaiting),
  securitySettings: clone(seedSecuritySettings),
  users: clone(seedUsers),
  rolePermissions: clone(defaultRolePermissions),
  clinicProfile: clone(seedClinicProfile),
  sharingPolicy: clone(seedSharingPolicy),
  taskMeta: {} as Record<string, TaskMeta>,
  reminders: [] as string[],
};

let seq = 0;
/** Ids del "servidor" mock (distintos de los ids optimistas de los stores). */
export const mockId = (prefix: string) => `${prefix}-srv-${++seq}`;

/** Respuesta async con copia profunda (como si viniera serializada por HTTP). */
export const ok = <T>(value: T): Promise<T> => Promise.resolve(clone(value));

/** Error 404 del mock. */
export const notFound = (what: string, id: string) => Promise.reject(new Error(`${what} ${id} no existe (mock)`));

/**
 * Usuario de la sesión en el mock (en el backend real sale del token).
 * El mock no conoce el rol elegido en "Ver como": usa el usuario demo veterinario.
 */
export const actor = () => db.users.find((u) => u.id === demoUserByRole.Veterinario)!;

/** Reemplaza un elemento por id y devuelve la versión nueva. */
export function patchById<T extends { id: string }>(list: T[], id: string, fn: (item: T) => T): T | undefined {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  list[i] = fn(list[i]);
  return list[i];
}

/** Siguiente número correlativo (folio, boleta, OC, ticket…). */
export const nextNumber = (values: number[]) => Math.max(0, ...values) + 1;
