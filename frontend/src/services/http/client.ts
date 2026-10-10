/**
 * Utilidades del cliente HTTP. Base URL desde `NEXT_PUBLIC_API_URL`
 * (p. ej. "https://api.vetdata.cl"); las rutas de los contratos ya incluyen `/api/v1`.
 */

/** Operación del contrato aún no conectada al backend. */
export class NotImplementedError extends Error {
  constructor(public readonly endpoint: string) {
    super(`Endpoint no implementado: ${endpoint}`);
    this.name = "NotImplementedError";
  }
}

/** Error HTTP con el status y el cuerpo devuelto por la API. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Cola de keys de idempotencia pendientes (T5-4). Los contratos de servicio no
 * reciben la key como parámetro, así que el store la genera con
 * `newIdempotencyKey()` justo antes de llamar al servicio y el próximo
 * `apiFetch` de mutación (POST/PUT/PATCH/DELETE) la consume como header
 * `Idempotency-Key`. La llamada al servicio ejecuta su `apiFetch` de forma
 * sincrónica, por lo que el orden de consumo sigue el orden de las llamadas;
 * las lecturas (GET/HEAD) nunca consumen. Cada key se usa una sola vez
 * (`shift`), así que el backend nunca ve una key reutilizada con otros datos.
 */
const pendingIdempotencyKeys: string[] = [];

/**
 * Genera una key de idempotencia única (UUID, 36 caracteres: dentro del rango
 * 8–128 que exige el backend) y la encola para el próximo `apiFetch` de
 * mutación. Una key por intención de usuario: estable ante reintento del mismo
 * intento (no hay reenvío automático), nueva ante cada nuevo intento.
 * En modo mock no se genera (los stores lo condicionan a `dataSource`).
 */
export function newIdempotencyKey(): string {
  const key =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  pendingIdempotencyKeys.push(key);
  // Protección ante fugas (p. ej. un servicio que rechaza sin llamar a
  // apiFetch): la cola en flujo normal vive vacía entre mutaciones.
  if (pendingIdempotencyKeys.length > 100) pendingIdempotencyKeys.shift();
  return key;
}

function hasHeader(headers: HeadersInit | undefined, name: string): boolean {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has(name);
  if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === name.toLowerCase());
  return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
}

/** Init de `apiFetch`: como `RequestInit` sin `body` serializable + key opcional. */
export type ApiFetchInit = Omit<RequestInit, "body"> & { body?: unknown; idempotencyKey?: string };

/**
 * fetch tipado contra la API de VetData. Listo para usar al implementar cada método:
 *
 *   list: () => apiFetch<Appointment[]>("/api/v1/appointments"),
 *   create: (input) => apiFetch<Appointment>("/api/v1/appointments", { method: "POST", body: input }),
 *
 * TODO(api): agregar el token de sesión (Authorization) y la clínica activa
 * según lo que defina el backend (cookie httpOnly o header).
 */
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { body, headers, idempotencyKey, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();
  // Solo las mutaciones llevan Idempotency-Key (el backend la exige en mutate()).
  // Precedencia: header explícito > init.idempotencyKey > cola de newIdempotencyKey().
  const queued =
    idempotencyKey === undefined && !hasHeader(headers, "Idempotency-Key") && method !== "GET" && method !== "HEAD"
      ? pendingIdempotencyKeys.shift()
      : undefined;
  const key = idempotencyKey ?? queued;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(key !== undefined ? { "Idempotency-Key": key } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, data, `${init.method ?? "GET"} ${path} → ${res.status}`);
  return data as T;
}
