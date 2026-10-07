"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { Ban, Banknote, CalendarCheck, CalendarClock, CalendarX, CircleCheck, Clock, HandCoins, Package, Printer, Receipt, Send, ShieldCheck, Trash2, Inbox } from "lucide-react";
import { RequirePermission } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { boxOccupancy, currentClinic, monthlyRevenue, owners, patients } from "@/lib/lookups";
import { COST_RATIO } from "@/domain/pharmacy";
import { grantStatus } from "@/domain/sharing";
import { formatCLP, formatDate } from "@/lib/format";
import { agendaLoad, appointmentRates } from "@/lib/metrics/clinic";
import { expiringValue, medicationTurnover } from "@/lib/metrics/pharmacy";
import { useDoctors, useStore } from "@/lib/store";
import { ExportButton, StatTile } from "./shared";

const single = (label: string) => ({ value: { label, color: "var(--viz-1)" } }) satisfies ChartConfig;
const millions = (n: number) => `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;

export function Reports() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Imprimir</Button>
      </div>
      <Tabs defaultValue="financiero">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="financiero">Financiero</TabsTrigger>
          <TabsTrigger value="operacion">Operación</TabsTrigger>
          <TabsTrigger value="farmacia">Farmacia</TabsTrigger>
          <TabsTrigger value="red">Red</TabsTrigger>
        </TabsList>
        <TabsContent value="financiero">
          <RequirePermission permission="reportes.financiero" message="Los reportes financieros están disponibles solo para roles con permiso de reportes financieros.">
            <Financial />
          </RequirePermission>
        </TabsContent>
        <TabsContent value="operacion"><Operations /></TabsContent>
        <TabsContent value="farmacia"><PharmacyReport /></TabsContent>
        <TabsContent value="red"><NetworkReport /></TabsContent>
      </Tabs>
    </div>
  );
}

function Financial() {
  const { invoices } = useStore();
  const billed = invoices.reduce((s, i) => s + i.total, 0);
  const unpaidInvoices = invoices.filter((i) => i.status === "Emitida").reduce((s, i) => s + i.total, 0);
  const ownerBalance = owners.reduce((s, o) => s + o.balance, 0);
  const byService = Object.entries(
    invoices.flatMap((i) => i.items).reduce<Record<string, { qty: number; total: number }>>((acc, it) => {
      const cur = acc[it.description] ?? { qty: 0, total: 0 };
      acc[it.description] = { qty: cur.qty + it.qty, total: cur.total + it.qty * it.unitPrice };
      return acc;
    }, {})
  )
    .map(([description, v]) => ({ description, ...v }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Banknote} label="Ingresos septiembre" value={millions(monthlyRevenue[10].ingresos)} hint="+7% vs agosto" />
        <StatTile icon={Receipt} label="Facturado (registros)" value={formatCLP(billed)} hint={`${invoices.length} facturas`} />
        <StatTile icon={HandCoins} tone="text-destructive" label="Por cobrar" value={formatCLP(unpaidInvoices + ownerBalance)} hint="Facturas emitidas + saldos de dueños" />
        <StatTile icon={Receipt} tone="text-muted-foreground" label="Ticket promedio" value={formatCLP(Math.round(billed / Math.max(1, invoices.length)))} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Ingresos netos por mes</CardTitle>
              <CardDescription>Últimos 12 meses (octubre en curso)</CardDescription>
            </div>
            <ExportButton filename="ingresos-mensuales.csv" rows={monthlyRevenue.map((m) => ({ Mes: m.month, Ingresos: m.ingresos }))} />
          </CardHeader>
          <CardContent>
            <ChartContainer config={single("Ingresos")} className="aspect-auto h-64 w-full">
              <BarChart data={monthlyRevenue.map((m) => ({ month: m.month, value: m.ingresos }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v / 1_000_000}M`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-medium tabular-nums">{formatCLP(Number(v))}</span>} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Ingresos por prestación</CardTitle>
              <CardDescription>Según facturas registradas (neto)</CardDescription>
            </div>
            <ExportButton filename="ingresos-prestacion.csv" rows={byService.map((s) => ({ Prestación: s.description, Cantidad: s.qty, Total: s.total }))} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestación / producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byService.map((s) => (
                  <TableRow key={s.description}>
                    <TableCell>{s.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCLP(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Operations() {
  const { appointments } = useStore();
  const byDoctor = Object.entries(
    patients
      .filter((p) => p.clinic === currentClinic)
      .flatMap((p) => p.consultations)
      .concat(patients.filter((p) => p.clinic !== currentClinic).flatMap((p) => p.consultations.filter((c) => c.clinic === currentClinic)))
      .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.doctor]: (acc[c.doctor] ?? 0) + 1 }), {})
  )
    .map(([doctor, value]) => ({ doctor: doctor.replace(/^(Dra?\.)\s/, ""), value }))
    .sort((a, b) => b.value - a.value);
  const doctors = useDoctors();
  const rates = appointmentRates(appointments);
  const load = agendaLoad(appointments, doctors);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={CalendarCheck} label="Citas próximas" value={rates.upcoming} hint="Agendadas y confirmadas" />
        <StatTile icon={CircleCheck} tone="text-muted-foreground" label="Citas realizadas" value={rates.done} hint="Últimas semanas" />
        <StatTile icon={Ban} tone="text-amber-600 dark:text-amber-400" label="Tasa de cancelación" value={`${rates.cancelPct}%`} hint="Sobre citas ya ocurridas" />
        <StatTile icon={CalendarX} tone="text-destructive" label="No asistió" value={`${rates.noShowPct}%`} hint="Sobre citas ya ocurridas" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Agenda de los próximos 7 días</CardTitle>
            <CardDescription>Bloques de 30 minutos tomados por profesional y su próxima hora libre</CardDescription>
          </div>
          <ExportButton
            filename="agenda-profesionales.csv"
            rows={load.map((l) => ({ Profesional: l.doctor.name, Citas: l.booked, "Ocupación %": l.occupancyPct, "Próxima hora": l.nextFree ? `${l.nextFree.date} ${l.nextFree.time}` : "" }))}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profesional</TableHead>
                <TableHead className="text-right">Citas</TableHead>
                <TableHead className="w-1/3">Ocupación</TableHead>
                <TableHead>Próxima hora libre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {load.map((l) => (
                <TableRow key={l.doctor.id}>
                  <TableCell>
                    <p className="font-medium">{l.doctor.name}</p>
                    <p className="text-xs text-muted-foreground">{l.doctor.specialty}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.booked}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-[var(--viz-1)]" style={{ width: `${Math.max(2, l.occupancyPct)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums">{l.occupancyPct}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {l.nextFree ? (
                      <span className="flex items-center gap-1"><Clock className="size-3.5 text-muted-foreground" /> {formatDate(l.nextFree.date)} · {l.nextFree.time}</span>
                    ) : "Sin horas en 7 días"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Consultas por profesional</CardTitle>
              <CardDescription>Atenciones registradas en tu clínica</CardDescription>
            </div>
            <ExportButton filename="consultas-profesional.csv" rows={byDoctor.map((d) => ({ Profesional: d.doctor, Consultas: d.value }))} />
          </CardHeader>
          <CardContent>
            <ChartContainer config={single("Consultas")} className="aspect-auto h-64 w-full">
              <BarChart data={byDoctor} layout="vertical" margin={{ right: 28 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="doctor" type="category" tickLine={false} axisLine={false} width={110} />
                <XAxis type="number" hide allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" className="fill-foreground" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Ocupación de boxes</CardTitle>
              <CardDescription>% del horario de atención, último mes</CardDescription>
            </div>
            <ExportButton filename="ocupacion-boxes.csv" rows={boxOccupancy.map((b) => ({ Box: b.box, "Ocupación %": b.ocupacion }))} />
          </CardHeader>
          <CardContent>
            <ChartContainer config={single("Ocupación")} className="aspect-auto h-64 w-full">
              <BarChart data={boxOccupancy.map((b) => ({ box: b.box, value: b.ocupacion }))} margin={{ top: 20 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="box" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-medium tabular-nums">{v}%</span>} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" className="fill-foreground" fontSize={11} formatter={(v) => `${v}%`} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PharmacyReport() {
  const { movements, medications } = useStore();
  const out = movements.filter((m) => m.type === "Salida");
  const top = Object.entries(out.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.medicationId]: (acc[m.medicationId] ?? 0) - m.qty }), {}))
    .map(([id, value]) => ({ name: medications.find((m) => m.id === id)?.name ?? id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const losses = movements.filter((m) => m.type === "Ajuste");
  const lossValue = losses.reduce((s, m) => s - m.qty * Math.round((medications.find((x) => x.id === m.medicationId)?.price ?? 0) * COST_RATIO), 0);
  const inventoryValue = medications.reduce((s, m) => s + m.stock * Math.round(m.price * COST_RATIO), 0);
  const turnover = medicationTurnover(medications, movements).filter((t) => t.out30 > 0);
  const expiring = expiringValue(medications);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={Package} label="Valor del inventario (costo)" value={formatCLP(inventoryValue)} hint={`${medications.length} productos`} />
        <StatTile icon={Send} tone="text-muted-foreground" label="Unidades despachadas" value={out.reduce((s, m) => s - m.qty, 0)} hint="Dispensación + venta" />
        <StatTile icon={Trash2} tone="text-destructive" label="Mermas y vencidos" value={formatCLP(lossValue)} hint={`${losses.reduce((s, m) => s - m.qty, 0)} unidades`} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Medicamentos más despachados</CardTitle>
            <CardDescription>Unidades por dispensación y venta</CardDescription>
          </div>
          <ExportButton filename="medicamentos-despachados.csv" rows={top.map((t) => ({ Medicamento: t.name, Unidades: t.value }))} />
        </CardHeader>
        <CardContent>
          <ChartContainer config={single("Unidades")} className="aspect-auto h-72 w-full">
            <BarChart data={top} layout="vertical" margin={{ right: 28 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={150} />
              <XAxis type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="value" position="right" className="fill-foreground" fontSize={11} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Rotación y días de cobertura</CardTitle>
              <CardDescription>Con las salidas de los últimos 30 días</CardDescription>
            </div>
            <ExportButton
              filename="rotacion-farmacia.csv"
              rows={turnover.map((t) => ({ Medicamento: t.medication.name, "Salidas 30 d": t.out30, Stock: t.medication.stock, Rotación: t.rotation, "Cobertura días": t.coverageDays ?? "" }))}
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="text-right">Salidas</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Rotación</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnover.map((t) => (
                  <TableRow key={t.medication.id}>
                    <TableCell className="font-medium">{t.medication.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.out30}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.medication.stock}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.rotation}×</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={t.coverageDays! < 15 ? "destructive" : t.coverageDays! < 30 ? "secondary" : "outline"} className="tabular-nums">
                        {t.coverageDays} d
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Vencimientos próximos</CardTitle>
              <CardDescription>60 días o menos · {formatCLP(expiring.total)} a costo</CardDescription>
            </div>
            <Link href="/farmacia/medicamentos" className="text-sm text-primary hover:underline">Ajustar stock</Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiring.list.map((e) => (
                  <TableRow key={e.medication.id}>
                    <TableCell className="font-medium">{e.medication.name}</TableCell>
                    <TableCell>
                      <span className="tabular-nums">{formatDate(e.medication.expiry)}</span>{" "}
                      <Badge variant={e.days < 0 ? "destructive" : "secondary"}>{e.days < 0 ? "Vencido" : `${e.days} d`}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.medication.stock}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCLP(e.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NetworkReport() {
  const { requests, grants } = useStore();
  const sent = requests.filter((r) => r.from === currentClinic);
  const received = requests.filter((r) => r.to === currentClinic);
  const answered = received.filter((r) => r.respondedAt);
  const approval = answered.length ? Math.round((answered.filter((r) => r.status === "Aprobada").length / answered.length) * 100) : 0;
  const avgResponse = answered.length
    ? (answered.reduce((s, r) => s + (Date.parse(r.respondedAt!) - Date.parse(r.date)) / 86_400_000, 0) / answered.length).toFixed(1)
    : "—";
  const active = grants.filter((g) => grantStatus(g) === "Vigente");
  const rows = [
    { metric: "Solicitudes enviadas", value: sent.length, detail: `${sent.filter((r) => r.status === "Pendiente").length} pendientes` },
    { metric: "Solicitudes recibidas", value: received.length, detail: `${received.filter((r) => r.status === "Pendiente").length} pendientes` },
    { metric: "Accesos que recibimos (vigentes)", value: active.filter((g) => g.grantedTo === currentClinic).length, detail: "Fichas de otras clínicas" },
    { metric: "Accesos que otorgamos (vigentes)", value: active.filter((g) => g.ownerClinic === currentClinic).length, detail: "Fichas propias compartidas" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Inbox} label="Solicitudes recibidas" value={received.length} />
        <StatTile icon={ShieldCheck} label="Tasa de aprobación" value={`${approval}%`} hint="De las solicitudes respondidas" />
        <StatTile icon={Clock} tone="text-muted-foreground" label="Tiempo medio de respuesta" value={`${avgResponse} d`} />
        <StatTile icon={Send} tone="text-muted-foreground" label="Solicitudes enviadas" value={sent.length} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Intercambio de datos con la red</CardTitle>
            <CardDescription>Se actualiza al aprobar, rechazar o revocar accesos.</CardDescription>
          </div>
          <ExportButton filename="red.csv" rows={rows.map((r) => ({ Indicador: r.metric, Valor: r.value, Detalle: r.detail }))} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.metric}>
                  <TableCell className="font-medium">{r.metric}</TableCell>
                  <TableCell className="text-right"><Badge variant="secondary" className="tabular-nums">{r.value}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{r.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
