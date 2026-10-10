// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import type { PurchaseOrder, StockMovement, Supplier } from "@/domain/pharmacy";

export const suppliers: Supplier[] = [
  { id: "sp1", name: "Drag Pharma Chile", rut: "96.512.300-4", contact: "Carolina Méndez", phone: "+56 2 2490 1100", email: "ventas@dragpharma.cl", categories: ["Antibiótico", "Antiinflamatorio", "Gastrointestinal"], leadTimeDays: 2, paymentTerms: "30 días" },
  { id: "sp2", name: "Agrovet Distribuidora", rut: "77.845.120-9", contact: "Héctor Salinas", phone: "+56 2 2733 5500", email: "pedidos@agrovet.cl", categories: ["Antiparasitario"], leadTimeDays: 3, paymentTerms: "Contado" },
  { id: "sp3", name: "Anestesia Vet SpA", rut: "76.210.884-K", contact: "Patricio Lobos", phone: "+56 2 2366 0900", email: "contacto@anestesiavet.cl", categories: ["Analgésico", "Anestésico"], leadTimeDays: 5, paymentTerms: "45 días" },
  { id: "sp4", name: "BioVac Laboratorios", rut: "99.587.430-1", contact: "Daniela Fuentes", phone: "+56 2 2810 7400", email: "biologicos@biovac.cl", categories: ["Vacuna"], leadTimeDays: 7, paymentTerms: "30 días" },
  { id: "sp5", name: "CardioPet Importaciones", rut: "77.301.556-2", contact: "Ricardo Zúñiga", phone: "+56 2 2590 3322", email: "ventas@cardiopet.cl", categories: ["Cardiológico"], leadTimeDays: 10, paymentTerms: "60 días" },
];

export const seedPurchaseOrders: PurchaseOrder[] = [
  { id: "oc1", number: 2041, supplierId: "sp1", date: "2026-09-22", items: [{ medicationId: "m01", qty: 30, unitCost: 10400 }, { medicationId: "m18", qty: 10, unitCost: 4400 }], status: "Recibida", receivedAt: "2026-09-24" },
  { id: "oc2", number: 2048, supplierId: "sp4", date: "2026-10-03", items: [{ medicationId: "m13", qty: 30, unitCost: 9300 }], status: "Enviada" },
  { id: "oc3", number: 2052, supplierId: "sp2", date: "2026-10-06", items: [{ medicationId: "m04", qty: 12, unitCost: 22000 }], status: "Borrador" },
];

const U = { rivas: "Dra. Paula Rivas", farmacia: "Marcela Toro (Farmacia)", herrera: "Dr. Tomás Herrera", paredes: "Dr. Ignacio Paredes" };

export const seedMovements: StockMovement[] = [
  { id: "mv01", date: "2026-09-08", medicationId: "m06", type: "Entrada", reason: "Compra", qty: 40, ref: "OC 2033", user: U.farmacia },
  { id: "mv02", date: "2026-09-09", medicationId: "m13", type: "Salida", reason: "Dispensación", qty: -6, user: U.rivas },
  { id: "mv03", date: "2026-09-10", medicationId: "m11", type: "Salida", reason: "Dispensación", qty: -4, ref: "Cirugía", user: U.herrera },
  { id: "mv04", date: "2026-09-12", medicationId: "m04", type: "Salida", reason: "Venta", qty: -5, ref: "Factura 10301", user: U.farmacia },
  { id: "mv05", date: "2026-09-13", medicationId: "m07", type: "Salida", reason: "Venta", qty: -3, ref: "Factura 10305", user: U.farmacia },
  { id: "mv06", date: "2026-09-15", medicationId: "m14", type: "Salida", reason: "Dispensación", qty: -8, user: U.rivas },
  { id: "mv07", date: "2026-09-16", medicationId: "m03", type: "Salida", reason: "Venta", qty: -4, ref: "Factura 10312", user: U.farmacia },
  { id: "mv08", date: "2026-09-17", medicationId: "m15", type: "Ajuste", reason: "Vencimiento", qty: -5, user: U.farmacia },
  { id: "mv09", date: "2026-09-18", medicationId: "m02", type: "Salida", reason: "Dispensación", qty: -4, user: U.paredes },
  { id: "mv10", date: "2026-09-19", medicationId: "m19", type: "Salida", reason: "Venta", qty: -3, ref: "Factura 10320", user: U.farmacia },
  { id: "mv11", date: "2026-09-20", medicationId: "m10", type: "Salida", reason: "Dispensación", qty: -2, user: U.rivas },
  { id: "mv12", date: "2026-09-22", medicationId: "m05", type: "Salida", reason: "Venta", qty: -4, ref: "Factura 10333", user: U.farmacia },
  { id: "mv13", date: "2026-09-24", medicationId: "m01", type: "Entrada", reason: "Compra", qty: 30, ref: "OC 2041", user: U.farmacia },
  { id: "mv14", date: "2026-09-24", medicationId: "m18", type: "Entrada", reason: "Compra", qty: 10, ref: "OC 2041", user: U.farmacia },
  { id: "mv15", date: "2026-09-25", medicationId: "m01", type: "Salida", reason: "Venta", qty: -2, ref: "Factura 10377", user: U.farmacia },
  { id: "mv16", date: "2026-09-26", medicationId: "m12", type: "Salida", reason: "Dispensación", qty: -1, ref: "Cirugía", user: U.herrera },
  { id: "mv17", date: "2026-09-27", medicationId: "m08", type: "Ajuste", reason: "Merma", qty: -2, user: U.farmacia },
  { id: "mv18", date: "2026-09-29", medicationId: "m02", type: "Salida", reason: "Dispensación", qty: -2, user: U.paredes },
  { id: "mv19", date: "2026-09-30", medicationId: "m09", type: "Salida", reason: "Dispensación", qty: -2, ref: "Cirugía", user: U.herrera },
  { id: "mv20", date: "2026-10-01", medicationId: "m13", type: "Salida", reason: "Dispensación", qty: -5, user: U.rivas },
  { id: "mv21", date: "2026-10-02", medicationId: "m06", type: "Salida", reason: "Venta", qty: -6, ref: "Factura 10385", user: U.farmacia },
  { id: "mv22", date: "2026-10-03", medicationId: "m14", type: "Entrada", reason: "Transferencia", qty: 5, ref: "Desde Hospital Veterinario Ñuñoa", user: U.farmacia },
  { id: "mv23", date: "2026-10-05", medicationId: "m16", type: "Salida", reason: "Dispensación", qty: -1, user: U.rivas },
  { id: "mv24", date: "2026-10-06", medicationId: "m18", type: "Salida", reason: "Dispensación", qty: -2, ref: "Coco", user: U.rivas },
  { id: "mv25", date: "2026-10-07", medicationId: "m11", type: "Salida", reason: "Dispensación", qty: -3, ref: "Cirugía Rocky", user: U.herrera },
];
