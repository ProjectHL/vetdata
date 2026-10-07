import { type Medication, expiryStatus, stockStatus } from "@/domain/medications";
import { COST_RATIO, type StockMovement } from "@/domain/pharmacy";
import { INTERNAL_PHARMACY, type Referral } from "@/domain/referrals";
import { TODAY, addDays, daysUntil } from "@/lib/format";

export function pharmacyKpis(medications: Medication[], referrals: Referral[]) {
  return {
    lowStock: medications.filter((m) => stockStatus(m) !== "Disponible").length,
    pendingDispense: referrals.filter((r) => r.destination === INTERNAL_PHARMACY && r.status !== "Dispensada").length,
  };
}

export type MedicationTurnover = {
  medication: Medication;
  out30: number;
  /** Veces que rota el stock en 30 días. */
  rotation: number;
  /** Días que alcanza el stock al ritmo de los últimos 30 días (null = sin salidas). */
  coverageDays: number | null;
};

/** Rotación y cobertura con las salidas (dispensación + venta) de los últimos 30 días. */
export function medicationTurnover(medications: Medication[], movements: StockMovement[]): MedicationTurnover[] {
  const from = addDays(TODAY, -30);
  return medications
    .map((medication) => {
      const out30 = movements
        .filter((m) => m.medicationId === medication.id && m.type === "Salida" && m.date >= from)
        .reduce((s, m) => s - m.qty, 0);
      const avgStock = (medication.stock + (medication.stock + out30)) / 2;
      return {
        medication,
        out30,
        rotation: avgStock > 0 ? Math.round((out30 / avgStock) * 10) / 10 : 0,
        coverageDays: out30 > 0 ? Math.round(medication.stock / (out30 / 30)) : null,
      };
    })
    .sort((a, b) => b.out30 - a.out30);
}

/** Medicamentos que vencen en ≤ 60 días, valorizados a costo. */
export function expiringValue(medications: Medication[]) {
  const list = medications
    .filter((m) => expiryStatus(m) !== "ok" && m.stock > 0)
    .map((m) => ({ medication: m, days: daysUntil(m.expiry), value: m.stock * Math.round(m.price * COST_RATIO) }))
    .sort((a, b) => a.days - b.days);
  return { list, total: list.reduce((s, x) => s + x.value, 0) };
}
