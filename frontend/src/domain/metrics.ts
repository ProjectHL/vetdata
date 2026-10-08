/**
 * Series históricas de la red. Los datos de la red son agregados anónimos:
 * conteos y porcentajes, nunca fichas ni datos de dueños.
 */

/** Margen bruto supuesto para servicios clínicos (insumos y honorarios variables aparte). */
export const SERVICES_MARGIN = 0.65;

/** Consultas por mes: mi clínica vs promedio por clínica de la red. */
export type MonthlyConsults = { month: string; clinica: number; red: number };
/** Ingresos netos por mes (CLP) de mi clínica. */
export type MonthlyRevenue = { month: string; ingresos: number };
/** Ingresos netos por línea de negocio (CLP). */
export type RevenueByLine = { month: string; servicios: number; farmacia: number; tienda: number };
/** Cobertura de vacunación al día (%) por especie. */
export type VaccineCoverage = { species: string; clinica: number; red: number };
/** Cobertura (%) por vacuna en mi clínica vs red. */
export type CoverageByVaccine = { vaccine: string; clinica: number; red: number };
/** Diagnósticos por categoría: casos en mi clínica y % del total en la red. */
export type DiagnosisCategory = { category: string; clinica: number; redPct: number };
/** Alerta de red por sector: casos últimos 30 días vs 30 días previos (anónimo). */
export type NetworkAlert = { sector: string; category: string; current: number; previous: number; note: string };
/** Ocupación promedio de un box (% del horario). */
export type BoxOccupancy = { box: string; ocupacion: number };
