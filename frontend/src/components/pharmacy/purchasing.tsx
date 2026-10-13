"use client";

import { Fragment, useState } from "react";
import { Clock, Mail, PackagePlus, Phone, Send, Truck } from "lucide-react";
import { Guard } from "@/components/settings/guard";
import { Field } from "@/components/care-actions/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Medication, stockStatus } from "@/domain/medications";
import { COST_RATIO, type PurchaseOrder, type PurchaseOrderStatus } from "@/domain/pharmacy";
import { formatCLP, formatDate, useToday } from "@/lib/format";
import { useSuppliers } from "@/lib/server-state";
import { useStore } from "@/lib/store";
import { dataSource } from "@/services";

/** Cantidad sugerida: reponer hasta el doble del mínimo. */
function suggestedQty(m: Medication) {
  return Math.max(0, m.minStock * 2 - m.stock);
}

const statusVariant: Record<PurchaseOrderStatus, "default" | "secondary" | "outline"> = {
  Borrador: "outline",
  Enviada: "secondary",
  "Parcialmente recibida": "secondary",
  Recibida: "default",
};

export function RestockSuggestions() {
  const { medications, purchaseOrders, createPurchaseOrder } = useStore();
  const suppliers = useSuppliers();
  const [notice, setNotice] = useState("");

  // Medicamentos ya pedidos en una OC abierta no se vuelven a sugerir.
  const onOrder = new Set(
    purchaseOrders.filter((o) => o.status !== "Recibida").flatMap((o) => o.items.map((i) => i.medicationId))
  );
  const low = medications.filter((m) => stockStatus(m) !== "Disponible" && !onOrder.has(m.id));
  const bySupplier = suppliers
    .map((s) => ({ supplier: s, meds: low.filter((m) => m.supplierId === s.id) }))
    .filter((g) => g.meds.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sugerencia de reposición</CardTitle>
        <CardDescription>
          Medicamentos bajo el stock mínimo, agrupados por proveedor habitual. Se sugiere reponer hasta el doble del mínimo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}
        {bySupplier.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Todo el inventario está sobre el mínimo o ya pedido.</p>
        )}
        {bySupplier.map(({ supplier, meds }) => {
          const total = meds.reduce((sum, m) => sum + suggestedQty(m) * (m.unitCost ?? Math.round(m.price * COST_RATIO)), 0);
          return (
            <div key={supplier.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{supplier.name}</p>
                  {(supplier.leadTimeDays > 0 || supplier.paymentTerms) && <p className="text-xs text-muted-foreground">
                    {supplier.leadTimeDays > 0 && `Entrega en ${supplier.leadTimeDays} días`}{supplier.leadTimeDays > 0 && supplier.paymentTerms && " · "}{supplier.paymentTerms && `pago ${supplier.paymentTerms.toLowerCase()}`}
                  </p>}
                </div>
                <Guard permission="farmacia.inventario">
                  <Button
                    size="sm"
                    onClick={() => {
                      const oc = createPurchaseOrder(
                        supplier.id,
                        meds.map((m) => ({ medicationId: m.id, qty: suggestedQty(m) }))
                      );
                      setNotice(`Orden de compra N° ${oc.number} creada en borrador para ${supplier.name}.`);
                    }}
                  >
                    <PackagePlus /> Generar orden · {formatCLP(total)}
                  </Button>
                </Guard>
              </div>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {meds.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2 rounded-md bg-muted/60 px-3 py-1.5">
                    <span className="truncate">{m.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {m.stock}/{m.minStock} → pedir <strong className="text-foreground">{suggestedQty(m)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function PurchaseOrders() {
  const { purchaseOrders, medications, sendPurchaseOrder, receivePurchaseOrder } = useStore();
  const suppliers = useSuppliers();
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const rows = [...purchaseOrders].sort((a, b) => b.number - a.number);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Órdenes de compra</CardTitle>
        <CardDescription>Borrador → Enviada → Recibida. La API admite recepciones parciales con lote y vencimiento por medicamento.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="text-right">Total neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => {
              const total = o.items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium tabular-nums">{o.number}</TableCell>
                  <TableCell>{suppliers.find((s) => s.id === o.supplierId)?.name}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(o.date)}
                    {o.receivedAt && <span className="block text-xs text-muted-foreground">Recibida {formatDate(o.receivedAt)}</span>}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    {o.items.map((i) => (
                      <Fragment key={i.medicationId}>
                        {i.qty} × {medications.find((m) => m.id === i.medicationId)?.name}
                        <br />
                      </Fragment>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(total)}</TableCell>
                  <TableCell><Badge variant={statusVariant[o.status]}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {o.status === "Borrador" && (
                      <Guard permission="farmacia.inventario">
                        <Button size="sm" variant="outline" onClick={() => sendPurchaseOrder(o.id)}><Send /> Enviar</Button>
                      </Guard>
                    )}
                    {(o.status === "Enviada" || o.status === "Parcialmente recibida") && (
                      <Guard permission="farmacia.inventario">
                        <Button size="sm" onClick={() => dataSource === "mock" ? void receivePurchaseOrder(o.id) : setReceiving(o)}><Truck /> Recibir</Button>
                      </Guard>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ReceiveOrderDialog order={receiving} medications={medications} onClose={() => setReceiving(null)} onReceive={receivePurchaseOrder} />
      </CardContent>
    </Card>
  );
}

function ReceiveOrderDialog({ order, medications, onClose, onReceive }: {
  order: PurchaseOrder | null;
  medications: Medication[];
  onClose: () => void;
  onReceive: (id: string, items: { medicationId: string; qty: number; lot: string; expiry: string }[]) => Promise<void>;
}) {
  const today = useToday();
  const [values, setValues] = useState<Record<string, { qty: number; lot: string; expiry: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = order?.items.filter((item) => (item.pending ?? item.qty) > 0) ?? [];
  const lines = pending.map((item) => ({
    medicationId: item.medicationId,
    qty: values[item.medicationId]?.qty ?? (item.pending ?? item.qty),
    lot: values[item.medicationId]?.lot ?? "",
    expiry: values[item.medicationId]?.expiry ?? "",
  }));
  const valid = lines.length > 0 && lines.every((line) => {
    const item = pending.find((candidate) => candidate.medicationId === line.medicationId)!;
    return Number.isInteger(line.qty) && line.qty > 0 && line.qty <= (item.pending ?? item.qty) && line.lot.trim().length > 0 && line.lot.length <= 120 && line.expiry >= today;
  });
  const update = (id: string, patch: Partial<{ qty: number; lot: string; expiry: string }>, max: number) => {
    setValues((prev) => ({ ...prev, [id]: { qty: prev[id]?.qty ?? max, lot: prev[id]?.lot ?? "", expiry: prev[id]?.expiry ?? "", ...patch } }));
    setError("");
  };
  const close = () => { setValues({}); setError(""); onClose(); };

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open && !saving) close(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recibir orden N° {order?.number}</DialogTitle>
          <DialogDescription>Registra el lote, vencimiento y cantidad recibida de cada medicamento. Puedes recibir menos que lo pendiente.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {pending.map((item) => {
            const max = item.pending ?? item.qty;
            const value = values[item.medicationId];
            return <div key={item.medicationId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <p className="font-medium sm:col-span-3">{medications.find((med) => med.id === item.medicationId)?.name ?? item.medicationId} · pendiente {max}</p>
              <Field label="Cantidad"><Input aria-label={`Cantidad ${item.medicationId}`} type="number" min={1} max={max} value={value?.qty ?? max} onChange={(event) => update(item.medicationId, { qty: Number(event.target.value) }, max)} /></Field>
              <Field label="Lote"><Input aria-label={`Lote ${item.medicationId}`} maxLength={120} value={value?.lot ?? ""} onChange={(event) => update(item.medicationId, { lot: event.target.value }, max)} /></Field>
              <Field label="Vencimiento"><Input aria-label={`Vencimiento ${item.medicationId}`} type="date" min={today} value={value?.expiry ?? ""} onChange={(event) => update(item.medicationId, { expiry: event.target.value }, max)} /></Field>
            </div>;
          })}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={close}>Cancelar</Button>
          <Button disabled={!valid || saving} onClick={async () => {
            if (!order || !valid) return;
            setSaving(true);
            setError("");
            try { await onReceive(order.id, lines); close(); }
            catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo recibir la orden."); }
            finally { setSaving(false); }
          }}>{saving ? "Registrando…" : "Registrar recepción"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupplierDirectory() {
  const { purchaseOrders } = useStore();
  const suppliers = useSuppliers();
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Proveedores ({suppliers.length})</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {suppliers.map((s) => {
          const open = purchaseOrders.filter((o) => o.supplierId === s.id && o.status !== "Recibida").length;
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
                <CardDescription className="tabular-nums">RUT {s.rut}{s.contact && ` · ${s.contact}`}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {s.phone && <li className="flex items-center gap-2"><Phone className="size-3.5" /> {s.phone}</li>}
                  {s.email && <li className="flex items-center gap-2"><Mail className="size-3.5" /> {s.email}</li>}
                  {(s.leadTimeDays > 0 || s.paymentTerms) && <li className="flex items-center gap-2"><Clock className="size-3.5" /> {s.leadTimeDays > 0 && `Entrega ${s.leadTimeDays} días`}{s.leadTimeDays > 0 && s.paymentTerms && " · "}{s.paymentTerms}</li>}
                </ul>
                <div className="flex flex-wrap gap-1">
                  {s.categories.map((c) => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{open} órdenes abiertas</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
