"use client";

import { useState } from "react";
import Link from "next/link";
import { Guard } from "@/components/settings/guard";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ownerName } from "@/domain/owners";
import { type AccessGrant, type GrantStatus, grantStatus } from "@/domain/sharing";
import { formatDate, formatRut } from "@/lib/format";
import { useCurrentClinic, useOwners, usePatients } from "@/lib/server-state";
import { useStore } from "@/lib/store";
import { EmptyState } from "@/components/layout/empty-state";

const statusVariant: Record<GrantStatus, "default" | "secondary" | "outline"> = {
  Vigente: "default",
  Vencido: "secondary",
  Revocado: "outline",
};

export function SharedTabs() {
  const { grants } = useStore();
  const currentClinic = useCurrentClinic();
  const withMe = grants.filter((g) => g.grantedTo === currentClinic);
  const byMe = grants.filter((g) => g.ownerClinic === currentClinic);
  const vigentes = (list: AccessGrant[]) => list.filter((g) => grantStatus(g) === "Vigente").length;

  return (
    <Tabs defaultValue="conmigo">
      <TabsList>
        <TabsTrigger value="conmigo">Compartidos conmigo ({vigentes(withMe)})</TabsTrigger>
        <TabsTrigger value="por-mi">Compartidos por mí ({vigentes(byMe)})</TabsTrigger>
      </TabsList>
      <TabsContent value="conmigo">
        <Card>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Mascotas de otras clínicas que tu clínica puede ver. Aparecen en Mascotas, Historial y Propietarios mientras el acceso esté vigente.
            </p>
            <GrantTable grants={withMe} counterpart="ownerClinic" />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="por-mi">
        <SharedByMe grants={byMe} />
      </TabsContent>
    </Tabs>
  );
}

function SharedByMe({ grants }: { grants: AccessGrant[] }) {
  const [status, setStatus] = useState<"all" | GrantStatus>("all");
  const rows = grants.filter((g) => status === "all" || grantStatus(g) === status);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Pacientes de tu clínica que otras clínicas pueden ver. Puedes revocar el acceso en cualquier momento.
          </p>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="Vigente">Vigente</SelectItem>
              <SelectItem value="Vencido">Vencido</SelectItem>
              <SelectItem value="Revocado">Revocado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <GrantTable grants={rows} counterpart="grantedTo" canRevoke />
      </CardContent>
    </Card>
  );
}

function GrantTable({
  grants,
  counterpart,
  canRevoke,
}: {
  grants: AccessGrant[];
  counterpart: "ownerClinic" | "grantedTo";
  canRevoke?: boolean;
}) {
  const { revokeGrant } = useStore();
  const patients = usePatients();
  const owners = useOwners();
  if (grants.length === 0) {
    return <EmptyState title="No hay accesos." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mascota</TableHead>
          <TableHead>Dueño</TableHead>
          <TableHead>{counterpart === "ownerClinic" ? "Clínica de origen" : "Compartido con"}</TableHead>
          <TableHead>Alcance</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead>Vence</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {grants.map((g) => {
          const p = patients.find((p) => p.id === g.patientId)!;
          const owner = owners.find((o) => o.rut === p.ownerRut)!;
          const status = grantStatus(g);
          return (
            <TableRow key={g.id}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <SpeciesIcon species={p.species} className="size-4 text-primary" />
                  {status === "Vigente" ? (
                    <Link href={`/pacientes/historial/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
                  ) : (
                    <span className="font-medium">{p.name}</span>
                  )}
                </span>
              </TableCell>
              <TableCell>
                {ownerName(owner)}
                <span className="block text-xs text-muted-foreground tabular-nums">{formatRut(owner.rut)}</span>
              </TableCell>
              <TableCell>{g[counterpart]}</TableCell>
              <TableCell>{g.scope}</TableCell>
              <TableCell className="tabular-nums">{formatDate(g.since)}</TableCell>
              <TableCell className="tabular-nums">{g.until ? formatDate(g.until) : "Permanente"}</TableCell>
              <TableCell><Badge variant={statusVariant[status]}>{status}</Badge></TableCell>
              <TableCell className="text-right">
                {canRevoke && status === "Vigente" && (
                  <Guard permission="red.revocar">
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => revokeGrant(g.id)}>
                      Revocar
                    </Button>
                  </Guard>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
