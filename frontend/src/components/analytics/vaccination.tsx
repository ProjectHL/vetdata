"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { AlertTriangle, BellRing, CalendarClock, CalendarPlus, Check, ShieldCheck } from "lucide-react";
import { PatientQuickView } from "@/components/care-actions/patient-quick-view";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import { coverage, dueVaccines, ownerOf, visiblePatients } from "@/lib/analytics";
import {
  useCoverageByVaccine,
  useCurrentClinic,
  usePatients,
  useVaccineCoverage,
} from "@/lib/server-state";
import { ownerName } from "@/domain/owners";
import { type Patient } from "@/domain/patients";
import { formatDate, useToday } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ExportButton, NetworkTag, StatTile, clinicVsNetwork } from "./shared";
import { EmptyState } from "@/components/layout/empty-state";

export function Vaccination() {
  const { grants, reminders, sendReminder } = useStore();
  const currentClinic = useCurrentClinic();
  const patients = usePatients();
  const vaccineCoverage = useVaccineCoverage();
  const coverageByVaccine = useCoverageByVaccine();
  const [scheduling, setScheduling] = useState<Patient | null>(null);
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();
  const mine = visiblePatients(grants, currentClinic, today);
  const due = dueVaccines(mine, today);
  const overdue = due.filter((d) => d.state === "vencida").length;
  const soon = due.length - overdue;
  const myCoverage = coverage(mine, today);
  const networkCoverage = coverage(patients, today);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={ShieldCheck} label="Cobertura al día · mi clínica" value={`${myCoverage}%`} hint={`${mine.length} pacientes propios y compartidos`} />
        <StatTile icon={ShieldCheck} tone="text-muted-foreground" label="Cobertura al día · red" value={`${networkCoverage}%`} hint={<NetworkTag />} />
        <StatTile icon={AlertTriangle} tone="text-destructive" label="Vacunas vencidas" value={overdue} hint="Requieren agendar" />
        <StatTile icon={CalendarClock} tone="text-amber-600 dark:text-amber-400" label="Por vencer (30 días)" value={soon} hint="Enviar recordatorio" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CoverageChart
          title="Cobertura por especie"
          data={vaccineCoverage}
          categoryKey="species"
        />
        <CoverageChart
          title="Cobertura por vacuna"
          data={coverageByVaccine}
          categoryKey="vaccine"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Vacunas vencidas y por vencer</CardTitle>
            <CardDescription>Pacientes de tu clínica (propios y compartidos). Agenda o avisa al dueño por su canal preferido.</CardDescription>
          </div>
          <ExportButton
            filename="vacunas-pendientes.csv"
            rows={due.map((d) => ({
              Mascota: d.patient.name,
              Vacuna: d.vaccine.name,
              "Próxima dosis": d.vaccine.nextDose ?? "",
              Estado: d.state,
              Dueño: ownerName(ownerOf(d.patient)),
              Teléfono: ownerOf(d.patient).phone,
            }))}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mascota</TableHead>
                <TableHead>Vacuna</TableHead>
                <TableHead>Próxima dosis</TableHead>
                <TableHead>Dueño · contacto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {due.map((d) => {
                const owner = ownerOf(d.patient);
                const reminded = reminders.includes(d.patient.id);
                return (
                  <TableRow key={`${d.patient.id}-${d.vaccine.name}`}>
                    <TableCell>
                      <Link href={`/pacientes/historial/${d.patient.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                        <SpeciesIcon species={d.patient.species} className="size-4 text-primary" />
                        {d.patient.name}
                      </Link>
                    </TableCell>
                    <TableCell>{d.vaccine.name}</TableCell>
                    <TableCell>
                      <span className="tabular-nums">{formatDate(d.vaccine.nextDose!)}</span>{" "}
                      {d.state === "vencida" ? (
                        <Badge variant="destructive"><AlertTriangle /> Vencida hace {-d.days} d</Badge>
                      ) : (
                        <Badge variant="secondary"><CalendarClock /> En {d.days} d</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {ownerName(owner)}
                      <span className="block text-xs text-muted-foreground">{owner.preferredContact} · {owner.phone}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" disabled={reminded} onClick={() => sendReminder(d.patient.id)}>
                          {reminded ? <><Check /> Avisado</> : <><BellRing /> Recordatorio</>}
                        </Button>
                        <Guard permission="agenda.gestionar">
                          <Button size="sm" variant="outline" onClick={() => setScheduling(d.patient)}>
                            <CalendarPlus /> Agendar
                          </Button>
                        </Guard>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {due.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="whitespace-normal">
                    <EmptyState icon={ShieldCheck} title="Todas las vacunas están al día." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PatientQuickView
        patient={scheduling}
        open={!!scheduling}
        onOpenChange={(o) => !o && setScheduling(null)}
        initialView="schedule"
      />
    </div>
  );
}

function CoverageChart({
  title,
  data,
  categoryKey,
}: {
  title: string;
  data: Record<string, string | number>[];
  categoryKey: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          % de pacientes con vacunas al día, últimos 12 meses <NetworkTag />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={clinicVsNetwork} className="aspect-auto h-64 w-full">
          <BarChart data={data} barGap={2} margin={{ top: 20 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v, name) => (
              <span className="flex w-full justify-between gap-4">
                <span className="text-muted-foreground">{clinicVsNetwork[name as keyof typeof clinicVsNetwork]?.label}</span>
                <span className="font-medium tabular-nums">{v}%</span>
              </span>
            )} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="clinica" fill="var(--color-clinica)" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="clinica" position="top" className="fill-foreground" fontSize={11} formatter={(v) => `${v}%`} />
            </Bar>
            <Bar dataKey="red" fill="var(--color-red)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
