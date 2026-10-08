/**
 * Implementación en memoria de los contratos (`../contracts.ts`) sobre `src/mocks`.
 * Es la fuente por defecto (`NEXT_PUBLIC_DATA_SOURCE` sin definir o "mock").
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

export const mockServices: Services = {
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
