/**
 * Tienda: productos para mascotas (alimentos, accesorios, ropa, juguetes…).
 * Dos ubicaciones: la bodega central recibe compras y abastece la sala de ventas;
 * el punto de venta descuenta de la sala.
 */

export type ProductCategory = "Alimentos" | "Snacks" | "Accesorios" | "Ropa" | "Juguetes" | "Higiene" | "Camas y transporte";
export type TargetSpecies = "Perro" | "Gato" | "Ave" | "Conejo" | "Todas";
export type Location = "central" | "sala";

export const LOCATIONS: Record<Location, string> = {
  central: "Bodega central",
  sala: "Sala de ventas",
};

export const CATEGORIES: ProductCategory[] = ["Alimentos", "Snacks", "Accesorios", "Ropa", "Juguetes", "Higiene", "Camas y transporte"];

export type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  species: TargetSpecies;
  /** Precio de venta con IVA (CLP). */
  price: number;
  /** Costo neto de compra (CLP). */
  cost: number;
  stock: Record<Location, number>;
  /** Mínimo total (central + sala) antes de comprar. */
  reorderPoint: number;
  /** Mínimo a mantener exhibido en sala. */
  shelfMin: number;
  supplierId: string;
  /** Pasillo/estante en bodega central. */
  bin: string;
};

export type RetailSupplier = {
  id: string;
  name: string;
  rut: string;
  contact: string;
  phone: string;
  email: string;
  categories: ProductCategory[];
  leadTimeDays: number;
  minOrder: number;
  paymentTerms: string;
};

export type PaymentMethod = "Efectivo" | "Débito" | "Crédito" | "Transferencia";
export const PAYMENT_METHODS: PaymentMethod[] = ["Débito", "Crédito", "Efectivo", "Transferencia"];

export type SaleItem = { productId: string; qty: number; unitPrice: number };

export type SaleChannel = "Mesón" | "Web";

export type Sale = {
  id: string;
  /** N° de boleta. */
  number: number;
  date: string;
  time: string;
  items: SaleItem[];
  ownerRut?: string;
  payment: PaymentMethod;
  /** Costo de despacho (con IVA), 0 si retiro en tienda. */
  deliveryFee: number;
  total: number;
  seller: string;
  channel: SaleChannel;
};

export type ShipmentStatus = "Por preparar" | "Preparado" | "En ruta" | "Entregado";
export const SHIPMENT_FLOW: ShipmentStatus[] = ["Por preparar", "Preparado", "En ruta", "Entregado"];

export type Shipment = {
  id: string;
  saleId: string;
  ownerRut: string;
  address: string;
  sector: string;
  courier: string;
  scheduledFor: string;
  status: ShipmentStatus;
};

export const COURIERS = ["Reparto propio", "Pedidos Ya Envíos", "Chilexpress"];

/** Despacho gratis en la comuna de la clínica; tarifa plana para el resto. */
export function deliveryFee(sector: string) {
  return sector === "Providencia" ? 0 : 3990;
}

export type RetailMovementType = "Entrada" | "Salida" | "Transferencia" | "Ajuste";
export type RetailMovementReason = "Compra" | "Venta" | "Reposición sala" | "Merma" | "Conteo";
export type RetailMovement = {
  id: string;
  date: string;
  productId: string;
  type: RetailMovementType;
  reason: RetailMovementReason;
  /** Ubicación afectada; en transferencias, el destino. */
  location: Location;
  from?: Location;
  qty: number;
  ref?: string;
  user: string;
};

export type RetailOrderStatus = "Borrador" | "Enviada" | "Recibida";
export type RetailOrder = {
  id: string;
  number: number;
  supplierId: string;
  date: string;
  expected: string;
  items: { productId: string; qty: number; unitCost: number }[];
  status: RetailOrderStatus;
  receivedAt?: string;
};

export const IVA = 0.19;

/** IVA incluido en un precio bruto. */
export function ivaIncluded(gross: number) {
  return Math.round(gross - gross / (1 + IVA));
}

export function totalStock(p: Product) {
  return p.stock.central + p.stock.sala;
}

export type StockLevel = "OK" | "Reponer sala" | "Comprar" | "Agotado";

export function stockLevel(p: Product): StockLevel {
  if (totalStock(p) === 0) return "Agotado";
  if (totalStock(p) <= p.reorderPoint) return "Comprar";
  if (p.stock.sala < p.shelfMin) return "Reponer sala";
  return "OK";
}

export function margin(p: Product) {
  const net = p.price / (1 + IVA);
  return Math.round(((net - p.cost) / net) * 100);
}
