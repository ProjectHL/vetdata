"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { AlertTriangle, PackageX, Percent, Receipt, Repeat, Timer, Truck, UserCheck } from "lucide-react";
import { ProductThumb } from "@/components/retail/shared";
import { RequirePermission } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCLP } from "@/lib/format";
import {
  crossSellBySpecies,
  marginByCategory,
  productTurnover,
  salesBreakdown,
  shipmentKpis,
} from "@/lib/metrics/retail";
import { useRetail } from "@/lib/retail-store";
import { ExportButton, StatTile } from "./shared";

const single = (label: string) => ({ value: { label, color: "var(--viz-1)" } }) satisfies ChartConfig;

export function RetailAnalytics() {
  const { sales, products, shipments } = useRetail();
  const s = salesBreakdown(sales);
  const margin = marginByCategory(sales, products);
  const turnover = productTurnover(sales, products);
  const breakSoon = turnover.filter((t) => t.coverageDays !== null && t.coverageDays < 7).sort((a, b) => a.coverageDays! - b.coverageDays!);
  const dead = turnover.filter((t) => t.sold === 0 && t.product.stock.central + t.product.stock.sala > 0);
  const topRotation = [...turnover].sort((a, b) => b.rotation - a.rotation).slice(0, 8);
  const ship = shipmentKpis(shipments);
  const cross = crossSellBySpecies(sales, products);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Receipt} label="Ticket promedio" value={formatCLP(s.ticket)} hint={`${s.count} boletas · 14 días`} />
        <StatTile icon={UserCheck} label="Ventas con RUT de cliente" value={`${s.withCustomerPct}%`} hint={`${s.customers} clientes identificados`} />
        <StatTile icon={Repeat} tone="text-muted-foreground" label="Recompra" value={`${s.repeatPct}%`} hint="Clientes con 2 o más boletas" />
        <StatTile icon={Truck} tone="text-muted-foreground" label="Despachos a tiempo" value={`${ship.onTimePct}%`} hint={`${ship.late.length} atrasados`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por canal y medio de pago</CardTitle>
            <CardDescription>Total con IVA, últimos 14 días</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <MiniTable title="Canal" rows={s.byChannel.map((c) => ({ label: c.channel, count: c.count, total: c.total }))} />
            <MiniTable title="Medio de pago" rows={s.byPayment.map((p) => ({ label: p.payment, count: p.count, total: p.total }))} />
          </CardContent>
        </Card>

        <RequirePermission permission="reportes.financiero" message="El margen de la tienda requiere permiso de reportes financieros.">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2"><Percent className="size-4 text-primary" /> Margen bruto por categoría</CardTitle>
                <CardDescription>Total {formatCLP(margin.margin)} · {margin.pct}% sobre venta neta</CardDescription>
              </div>
              <ExportButton filename="margen-tienda.csv" rows={margin.rows.map((r) => ({ Categoría: r.category, "Venta neta": r.revenue, Margen: r.margin, "Margen %": r.pct }))} />
            </CardHeader>
            <CardContent>
              <ChartContainer config={single("Margen")} className="aspect-auto h-56 w-full">
                <BarChart data={margin.rows.map((r) => ({ label: r.category, value: r.margin, pct: r.pct }))} layout="vertical" margin={{ right: 48 }}>
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={120} />
                  <XAxis type="number" hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-medium tabular-nums">{formatCLP(Number(v))}</span>} />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="pct" position="right" className="fill-foreground" fontSize={11} formatter={(v) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </RequirePermission>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> Quiebres próximos</CardTitle>
              <CardDescription>Menos de 7 días de cobertura al ritmo de venta actual</CardDescription>
            </div>
            <Link href="/tienda/compras" className="text-sm text-primary hover:underline">Ir a compras</Link>
          </CardHeader>
          <CardContent>
            {breakSoon.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Ningún producto en riesgo de quiebre.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Vendidas 14 d</TableHead>
                    <TableHead className="text-right">Cobertura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakSoon.map((t) => (
                    <TableRow key={t.product.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <ProductThumb category={t.product.category} className="size-7" />
                          <span className="truncate">{t.product.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.product.stock.central + t.product.stock.sala}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.sold}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={t.coverageDays! <= 2 ? "destructive" : "secondary"} className="tabular-nums">{t.coverageDays} d</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rotación de inventario</CardTitle>
            <CardDescription>Veces que rota el stock en 14 días (vendidas / stock promedio)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={single("Rotación")} className="aspect-auto h-64 w-full">
              <BarChart data={topRotation.map((t) => ({ label: t.product.name.length > 24 ? `${t.product.name.slice(0, 24)}…` : t.product.name, value: t.rotation }))} layout="vertical" margin={{ right: 32 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={170} fontSize={11} />
                <XAxis type="number" hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" className="fill-foreground" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PackageX className="size-4 text-muted-foreground" /> Sin movimiento</CardTitle>
            <CardDescription>Con stock y sin ventas en 14 días</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {dead.length === 0 && <p className="text-muted-foreground">Todos los productos se vendieron.</p>}
            {dead.map((t) => (
              <p key={t.product.id} className="flex justify-between gap-2">
                <span className="truncate">{t.product.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{t.product.stock.central + t.product.stock.sala} u.</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="size-4 text-primary" /> Despachos</CardTitle>
            <CardDescription>Por estado y por comuna</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {ship.byStatus.map((b) => (
                <Badge key={b.status} variant="outline">{b.status}: {b.count}</Badge>
              ))}
            </div>
            {ship.bySector.map((b) => (
              <p key={b.sector} className="flex justify-between">
                <span>{b.sector}</span>
                <span className="tabular-nums text-muted-foreground">{b.count}</span>
              </p>
            ))}
            {ship.late.length > 0 && (
              <Link href="/tienda/despachos" className="flex items-center gap-1 text-destructive hover:underline">
                <Timer className="size-4" /> {ship.late.length} despachos atrasados
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Venta cruzada clínica → tienda</CardTitle>
            <CardDescription>Qué compran los clientes según la especie de sus mascotas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {cross.map((c) => (
              <div key={c.species}>
                <p className="font-medium">{c.species}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.top.map((t) => (
                    <Badge key={t.category} variant="secondary">{t.category} · {t.units} u.</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniTable({ title, rows }: { title: string; rows: { label: string; count: number; total: number }[] }) {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((r) => {
          const pct = Math.round((r.total / Math.max(1, sum)) * 100);
          return (
            <li key={r.label}>
              <div className="flex justify-between gap-2">
                <span>{r.label} <span className="text-xs text-muted-foreground">({r.count})</span></span>
                <span className="tabular-nums">{formatCLP(r.total)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-[var(--viz-1)]" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
