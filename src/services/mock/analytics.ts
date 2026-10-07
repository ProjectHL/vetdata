import {
  boxOccupancy,
  coverageByVaccine,
  diagnosisCategories,
  monthlyConsults,
  monthlyRevenue,
  networkAlerts,
  revenueByLine,
  vaccineCoverage,
} from "@/mocks/metrics";
import type { AnalyticsService } from "../contracts";
import { ok } from "./db";

/** Series agregadas (anónimas) de la red: de solo lectura. */
export const analytics: AnalyticsService = {
  monthlyConsults: () => ok(monthlyConsults),
  monthlyRevenue: () => ok(monthlyRevenue),
  revenueByLine: () => ok(revenueByLine),
  vaccineCoverage: () => ok(vaccineCoverage),
  coverageByVaccine: () => ok(coverageByVaccine),
  diagnosisCategories: () => ok(diagnosisCategories),
  networkAlerts: () => ok(networkAlerts),
  boxOccupancy: () => ok(boxOccupancy),
};
