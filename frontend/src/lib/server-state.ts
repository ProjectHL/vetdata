/**
 * Registro de estado de servidor para el nivel `lib` (T5-3a).
 *
 * En modo mock este módulo es transparente: `read` devuelve el fallback
 * (la semilla) y `publish` no hace nada, así que todo sigue igual.
 *
 * En modo http los stores publican sus listas hidratadas con `publish` y
 * `lib/` lee desde aquí con `read`. El truco que permite no tocar
 * ningún componente: `read` devuelve siempre el MISMO arreglo vivo por
 * clave y `publish` lo sincroniza en el lugar (sin reemplazar la
 * referencia), así que las lecturas evaluadas durante el render ven los
 * datos del servidor en cuanto llegan.
 *
 * La carga de catálogos sin store dueño (pacientes, dueños, doctores,
 * clínicas, proveedores) y de las series de analytics vive en
 * `ensureServerCatalogs`, que llama el store principal dentro de su
 * hidratación: su `setState` posterior re-renderiza el árbol y los
 * consumidores de `lib/` ya ven datos del servidor. Cada endpoint se
 * publica por separado (allSettled): si uno falla, los demás igual se
 * actualizan y la semilla queda como fallback. Nunca lanza.
 *
 * T5-3c: los componentes ya no importan `@/mocks` ni llaman a `read`
 * directo (solo `lib/` lee semillas). Leen los catálogos con los hooks de
 * este módulo (`usePatients`, `useOwners`, `useDoctorsAll`, `useClinics`,
 * `useSuppliers`, `useRetailSuppliers`, `useCurrentClinic`, series de
 * analytics…), que se suscriben al registro y re-renderizan al publicar.
 */
import { useSyncExternalStore } from "react";
import { type Clinic } from "@/domain/network";
import { type Owner } from "@/domain/owners";
import { type Patient } from "@/domain/patients";
import { type Supplier } from "@/domain/pharmacy";
import { type Doctor } from "@/domain/clinic";
import { type RetailSupplier } from "@/domain/retail";
import { type Service } from "@/domain/services";
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
// Semillas: cada lector de `src/lib` importa su propia semilla de
// `@/mocks` como fallback de `read`/`readScalar`. Los componentes leen
// los catálogos con los hooks de abajo, nunca con imports directos a `@/mocks`.
import { doctors as seedDoctors, rooms as seedRooms } from "@/mocks/clinic";
import { medications as seedMedications } from "@/mocks/medications";
import {
  boxOccupancy as seedBoxOccupancy,
  coverageByVaccine as seedCoverageByVaccine,
  diagnosisCategories as seedDiagnosisCategories,
  monthlyConsults as seedMonthlyConsults,
  monthlyRevenue as seedMonthlyRevenue,
  networkAlerts as seedNetworkAlerts,
  revenueByLine as seedRevenueByLine,
  vaccineCoverage as seedVaccineCoverage,
} from "@/mocks/metrics";
import {
  clinics as seedClinics,
  currentClinic as seedCurrentClinic,
  networkClinics as seedNetworkClinics,
} from "@/mocks/network";
import { owners as seedOwners, sectors as seedSectors } from "@/mocks/owners";
import { patients as seedPatients } from "@/mocks/patients";
import { suppliers as seedSuppliers } from "@/mocks/pharmacy";
import { retailSuppliers as seedRetailSuppliers } from "@/mocks/retail";
import { services as seedBillableServices } from "@/mocks/services";
import { releases as seedReleases } from "@/mocks/support";

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
// Suscripciones por lista (T5-3c): `publish` avisa y los hooks re-renderizan.
// `publish` sincroniza en el lugar (misma referencia), así que cada clave
// lleva un contador de versión: es lo que observa el hook.
const listVersions = new Map<string, number>();
const listListeners = new Map<string, Set<() => void>>();

function listVersion(key: string): number {
  return listVersions.get(key) ?? 0;
}

