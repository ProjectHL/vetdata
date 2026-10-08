// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y lib/lookups.
import type { Service } from "@/domain/services";

/** Prestaciones facturables (precios netos en CLP). */
export const services: Service[] = [
  { id: "s01", name: "Consulta general", price: 25000 },
  { id: "s02", name: "Consulta especialidad", price: 38000 },
  { id: "s03", name: "Control", price: 15000 },
  { id: "s04", name: "Consulta de urgencia", price: 45000 },
  { id: "s05", name: "Aplicación de vacuna", price: 8000 },
  { id: "s06", name: "Hemograma", price: 22000 },
  { id: "s07", name: "Perfil bioquímico", price: 32000 },
  { id: "s08", name: "Radiografía (2 proyecciones)", price: 42000 },
  { id: "s09", name: "Ecografía abdominal", price: 48000 },
  { id: "s10", name: "Cirugía menor", price: 180000 },
  { id: "s11", name: "Cirugía mayor", price: 450000 },
  { id: "s12", name: "Hospitalización (día)", price: 55000 },
  { id: "s13", name: "Destartraje dental", price: 120000 },
  { id: "s14", name: "Fluidoterapia", price: 28000 },
];
