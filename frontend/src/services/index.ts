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
export { newIdempotencyKey } from "./http/client";

export const dataSource: "mock" | "http" = process.env.NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock";

export const services: Services = dataSource === "http" ? httpServices : mockServices;

/**
 * Ejecuta una operación de servicio sin bloquear la UI (fire-and-forget).
 *
 * Patrón T5-4 en modo http: el store genera UNA key con `newIdempotencyKey()`
 * justo antes de llamar al servicio, aplica el optimista, y encadena
 * `.then(reconciliar, revertir)` sobre la promesa ANTES de pasarla aquí, p. ej.
 * `runInBackground(promise.then(reemplazarId, revertirYSenalar))`. Así la
 * respuesta canónica (ids, folios, números) reemplaza al `-new-N` optimista y
 * el fallo revierte el cambio y expone el error en el store. En modo mock la
 * promesa se pasa directa, sin keys ni reconcile.
 */
export function runInBackground(promise: Promise<unknown>) {
  promise.catch((error: unknown) => console.error("[services]", error));
}
