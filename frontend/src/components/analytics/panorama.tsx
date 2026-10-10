"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  Banknote,
  Building2,
  Cctv,
  ChevronRight,
  LifeBuoy,
  Percent,
  Pill,
  ShoppingBag,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { RequirePermission } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { visiblePatients } from "@/lib/analytics";
import { useCurrentClinic, useRevenueByLine as useRevenueByLineLive } from "@/lib/server-state";
import { SERVICES_MARGIN } from "@/domain/metrics";
import { COST_RATIO } from "@/domain/pharmacy";
import { grantStatus } from "@/domain/sharing";
import { formatCLP, useToday } from "@/lib/format";
import { consultsThisMonth, vaccineKpis } from "@/lib/metrics/clinic";
import { pharmacyKpis } from "@/lib/metrics/pharmacy";
import { marginByCategory, productTurnover, retailKpis, retailMonthNet, shipmentKpis } from "@/lib/metrics/retail";
import { supportKpis } from "@/lib/metrics/support";
import { OPEN_EVENT } from "@/domain/security";
import { useRetail } from "@/lib/retail-store";
import { useSecurity } from "@/lib/security-store";
import { useStore } from "@/lib/store";
import { useSupport } from "@/lib/support-store";
import { cn } from "@/lib/utils";
import { StatTile } from "./shared";

const linesConfig = {
  servicios: { label: "Servicios clínicos", color: "var(--viz-1)" },
  farmacia: { label: "Farmacia", color: "var(--viz-2)" },
  tienda: { label: "Tienda", color: "var(--viz-3)" },
} satisfies ChartConfig;

