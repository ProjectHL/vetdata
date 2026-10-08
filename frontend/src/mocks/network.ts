// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y lib/lookups.
import type { Clinic } from "@/domain/network";

/** Clínicas con pacientes en el prototipo (los pacientes referencian estos nombres). */
export const clinics = [
  "Clínica Vet Providencia",
  "Hospital Veterinario Ñuñoa",
  "VetCare Las Condes",
  "Centro Animal Maipú",
];

// Clínica del usuario que inició sesión.
export const currentClinic = clinics[0];

export const networkClinics: Clinic[] = [
  { name: clinics[0], sector: "Providencia", address: "Av. Providencia 1650", phone: "+56 2 2233 4455", email: "contacto@vetprovidencia.cl", specialties: ["Medicina general", "Dermatología", "Medicina felina"], joinedAt: "2024-03-01", status: "Conectada", lastSync: "07 oct 2026 · 11:02", patients: 1840 },
  { name: clinics[1], sector: "Ñuñoa", address: "Irarrázaval 2890", phone: "+56 2 2274 9900", email: "hola@hvnunoa.cl", specialties: ["Urgencias 24 h", "Cirugía", "Odontología"], joinedAt: "2024-03-01", status: "Conectada", lastSync: "07 oct 2026 · 10:58", patients: 3120 },
  { name: clinics[2], sector: "Las Condes", address: "Apoquindo 5400", phone: "+56 2 2945 1200", email: "atencion@vetcare.cl", specialties: ["Cirugía", "Traumatología", "Exóticos"], joinedAt: "2024-06-15", status: "Conectada", lastSync: "07 oct 2026 · 11:04", patients: 2275 },
  { name: clinics[3], sector: "Maipú", address: "Av. Pajaritos 3100", phone: "+56 2 2531 7788", email: "contacto@centroanimal.cl", specialties: ["Medicina general", "Cardiología", "Imagenología"], joinedAt: "2024-09-10", status: "Conectada", lastSync: "07 oct 2026 · 10:47", patients: 1960 },
  { name: "Clínica Veterinaria Vitacura", sector: "Vitacura", address: "Av. Vitacura 6780", phone: "+56 2 2218 3300", email: "info@vetvitacura.cl", specialties: ["Oncología", "Medicina felina"], joinedAt: "2025-02-20", status: "Conectada", lastSync: "07 oct 2026 · 09:15", patients: 1180 },
  { name: "VetSur La Florida", sector: "La Florida", address: "Vicuña Mackenna 7255", phone: "+56 2 2281 6600", email: "contacto@vetsur.cl", specialties: ["Medicina general", "Vacunatorio"], joinedAt: "2025-07-01", status: "Conectada", lastSync: "06 oct 2026 · 19:40", patients: 2410 },
  { name: "Hospital Veterinario Puente Alto", sector: "Puente Alto", address: "Concha y Toro 1450", phone: "+56 2 2850 4400", email: "hvpa@hvpa.cl", specialties: ["Urgencias 24 h", "Hospitalización"], joinedAt: "2026-01-12", status: "Conectada", lastSync: "07 oct 2026 · 08:30", patients: 2890 },
  { name: "Clínica Costa Viña", sector: "Viña del Mar", address: "Av. Libertad 1100", phone: "+56 32 268 1100", email: "contacto@costavina.cl", specialties: ["Medicina general", "Fisioterapia"], joinedAt: "2026-09-30", status: "Invitación pendiente", lastSync: "—", patients: 0 },
];
