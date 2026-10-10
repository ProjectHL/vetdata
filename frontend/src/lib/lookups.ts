/**
 * Lookups y catálogos de solo lectura que hoy salen de `src/mocks`.
 *
 * Decisión de arquitectura (paso 3 del refactor a capa de servicios):
 * - Las reglas que solo transforman o derivan datos (stockStatus, expiryStatus,
 *   accessLevel, grantStatus, slaState, stockLevel, margin, totalStock,
 *   deliveryFee, ivaIncluded, ownerName, lastVisit, patientAge, invoiceTotals…)
 *   viven en `src/domain/` junto a su tipo: son reglas de negocio puras y
 *   seguirán valiendo cuando los datos vengan de la API.
 * - Las funciones que BUSCAN en los datos semilla (getPatient, getOwner, petsOf,
 *   ownerLastVisit, getClinic, getSupplier) y los catálogos que la UI lee
 *   directo (pacientes, dueños, profesionales, clínicas, proveedores, series de
 *   métricas…) viven aquí. Es el único punto por el que componentes y utilidades
 *   puras (`lib/analytics`, `lib/metrics/*`, `lib/tasks`) leen datos semilla,
 *   para que los componentes no importen `@/mocks` directamente.
 * - Generadores de semillas (buildSeedShipments, ventas deterministas) quedan
 *   en `src/mocks/`.
 *
 * T5-3a: en modo http cada catálogo con endpoint lee del registro de
 * `lib/server-state` (los stores publican sus listas hidratadas y el store
 * principal carga los catálogos sin dueño + las series de analytics). Cada
 * export es el MISMO arreglo vivo que `publish` sincroniza en el lugar, así
 * que los ~60 consumidores no cambian: en http leen estado del servidor, en
 * mock la semilla. Sin endpoint en el backend (`billableServices`, `NVR`) se
 * conserva la semilla en ambos modos.
 *
 * TODO(api): cada export está anotado con la operación de `services` que lo
 * reemplaza. Al conectar el backend, estos datos deben pasar a un store o a
 * una carga (server component / fetch) en lugar de leerse de forma síncrona.
 */
import { type Patient, lastVisit } from "@/domain/patients";
import { type Doctor, type Room } from "@/domain/clinic";
import { type Medication } from "@/domain/medications";
import { type Clinic } from "@/domain/network";
import { type Owner } from "@/domain/owners";
import { type Supplier } from "@/domain/pharmacy";
import { type RetailSupplier } from "@/domain/retail";
import { type Release } from "@/domain/support";
import {
  type BoxOccupancy,
  type CoverageByVaccine,
  type DiagnosisCategory,
  type MonthlyConsults,
  type MonthlyRevenue,
  type NetworkAlert,
  type RevenueByLine,
  type VaccineCoverage,
} from "@/domain/metrics";
import {
  isServerMode,
  read,
  readScalar,
  subscribeScalar,
} from "@/lib/server-state";
import { doctors as mockDoctors, rooms as mockRooms } from "@/mocks/clinic";
import { medications as mockMedications } from "@/mocks/medications";
import {
  boxOccupancy as mockBoxOccupancy,
  coverageByVaccine as mockCoverageByVaccine,
  diagnosisCategories as mockDiagnosisCategories,
  monthlyConsults as mockMonthlyConsults,
  monthlyRevenue as mockMonthlyRevenue,
  networkAlerts as mockNetworkAlerts,
  revenueByLine as mockRevenueByLine,
  vaccineCoverage as mockVaccineCoverage,
} from "@/mocks/metrics";
import {
  clinics as mockClinics,
  currentClinic as mockCurrentClinic,
  networkClinics as mockNetworkClinics,
} from "@/mocks/network";
import { owners as mockOwners, sectors as mockSectors } from "@/mocks/owners";
import { patients as mockPatients } from "@/mocks/patients";
import { suppliers as mockSuppliers } from "@/mocks/pharmacy";
import { retailSuppliers as mockRetailSuppliers } from "@/mocks/retail";
import { releases as mockReleases } from "@/mocks/support";

// ---- Sesión ----

/**
 * Clínica del usuario que inició sesión.
 * TODO(api): reemplazar por la clínica de la sesión autenticada (services.network.getCurrentClinic()).
 */
export let currentClinic: string = readScalar("currentClinic", mockCurrentClinic);
if (isServerMode) {
  subscribeScalar("currentClinic", (value) => {
    currentClinic = value as string;
  });
}

// ---- Pacientes y dueños ----

/** TODO(api): services.patients.list() */
export const patients: Patient[] = read("patients", mockPatients);
/** TODO(api): services.owners.list() */
export const owners: Owner[] = read("owners", mockOwners);
export const sectors: string[] = read("sectors", mockSectors);

/** TODO(api): services.patients.get(id) */
export function getPatient(id: string): Patient | undefined {
  return patients.find((p) => p.id === id);
}

