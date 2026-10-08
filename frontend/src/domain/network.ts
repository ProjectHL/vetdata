export type ClinicStatus = "Conectada" | "Invitación pendiente";

export type Clinic = {
  name: string;
  sector: string;
  address: string;
  phone: string;
  email: string;
  specialties: string[];
  joinedAt: string;
  status: ClinicStatus;
  /** Última sincronización con la red (fecha y hora). */
  lastSync: string;
  /** Pacientes registrados (dato referencial de la red). */
  patients: number;
};
