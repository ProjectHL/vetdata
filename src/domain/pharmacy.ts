export type MovementType = "Entrada" | "Salida" | "Ajuste";
export type MovementReason =
  | "Compra"
  | "Dispensación"
  | "Venta"
  | "Merma"
  | "Vencimiento"
  | "Transferencia";

export type StockMovement = {
  id: string;
  date: string;
  medicationId: string;
  type: MovementType;
  reason: MovementReason;
  /** Positivo = entra al inventario, negativo = sale. */
  qty: number;
  /** Documento de origen: folio de factura, derivación u orden de compra. */
  ref?: string;
  user: string;
};

export type Supplier = {
  id: string;
  name: string;
  rut: string;
  contact: string;
  phone: string;
  email: string;
  categories: string[];
  leadTimeDays: number;
  paymentTerms: string;
};

export type PurchaseOrderStatus = "Borrador" | "Enviada" | "Recibida";

export type PurchaseOrder = {
  id: string;
  number: number;
  supplierId: string;
  date: string;
  items: { medicationId: string; qty: number; unitCost: number }[];
  status: PurchaseOrderStatus;
  receivedAt?: string;
};

/** Costo de compra estimado = 55% del precio de venta. */
export const COST_RATIO = 0.55;
