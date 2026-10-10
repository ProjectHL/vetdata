/**
 * Registro de estado de servidor para el nivel `lib` (T5-3a).
 *
 * En modo mock este módulo es transparente: `read` devuelve el fallback
 * (la semilla) y `publish` no hace nada, así que todo sigue igual.
 *
 * En modo http los stores publican sus listas hidratadas con `publish` y
 * `lib/lookups` lee desde aquí con `read`. El truco que permite no tocar
 * ningún componente: `read` devuelve siempre el MISMO arreglo vivo por
 * clave y `publish` lo sincroniza en el lugar (sin reemplazar la
 * referencia), así que los `export const` de `lookups` evaluados al
 * importar el módulo ven los datos del servidor en cuanto llegan.
 *
 * La carga de catálogos sin store dueño (pacientes, dueños, doctores,
 * clínicas, proveedores) y de las series de analytics vive en
 * `ensureServerCatalogs`, que llama el store principal dentro de su
 * hidratación: su `setState` posterior re-renderiza el árbol y los
 * consumidores de `lookups` ya ven datos del servidor. Cada endpoint se
 * publica por separado (allSettled): si uno falla, los demás igual se
 * actualizan y la semilla queda como fallback. Nunca lanza.
 */
import { type Clinic } from "@/domain/network";
import { type Owner } from "@/domain/owners";
import { type Patient } from "@/domain/patients";
import { type Supplier } from "@/domain/pharmacy";
import { type Doctor } from "@/domain/clinic";
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
import { dataSource, services } from "@/services";

/** Verdadero solo con `NEXT_PUBLIC_DATA_SOURCE=http` (se inyecta en build). */
export const isServerMode = dataSource === "http";

export type ServerStateKey =
  | "patients"
  | "owners"
  | "sectors"
  | "doctors"
  | "rooms"
  | "medications"
  | "suppliers"
  | "retailSuppliers"
  | "releases"
  | "clinics"
  | "networkClinics"
  | "monthlyConsults"
  | "monthlyRevenue"
  | "revenueByLine"
  | "vaccineCoverage"
  | "coverageByVaccine"
  | "diagnosisCategories"
  | "networkAlerts"
  | "boxOccupancy";

const lists = new Map<string, unknown[]>();

/**
 * Lee la lista viva de una clave, sembrada con el fallback en modo http.
 * En modo mock devuelve el fallback tal cual (sin copiar).
 */
export function read<T>(key: ServerStateKey, fallback: readonly T[]): T[] {
  if (!isServerMode) return fallback as T[];
  let live = lists.get(key) as T[] | undefined;
  if (!live) {
    live = [...fallback];
    lists.set(key, live);
  }
  return live;
}

/**
 * Publica una lista del servidor (solo modo http). Sincroniza en el lugar
 * para no romper la referencia que ya importaron los consumidores.
 * Si `list` es el mismo arreglo vivo, no hace nada.
 */
export function publish<T>(key: ServerStateKey, list: readonly T[]): void {
  if (!isServerMode) return;
  const live = lists.get(key) as T[] | undefined;
  if (!live) {
    lists.set(key, [...list]);
    return;
  }
  if (live === (list as unknown as T[])) return;
  live.length = 0;
  live.push(...list);
}

// ---- Escalares (hoy solo la clínica de la sesión) ----

const scalars = new Map<string, unknown>();
const scalarListeners = new Map<string, Set<(value: unknown) => void>>();

export function readScalar<T>(key: string, fallback: T): T {
  if (!isServerMode) return fallback;
  return (scalars.has(key) ? scalars.get(key) : fallback) as T;
}

export function publishScalar<T>(key: string, value: T): void {
  if (!isServerMode) return;
  scalars.set(key, value);
  scalarListeners.get(key)?.forEach((fn) => fn(value));
}

export function subscribeScalar(key: string, fn: (value: unknown) => void): void {
  let set = scalarListeners.get(key);
  if (!set) {
    set = new Set();
    scalarListeners.set(key, set);
  }
  set.add(fn);
}

// ---- Carga de catálogos sin store dueño + series de analytics ----

