// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y lib/lookups.
import type { Doctor, Room } from "@/domain/clinic";

export const doctors: Doctor[] = [
  { id: "d1", name: "Dra. Paula Rivas", specialty: "Medicina general", initials: "PR" },
  { id: "d2", name: "Dr. Tomás Herrera", specialty: "Cirugía", initials: "TH" },
  { id: "d3", name: "Dra. Javiera Lagos", specialty: "Dermatología", initials: "JL" },
  { id: "d4", name: "Dr. Andrés Molina", specialty: "Traumatología", initials: "AM" },
  { id: "d5", name: "Dra. Catalina Vera", specialty: "Imagenología", initials: "CV" },
  { id: "d6", name: "Dr. Ignacio Paredes", specialty: "Medicina felina", initials: "IP" },
];

export const rooms: Room[] = [
  { id: "recepcion", name: "Recepción", kind: "comun", span: 2, status: "disponible", note: "2 recepcionistas en turno" },
  { id: "espera", name: "Sala de espera", kind: "comun", span: 2, status: "disponible", note: "Coco, Pimienta y Bruno en espera" },
  { id: "box-1", name: "Box 1", kind: "box", span: 1, status: "ocupado", doctorId: "d1", patientId: "p-001", since: "10:40" },
  { id: "box-2", name: "Box 2", kind: "box", span: 1, status: "limpieza", since: "10:58" },
  { id: "box-3", name: "Box 3", kind: "box", span: 1, status: "ocupado", doctorId: "d3", patientId: "p-004", since: "10:20" },
  { id: "box-4", name: "Box 4", kind: "box", span: 1, status: "disponible" },
  { id: "box-5", name: "Box 5", kind: "box", span: 1, status: "ocupado", doctorId: "d6", patientId: "p-002", since: "10:50" },
  { id: "box-6", name: "Box 6", kind: "box", span: 1, status: "disponible" },
  { id: "rayos", name: "Rayos X", kind: "imagen", span: 1, status: "ocupado", doctorId: "d5", patientId: "p-005", since: "10:35" },
  { id: "laboratorio", name: "Laboratorio", kind: "laboratorio", span: 1, status: "limpieza", since: "11:00" },
  { id: "quirofano", name: "Quirófano", kind: "quirofano", span: 2, status: "ocupado", doctorId: "d2", patientId: "p-003", since: "09:30" },
  { id: "hospitalizacion", name: "Hospitalización", kind: "hospitalizacion", span: 2, status: "disponible", note: "4 de 8 jaulas ocupadas" },
];
