// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import { type Invoice, type InvoiceItem, invoiceTotals } from "@/domain/invoices";

function build(
  id: string,
  folio: number,
  patientId: string,
  ownerRut: string,
  date: string,
  items: InvoiceItem[],
  status: Invoice["status"]
): Invoice {
  return { id, folio, patientId, ownerRut, date, items, ...invoiceTotals(items), status };
}

export const seedInvoices: Invoice[] = [
  build("f01", 10231, "p-001", "16482335-0", "2026-06-12", [
    { description: "Consulta especialidad", qty: 1, unitPrice: 38000 },
    { description: "Radiografía (2 proyecciones)", qty: 1, unitPrice: 42000 },
    { description: "Meloxivet 1,5 mg/ml", qty: 1, unitPrice: 15990 },
  ], "Pagada"),
  build("f02", 10287, "p-002", "13907452-1", "2026-07-01", [
    { description: "Consulta especialidad", qty: 1, unitPrice: 38000 },
    { description: "Perfil bioquímico", qty: 1, unitPrice: 32000 },
  ], "Emitida"),
  build("f03", 10342, "p-003", "19234871-4", "2026-09-28", [
    { description: "Consulta especialidad", qty: 1, unitPrice: 38000 },
    { description: "Hemograma", qty: 1, unitPrice: 22000 },
    { description: "Radiografía (2 proyecciones)", qty: 1, unitPrice: 42000 },
  ], "Pagada"),
  build("f04", 10398, "p-008", "18556013-9", "2026-10-06", [
    { description: "Consulta de urgencia", qty: 1, unitPrice: 45000 },
    { description: "Fluidoterapia", qty: 1, unitPrice: 28000 },
  ], "Emitida"),
  build("f05", 10377, "p-016", "14290186-2", "2026-09-25", [
    { description: "Destartraje dental", qty: 1, unitPrice: 120000 },
    { description: "Clavamox 250 mg", qty: 1, unitPrice: 18990 },
  ], "Pagada"),
];
