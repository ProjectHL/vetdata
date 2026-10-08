"use client";

import Link from "next/link";
import { ArrowRight, KeyRound, PawPrint, Send, ShoppingBag, Stethoscope, Syringe, Truck } from "lucide-react";
import { StatusBadge } from "@/components/patients/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { visiblePatients } from "@/lib/analytics";
import { currentClinic, getOwner, getPatient } from "@/lib/lookups";
import { ownerName } from "@/domain/owners";
import { lastVisit } from "@/domain/patients";
import { formatCLP, formatDate } from "@/lib/format";
import { consultsThisMonth, vaccineKpis } from "@/lib/metrics/clinic";
import { speciesDistribution } from "@/lib/metrics/customers";
import { retailKpis } from "@/lib/metrics/retail";
import { useRetail } from "@/lib/retail-store";
import { useStore } from "@/lib/store";
import { AdminAlerts } from "./shared";

export function AdminDay() {
  const { grants, requests } = useStore();
  const { sales, products } = useRetail();
  const visible = visiblePatients(grants, currentClinic);
  const own = visible.filter((p) => p.clinic === currentClinic).length;
  const consults = consultsThisMonth();
  const vax = vaccineKpis(visible);
  const retail = retailKpis(sales, products);
  const species = speciesDistribution(visible);
  const recent = [...visible].sort((a, b) => lastVisit(b).localeCompare(lastVisit(a))).slice(0, 6);

  const kpis = [
    { label: "Mascotas en mi clínica", value: visible.length, hint: `${own} propias · ${visible.length - own} compartidas`, icon: PawPrint, href: "/pacientes/mascotas" },
    { label: "Consultas del mes", value: consults.value, hint: `Octubre en curso · septiembre ${consults.previous}`, icon: Stethoscope, href: "/analisis/diagnosticos" },
    { label: "Ventas tienda hoy", value: formatCLP(retail.todayTotal), hint: `${retail.todayCount} boletas`, icon: ShoppingBag, href: "/analisis/tienda" },
    { label: "Vacunas vencidas", value: vax.overdue, hint: `${vax.soon} por vencer en 30 días`, icon: Syringe, href: "/analisis/vacunacion" },
  ];

  // Actividad reciente: red (solicitudes y accesos) + pedidos web de la tienda.
  const activity = [
    ...requests
      .filter((r) => r.to === currentClinic || r.from === currentClinic)
      .map((r) => ({
        date: r.respondedAt ?? r.date,
        icon: Send,
        text:
          r.to === currentClinic
            ? `${r.from} solicitó acceso a ${getPatient(r.patientId)?.name}${r.status !== "Pendiente" ? ` · ${r.status.toLowerCase()}` : ""}`
            : `Pediste acceso a ${getPatient(r.patientId)?.name} en ${r.to} · ${r.status.toLowerCase()}`,
        href: "/clinicas/solicitudes",
      })),
    ...grants
      .filter((g) => g.grantedTo === currentClinic)
      .map((g) => ({ date: g.since, icon: KeyRound, text: `${g.ownerClinic} compartió la ficha de ${getPatient(g.patientId)?.name}`, href: "/clinicas/compartidos" })),
    ...sales
      .filter((s) => s.channel === "Web" && s.ownerRut)
      .map((s) => ({ date: s.date, icon: Truck, text: `Pedido web de ${ownerName(getOwner(s.ownerRut!)!)} · ${formatCLP(s.total)}`, href: "/tienda/despachos" })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <AdminAlerts />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <k.icon className="size-4 text-primary" /> {k.label}
                  <ArrowRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{k.value}</CardTitle>
                <p className="text-xs text-muted-foreground">{k.hint}</p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Pacientes recientes</CardTitle>
            <CardDescription>Últimas atenciones de pacientes visibles para tu clínica.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mascota</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/pacientes/historial/${p.id}`} className="font-medium hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.species} · {p.breed}</div>
                    </TableCell>
                    <TableCell>{ownerName(getOwner(p.ownerRut)!)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.clinic}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(lastVisit(p))}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pacientes por especie</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {species.map((s) => (
                <div key={s.species} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{s.species}</span>
                    <span className="text-muted-foreground tabular-nums">{s.count} · {s.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-[var(--viz-1)]" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {activity.map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="flex gap-3 text-sm hover:text-primary">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <a.icon className="size-3.5" />
                      </span>
                      <span>
                        {a.text}
                        <span className="block text-xs text-muted-foreground">{formatDate(a.date)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
