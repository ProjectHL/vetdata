import type { AnalyticsService } from "../contracts";
import { NotImplementedError } from "./client";

export const analytics: AnalyticsService = {
  /** GET /api/v1/analytics/monthly-consults */
  monthlyConsults: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/monthly-consults");
  },
  /** GET /api/v1/analytics/monthly-revenue */
  monthlyRevenue: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/monthly-revenue");
  },
  /** GET /api/v1/analytics/revenue-by-line */
  revenueByLine: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/revenue-by-line");
  },
  /** GET /api/v1/analytics/vaccine-coverage */
  vaccineCoverage: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/vaccine-coverage");
  },
  /** GET /api/v1/analytics/coverage-by-vaccine */
  coverageByVaccine: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/coverage-by-vaccine");
  },
  /** GET /api/v1/analytics/diagnosis-categories */
  diagnosisCategories: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/diagnosis-categories");
  },
  /** GET /api/v1/analytics/network-alerts */
  networkAlerts: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/network-alerts");
  },
  /** GET /api/v1/analytics/box-occupancy */
  boxOccupancy: async () => {
    throw new NotImplementedError("GET /api/v1/analytics/box-occupancy");
  },
};
