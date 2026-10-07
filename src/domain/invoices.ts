import { IVA_RATE } from "./services";

export type InvoiceItem = { description: string; qty: number; unitPrice: number; medicationId?: string };

export type InvoiceStatus = "Emitida" | "Pagada";

export type Invoice = {
  id: string;
  folio: number;
  patientId: string;
  ownerRut: string;
  date: string;
  items: InvoiceItem[];
  net: number;
  iva: number;
  total: number;
  status: InvoiceStatus;
};

/** Neto, IVA (19 %) y total de una factura a partir de sus líneas. */
export function invoiceTotals(items: InvoiceItem[]): Pick<Invoice, "net" | "iva" | "total"> {
  const net = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const iva = Math.round(net * IVA_RATE);
  return { net, iva, total: net + iva };
}
