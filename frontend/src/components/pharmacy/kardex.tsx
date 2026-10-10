"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { MovementType } from "@/domain/pharmacy";
import { addDays, formatDate, useToday } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/empty-state";

const TYPES: MovementType[] = ["Entrada", "Salida", "Ajuste"];
const PERIODS = { "7": "Últimos 7 días", "30": "Últimos 30 días", all: "Todo" } as const;

const typeVariant: Record<MovementType, "default" | "secondary" | "destructive"> = {
  Entrada: "default",
  Salida: "secondary",
  Ajuste: "destructive",
};

export function Kardex() {
  const { movements, medications } = useStore();
  const [type, setType] = useState<"all" | MovementType>("all");
  const [medId, setMedId] = useState("all");
  const [period, setPeriod] = useState<keyof typeof PERIODS>("30");
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();

  const from = period === "all" ? "" : addDays(today, -Number(period));
  const inPeriod = movements.filter((m) => m.date >= from);
  const totals = {
    in: inPeriod.filter((m) => m.qty > 0).reduce((s, m) => s + m.qty, 0),
    out: inPeriod.filter((m) => m.type === "Salida").reduce((s, m) => s - m.qty, 0),
    loss: inPeriod.filter((m) => m.type === "Ajuste").reduce((s, m) => s - m.qty, 0),
  };

  // Orden cronológico inverso; el saldo se reconstruye hacia atrás desde el stock actual.
  const sorted = [...movements].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const balanceAfter = new Map<string, number>();
  if (medId !== "all") {
    let balance = medications.find((m) => m.id === medId)?.stock ?? 0;
    for (const m of sorted.filter((x) => x.medicationId === medId)) {
      balanceAfter.set(m.id, balance);
      balance -= m.qty;
    }
  }
  const rows = sorted.filter(
    (m) => m.date >= from && (type === "all" || m.type === type) && (medId === "all" || m.medicationId === medId)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={ArrowDownLeft} label="Unidades ingresadas" value={totals.in} tone="text-primary" />
        <Kpi icon={ArrowUpRight} label="Unidades despachadas" value={totals.out} tone="text-muted-foreground" />
        <Kpi icon={Trash2} label="Mermas y vencidos" value={totals.loss} tone="text-destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kardex</CardTitle>
          <CardDescription>Todos los movimientos de inventario: compras, dispensaciones, ventas y ajustes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={medId} onValueChange={setMedId}>
              <SelectTrigger aria-label="Medicamento" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los medicamentos</SelectItem>
                {medications.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger aria-label="Tipo de movimiento" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as keyof typeof PERIODS)}>
              <SelectTrigger aria-label="Período" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                {medId !== "all" && <TableHead className="text-right">Saldo</TableHead>}
                <TableHead>Documento</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">{formatDate(m.date)}</TableCell>
                  <TableCell className="font-medium">{medications.find((x) => x.id === m.medicationId)?.name}</TableCell>
                  <TableCell><Badge variant={typeVariant[m.type]}>{m.type}</Badge></TableCell>
                  <TableCell>{m.reason}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", m.qty > 0 ? "text-primary" : "text-foreground")}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </TableCell>
                  {medId !== "all" && <TableCell className="text-right tabular-nums">{balanceAfter.get(m.id)}</TableCell>}
                  <TableCell className="text-muted-foreground">{m.ref ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="whitespace-normal">
                    <EmptyState icon={History} title="Sin movimientos." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon className={cn("size-4", tone)} /> {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
