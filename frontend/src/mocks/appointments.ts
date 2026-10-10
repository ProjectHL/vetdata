// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import type { Appointment } from "@/domain/appointments";

export const seedAppointments: Appointment[] = [
  { id: "a01", patientId: "p-001", date: "2026-10-14", time: "10:00", doctorId: "d4", roomId: "box-4", reason: "Control de cadera", status: "Confirmada" },
  { id: "a02", patientId: "p-002", date: "2027-01-07", time: "11:30", doctorId: "d6", roomId: "box-5", reason: "Control renal trimestral", status: "Agendada" },
  { id: "a03", patientId: "p-003", date: "2026-10-09", time: "09:30", doctorId: "d2", roomId: "box-1", reason: "Control post operatorio", status: "Confirmada" },
  { id: "a04", patientId: "p-004", date: "2026-10-22", time: "16:00", doctorId: "d3", roomId: "box-3", reason: "Control dermatológico", status: "Agendada" },
  { id: "a05", patientId: "p-008", date: "2026-10-08", time: "09:00", doctorId: "d1", roomId: "box-1", reason: "Control estasis GI", status: "Confirmada" },
  { id: "a06", patientId: "p-005", date: "2026-10-07", time: "15:00", doctorId: "d4", roomId: "box-6", reason: "Control cardiológico", status: "Confirmada" },
  { id: "a07", patientId: "p-015", date: "2026-10-12", time: "12:00", doctorId: "d1", roomId: "box-2", reason: "Segunda dosis óctuple", status: "Agendada" },
  { id: "a08", patientId: "p-001", date: "2026-06-12", time: "10:30", doctorId: "d4", roomId: "box-3", reason: "Cojera", status: "Realizada" },
  // Historial del último mes (para tasas de cancelación y no asistencia)
  { id: "a09", patientId: "p-009", date: "2026-09-08", time: "10:00", doctorId: "d6", roomId: "box-5", reason: "Control anual", status: "Realizada" },
  { id: "a10", patientId: "p-010", date: "2026-09-30", time: "12:00", doctorId: "d1", roomId: "box-1", reason: "Control tiroides", status: "Realizada" },
  { id: "a11", patientId: "p-004", date: "2026-09-18", time: "16:30", doctorId: "d3", roomId: "box-3", reason: "Revisión piel", status: "No asistió" },
  { id: "a12", patientId: "p-011", date: "2026-09-22", time: "11:00", doctorId: "d1", roomId: "box-2", reason: "Limado dental", status: "Cancelada" },
  { id: "a13", patientId: "p-002", date: "2026-09-25", time: "09:30", doctorId: "d6", roomId: "box-5", reason: "Control renal", status: "Realizada" },
  { id: "a14", patientId: "p-008", date: "2026-10-06", time: "18:00", doctorId: "d1", roomId: "box-1", reason: "Urgencia", status: "Realizada" },
  { id: "a15", patientId: "p-001", date: "2026-10-02", time: "15:00", doctorId: "d2", roomId: "box-4", reason: "Evaluación", status: "No asistió" },
  { id: "a16", patientId: "p-003", date: "2026-10-03", time: "10:30", doctorId: "d2", roomId: "box-1", reason: "Prequirúrgico", status: "Realizada" },
  { id: "a17", patientId: "p-005", date: "2026-10-05", time: "12:30", doctorId: "d5", roomId: "box-6", reason: "Imagenología", status: "Cancelada" },
  { id: "a18", patientId: "p-009", date: "2026-10-09", time: "11:30", doctorId: "d6", roomId: "box-5", reason: "Vacuna", status: "Agendada" },
  { id: "a19", patientId: "p-010", date: "2026-10-10", time: "10:00", doctorId: "d1", roomId: "box-2", reason: "Control", status: "Confirmada" },
  // Hoy: pacientes en sala de espera y llegadas esperadas
  { id: "a21", patientId: "p-009", date: "2026-10-07", time: "11:30", doctorId: "d6", roomId: "box-6", reason: "Control anual", status: "Confirmada" },
  { id: "a22", patientId: "p-010", date: "2026-10-07", time: "11:00", doctorId: "d4", roomId: "box-4", reason: "Control tiroides", status: "Confirmada" },
  { id: "a23", patientId: "p-008", date: "2026-10-07", time: "11:15", doctorId: "d1", roomId: "box-2", reason: "Control estasis GI", status: "Confirmada" },
  { id: "a24", patientId: "p-011", date: "2026-10-07", time: "12:00", doctorId: "d1", roomId: "box-2", reason: "Revisión dental", status: "Agendada" },
  { id: "a25", patientId: "p-016", date: "2026-10-07", time: "12:30", doctorId: "d2", roomId: "box-4", reason: "Control post destartraje", status: "Confirmada" },
  { id: "a20", patientId: "p-004", date: "2026-10-08", time: "16:00", doctorId: "d3", roomId: "box-3", reason: "Reprogramada", status: "Confirmada" },
];
