// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y lib/lookups.
import { INTERNAL_PHARMACY, type Referral } from "@/domain/referrals";

export const seedReferrals: Referral[] = [
  {
    id: "r01", patientId: "p-002", date: "2026-07-01", doctorId: "d6", destination: "Hospital Veterinario Ñuñoa",
    items: [{ medicationId: "m17", dose: "1/2 comprimido", frequency: "Cada 24 h", duration: "Indefinido", qty: 2 }],
    notes: "Paciente renal. Mantener dieta renal.", status: "Recibida",
  },
  {
    id: "r02", patientId: "p-005", date: "2026-10-06", doctorId: "d5", destination: INTERNAL_PHARMACY,
    items: [
      { medicationId: "m16", dose: "0,25 mg/kg", frequency: "Cada 12 h", duration: "Indefinido", qty: 1 },
      { medicationId: "m10", dose: "10 mg/kg", frequency: "Cada 12 h", duration: "30 días", qty: 2 },
    ],
    notes: "", status: "Enviada",
  },
  {
    id: "r03", patientId: "p-008", date: "2026-10-07", doctorId: "d1", destination: INTERNAL_PHARMACY,
    items: [
      { medicationId: "m18", dose: "0,5 mg/kg", frequency: "Cada 8 h", duration: "3 días", qty: 1 },
      { medicationId: "m19", dose: "1 mg/kg", frequency: "Cada 24 h", duration: "4 días", qty: 1 },
    ],
    notes: "Entregar al dueño con indicaciones de ayuno.", status: "Enviada",
  },
];
