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
 * TODO(api): cada export está anotado con la operación de `services` que lo
 * reemplaza. Al conectar el backend, estos datos deben pasar a un store o a
 * una carga (server component / fetch) en lugar de leerse de forma síncrona.
 */
import { type Patient, lastVisit } from "@/domain/patients";
import { networkClinics } from "@/mocks/network";
import { owners } from "@/mocks/owners";
import { patients } from "@/mocks/patients";
import { suppliers } from "@/mocks/pharmacy";

// ---- Sesión ----

/**
 * Clínica del usuario que inició sesión.
 * TODO(api): reemplazar por la clínica de la sesión autenticada (services.network.getCurrentClinic()).
 */
export { currentClinic } from "@/mocks/network";

// ---- Pacientes y dueños ----

/** TODO(api): services.patients.list() */
export { patients } from "@/mocks/patients";
/** TODO(api): services.owners.list() */
export { owners, sectors } from "@/mocks/owners";

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
export { doctors } from "@/mocks/clinic";
/** Estado inicial del mapa (la versión viva está en useStore().rooms). TODO(api): services.clinic.listRooms() */
export { rooms } from "@/mocks/clinic";
/** Prestaciones facturables. TODO(api): services.clinic.listServices() */
export { services as billableServices } from "@/mocks/services";

// ---- Red de clínicas ----

/** Nombres de las clínicas con pacientes. TODO(api): services.network.listClinics() */
export { clinics, networkClinics } from "@/mocks/network";

/** TODO(api): services.network.listClinics() + búsqueda por nombre */
export function getClinic(name: string) {
  return networkClinics.find((c) => c.name === name);
}

// ---- Farmacia ----

/** Catálogo inicial (la versión viva está en useStore().medications). TODO(api): services.pharmacy.listMedications() */
export { medications } from "@/mocks/medications";
/** TODO(api): services.pharmacy.listSuppliers() */
export { suppliers } from "@/mocks/pharmacy";

/** TODO(api): services.pharmacy.listSuppliers() + búsqueda por id */
export function getSupplier(id: string) {
  return suppliers.find((s) => s.id === id);
}

// ---- Tienda ----

/** TODO(api): services.retail.listSuppliers() */
export { retailSuppliers } from "@/mocks/retail";

// ---- Soporte ----

/** TODO(api): services.support.listReleases() */
export { releases } from "@/mocks/support";

// ---- Seguridad ----

/** TODO(api): services.security.getNvrStorage() */
export { NVR } from "@/mocks/security";

// ---- Análisis (series agregadas de la red) ----

/** TODO(api): services.analytics.* (una operación por serie) */
export {
  boxOccupancy,
  coverageByVaccine,
  diagnosisCategories,
  monthlyConsults,
  monthlyRevenue,
  networkAlerts,
  revenueByLine,
  vaccineCoverage,
} from "@/mocks/metrics";
