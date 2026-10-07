"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, Package, PackageCheck, Truck } from "lucide-react";
import { StatTile } from "@/components/analytics/shared";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOwner } from "@/lib/lookups";
import { ownerName } from "@/domain/owners";
import { SHIPMENT_FLOW, type ShipmentStatus } from "@/domain/retail";
import { formatCLP, formatDate } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";

const statusIcon: Record<ShipmentStatus, React.ComponentType<{ className?: string }>> = {
  "Por preparar": Package,
  Preparado: PackageCheck,
  "En ruta": Truck,
  Entregado: CheckCircle2,
};

export function Shipments() {
  const { shipments, sales, advanceShipment } = useRetail();
  const [sector, setSector] = useState("all");
  const sectors = [...new Set(shipments.map((s) => s.sector))].sort();
  const list = shipments.filter((s) => sector === "all" || s.sector === sector);
  const active = shipments.filter((s) => s.status !== "Entregado");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SHIPMENT_FLOW.map((st) => (
          <StatTile key={st} icon={statusIcon[st]} tone={st === "Entregado" ? "text-muted-foreground" : "text-primary"} label={st} value={shipments.filter((s) => s.status === st).length} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Despachos activos por comuna</CardTitle>
            <CardDescription>Para armar rutas de reparto del día.</CardDescription>
          </div>
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger aria-label="Filtrar por comuna" size="sm" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las comunas</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {sectors.map((s) => {
            const n = active.filter((x) => x.sector === s).length;
            return n > 0 ? (
              <Badge key={s} variant="outline"><MapPin /> {s}: {n}</Badge>
            ) : null;
          })}
          {active.length === 0 && <p className="text-sm text-muted-foreground">Sin despachos pendientes.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SHIPMENT_FLOW.map((status) => {
          const Icon = statusIcon[status];
          const column = list.filter((s) => s.status === status).sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
          const next = SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(status) + 1];
          return (
            <div key={status} className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 text-primary" /> {status}
                <Badge variant="secondary" className="ml-auto">{column.length}</Badge>
              </p>
              {column.slice(0, status === "Entregado" ? 5 : undefined).map((s) => {
                const sale = sales.find((x) => x.id === s.saleId);
                const owner = getOwner(s.ownerRut);
                return (
                  <Card key={s.id} className="gap-2 py-3">
                    <CardContent className="flex flex-col gap-1.5 px-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Boleta {sale?.number}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(s.scheduledFor)}</span>
                      </div>
                      {owner && (
                        <Link href={`/pacientes/propietarios/${owner.rut}`} className="hover:text-primary hover:underline">
                          {ownerName(owner)}
                        </Link>
                      )}
                      <p className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3 shrink-0" /> {s.address}, {s.sector}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.courier} · {sale?.items.reduce((n, i) => n + i.qty, 0)} productos · {formatCLP(sale?.total ?? 0)}
                      </p>
                      {next && (
                        <Guard permission="tienda.inventario">
                          <Button size="sm" variant="outline" className="mt-1" onClick={() => advanceShipment(s.id)}>
                            {next} <ArrowRight />
                          </Button>
                        </Guard>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {column.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin pedidos</p>}
              {status === "Entregado" && column.length > 5 && (
                <p className="text-center text-xs text-muted-foreground">+{column.length - 5} entregados anteriores</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