/** TODO(api): services.patients.listByOwner(rut) */
export function petsOf(ownerRut: string) {
  return patients.filter((p) => p.ownerRut === ownerRut);
}

/** Última visita entre todas las mascotas del dueño. TODO(api): campo calculado por el backend. */
export function ownerLastVisit(ownerRut: string) {
  return petsOf(ownerRut).reduce((max, p) => {
    const v = lastVisit(p);
    return v > max ? v : max;
  }, "");
}

/** TODO(api): services.owners.get(rut) */
export function getOwner(rut: string) {
  return owners.find((o) => o.rut === rut);
}

// ---- Clínica ----

/** Catálogo de profesionales. TODO(api): services.clinic.listDoctors() */
export const doctors: Doctor[] = read("doctors", mockDoctors);
/** Estado inicial del mapa (la versión viva está en useStore().rooms). TODO(api): services.clinic.listRooms() */
export const rooms: Room[] = read("rooms", mockRooms);
/** Prestaciones facturables. Sin endpoint en el backend: se conserva la semilla. TODO(api): services.clinic.listServices() */
export { services as billableServices } from "@/mocks/services";

// ---- Red de clínicas ----

/** Nombres de las clínicas con pacientes. TODO(api): services.network.listClinics() */
export const clinics: string[] = read("clinics", mockClinics);
export const networkClinics: Clinic[] = read("networkClinics", mockNetworkClinics);

/** TODO(api): services.network.listClinics() + búsqueda por nombre */
export function getClinic(name: string) {
  return networkClinics.find((c) => c.name === name);
}

// ---- Farmacia ----

/** Catálogo inicial (la versión viva está en useStore().medications). TODO(api): services.pharmacy.listMedications() */
export const medications: Medication[] = read("medications", mockMedications);
/** TODO(api): services.pharmacy.listSuppliers() */
export const suppliers: Supplier[] = read("suppliers", mockSuppliers);

/** TODO(api): services.pharmacy.listSuppliers() + búsqueda por id */
export function getSupplier(id: string) {
  return suppliers.find((s) => s.id === id);
}

// ---- Tienda ----

/** TODO(api): services.retail.listSuppliers() */
export const retailSuppliers: RetailSupplier[] = read("retailSuppliers", mockRetailSuppliers);

// ---- Soporte ----

/** TODO(api): services.support.listReleases() */
export const releases: Release[] = read("releases", mockReleases);

// ---- Seguridad ----

/** Sin endpoint en el backend: se conserva la semilla. TODO(api): services.security.getNvrStorage() */
export { NVR } from "@/mocks/security";

// ---- Análisis (series agregadas de la red) ----

/** TODO(api): services.analytics.* (una operación por serie) */
export const monthlyConsults: MonthlyConsults[] = read("monthlyConsults", mockMonthlyConsults);
export const monthlyRevenue: MonthlyRevenue[] = read("monthlyRevenue", mockMonthlyRevenue);
export const revenueByLine: RevenueByLine[] = read("revenueByLine", mockRevenueByLine);
export const vaccineCoverage: VaccineCoverage[] = read("vaccineCoverage", mockVaccineCoverage);
export const coverageByVaccine: CoverageByVaccine[] = read("coverageByVaccine", mockCoverageByVaccine);
export const diagnosisCategories: DiagnosisCategory[] = read("diagnosisCategories", mockDiagnosisCategories);
export const networkAlerts: NetworkAlert[] = read("networkAlerts", mockNetworkAlerts);
export const boxOccupancy: BoxOccupancy[] = read("boxOccupancy", mockBoxOccupancy);

/**
 * Semillas para el estado inicial de los stores. Este módulo es el único
 * punto de `src/lib` que importa `@/mocks`: en mock son el estado final y
 * en http el estado previo a la hidratación (los stores lo reemplazan con
 * `services.*` al montar y publican las listas que son catálogos).
 */
export { seedAppointments } from "@/mocks/appointments";
export { seedInvoices } from "@/mocks/invoices";
export { seedMovements, seedPurchaseOrders } from "@/mocks/pharmacy";
export { seedReferrals } from "@/mocks/referrals";
export {
  buildSeedShipments,
  seedProducts,
  seedRetailMovements,
  seedRetailOrders,
  seedSales,
} from "@/mocks/retail";
export {
  seedAccess,
  seedAudit,
  seedCameras,
  seedDevices,
  seedEvents,
  seedSecuritySettings,
  seedWaiting,
} from "@/mocks/security";
export {
  defaultRolePermissions,
  demoUserByRole,
  seedClinicProfile,
  seedSharingPolicy,
  seedUsers,
} from "@/mocks/settings";
export { seedGrants, seedRequests } from "@/mocks/sharing";
export { seedIdeas, seedTickets } from "@/mocks/support";
