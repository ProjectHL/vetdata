/** Bloques de agenda de 30 minutos, 09:00–18:30. */
export const SLOTS = Array.from({ length: 20 }, (_, i) => {
  const min = 9 * 60 + i * 30;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
});

export type AppointmentStatus = "Agendada" | "Confirmada" | "Realizada" | "Cancelada" | "No asistió";

export type Appointment = {
  id: string;
  patientId: string;
  date: string;
  time: string;
  doctorId: string;
  roomId?: string;
  reason: string;
  status: AppointmentStatus;
};
