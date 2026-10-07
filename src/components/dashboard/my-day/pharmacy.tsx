"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, PackageCheck, Store, Truck } from "lucide-react";
import { DispenseQueue } from "@/components/pharmacy/dispense-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupplier, retailSuppliers } from "@/lib/lookups";
import { formatCLP, formatDate } from "@/lib/format";
import { expiringValue, pharmacyKpis } from "@/lib/metrics/pharmacy";
import { retailKpis } from "@/lib/metrics/retail";
import { useRetail } from "@/lib/retail-store";
import { useStore } from "@/lib/store";
import { LinkTile, MyTasksCard } from "./shared";

export function PharmacyDay() {
  const { medications, referrals, purchaseOrders, receivePurchaseOrder } = useStore();
  const { sales, products, orders, receiveOrder } = useRetail();
  const kpis = pharmacyKpis(medications, referrals);
  const expiring = expiringValue(medications);
  const retail = retailKpis(sales, products);
  const incoming = [
    ...purchaseOrders.filter((o) => o.status === "Enviada").map((o) => ({ id: o.id, label: `Farmacia · OC ${o.number}`, who: getSupplier(o.supplierId)?.name, receive: () => receivePurchaseOrder(o.id) })),
    ...orders.filter((o) => o.status === "Enviada").map((o) => ({ id: o.id, label: `Tienda · OC ${o.number}`, who: retailSuppliers.find((s) => s.id === o.supplierId)?.name, receive: () => receiveOrder(o.id) })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LinkTile icon={PackageCheck} label="Recetas por dispensar" value={kpis.pendingDispense} href="/farmacia/movimientos" />
        <LinkTile icon={AlertTriangle} label="Medicamentos con stock bajo" value={kpis.lowStock} href="/farmacia/proveedores" tone="text-amber-600 dark:text-amber-400" />
        <LinkTile icon={CalendarClock} label="Por vencer (60 días)" value={expiring.list.length} hint={formatCLP(expiring.total)} href="/analisis/reportes" tone="text-destructive" />
        <LinkTile icon={Store} label="Reponer sala de tienda" value={retail.refill} href="/tienda/bodega" tone="text-muted-foreground" />
      </div>

      <DispenseQueue />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="size-4 text-primary" /> Órdenes por recibir</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {incoming.length === 0 && <p className="text-muted-foreground">Nada por recibir.</p>}
            {incoming.map((o) => (
              <div key={o.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.who}</p>
                </div>
                <Button size="sm" variant="outline" onClick={o.receive}>Recibir</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimientos</CardTitle>
            <CardDescription>
              <Link href="/farmacia/medicamentos" className="text-primary hover:underline">Ajustar stock</Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {expiring.list.slice(0, 5).map((e) => (
              <div key={e.medication.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{e.medication.name}</span>
                <Badge variant={e.days < 0 ? "destructive" : "secondary"} className="tabular-nums">
                  {e.days < 0 ? "Vencido" : formatDate(e.medication.expiry)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <MyTasksCard />
      </div>
    </div>
  );
}
