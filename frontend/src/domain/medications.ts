import { TODAY, daysUntil } from "@/lib/format";

export type MedCategory =
  | "Antibiótico"
  | "Antiparasitario"
  | "Antiinflamatorio"
  | "Analgésico"
  | "Anestésico"
  | "Vacuna"
  | "Cardiológico"
  | "Gastrointestinal";

export type Medication = {
  id: string;
  name: string;
  activeIngredient: string;
  category: MedCategory;
  presentation: string;
  stock: number;
  minStock: number;
  unit: string;
  expiry: string;
  lot: string;
  prescription: boolean;
  /** Precio de venta unitario en CLP. */
  price: number;
  /** Costo unitario persistido por la API; ausente en la semilla histórica. */
  unitCost?: number;
  /** Proveedor habitual. */
  supplierId: string;
  /** Lotes persistidos; la demo antigua solo tenía un lote resumido. */
  lots?: { id: string; lot: string; expiry: string | null; qty: number; location: string }[];
};

export type StockStatus = "Disponible" | "Stock bajo" | "Sin stock";

export function stockStatus(m: Medication): StockStatus {
  if (m.stock === 0) return "Sin stock";
  if (m.stock < m.minStock) return "Stock bajo";
  return "Disponible";
}

export type ExpiryStatus = "vencido" | "por vencer" | "ok";

export const EXPIRY_WARNING_DAYS = 60;

export function expiryStatus(m: Medication, today = TODAY): ExpiryStatus {
  if (!m.expiry) return "ok";
  const days = daysUntil(m.expiry, today);
  if (days < 0) return "vencido";
  if (days <= EXPIRY_WARNING_DAYS) return "por vencer";
  return "ok";
}
