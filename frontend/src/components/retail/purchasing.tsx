"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, Clock, Mail, PackagePlus, Phone, Send, Truck } from "lucide-react";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Product, type RetailOrderStatus, stockLevel, totalStock } from "@/domain/retail";
import { formatCLP, formatDate } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { read } from "@/lib/server-state";
import { retailSuppliers as mockRetailSuppliers } from "@/mocks/retail";

/** Comprar hasta el doble del punto de compra. */
function orderQty(p: Product) {
  return Math.max(1, p.reorderPoint * 2 - totalStock(p));
}

const statusVariant: Record<RetailOrderStatus, "default" | "secondary" | "outline"> = {
  Borrador: "outline",
  Enviada: "secondary",
  Recibida: "default",
};

export function RetailPurchasing() {
  const { products, orders, createOrder, sendOrder, receiveOrder } = useRetail();
  const retailSuppliers = read("retailSuppliers", mockRetailSuppliers);
  const [notice, setNotice] = useState("");

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
                      Entrega {supplier.leadTimeDays} días · compra mínima {formatCLP(supplier.minOrder)} · pago {supplier.paymentTerms.toLowerCase()}
                    </p>
                  </div>
                  <Guard permission="tienda.compras">
                    <Button
                      size="sm"
                      onClick={() => {
                        const oc = createOrder(supplier.id, items.map((p) => ({ productId: p.id, qty: orderQty(p) })), supplier.leadTimeDays);
                        setNotice(`Orden de compra N° ${oc.number} creada en borrador para ${supplier.name}.`);
                      }}
                    >
                      <PackagePlus /> Generar orden · {formatCLP(total)}
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
                      {o.receivedAt ? `Recibida ${formatDate(o.receivedAt)}` : `Estimada ${formatDate(o.expected)}`}
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
                        <Button size="sm" variant="outline" onClick={() => sendOrder(o.id)}><Send /> Enviar</Button>
                      </Guard>
                    )}
                    {o.status === "Enviada" && (
                      <Guard permission="tienda.compras">
                        <Button size="sm" onClick={() => receiveOrder(o.id)}><Truck /> Recibir</Button>
                      </Guard>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Proveedores de tienda ({retailSuppliers.length})</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {retailSuppliers.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
                <CardDescription className="tabular-nums">RUT {s.rut} · {s.contact}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li className="flex items-center gap-2"><Phone className="size-3.5" /> {s.phone}</li>
                  <li className="flex items-center gap-2"><Mail className="size-3.5" /> {s.email}</li>
                  <li className="flex items-center gap-2"><Clock className="size-3.5" /> Entrega {s.leadTimeDays} días · {s.paymentTerms}</li>
                </ul>
                <div className="flex flex-wrap gap-1">
                  {s.categories.map((c) => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {products.filter((p) => p.supplierId === s.id).length} productos · compra mínima {formatCLP(s.minOrder)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
