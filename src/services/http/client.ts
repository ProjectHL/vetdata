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
 * fetch tipado contra la API de VetData. Listo para usar al implementar cada método:
 *
 *   list: () => apiFetch<Appointment[]>("/api/v1/appointments"),
 *   create: (input) => apiFetch<Appointment>("/api/v1/appointments", { method: "POST", body: input }),
 *
 * TODO(api): agregar el token de sesión (Authorization) y la clínica activa
 * según lo que defina el backend (cookie httpOnly o header).
 */
export async function apiFetch<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, data, `${init.method ?? "GET"} ${path} → ${res.status}`);
  return data as T;
}
