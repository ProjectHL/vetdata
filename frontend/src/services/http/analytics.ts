import type {
  BoxOccupancy,
  CoverageByVaccine,
  DiagnosisCategory,
  MonthlyConsults,
  MonthlyRevenue,
  NetworkAlert,
  RevenueByLine,
  VaccineCoverage,
} from "@/domain/metrics";
import type { AnalyticsService } from "../contracts";
import { apiFetch } from "./client";

export const analytics: AnalyticsService = {
  /** GET /api/v1/analytics/monthly-consults */
  monthlyConsults: () => apiFetch<MonthlyConsults[]>("/api/v1/analytics/monthly-consults"),
  /** GET /api/v1/analytics/monthly-revenue */
  monthlyRevenue: () => apiFetch<MonthlyRevenue[]>("/api/v1/analytics/monthly-revenue"),
  /** GET /api/v1/analytics/revenue-by-line */
  revenueByLine: () => apiFetch<RevenueByLine[]>("/api/v1/analytics/revenue-by-line"),
  /** GET /api/v1/analytics/vaccine-coverage */
  vaccineCoverage: () => apiFetch<VaccineCoverage[]>("/api/v1/analytics/vaccine-coverage"),
  /** GET /api/v1/analytics/coverage-by-vaccine */
  coverageByVaccine: () => apiFetch<CoverageByVaccine[]>("/api/v1/analytics/coverage-by-vaccine"),
  /** GET /api/v1/analytics/diagnosis-categories */
  diagnosisCategories: () => apiFetch<DiagnosisCategory[]>("/api/v1/analytics/diagnosis-categories"),
  /** GET /api/v1/analytics/network-alerts */
  networkAlerts: () => apiFetch<NetworkAlert[]>("/api/v1/analytics/network-alerts"),
  /** GET /api/v1/analytics/box-occupancy */
  boxOccupancy: () => apiFetch<BoxOccupancy[]>("/api/v1/analytics/box-occupancy"),
};
