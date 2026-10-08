"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutGrid, List, Network, Search, SearchX, X } from "lucide-react";
import { PatientQuickView } from "@/components/care-actions/patient-quick-view";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { AccessBadge } from "@/components/sharing/access-badge";
import { StatusBadge } from "@/components/patients/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { clinics, currentClinic, getOwner, patients } from "@/lib/lookups";
import { ownerName } from "@/domain/owners";
import { type Patient, type PatientStatus, lastVisit, patientAge } from "@/domain/patients";
import { formatDate, formatRut, normalizeRut } from "@/lib/format";
import { useCanView } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/clickable-row";

const SPECIES = ["Perro", "Gato", "Ave", "Conejo"];
const STATUSES: PatientStatus[] = ["Urgente", "Control", "Al día"];

const SORTS = {
  recent: { label: "Última visita", fn: (a: Patient, b: Patient) => lastVisit(b).localeCompare(lastVisit(a)) },
  name: { label: "Nombre (A–Z)", fn: (a: Patient, b: Patient) => a.name.localeCompare(b.name, "es") },
  age: { label: "Edad (mayor primero)", fn: (a: Patient, b: Patient) => a.birthDate.localeCompare(b.birthDate) },
  status: {
    label: "Prioridad (urgente primero)",
    fn: (a: Patient, b: Patient) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
  },
};
type SortKey = keyof typeof SORTS;

const ALL = "all";

const ORIGINS = {
  all: "Todas las accesibles",
  own: "Mi clínica",
  shared: "Compartidas conmigo",
};
type Origin = keyof typeof ORIGINS;

export function PetBrowser() {
  const [query, setQuery] = useState("");
  const [rut, setRut] = useState("");
  const [clinic, setClinic] = useState(ALL);
  const [species, setSpecies] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [origin, setOrigin] = useState<Origin>("all");
  const canView = useCanView();

  const q = query.trim().toLowerCase();
  const r = normalizeRut(rut.trim());
  const rows = patients
    .filter((p) => canView(p.id))
    .filter((p) => origin === "all" || (origin === "own") === (p.clinic === currentClinic))
    .filter((p) => clinic === ALL || p.clinic === clinic)
    .filter((p) => species === ALL || p.species === species)
    .filter((p) => status === ALL || p.status === status)
    .filter((p) => !r || p.ownerRut.includes(r))
    .filter((p) => !q || [p.name, p.chip, p.breed].some((v) => v.toLowerCase().includes(q)))
    .sort(SORTS[sort].fn);

  const hasFilters = q || r || clinic !== ALL || species !== ALL || status !== ALL || origin !== "all";
  const reset = () => {
    setQuery("");
    setRut("");
    setClinic(ALL);
    setSpecies(ALL);
    setStatus(ALL);
    setOrigin("all");
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar mascotas" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, raza o chip" className="pl-8" />
          </div>
          <Input aria-label="RUT del dueño" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="RUT del dueño (ej. 15.620.948-1)" />
          <FilterSelect value={clinic} onChange={setClinic} label="Clínica" all="Todas las clínicas" options={clinics} />
          <FilterSelect value={species} onChange={setSpecies} label="Especie" all="Todas las especies" options={SPECIES} />
          <FilterSelect value={status} onChange={setStatus} label="Estado" all="Todos los estados" options={STATUSES} />
          <Select value={origin} onValueChange={(v) => setOrigin(v as Origin)}>
            <SelectTrigger aria-label="Filtrar por origen" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ORIGINS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "mascota" : "mascotas"}
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger aria-label="Ordenar" size="sm" className="w-56">
              <span className="text-muted-foreground">Ordenar:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([key, s]) => (
                <SelectItem key={key} value={key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border p-0.5">
            <Button
              size="icon"
              variant={view === "cards" ? "secondary" : "ghost"}
              className="size-7"
              aria-label="Vista tarjetas"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid />
            </Button>
            <Button
              size="icon"
              variant={view === "table" ? "secondary" : "ghost"}
              className="size-7"
              aria-label="Vista tabla"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <List />
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={SearchX}
              title="No hay mascotas accesibles que coincidan con los filtros."
              className="py-12"
              action={
                r && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/clinicas/red?rut=${encodeURIComponent(r)}`}>
                      <Network /> Buscar este RUT en la red de clínicas
                    </Link>
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((p) => (
            <PetCard key={p.id} patient={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mascota</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const owner = getOwner(p.ownerRut)!;
                  return (
                    <TableRow key={p.id} {...clickableRow(() => setSelected(p))}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <SpeciesIcon species={p.species} className="size-4 text-primary" />
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.breed}</span>
                        </div>
                      </TableCell>
                      <TableCell>{patientAge(p)}</TableCell>
                      <TableCell>{ownerName(owner)}</TableCell>
                      <TableCell className="tabular-nums">{formatRut(owner.rut)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.clinic}</TableCell>
                      <TableCell className="tabular-nums">{formatDate(lastVisit(p))}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PatientQuickView patient={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  all,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PetCard({ patient: p, onClick }: { patient: Patient; onClick: () => void }) {
  const owner = getOwner(p.ownerRut)!;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        p.status === "Urgente" && "border-destructive/40"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SpeciesIcon species={p.species} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {p.breed} · {patientAge(p)}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Dueño</dt>
          <dd className="truncate font-medium">{ownerName(owner)}</dd>
          <dd className="text-muted-foreground tabular-nums">{formatRut(owner.rut)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última visita</dt>
          <dd className="font-medium tabular-nums">{formatDate(lastVisit(p))}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <AccessBadge level={p.clinic === currentClinic ? "propio" : "compartido"} origin={p.clinic === currentClinic ? undefined : p.clinic} />
        {p.allergies.length > 0 && (
          <Badge variant="destructive"><AlertTriangle /> Alergia</Badge>
        )}
      </div>
    </button>
  );
}
