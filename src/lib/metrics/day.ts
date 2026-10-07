import type { Appointment } from "@/domain/appointments";
import type { Room } from "@/domain/clinic";
import type { AccessEntry, WaitingEntry } from "@/domain/security";
import { NOW_TIME, TODAY, minutesSince } from "@/lib/format";

export type AppointmentStage = "Por llegar" | "En espera" | "En box" | "Realizada" | "Cancelada" | "No asistió";

export function todayAppointments(appointments: Appointment[], date = TODAY) {
  return appointments.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Etapa real de una cita cruzando agenda, sala de espera (Seguridad) y mapa de boxes (Actividad).
 */
export function appointmentStage(appt: Appointment, waiting: WaitingEntry[], rooms: Room[]): AppointmentStage {
  if (appt.status === "Cancelada") return "Cancelada";
  if (appt.status === "No asistió") return "No asistió";
  if (appt.status === "Realizada") return "Realizada";
  if (waiting.some((w) => w.appointmentId === appt.id)) return "En espera";
  // En box: el paciente ocupa un box ahora y la cita es de la próxima hora (no una cita posterior del mismo día).
  if (
    appt.date === TODAY &&
    -minutesSince(appt.time, NOW_TIME) <= 60 &&
    rooms.some((r) => r.status === "ocupado" && r.patientId === appt.patientId)
  )
    return "En box";
  return "Por llegar";
}

/** Citas de hoy activas que aún no registran ingreso en el hall ni están en la sala de espera. */
export function expectedArrivals(appointments: Appointment[], access: AccessEntry[], waiting: WaitingEntry[], rooms: Room[]) {
  const arrived = new Set([...access.map((a) => a.appointmentId), ...waiting.map((w) => w.appointmentId)].filter(Boolean));
  return todayAppointments(appointments).filter(
    (a) =>
      (a.status === "Agendada" || a.status === "Confirmada") &&
      !arrived.has(a.id) &&
      appointmentStage(a, waiting, rooms) === "Por llegar"
  );
}

export const stageStyle: Record<AppointmentStage, string> = {
  "Por llegar": "border-border bg-card",
  "En espera": "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
  "En box": "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40",
  Realizada: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
  Cancelada: "border-dashed bg-muted/40 text-muted-foreground line-through",
  "No asistió": "border-dashed bg-muted/40 text-muted-foreground",
};
