import { getOwner, patients } from "@/lib/lookups";
import { type Patient, type Vaccine } from "@/domain/patients";
import { type AccessGrant, accessLevel } from "@/domain/sharing";
import { daysUntil } from "@/lib/format";

/** Universo de "mi clínica": propios + compartidos vigentes (misma regla que el resto del producto). */
export function visiblePatients(grants: AccessGrant[], clinic: string) {
  return patients.filter((p) => accessLevel(p, grants, clinic).level !== "ninguno");
}

export type VaccineState = "vencida" | "próxima" | "vigente";

export function vaccineState(v: Vaccine): VaccineState {
  if (!v.nextDose) return "vigente";
  const d = daysUntil(v.nextDose);
  if (d < 0) return "vencida";
  if (d <= 30) return "próxima";
  return "vigente";
}

/** Paciente "al día" = tiene al menos una vacuna y ninguna vencida. */
export function isUpToDate(p: Patient) {
  return p.vaccines.length > 0 && p.vaccines.every((v) => vaccineState(v) !== "vencida");
}

export function coverage(list: Patient[]) {
  const withRecord = list.filter((p) => p.vaccines.length > 0);
  if (withRecord.length === 0) return 0;
  return Math.round((withRecord.filter(isUpToDate).length / withRecord.length) * 100);
}

export type DueVaccine = { patient: Patient; vaccine: Vaccine; state: VaccineState; days: number };

/** Vacunas vencidas o por vencer (≤ 30 días), más urgentes primero. */
export function dueVaccines(list: Patient[]): DueVaccine[] {
  return list
    .flatMap((patient) =>
      patient.vaccines
        .map((vaccine) => ({ patient, vaccine, state: vaccineState(vaccine), days: daysUntil(vaccine.nextDose ?? "") }))
        .filter((d) => d.state !== "vigente")
    )
    .sort((a, b) => a.days - b.days);
}

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["Dermatológico", /derma|alopecia|piel|pulga/i],
  ["Digestivo", /gastro|estasis|digest|vómit/i],
  ["Osteoarticular", /displasia|artrosis|cadera|cojera/i],
  ["Respiratorio", /respirat|braquic|tos/i],
  ["Dental", /dental|periodont|incisivo/i],
  ["Renal / urinario", /renal|urin/i],
  ["Cardiológico", /card|soplo/i],
  ["Endocrino", /tiroid/i],
];

export function diagnosisCategory(diagnosis: string) {
  return CATEGORY_KEYWORDS.find(([, re]) => re.test(diagnosis))?.[0] ?? "Preventivo / sano";
}

/** Mascotas visibles con al menos un diagnóstico de la categoría. */
export function patientsWithCategory(list: Patient[], category: string) {
  return list
    .map((p) => ({ patient: p, hits: p.consultations.filter((c) => diagnosisCategory(c.diagnosis) === category) }))
    .filter((x) => x.hits.length > 0);
}

export function ownerOf(p: Patient) {
  return getOwner(p.ownerRut)!;
}
