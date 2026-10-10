"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { SpeciesIcon } from "@/components/patients/species-icon";
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
import { patientsWithCategory, visiblePatients } from "@/lib/analytics";
import {
  useCurrentClinic,
  useDiagnosisCategories,
  useMonthlyConsults,
  useNetworkAlerts,
} from "@/lib/server-state";
import { formatDate, useToday } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ExportButton, NetworkTag, clinicVsNetwork } from "./shared";

const PERIODS = { "3": "Últimos 3 meses", "6": "Últimos 6 meses", "12": "Últimos 12 meses" } as const;

const casesConfig = { clinica: { label: "Casos", color: "var(--viz-1)" } } satisfies ChartConfig;

export function Diagnoses() {
  const { grants } = useStore();
  const currentClinic = useCurrentClinic();
  const diagnosisCategories = useDiagnosisCategories();
  const monthlyConsults = useMonthlyConsults();
  const networkAlerts = useNetworkAlerts();
  const [period, setPeriod] = useState<keyof typeof PERIODS>("12");
  const [category, setCategory] = useState(diagnosisCategories[0].category);
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();
  const trend = monthlyConsults.slice(-Number(period));
  const mine = visiblePatients(grants, currentClinic, today);
  const matches = patientsWithCategory(mine, category);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Consultas por mes</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              Mi clínica vs promedio por clínica de la red (octubre en curso) <NetworkTag />
            </CardDescription>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as keyof typeof PERIODS)}>
            <SelectTrigger aria-label="Período" size="sm" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ChartContainer config={clinicVsNetwork} className="aspect-auto h-64 w-full">
            <LineChart data={trend} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="clinica" type="monotone" stroke="var(--color-clinica)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line dataKey="red" type="monotone" stroke="var(--color-red)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Diagnósticos por categoría</CardTitle>
              <CardDescription>Casos en tu clínica, últimos 90 días. Haz clic en una barra para ver pacientes.</CardDescription>
            </div>
            <ExportButton
              filename="diagnosticos.csv"
              rows={diagnosisCategories.map((d) => ({ Categoría: d.category, "Casos mi clínica": d.clinica, "% red": d.redPct }))}
            />
          </CardHeader>
          <CardContent>
            <ChartContainer config={casesConfig} className="aspect-auto h-80 w-full">
              <BarChart data={diagnosisCategories} layout="vertical" margin={{ right: 32 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={110} />
                <XAxis type="number" hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />
                <Bar
                  dataKey="clinica"
                  radius={[0, 4, 4, 0]}
                  className="cursor-pointer"
                  onClick={(d) => setCategory((d as unknown as { category: string }).category)}
                >
                  {diagnosisCategories.map((d) => (
                    <Cell key={d.category} fill="var(--color-clinica)" fillOpacity={d.category === category ? 1 : 0.45} />
                  ))}
                  <LabelList dataKey="clinica" position="right" className="fill-foreground" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
            <CardDescription>
              {diagnosisCategories.find((d) => d.category === category)?.redPct}% de los diagnósticos de la red · pacientes de tu clínica:
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {matches.length === 0 && <p className="text-sm text-muted-foreground">Ningún paciente visible con esta categoría.</p>}
            {matches.map(({ patient, hits }) => (
              <Link
                key={patient.id}
                href={`/pacientes/historial/${patient.id}`}
                className="flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary/50"
              >
                <SpeciesIcon species={patient.species} className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="font-medium">{patient.name}</p>
                  {hits.map((h, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{formatDate(h.date)} · {h.diagnosis}</p>
                  ))}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">Alertas de la red por sector <NetworkTag /></CardTitle>
          <CardDescription>Casos de los últimos 30 días frente a los 30 días previos. Sin datos de pacientes ni dueños.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Casos 30 d</TableHead>
                <TableHead className="text-right">Variación</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networkAlerts.map((a) => {
                const pct = Math.round(((a.current - a.previous) / a.previous) * 100);
                const level = pct >= 25 ? "alta" : pct > 5 ? "media" : pct < -5 ? "baja" : "estable";
                const Icon = pct > 5 ? ArrowUpRight : pct < -5 ? ArrowDownRight : Minus;
                return (
                  <TableRow key={`${a.sector}-${a.category}`}>
                    <TableCell className="font-medium">{a.sector}</TableCell>
                    <TableCell>{a.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.current}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={level === "alta" ? "destructive" : "outline"}
                        className={cn(level === "media" && "text-amber-700 dark:text-amber-300")}
                      >
                        <Icon /> {pct > 0 ? "+" : ""}{pct}% · {level}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{a.note}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
