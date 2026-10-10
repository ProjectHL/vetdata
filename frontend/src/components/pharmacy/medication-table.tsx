"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CalendarX, CheckCircle2, PackageX, Pill, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Guard } from "@/components/settings/guard";
import { Button } from "@/components/ui/button";
import { EXPIRY_WARNING_DAYS, type Medication, type StockStatus, expiryStatus, stockStatus } from "@/domain/medications";
import { useStore } from "@/lib/store";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { formatDate, useToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/empty-state";

const stockBadge: Record<StockStatus, "default" | "secondary" | "destructive"> = {
  Disponible: "default",
  "Stock bajo": "secondary",
  "Sin stock": "destructive",
};

const stockIcon: Record<StockStatus, React.ComponentType<{ className?: string }>> = {
  Disponible: CheckCircle2,
  "Stock bajo": AlertTriangle,
  "Sin stock": PackageX,
};

export function MedicationTable() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyLow, setOnlyLow] = useState(false);
  const [adjusting, setAdjusting] = useState<Medication | null>(null);
  const { medications } = useStore();
  const today = useToday();
  const categories = [...new Set(medications.map((m) => m.category))].sort();
  const kpis = [
    { label: "Productos en catálogo", icon: Pill, value: medications.length, tone: "text-primary" },
    {
      label: "Stock bajo",
      icon: AlertTriangle,
      value: medications.filter((m) => stockStatus(m) === "Stock bajo").length,
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      label: `Por vencer (≤ ${EXPIRY_WARNING_DAYS} días)`,
      icon: CalendarClock,
      value: medications.filter((m) => expiryStatus(m, today) !== "ok").length,
      tone: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Sin stock",
      icon: PackageX,
      value: medications.filter((m) => stockStatus(m) === "Sin stock").length,
      tone: "text-destructive",
    },
  ];

  const q = query.trim().toLowerCase();
  const rows = medications.filter(
    (m) =>
      (category === "all" || m.category === category) &&
      (!onlyLow || stockStatus(m) !== "Disponible") &&
      (!q || [m.name, m.activeIngredient, m.lot].some((v) => v.toLowerCase().includes(q)))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <k.icon className={cn("size-4", k.tone)} />
                {k.label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{k.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar medicamentos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, principio activo o lote"
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Filtrar por categoría" className="w-full md:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox id="only-low" checked={onlyLow} onCheckedChange={(v) => setOnlyLow(v === true)} />
              <Label htmlFor="only-low" className="font-normal whitespace-nowrap">
                Solo stock bajo / sin stock
              </Label>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicamento</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Presentación</TableHead>
                <TableHead className="min-w-40">Stock</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Receta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const status = stockStatus(m);
                const StockIcon = stockIcon[status];
                const expiry = expiryStatus(m, today);
                // La barra llena = el doble del mínimo; bajo el mínimo queda bajo la mitad.
                const pct = Math.min(100, (m.stock / (m.minStock * 2)) * 100);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.activeIngredient}</div>
                    </TableCell>
                    <TableCell>{m.category}</TableCell>
                    <TableCell className="text-muted-foreground">{m.presentation}</TableCell>
                    <TableCell>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium tabular-nums">{m.stock}</span>
                        <span className="text-xs text-muted-foreground">mín. {m.minStock} {m.unit}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            status === "Disponible" ? "bg-primary" : status === "Stock bajo" ? "bg-amber-500" : "bg-destructive"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums">{formatDate(m.expiry)}</div>
                      <div className="text-xs text-muted-foreground">Lote {m.lot}</div>
                      {expiry === "vencido" && <Badge variant="destructive" className="mt-1"><CalendarX /> Vencido</Badge>}
                      {expiry === "por vencer" && (
                        <Badge variant="outline" className="mt-1 border-orange-300 text-orange-700 dark:text-orange-300">
                          <CalendarClock /> Por vencer
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{m.prescription ? "Sí" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant={stockBadge[status]}>
                        <StockIcon /> {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Guard permission="farmacia.inventario">
                        <Button size="sm" variant="ghost" onClick={() => setAdjusting(m)}>Ajustar</Button>
                      </Guard>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="whitespace-normal">
                    <EmptyState icon={Pill} title="No hay medicamentos que coincidan con los filtros." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AdjustStockDialog
        medication={adjusting && medications.find((m) => m.id === adjusting.id)!}
        onOpenChange={(o) => !o && setAdjusting(null)}
      />
    </div>
  );
}
