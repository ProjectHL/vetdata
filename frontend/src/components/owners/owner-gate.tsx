"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ownerName } from "@/domain/owners";
import { formatRut } from "@/lib/format";
import { useOwners, usePatients } from "@/lib/server-state";
import { useCanView } from "@/lib/store";

/** El detalle del dueño solo se ve si la clínica tiene acceso a al menos una de sus mascotas. */
export function OwnerGate({ ownerRut, children }: { ownerRut: string; children: React.ReactNode }) {
  const canView = useCanView();
  const owners = useOwners();
  const patients = usePatients();
  const owner = owners.find((o) => o.rut === ownerRut)!;
  if (patients.filter((p) => p.ownerRut === ownerRut).some((p) => canView(p.id))) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <p className="text-lg font-semibold">{ownerName(owner)}</p>
          <p className="text-sm text-muted-foreground tabular-nums">RUT {formatRut(owner.rut)} · {owner.sector}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Este dueño y sus mascotas están registrados en otra clínica. Solicita acceso desde la red para traer sus datos.
          </p>
          <Button asChild>
            <Link href={`/clinicas/red?rut=${owner.rut}`}>Buscar en la red de clínicas</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
