"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Globe, Receipt as ReceiptIcon, ShoppingBag, TrendingUp } from "lucide-react";
import { ExportButton, StatTile } from "@/components/analytics/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ownerName } from "@/domain/owners";
import { CATEGORIES, PAYMENT_METHODS, type Sale } from "@/domain/retail";
import { formatCLP, formatDate, useToday } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { useOwners } from "@/lib/server-state";
import { Receipt } from "./receipt";

const salesConfig = { value: { label: "Ventas", color: "var(--viz-1)" } } satisfies ChartConfig;

export function SalesReport() {
  const { sales, products } = useRetail();
  const owners = useOwners();
  const [channel, setChannel] = useState("all");
  const [payment, setPayment] = useState("all");
  const [open, setOpen] = useState<Sale | null>(null);
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const todayDate = useToday();

  const today = sales.filter((s) => s.date === todayDate);
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const web = sales.filter((s) => s.channel === "Web").length;

  const days = [...new Set(sales.map((s) => s.date))].sort();
  const byDay = days.map((d) => ({
    day: formatDate(d).slice(0, 6),
    value: sales.filter((s) => s.date === d).reduce((sum, s) => sum + s.total, 0),
  }));

  const productOf = (id: string) => products.find((p) => p.id === id)!;
  const byCategory = CATEGORIES.map((c) => {
    const items = sales.flatMap((s) => s.items).filter((i) => productOf(i.productId).category === c);
    return { category: c, units: items.reduce((s, i) => s + i.qty, 0), value: items.reduce((s, i) => s + i.qty * i.unitPrice, 0) };
  }).sort((a, b) => b.value - a.value);

  const topProducts = Object.entries(
    sales.flatMap((s) => s.items).reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.productId]: (acc[i.productId] ?? 0) + i.qty }), {})
  )
    .map(([id, qty]) => ({ product: productOf(id), qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const rows = [...sales]
    .filter((s) => (channel === "all" || s.channel === channel) && (payment === "all" || s.payment === payment))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={ShoppingBag} label="Ventas de hoy" value={formatCLP(today.reduce((s, x) => s + x.total, 0))} hint={`${today.length} boletas`} />
        <StatTile icon={TrendingUp} label="Ventas últimos 14 días" value={formatCLP(revenue)} hint={`${sales.length} boletas`} />
        <StatTile icon={ReceiptIcon} tone="text-muted-foreground" label="Ticket promedio" value={formatCLP(Math.round(revenue / Math.max(1, sales.length)))} />
        <StatTile icon={Globe} tone="text-muted-foreground" label="Ventas web con despacho" value={`${Math.round((web / Math.max(1, sales.length)) * 100)}%`} hint={`${web} pedidos`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por día</CardTitle>
            <CardDescription>Total con IVA, últimos 14 días</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={salesConfig} className="aspect-auto h-64 w-full">
              <BarChart data={byDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-medium tabular-nums">{formatCLP(Number(v))}</span>} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Más vendidos</CardTitle>
            <CardDescription>Unidades, últimos 14 días</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              {topProducts.map((t, i) => (
                <li key={t.product.id} className="flex items-center gap-2">
                  <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{t.product.name}</span>
                  <Badge variant="secondary" className="tabular-nums">{t.qty} u.</Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Ventas por categoría</CardTitle>
            <CardDescription>Total con IVA, últimos 14 días</CardDescription>
          </div>
          <ExportButton filename="ventas-categoria.csv" rows={byCategory.map((c) => ({ Categoría: c.category, Unidades: c.units, Total: c.value }))} />
        </CardHeader>
        <CardContent>
          <ChartContainer config={salesConfig} className="aspect-auto h-64 w-full">
            <BarChart data={byCategory} layout="vertical" margin={{ right: 72 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={130} />
              <XAxis type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-medium tabular-nums">{formatCLP(Number(v))}</span>} />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="value" position="right" className="fill-foreground" fontSize={11} formatter={(v) => formatCLP(Number(v))} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Boletas</CardTitle>
            <CardDescription>{rows.length} ventas</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger aria-label="Canal de venta" size="sm" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo canal</SelectItem>
                <SelectItem value="Mesón">Mesón</SelectItem>
                <SelectItem value="Web">Web</SelectItem>
              </SelectContent>
            </Select>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger aria-label="Medio de pago" size="sm" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo medio de pago</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              filename="boletas.csv"
              rows={rows.map((s) => ({
                Boleta: s.number,
                Fecha: s.date,
                Hora: s.time,
                Canal: s.channel,
                Pago: s.payment,
                Cliente: s.ownerRut ?? "",
                Total: s.total,
              }))}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Boleta</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const owner = s.ownerRut ? owners.find((o) => o.rut === s.ownerRut) : undefined;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium tabular-nums">{s.number}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(s.date)} · {s.time}</TableCell>
                    <TableCell>{owner ? ownerName(owner) : <span className="text-muted-foreground">Sin cliente</span>}</TableCell>
                    <TableCell><Badge variant={s.channel === "Web" ? "secondary" : "outline"}>{s.channel}</Badge></TableCell>
                    <TableCell>{s.payment}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.items.reduce((n, i) => n + i.qty, 0)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCLP(s.total)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpen(s)}>Ver</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Boleta N° {open?.number}</DialogTitle>
          </DialogHeader>
          {open && <Receipt sale={open} />}
          {open?.channel === "Mesón" && (
            <Link href="/seguridad/tienda" className="text-sm text-primary hover:underline">
              Ver video de caja de las {open.time} (Seguridad › Tienda)
            </Link>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
