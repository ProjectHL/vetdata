"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { HandCoins, PawPrint, Repeat, ShoppingBag, UserPlus } from "lucide-react";
import { RequirePermission } from "@/components/settings/guard";
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
import { visiblePatients } from "@/lib/analytics";
import { useCurrentClinic } from "@/lib/server-state";
import { ownerName } from "@/domain/owners";
import { formatCLP, formatRut } from "@/lib/format";
import {
  customerSpend,
  omnichannel,
  patientKpis,
  petsPerOwner,
  receivables,
  speciesDistribution,
  visibleOwners,
} from "@/lib/metrics/customers";
import { useRetail } from "@/lib/retail-store";
import { useStore } from "@/lib/store";
import { ExportButton, StatTile } from "./shared";

const countConfig = { value: { label: "Cantidad", color: "var(--viz-1)" } } satisfies ChartConfig;

export function Customers() {
  const { grants, invoices } = useStore();
  const { sales } = useRetail();
  const currentClinic = useCurrentClinic();
  const visible = visiblePatients(grants, currentClinic);
  const kpis = patientKpis(visible);
  const species = speciesDistribution(visible);
  const perOwner = petsPerOwner(visible);
  const spend = customerSpend(visible, invoices, sales);
  const omni = omnichannel(spend, visible);
  const debt = receivables(visible, invoices);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={PawPrint} label="Pacientes activos" value={kpis.active} hint={`De ${visible.length} visibles · visita en 12 meses`} />
        <StatTile icon={UserPlus} label="Pacientes nuevos (90 días)" value={kpis.new90} />
        <StatTile icon={Repeat} tone="text-muted-foreground" label="Tasa de retorno" value={`${kpis.returnPct}%`} hint="Con más de una consulta" />
        <StatTile icon={ShoppingBag} tone="text-muted-foreground" label="Clientes clínica + tienda" value={`${omni.pct}%`} hint={`${omni.count} de ${visibleOwners(visible).length} dueños`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pacientes por especie</CardTitle>
            <CardDescription>Propios y compartidos con tu clínica</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={countConfig} className="aspect-auto h-56 w-full">
              <BarChart data={species.map((s) => ({ label: s.species, value: s.count, pct: s.pct }))} layout="vertical" margin={{ right: 56 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={64} />
                <XAxis type="number" hide allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="pct" position="right" className="fill-foreground" fontSize={11} formatter={(v) => `${v}%`} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mascotas por dueño</CardTitle>
            <CardDescription>Cantidad de dueños según cuántas mascotas tienen en tu clínica</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={countConfig} className="aspect-auto h-56 w-full">
              <BarChart data={perOwner.map((p) => ({ label: p.bucket, value: p.owners }))} margin={{ top: 20 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" className="fill-foreground" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <RequirePermission permission="reportes.financiero" message="El gasto por cliente y la cobranza requieren permiso de reportes financieros.">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Mejores clientes</CardTitle>
                <CardDescription>Gasto total en clínica (facturas) y tienda (boletas)</CardDescription>
              </div>
              <ExportButton
                filename="clientes-gasto.csv"
                rows={spend.map((c) => ({ Cliente: ownerName(c.owner), RUT: c.owner.rut, Clínica: c.clinic, Tienda: c.store, Total: c.total }))}
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Clínica</TableHead>
                    <TableHead className="text-right">Tienda</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spend.slice(0, 10).map((c) => (
                    <TableRow key={c.owner.rut}>
                      <TableCell>
                        <Link href={`/pacientes/propietarios/${c.owner.rut}`} className="font-medium hover:text-primary hover:underline">
                          {ownerName(c.owner)}
                        </Link>
                        <span className="block text-xs text-muted-foreground tabular-nums">{formatRut(c.owner.rut)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.clinic ? formatCLP(c.clinic) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.store ? formatCLP(c.store) : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCLP(c.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2"><HandCoins className="size-4 text-primary" /> Cobranza por antigüedad</CardTitle>
                <CardDescription>Total por cobrar {formatCLP(debt.total)}</CardDescription>
              </div>
              <ExportButton
                filename="cobranza.csv"
                rows={debt.rows.map((r) => ({ Cliente: ownerName(r.owner), Teléfono: r.owner.phone, Origen: r.source, Monto: r.amount, Días: r.age }))}
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2">
                {debt.buckets.map((b, i) => (
                  <div key={b.bucket} className="rounded-lg bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">{b.bucket}</p>
                    <p className={i === 2 && b.amount > 0 ? "font-semibold text-destructive tabular-nums" : "font-semibold tabular-nums"}>
                      {formatCLP(b.amount)}
                    </p>
                  </div>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente · contacto</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Días</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debt.rows.map((r) => (
                    <TableRow key={`${r.owner.rut}-${r.source}`}>
                      <TableCell>
                        <Link href={`/pacientes/propietarios/${r.owner.rut}`} className="hover:text-primary hover:underline">{ownerName(r.owner)}</Link>
                        <span className="block text-xs text-muted-foreground">{r.owner.preferredContact} · {r.owner.phone}</span>
                      </TableCell>
                      <TableCell>{r.source}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.age}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCLP(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </RequirePermission>
    </div>
  );
}
