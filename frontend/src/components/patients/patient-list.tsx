"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { ownerName } from "@/domain/owners";
import { lastVisit } from "@/domain/patients";
import { formatDate } from "@/lib/format";
import { useOwners, usePatients } from "@/lib/server-state";
import { useCanView } from "@/lib/store";
import { SpeciesIcon } from "./species-icon";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/clickable-row";

const SPECIES = ["Perro", "Gato", "Ave", "Conejo"];

export function PatientList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState("all");
  const canView = useCanView();
  const patients = usePatients();
  const owners = useOwners();
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);

  const q = query.trim().toLowerCase();
  const rows = patients
    .filter((p) => canView(p.id))
    .filter((p) => species === "all" || p.species === species)
    .filter(
      (p) =>
        !q ||
        [p.name, p.chip, ownerName(getOwner(p.ownerRut)!), p.ownerRut, p.breed].some((v) => v.toLowerCase().includes(q))
    )
    .sort((a, b) => lastVisit(b).localeCompare(lastVisit(a)));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar pacientes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, chip, raza o propietario"
              className="pl-8"
            />
          </div>
          <Select value={species} onValueChange={setSpecies}>
            <SelectTrigger aria-label="Filtrar por especie" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las especies</SelectItem>
              {SPECIES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Chip</TableHead>
              <TableHead>Clínica de origen</TableHead>
              <TableHead>Última visita</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} {...clickableRow(() => router.push(`/pacientes/historial/${p.id}`))}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <SpeciesIcon species={p.species} className="size-4" />
                    </span>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.species} · {p.breed}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{ownerName(getOwner(p.ownerRut)!)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.chip}</TableCell>
                <TableCell className="text-muted-foreground">{p.clinic}</TableCell>
                <TableCell className="tabular-nums">{formatDate(lastVisit(p))}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="whitespace-normal">
                    <EmptyState icon={SearchX} title="No hay pacientes que coincidan con la búsqueda." />
                  </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
