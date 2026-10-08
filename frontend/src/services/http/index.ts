/**
 * Implementación HTTP de los contratos (`../contracts.ts`). Esqueleto: cada
 * método lanza `NotImplementedError` con su endpoint hasta que el backend exista.
 * Para implementarlo usa `apiFetch` de `./client.ts`. Se activa con
 * `NEXT_PUBLIC_DATA_SOURCE=http` y `NEXT_PUBLIC_API_URL=<url de la API>`.
 */
import type { Services } from "../contracts";
import { analytics } from "./analytics";
import { appointments, clinic, invoices, network, owners, patients, referrals } from "./clinic";
import { pharmacy } from "./pharmacy";
import { retail } from "./retail";
import { security } from "./security";
import { settings, tasks } from "./settings";
import { sharing } from "./sharing";
import { support } from "./support";

export { ApiError, NotImplementedError, apiFetch } from "./client";

export const httpServices: Services = {
  patients,
  owners,
  clinic,
  appointments,
  invoices,
  referrals,
  network,
  sharing,
  pharmacy,
  retail,
  support,
  security,
  settings,
  tasks,
  analytics,
};