/** Suscribe `fn` a los `publish` de una clave. Devuelve el desuscriptor. */
export function subscribeList(key: string, fn: () => void): () => void {
  let set = listListeners.get(key);
  if (!set) {
    set = new Set();
    listListeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

function notifyList(key: string): void {
  listVersions.set(key, listVersion(key) + 1);
  listListeners.get(key)?.forEach((fn) => fn());
}

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
    notifyList(key);
    return;
  }
  if (live === (list as unknown as T[])) return;
  live.length = 0;
  live.push(...list);
  notifyList(key);
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

export function subscribeScalar(key: string, fn: (value: unknown) => void): () => void {
  let set = scalarListeners.get(key);
  if (!set) {
    set = new Set();
    scalarListeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

// ---- Hooks vivos para componentes (T5-3c) ----

/**
 * Semilla por clave, solo dentro de `lib/`. Los componentes no pasan
 * fallback: el hook lo resuelve aquí, así ningún componente importa
 * `@/mocks` directo.
 */
const fallbacks: Record<ServerStateKey, readonly unknown[]> = {
  patients: seedPatients,
  owners: seedOwners,
  sectors: seedSectors,
  doctors: seedDoctors,
  rooms: seedRooms,
  medications: seedMedications,
  suppliers: seedSuppliers,
  retailSuppliers: seedRetailSuppliers,
  releases: seedReleases,
  clinics: seedClinics,
  networkClinics: seedNetworkClinics,
  monthlyConsults: seedMonthlyConsults,
  monthlyRevenue: seedMonthlyRevenue,
  revenueByLine: seedRevenueByLine,
  vaccineCoverage: seedVaccineCoverage,
  coverageByVaccine: seedCoverageByVaccine,
  diagnosisCategories: seedDiagnosisCategories,
  networkAlerts: seedNetworkAlerts,
  boxOccupancy: seedBoxOccupancy,
};

/**
 * Lee la lista viva de una clave y se suscribe a sus `publish` (modo http).
 * En modo mock devuelve la semilla (estable, sin re-renders).
 */
export function useLiveList<T>(key: ServerStateKey): T[] {
  useSyncExternalStore(
    (notify) => subscribeList(key, notify),
    () => listVersion(key),
    () => listVersion(key),
  );
  return read<T>(key, fallbacks[key] as readonly T[]);
}

/** Catálogo de pacientes. TODO(api): services.patients.list() */
export function usePatients(): Patient[] {
  return useLiveList<Patient>("patients");
}

/** Catálogo de dueños. TODO(api): services.owners.list() */
export function useOwners(): Owner[] {
  return useLiveList<Owner>("owners");
}

/** Sectores (comunas) de dueños. TODO(api): derivado de services.owners.list() */
export function useSectors(): string[] {
  return useLiveList<string>("sectors");
}

/**
 * Catálogo completo de profesionales (sin filtrar por usuarios activos).
 * Para agenda y mapa con filtro de activos, usar `useDoctors` del store.
 * TODO(api): services.clinic.listDoctors()
 */
export function useDoctorsAll(): Doctor[] {
  return useLiveList<Doctor>("doctors");
}

/** Nombres de las clínicas con pacientes. TODO(api): services.network.listClinics() */
export function useClinics(): string[] {
  return useLiveList<string>("clinics");
}

/** Red de clínicas. TODO(api): services.network.listClinics() */
export function useNetworkClinics(): Clinic[] {
  return useLiveList<Clinic>("networkClinics");
}

/** Proveedores de farmacia. TODO(api): services.pharmacy.listSuppliers() */
export function useSuppliers(): Supplier[] {
  return useLiveList<Supplier>("suppliers");
}

/** Proveedores de tienda. TODO(api): services.retail.listSuppliers() */
export function useRetailSuppliers(): RetailSupplier[] {
  return useLiveList<RetailSupplier>("retailSuppliers");
}

/**
 * Clínica de la sesión. Se suscribe al escalar (ver `subscribeScalar`):
 * en http re-renderiza al publicar, en mock es la semilla.
 * TODO(api): services.network.getCurrentClinic()
 */
export function useCurrentClinic(): string {
  return useSyncExternalStore(
    (notify) => subscribeScalar("currentClinic", notify),
    () => readScalar("currentClinic", seedCurrentClinic),
    () => readScalar("currentClinic", seedCurrentClinic),
  );
}

/** TODO(api): services.analytics.monthlyConsults() */
export function useMonthlyConsults(): MonthlyConsults[] {
  return useLiveList<MonthlyConsults>("monthlyConsults");
}

/** TODO(api): services.analytics.monthlyRevenue() */
export function useMonthlyRevenue(): MonthlyRevenue[] {
  return useLiveList<MonthlyRevenue>("monthlyRevenue");
}

/** TODO(api): services.analytics.revenueByLine() */
export function useRevenueByLine(): RevenueByLine[] {
  return useLiveList<RevenueByLine>("revenueByLine");
}

/** TODO(api): services.analytics.vaccineCoverage() */
export function useVaccineCoverage(): VaccineCoverage[] {
  return useLiveList<VaccineCoverage>("vaccineCoverage");
}

/** TODO(api): services.analytics.coverageByVaccine() */
export function useCoverageByVaccine(): CoverageByVaccine[] {
  return useLiveList<CoverageByVaccine>("coverageByVaccine");
}

/** TODO(api): services.analytics.diagnosisCategories() */
export function useDiagnosisCategories(): DiagnosisCategory[] {
  return useLiveList<DiagnosisCategory>("diagnosisCategories");
}

/** TODO(api): services.analytics.networkAlerts() */
export function useNetworkAlerts(): NetworkAlert[] {
  return useLiveList<NetworkAlert>("networkAlerts");
}

/** TODO(api): services.analytics.boxOccupancy() */
export function useBoxOccupancy(): BoxOccupancy[] {
  return useLiveList<BoxOccupancy>("boxOccupancy");
}

/**
 * Prestaciones facturables. Sin endpoint en el backend: se conserva la
 * semilla de `@/mocks/services` en ambos modos.
 * TODO(api): services.clinic.listServices()
 */
export function useBillableServices(): Service[] {
  return seedBillableServices;
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
 * de `lib/` ven datos del servidor sin suscripciones nuevas ni cambios
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
