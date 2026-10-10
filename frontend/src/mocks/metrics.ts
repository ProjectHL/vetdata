// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
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

/**
 * Series históricas de la red (dummy). Los datos de la red son agregados anónimos:
 * conteos y porcentajes, nunca fichas ni datos de dueños.
 */

export const MONTHS = ["nov", "dic", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct"];

/** Consultas por mes: mi clínica vs promedio por clínica de la red. */
export const monthlyConsults: MonthlyConsults[] = MONTHS.map((month, i) => ({
  month,
  clinica: [212, 198, 176, 189, 224, 231, 245, 238, 252, 261, 274, 96][i],
  red: [205, 201, 188, 192, 210, 215, 222, 226, 230, 236, 241, 88][i],
}));

/** Ingresos netos por mes (CLP) de mi clínica. */
export const monthlyRevenue: MonthlyRevenue[] = MONTHS.map((month, i) => ({
  month,
  ingresos: [18.2, 21.5, 15.8, 16.9, 19.7, 20.4, 22.1, 21.3, 23.6, 24.2, 25.9, 8.4][i] * 1_000_000,
}));

/**
 * Ingresos netos por línea de negocio (CLP). Octubre está en curso.
 * La tienda del mes actual se reemplaza por lo calculado desde las boletas.
 */
export const revenueByLine: RevenueByLine[] = MONTHS.map((month, i) => ({
  month,
  servicios: [12.9, 15.1, 11.2, 11.9, 13.8, 14.3, 15.5, 14.9, 16.4, 16.8, 17.9, 5.8][i] * 1_000_000,
  farmacia: [3.6, 4.2, 3.1, 3.4, 4.0, 4.1, 4.4, 4.3, 4.8, 4.9, 5.3, 1.7][i] * 1_000_000,
  tienda: [2.1, 3.4, 1.9, 2.0, 2.3, 2.4, 2.6, 2.5, 2.7, 2.9, 3.1, 0][i] * 1_000_000,
}));


/** Cobertura de vacunación al día (%) por especie. */
export const vaccineCoverage: VaccineCoverage[] = [
  { species: "Perros", clinica: 78, red: 71 },
  { species: "Gatos", clinica: 64, red: 58 },
  { species: "Conejos", clinica: 41, red: 36 },
  { species: "Aves", clinica: 22, red: 25 },
];

/** Cobertura (%) por vacuna en mi clínica vs red. */
export const coverageByVaccine: CoverageByVaccine[] = [
  { vaccine: "Antirrábica", clinica: 84, red: 79 },
  { vaccine: "Óctuple", clinica: 72, red: 66 },
  { vaccine: "Triple felina", clinica: 63, red: 57 },
  { vaccine: "KC", clinica: 38, red: 33 },
];

/** Diagnósticos por categoría, últimos 90 días: casos en mi clínica y % del total en la red. */
export const diagnosisCategories: DiagnosisCategory[] = [
  { category: "Dermatológico", clinica: 64, redPct: 17 },
  { category: "Digestivo", clinica: 52, redPct: 15 },
  { category: "Osteoarticular", clinica: 41, redPct: 12 },
  { category: "Respiratorio", clinica: 38, redPct: 13 },
  { category: "Dental", clinica: 29, redPct: 9 },
  { category: "Renal / urinario", clinica: 24, redPct: 8 },
  { category: "Cardiológico", clinica: 18, redPct: 6 },
  { category: "Endocrino", clinica: 11, redPct: 4 },
];

/** Alertas de red por sector: casos últimos 30 días vs 30 días previos (anónimo). */
export const networkAlerts: NetworkAlert[] = [
  { sector: "Ñuñoa", category: "Respiratorio", current: 46, previous: 28, note: "Brote compatible con tos de las perreras (KC)." },
  { sector: "Maipú", category: "Digestivo", current: 39, previous: 30, note: "Aumento de gastroenteritis en cachorros." },
  { sector: "Las Condes", category: "Dermatológico", current: 33, previous: 31, note: "Estable: temporada de pulgas." },
  { sector: "Providencia", category: "Respiratorio", current: 21, previous: 24, note: "Leve baja." },
];

/** Ocupación promedio de boxes (% del horario) último mes. */
export const boxOccupancy: BoxOccupancy[] = [
  { box: "Box 1", ocupacion: 82 },
  { box: "Box 2", ocupacion: 74 },
  { box: "Box 3", ocupacion: 69 },
  { box: "Box 4", ocupacion: 55 },
  { box: "Box 5", ocupacion: 71 },
  { box: "Box 6", ocupacion: 48 },
  { box: "Quirófano", ocupacion: 63 },
  { box: "Rayos X", ocupacion: 37 },
];
