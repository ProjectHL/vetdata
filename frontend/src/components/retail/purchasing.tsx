"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, Clock, Mail, PackagePlus, Phone, Send, Truck } from "lucide-react";
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
import { type Product, type RetailOrder, type RetailOrderStatus, stockLevel, totalStock } from "@/domain/retail";
import { formatCLP, formatDate, useToday } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { useRetailSuppliers } from "@/lib/server-state";
import { dataSource } from "@/services";

/** Comprar hasta el doble del punto de compra. */
function orderQty(p: Product) {
  return Math.max(1, p.reorderPoint * 2 - totalStock(p));
}

const statusVariant: Record<RetailOrderStatus, "default" | "secondary" | "outline"> = {
  Borrador: "outline",
  Enviada: "secondary",
  "Parcialmente recibida": "secondary",
  Recibida: "default",
};

export function RetailPurchasing() {
  const { products, orders, createOrder, sendOrder, receiveOrder } = useRetail();
  const retailSuppliers = useRetailSuppliers();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<RetailOrder | null>(null);

  const onOrder = new Set(orders.filter((o) => o.status !== "Recibida").flatMap((o) => o.items.map((i) => i.productId)));
  const toBuy = products.filter((p) => (stockLevel(p) === "Comprar" || stockLevel(p) === "Agotado") && !onOrder.has(p.id));
  const groups = retailSuppliers
    .map((s) => ({ supplier: s, items: toBuy.filter((p) => p.supplierId === s.id) }))
    .filter((g) => g.items.length > 0);
  const productOf = (id: string) => products.find((p) => p.id === id);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sugerencia de compra</CardTitle>
          <CardDescription>
            Productos bajo el punto de compra (bodega + sala), agrupados por proveedor. Se sugiere comprar hasta el doble del punto de compra.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {notice && <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay productos por comprar.</p>}
          {groups.map(({ supplier, items }) => {
            const total = items.reduce((s, p) => s + orderQty(p) * p.cost, 0);
            const belowMin = total < supplier.minOrder;
            return (
              <div key={supplier.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{supplier.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {supplier.leadTimeDays > 0 ? `Entrega ${supplier.leadTimeDays} días` : "Plazo sin registrar"} · {supplier.minOrder > 0 ? `compra mínima ${formatCLP(supplier.minOrder)}` : "Mínimo sin registrar"} · {supplier.paymentTerms || "Pago sin registrar"}
                    </p>
                  </div>
                  <Guard permission="tienda.compras">
                    <Button
                      size="sm"
                      disabled={!!creatingFor}
                      onClick={async () => {
                        setCreatingFor(supplier.id);
                        setError("");
                        try {
                          const oc = await createOrder(supplier.id, items.map((p) => ({ productId: p.id, qty: orderQty(p) })), supplier.leadTimeDays);
                          setNotice(`Orden de compra N° ${oc.number} creada en borrador para ${supplier.name}.`);
                        } catch (cause) {
                          setError(cause instanceof Error ? cause.message : "No se pudo crear la orden.");
                        } finally {
                          setCreatingFor(null);
                        }
                      }}
                    >
                      <PackagePlus /> {creatingFor === supplier.id ? "Registrando…" : `Generar orden · ${formatCLP(total)}`}
                    </Button>
                  </Guard>
                </div>
                {belowMin && (
                  <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3" /> Bajo la compra mínima del proveedor: agrega más productos o espera a consolidar.
                  </p>
                )}
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {items.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 rounded-md bg-muted/60 px-3 py-1.5">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {totalStock(p)}/{p.reorderPoint} → <strong className="text-foreground">{orderQty(p)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de compra</CardTitle>
          <CardDescription>Borrador → Enviada → Recibida. Al recibir, el stock entra a la bodega central.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Emitida · llegada</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Total neto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...orders].sort((a, b) => b.number - a.number).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium tabular-nums">{o.number}</TableCell>
                  <TableCell>{retailSuppliers.find((s) => s.id === o.supplierId)?.name}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(o.date)}
                    <span className="block text-xs text-muted-foreground">
                      {o.receivedAt ? `Recibida ${formatDate(o.receivedAt)}` : o.expected ? `Estimada ${formatDate(o.expected)}` : "Llegada sin registrar"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    {o.items.map((i) => (
                      <Fragment key={i.productId}>
                        {i.qty} × {productOf(i.productId)?.name}
                        <br />
                      </Fragment>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(o.items.reduce((s, i) => s + i.qty * i.unitCost, 0))}</TableCell>
                  <TableCell><Badge variant={statusVariant[o.status]}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {o.status === "Borrador" && (
                      <Guard permission="tienda.compras">
                        <Button size="sm" variant="outline" disabled={!!sendingId} onClick={async () => {
                          setSendingId(o.id);
                          setError("");
                          try { await sendOrder(o.id); }
                          catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo enviar la orden."); }
                          finally { setSendingId(null); }
                        }}><Send /> {sendingId === o.id ? "Enviando…" : "Enviar"}</Button>
                      </Guard>
                    )}
                    {(o.status === "Enviada" || o.status === "Parcialmente recibida") && (
                      <Guard permission="tienda.compras">
                        <Button size="sm" onClick={() => dataSource === "mock" ? void receiveOrder(o.id) : setReceiving(o)}><Truck /> Recibir</Button>
                      </Guard>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ReceiveRetailOrderDialog order={receiving} products={products} onClose={() => setReceiving(null)} onReceive={receiveOrder} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Proveedores de tienda ({retailSuppliers.length})</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {retailSuppliers.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
                <CardDescription className="tabular-nums">RUT {s.rut}{s.contact && ` · ${s.contact}`}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {s.phone && <li className="flex items-center gap-2"><Phone className="size-3.5" /> {s.phone}</li>}
                  {s.email && <li className="flex items-center gap-2"><Mail className="size-3.5" /> {s.email}</li>}
                  <li className="flex items-center gap-2"><Clock className="size-3.5" /> {s.leadTimeDays > 0 ? `Entrega ${s.leadTimeDays} días` : "Plazo sin registrar"} · {s.paymentTerms || "Pago sin registrar"}</li>
                </ul>
                <div className="flex flex-wrap gap-1">
                  {s.categories.map((c) => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {products.filter((p) => p.supplierId === s.id).length} productos{s.minOrder > 0 && ` · compra mínima ${formatCLP(s.minOrder)}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReceiveRetailOrderDialog({ order, products, onClose, onReceive }: {
  order: RetailOrder | null;
  products: Product[];
  onClose: () => void;
  onReceive: (id: string, items: { productId: string; qty: number; lot: string; expiry?: string }[]) => Promise<void>;
}) {
  const today = useToday();
  const [values, setValues] = useState<Record<string, { qty: number; lot: string; expiry: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = order?.items.filter((item) => (item.pending ?? item.qty) > 0) ?? [];
  const lines = pending.map((item) => ({
    productId: item.productId,
    qty: values[item.productId]?.qty ?? (item.pending ?? item.qty),
    lot: values[item.productId]?.lot ?? "",
    expiry: values[item.productId]?.expiry ?? "",
  }));
  const valid = lines.length > 0 && lines.every((line) => {
    const item = pending.find((candidate) => candidate.productId === line.productId)!;
    return Number.isInteger(line.qty) && line.qty > 0 && line.qty <= (item.pending ?? item.qty) && line.lot.trim().length > 0 && line.lot.length <= 120 && (!line.expiry || line.expiry >= today);
  });
  const update = (id: string, patch: Partial<{ qty: number; lot: string; expiry: string }>, max: number) => {
    setValues((prev) => ({ ...prev, [id]: { qty: prev[id]?.qty ?? max, lot: prev[id]?.lot ?? "", expiry: prev[id]?.expiry ?? "", ...patch } }));
    setError("");
  };
  const close = () => { setValues({}); setError(""); onClose(); };

  return <Dialog open={!!order} onOpenChange={(open) => { if (!open && !saving) close(); }}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Recibir orden N° {order?.number}</DialogTitle>
        <DialogDescription>Registra lote y cantidad recibida de cada producto. El vencimiento es opcional; puedes recibir menos que lo pendiente.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        {pending.map((item) => {
          const max = item.pending ?? item.qty;
          const value = values[item.productId];
          return <div key={item.productId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <p className="font-medium sm:col-span-3">{products.find((product) => product.id === item.productId)?.name ?? item.productId} · pendiente {max}</p>
            <Field label="Cantidad"><Input aria-label={`Cantidad ${item.productId}`} type="number" min={1} max={max} value={value?.qty ?? max} onChange={(event) => update(item.productId, { qty: Number(event.target.value) }, max)} /></Field>
            <Field label="Lote"><Input aria-label={`Lote ${item.productId}`} maxLength={120} value={value?.lot ?? ""} onChange={(event) => update(item.productId, { lot: event.target.value }, max)} /></Field>
            <Field label="Vencimiento"><Input aria-label={`Vencimiento ${item.productId}`} type="date" min={today} value={value?.expiry ?? ""} onChange={(event) => update(item.productId, { expiry: event.target.value }, max)} /></Field>
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
  </Dialog>;
}
