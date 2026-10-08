"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Users, Wallet, PawPrint } from "lucide-react";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ownerLastVisit, owners, petsOf, sectors } from "@/lib/lookups";
import { ownerName } from "@/domain/owners";
import { daysUntil, formatCLP, formatDate, formatRut, normalizeRut } from "@/lib/format";
import { useCanView } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/clickable-row";

export function OwnerList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("all");
  const canView = useCanView();
  const visible = owners.filter((o) => petsOf(o.rut).some((p) => canView(p.id)));
  const kpis = [
    { label: "Propietarios en tu clínica", icon: Users, value: visible.length },
    { label: "Con más de una mascota", icon: PawPrint, value: visible.filter((o) => petsOf(o.rut).length > 1).length },
    { label: "Con saldo pendiente", icon: Wallet, value: visible.filter((o) => o.balance > 0).length },
    { label: "Nuevos (últimos 30 días)", icon: UserPlus, value: visible.filter((o) => daysUntil(o.registeredAt) >= -30).length },
  ];

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const rows = visible
    .filter((o) => sector === "all" || o.sector === sector)
    .filter(
      (o) =>
        !q ||
        ownerName(o).toLowerCase().includes(q) ||
        o.email.includes(q) ||
        o.rut.includes(normalizeRut(q)) ||
        (digits.length >= 4 && o.phone.replace(/\D/g, "").includes(digits))
    )
    .sort((a, b) => ownerLastVisit(b.rut).localeCompare(ownerLastVisit(a.rut)));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <k.icon className="size-4 text-primary" /> {k.label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{k.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar propietarios"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, RUT, email o teléfono"
                className="pl-8"
              />
            </div>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger aria-label="Filtrar por sector" className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sectores</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propietario</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Mascotas</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const pets = petsOf(o.rut);
                return (
                  <TableRow key={o.rut} {...clickableRow(() => router.push(`/pacientes/propietarios/${o.rut}`))}>
                    <TableCell>
                      <div className="font-medium">{ownerName(o)}</div>
                      <div className="text-xs text-muted-foreground">{o.email}</div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatRut(o.rut)}</TableCell>
                    <TableCell className="tabular-nums">{o.phone}</TableCell>
                    <TableCell>{o.sector}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pets.map((p) => (
                          <span
                            key={p.id}
                            title={canView(p.id) ? undefined : `Sin acceso · ${p.clinic}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                              canView(p.id) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            <SpeciesIcon species={p.species} className="size-3" />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(ownerLastVisit(o.rut))}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", o.balance > 0 && "font-medium text-destructive")}>
                      {o.balance > 0 ? formatCLP(o.balance) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="whitespace-normal">
                    <EmptyState
                      icon={Users}
                      title={
                        <>
                          No hay propietarios en tu clínica que coincidan. ¿Es de otra clínica?{" "}
                          <Link href="/clinicas/red" className="text-primary hover:underline">Búscalo en la red</Link>
                        </>
                      }
                    />
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
