export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  initials: string;
};

export type RoomStatus = "ocupado" | "limpieza" | "disponible";
export type RoomKind = "box" | "quirofano" | "imagen" | "laboratorio" | "hospitalizacion" | "comun";

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  /** Ancho en la grilla del plano (columnas en sm+). */
  span: 1 | 2;
  status: RoomStatus;
  doctorId?: string;
  patientId?: string;
  /** Hora de inicio del estado actual (HH:mm). */
  since?: string;
  note?: string;
};
