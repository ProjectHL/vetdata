/**
 * Punto de entrada de la capa de servicios.
 *
 * `NEXT_PUBLIC_DATA_SOURCE` elige la implementación (se inyecta en build):
 * - "mock" (por defecto): en memoria sobre `src/mocks`.
 * - "http": cliente de la API real (`./http`, hoy esqueleto).
 *
 * Los stores importan `services` y llaman a sus operaciones después de aplicar
 * la actualización optimista local (ver `runInBackground`).
 */
import type { Services } from "./contracts";
import { httpServices } from "./http";
import { mockServices } from "./mock";

export type * from "./contracts";

export const dataSource: "mock" | "http" = process.env.NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock";

export const services: Services = dataSource === "http" ? httpServices : mockServices;

/**
 * Ejecuta una operación de servicio sin bloquear la UI (fire-and-forget).
 * TODO(api): al conectar el backend, reconciliar la respuesta con el estado
 * optimista (ids definitivos, folios) y revertir/avisar si falla.
 */
export function runInBackground(promise: Promise<unknown>) {
  promise.catch((error: unknown) => console.error("[services]", error));
}
