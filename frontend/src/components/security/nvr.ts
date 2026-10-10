import type { NvrStorage } from "@/domain/security";

/**
 * Almacenamiento del grabador (TB) y días efectivamente guardados.
 *
 * Semilla sin endpoint en el backend (`services.security.getNvrStorage`
 * lanza NotImplemented): se conserva el valor demo en ambos modos.
 * Cuando el backend exponga el endpoint,
 * este módulo debe leer del store de seguridad o de un hook vivo de
 * `lib/server-state` en lugar del valor fijo.
 */
export const NVR: NvrStorage = { usedTb: 6.8, totalTb: 8, daysRecorded: 27 };
