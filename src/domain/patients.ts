import { ageFrom } from "@/lib/format";

export type Species = "Perro" | "Gato" | "Ave" | "Conejo";
export type PatientStatus = "Al día" | "Control" | "Urgente";

export type Consultation = {
  date: string;
  clinic: string;
  doctor: string;
  reason: string;
  diagnosis: string;
  treatment: string;
};

export type Vaccine = { name: string; date: string; nextDose?: string };
export type Exam = { date: string; name: string; result: string; clinic: string };
export type Prescription = { date: string; drug: string; dose: string; duration: string; doctor: string };

export type Patient = {
  id: string;
  name: string;
  species: Species;
  breed: string;
  sex: "Macho" | "Hembra";
  birthDate: string;
  color: string;
  sterilized: boolean;
  weightKg: number;
  chip: string;
  ownerRut: string;
  clinic: string;
  status: PatientStatus;
  allergies: string[];
  conditions: string[];
  consultations: Consultation[];
  vaccines: Vaccine[];
  exams: Exam[];
  prescriptions: Prescription[];
};

/** Fecha de la última consulta registrada ("" si no tiene). */
export function lastVisit(p: Patient) {
  return p.consultations.reduce((max, c) => (c.date > max ? c.date : max), "");
}

export function patientAge(p: Patient) {
  return ageFrom(p.birthDate);
}