/**
 * Carga desde el servidor los catálogos que ningún store hidrata
 * (pacientes, dueños, doctores, clínicas, proveedores de farmacia) y las 8
 * series de analytics, y los publica en el registro. La llama el store
 * principal dentro de su hidratación (ver `lib/store.tsx`). Los catálogos
 * con store dueño (salas y medicamentos → store principal; proveedores de
 * tienda → retail-store; novedades → support-store) los publica cada store.
 *
 * Decisión (T5-3a): el store principal es el dueño de esta carga porque su
 * hidratación ya re-renderiza todo el árbol, así los consumidores síncronos
 * de `lookups` ven datos del servidor sin suscripciones nuevas ni cambios
 * en componentes. Un fetch lazy con caché en este módulo dejaría a esos
 * consumidores con la semilla hasta el próximo render, sin quién lo
 * provoque. Cada endpoint se resuelve por separado: un fallo solo conserva
 * la semilla de esa clave. Nunca lanza.
 */
export async function ensureServerCatalogs(): Promise<void> {
  if (!isServerMode) return;
  const tasks: { key: ServerStateKey | "currentClinic"; run: () => Promise<unknown> }[] = [
    { key: "patients", run: () => services.patients.list() },
    { key: "owners", run: () => services.owners.list() },
    { key: "doctors", run: () => services.clinic.listDoctors() },
    { key: "networkClinics", run: () => services.network.listClinics() },
    { key: "currentClinic", run: () => services.network.getCurrentClinic() },
    { key: "suppliers", run: () => services.pharmacy.listSuppliers() },
    { key: "monthlyConsults", run: () => services.analytics.monthlyConsults() },
    { key: "monthlyRevenue", run: () => services.analytics.monthlyRevenue() },
    { key: "revenueByLine", run: () => services.analytics.revenueByLine() },
    { key: "vaccineCoverage", run: () => services.analytics.vaccineCoverage() },
    { key: "coverageByVaccine", run: () => services.analytics.coverageByVaccine() },
    { key: "diagnosisCategories", run: () => services.analytics.diagnosisCategories() },
    { key: "networkAlerts", run: () => services.analytics.networkAlerts() },
    { key: "boxOccupancy", run: () => services.analytics.boxOccupancy() },
  ];
  // `Promise.resolve().then(...)` también atrapa un throw síncrono al construir la promesa.
  const results = await Promise.allSettled(tasks.map((t) => Promise.resolve().then(t.run)));
  results.forEach((result, i) => {
    if (result.status !== "fulfilled") {
      console.error("[services]", result.reason);
      return;
    }
    const { key } = tasks[i];
    const value = result.value;
    switch (key) {
      case "patients":
        publish("patients", value as Patient[]);
        break;
      case "owners": {
        const owners = value as Owner[];
        publish("owners", owners);
        publish("sectors", [...new Set(owners.map((o) => o.sector))].sort());
        break;
      }
      case "doctors":
        publish("doctors", value as Doctor[]);
        break;
      case "networkClinics": {
        const clinics = value as Clinic[];
        publish("networkClinics", clinics);
        publish("clinics", clinics.map((c) => c.name));
        break;
      }
      case "currentClinic":
        publishScalar("currentClinic", value as string);
        break;
      case "suppliers":
        publish("suppliers", value as Supplier[]);
        break;
      case "monthlyConsults":
        publish("monthlyConsults", value as MonthlyConsults[]);
        break;
      case "monthlyRevenue":
        publish("monthlyRevenue", value as MonthlyRevenue[]);
        break;
      case "revenueByLine":
        publish("revenueByLine", value as RevenueByLine[]);
        break;
      case "vaccineCoverage":
        publish("vaccineCoverage", value as VaccineCoverage[]);
        break;
      case "coverageByVaccine":
        publish("coverageByVaccine", value as CoverageByVaccine[]);
        break;
      case "diagnosisCategories":
        publish("diagnosisCategories", value as DiagnosisCategory[]);
        break;
      case "networkAlerts":
        publish("networkAlerts", value as NetworkAlert[]);
        break;
      case "boxOccupancy":
        publish("boxOccupancy", value as BoxOccupancy[]);
        break;
    }
  });
}
