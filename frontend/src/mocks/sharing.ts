// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import type { AccessGrant, AccessRequest } from "@/domain/sharing";
import { clinics } from "./network";

const [providencia, nunoa, lasCondes, maipu] = clinics;

export const seedGrants: AccessGrant[] = [
  // Compartidos CON Providencia (pacientes que ya atiende en el mapa de Actividad)
  { id: "g01", patientId: "p-002", ownerClinic: nunoa, grantedTo: providencia, scope: "Ficha completa", since: "2026-07-01", until: null, revoked: false },
  { id: "g02", patientId: "p-003", ownerClinic: lasCondes, grantedTo: providencia, scope: "Ficha completa", since: "2026-09-28", until: "2026-12-27", revoked: false },
  { id: "g03", patientId: "p-005", ownerClinic: maipu, grantedTo: providencia, scope: "Ficha completa", since: "2026-08-14", until: "2026-11-12", revoked: false },
  { id: "g04", patientId: "p-016", ownerClinic: nunoa, grantedTo: providencia, scope: "Resumen clínico", since: "2026-09-20", until: "2026-12-19", revoked: false },
  // Compartidos POR Providencia
  { id: "g05", patientId: "p-001", ownerClinic: providencia, grantedTo: lasCondes, scope: "Ficha completa", since: "2026-06-12", until: "2026-12-31", revoked: false },
  { id: "g06", patientId: "p-008", ownerClinic: providencia, grantedTo: nunoa, scope: "Resumen clínico", since: "2026-08-01", until: "2026-08-31", revoked: false },
  { id: "g07", patientId: "p-010", ownerClinic: providencia, grantedTo: maipu, scope: "Resumen clínico", since: "2026-04-02", until: null, revoked: false },
];

export const seedRequests: AccessRequest[] = [
  // Recibidas (otras clínicas piden pacientes de Providencia)
  { id: "q01", patientId: "p-001", ownerRut: "16482335-0", from: nunoa, to: providencia, requestedBy: "Dr. Rodrigo Saavedra", date: "2026-10-06", reason: "Consulta de urgencia, requiere antecedentes de alergias.", scope: "Resumen clínico", duration: 30, status: "Pendiente" },
  { id: "q02", patientId: "p-010", ownerRut: "15620948-1", from: lasCondes, to: providencia, requestedBy: "Dra. Macarena Ortiz", date: "2026-10-05", reason: "Segunda opinión endocrinológica.", scope: "Ficha completa", duration: 90, status: "Pendiente" },
  { id: "q03", patientId: "p-008", ownerRut: "18556013-9", from: nunoa, to: providencia, requestedBy: "Dr. Rodrigo Saavedra", date: "2026-10-07", reason: "Renovación de acceso: control de estasis GI.", scope: "Ficha completa", duration: 30, status: "Pendiente" },
  { id: "q04", patientId: "p-004", ownerRut: "15620948-1", from: maipu, to: providencia, requestedBy: "Dr. Andrés Molina", date: "2026-09-12", reason: "Vacunación en sucursal cercana al trabajo del dueño.", scope: "Resumen clínico", duration: 30, status: "Rechazada", respondedAt: "2026-09-13" },
  // Enviadas (Providencia pide pacientes de otras clínicas)
  { id: "q05", patientId: "p-007", ownerRut: "17398220-8", from: providencia, to: lasCondes, requestedBy: "Dra. Paula Rivas", date: "2026-10-06", reason: "Dueña se cambió de clínica.", scope: "Ficha completa", duration: null, status: "Pendiente" },
  { id: "q06", patientId: "p-012", ownerRut: "11873264-2", from: providencia, to: maipu, requestedBy: "Dra. Paula Rivas", date: "2026-10-07", reason: "Atención junto a Toby.", scope: "Resumen clínico", duration: 90, status: "Pendiente" },
  { id: "q07", patientId: "p-006", ownerRut: "20145637-1", from: providencia, to: nunoa, requestedBy: "Dr. Ignacio Paredes", date: "2026-09-02", reason: "Control de rutina.", scope: "Ficha completa", duration: 30, status: "Rechazada", respondedAt: "2026-09-03" },
];