const millions = (n: number) => `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;

/** Serie de ingresos con el mes en curso de la tienda calculado desde las boletas. */
function useRevenueByLine() {
  const { sales } = useRetail();
  const base = useRevenueByLineLive();
  // T5-5: fecha real tras el montaje en modo http (fijo en mock/SSR).
  const today = useToday();
  const series = base.map((m) => ({ ...m }));
  series[series.length - 1].tienda = retailMonthNet(sales, today);
  return series;
}

export function Panorama() {
  const { grants, requests, medications, referrals } = useStore();
  const { sales, products, shipments } = useRetail();
  const { tickets } = useSupport();
  const security = useSecurity();
  const currentClinic = useCurrentClinic();
  // T5-5: fecha real tras el montaje en modo http (fijo en mock/SSR).
  const today = useToday();
  const camsOnline = security.cameras.filter((c) => c.status === "En línea").length;
  const openEvents = security.events.filter((e) => OPEN_EVENT.includes(e.status));
  const criticalNew = openEvents.filter((e) => e.severity === "Crítica" && e.status === "Nuevo").length;
  const series = useRevenueByLine();

  const visible = visiblePatients(grants, currentClinic, today);
  const vax = vaccineKpis(visible, today);
  const consults = consultsThisMonth();
  const pharma = pharmacyKpis(medications, referrals);
  const retail = retailKpis(sales, products, today);
  const retailMargin = marginByCategory(sales, products);
  const breakSoon = productTurnover(sales, products).filter((t) => t.coverageDays !== null && t.coverageDays < 7).length;
  const ship = shipmentKpis(shipments, today);
  const support = supportKpis(tickets);
  const pendingRequests = requests.filter((r) => r.to === currentClinic && r.status === "Pendiente").length;
  const activeGrants = grants.filter((g) => grantStatus(g, today) === "Vigente").length;

  const sept = series[series.length - 2];
  const aug = series[series.length - 3];
  const septTotal = sept.servicios + sept.farmacia + sept.tienda;
  const augTotal = aug.servicios + aug.farmacia + aug.tienda;
  const septMargin = sept.servicios * SERVICES_MARGIN + sept.farmacia * (1 - COST_RATIO) + sept.tienda * (retailMargin.pct / 100);
  const oct = series[series.length - 1];

  const attention = [
    { count: criticalNew, label: "eventos de seguridad críticos sin revisar", href: "/seguridad/eventos", tone: "critical" },
    { count: support.critical, label: "tickets críticos abiertos con VetData", href: "/soporte/tickets", tone: "critical" },
    { count: security.cameras.length - camsOnline, label: "cámaras sin señal", href: "/seguridad/dispositivos", tone: "warning" },
    { count: vax.overdue, label: "vacunas vencidas en pacientes de tu clínica", href: "/analisis/vacunacion", tone: "critical" },
    { count: pendingRequests, label: "solicitudes de la red por responder", href: "/clinicas/solicitudes", tone: "warning" },
    { count: pharma.pendingDispense, label: "recetas por dispensar en farmacia", href: "/farmacia/movimientos", tone: "warning" },
    { count: ship.late.length, label: "despachos atrasados", href: "/tienda/despachos", tone: "warning" },
    { count: breakSoon, label: "productos de tienda con quiebre en menos de 7 días", href: "/analisis/tienda", tone: "warning" },
    { count: pharma.lowStock, label: "medicamentos bajo el stock mínimo", href: "/farmacia/proveedores", tone: "info" },
    { count: retail.refill, label: "productos por reponer en sala", href: "/tienda/bodega", tone: "info" },
    { count: support.atRisk, label: "tickets con SLA en riesgo o vencido", href: "/soporte/tickets", tone: "info" },
  ].filter((a) => a.count > 0);

  const areas = [
    { icon: Stethoscope, title: "Clínica", href: "/analisis/diagnosticos", kpis: [["Consultas del mes", consults.value], ["Cobertura vacunas", `${vax.coverage}%`]] },
    { icon: Pill, title: "Farmacia", href: "/farmacia/movimientos", kpis: [["Stock bajo", pharma.lowStock], ["Por dispensar", pharma.pendingDispense]] },
    { icon: ShoppingBag, title: "Tienda", href: "/analisis/tienda", kpis: [["Ventas hoy", formatCLP(retail.todayTotal)], ["Reponer sala", retail.refill]] },
    { icon: Building2, title: "Red", href: "/clinicas/solicitudes", kpis: [["Solicitudes pendientes", pendingRequests], ["Accesos vigentes", activeGrants]] },
    { icon: LifeBuoy, title: "Soporte", href: "/soporte/tickets", kpis: [["Tickets abiertos", support.open], ["SLA en riesgo", support.atRisk]] },
    { icon: Cctv, title: "Seguridad", href: "/seguridad/monitoreo", kpis: [["Cámaras en línea", `${camsOnline}/${security.cameras.length}`], ["Eventos abiertos", openEvents.length]] },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <RequirePermission permission="reportes.financiero" message="Los ingresos y márgenes están disponibles para roles con permiso de reportes financieros.">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Banknote} label="Ingresos septiembre (neto)" value={millions(septTotal)} hint={`${septTotal >= augTotal ? "+" : ""}${Math.round(((septTotal - augTotal) / augTotal) * 100)}% vs agosto`} />
            <StatTile icon={Percent} label="Margen bruto estimado" value={`${Math.round((septMargin / septTotal) * 100)}%`} hint={millions(septMargin)} />
            <StatTile icon={ShoppingBag} tone="text-muted-foreground" label="Participación tienda" value={`${Math.round((sept.tienda / septTotal) * 100)}%`} hint={`Margen tienda ${retailMargin.pct}%`} />
            <StatTile icon={TrendingUp} tone="text-muted-foreground" label="Octubre en curso" value={millions(oct.servicios + oct.farmacia + oct.tienda)} hint="7 días · tienda calculada de boletas" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por línea de negocio</CardTitle>
              <CardDescription>
                Neto mensual, últimos 12 meses. Margen supuesto: servicios {Math.round(SERVICES_MARGIN * 100)}%, farmacia {Math.round((1 - COST_RATIO) * 100)}%, tienda según costo real ({retailMargin.pct}%).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={linesConfig} className="aspect-auto h-72 w-full">
                <BarChart data={series}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v / 1_000_000}M`} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(v, name) => (
                          <span className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{linesConfig[name as keyof typeof linesConfig]?.label}</span>
                            <span className="font-medium tabular-nums">{millions(Number(v))}</span>
                          </span>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {/* Separación de 2px entre segmentos apilados (stroke del color de fondo). */}
                  <Bar dataKey="servicios" stackId="a" fill="var(--color-servicios)" stroke="var(--card)" strokeWidth={2} />
                  <Bar dataKey="farmacia" stackId="a" fill="var(--color-farmacia)" stroke="var(--card)" strokeWidth={2} />
                  <Bar dataKey="tienda" stackId="a" fill="var(--color-tienda)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </RequirePermission>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {areas.map((a) => (
            <Link key={a.title} href={a.href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <a.icon className="size-4 text-primary" /> {a.title}
                    <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {a.kpis.map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xl font-semibold tabular-nums">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requiere atención</CardTitle>
            <CardDescription>Ordenado por urgencia. Cada ítem lleva al módulo donde se resuelve.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {attention.length === 0 && <p className="text-sm text-muted-foreground">Todo al día.</p>}
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary/50"
              >
                <Badge
                  variant={a.tone === "critical" ? "destructive" : a.tone === "warning" ? "secondary" : "outline"}
                  className={cn("min-w-9 justify-center tabular-nums")}
                >
                  {a.count}
                </Badge>
                <span className="flex-1">{a.label}</span>
                <span className="text-xs text-muted-foreground">
                  {a.tone === "critical" ? "Urgente" : a.tone === "warning" ? "Pronto" : "Revisar"}
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
