"use client";

import Link from "next/link";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { Guard } from "@/components/settings/guard";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INTERNAL_PHARMACY } from "@/domain/referrals";
import { formatDate } from "@/lib/format";
import { read } from "@/lib/server-state";
import { doctors as mockDoctors } from "@/mocks/clinic";
import { patients as mockPatients } from "@/mocks/patients";
import { useStore } from "@/lib/store";
import { EmptyState } from "@/components/layout/empty-state";

/** Derivaciones a farmacia interna pendientes de entrega. */
export function DispenseQueue() {
  const { referrals, medications, dispenseReferral } = useStore();
  const doctors = read("doctors", mockDoctors);
  const patients = read("patients", mockPatients);
  const queue = referrals
    .filter((r) => r.destination === INTERNAL_PHARMACY && r.status !== "Dispensada")
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Por dispensar <Badge variant="secondary">{queue.length}</Badge>
        </CardTitle>
        <CardDescription>
          Fichas de medicamentos derivadas a farmacia interna. Al dispensar se descuenta el stock y queda en el kardex.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {queue.length === 0 && (
          <EmptyState icon={PackageCheck} title="No hay derivaciones pendientes." className="py-8" />
        )}
        {queue.map((r) => {
          const patient = patients.find((p) => p.id === r.patientId)!;
          const doctor = doctors.find((d) => d.id === r.doctorId);
          const lines = r.items.map((i) => {
            const med = medications.find((m) => m.id === i.medicationId)!;
            return { ...i, med, short: med.stock < i.qty };
          });
          const blocked = lines.some((l) => l.short);
          return (
            <div key={r.id} className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <SpeciesIcon species={patient.species} className="size-5" />
                </span>
                <div className="min-w-0 text-sm">
                  <p>
                    <Link href={`/pacientes/historial/${patient.id}`} className="font-semibold hover:text-primary hover:underline">
                      {patient.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {doctor?.name} · {formatDate(r.date)}</span>
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {lines.map((l) => (
                      <li key={l.medicationId} className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{l.qty} × {l.med.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {l.dose} · {l.frequency.toLowerCase()} · {l.duration}
                        </span>
                        {l.short && (
                          <Badge variant="destructive"><AlertTriangle /> Stock {l.med.stock}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                  {r.notes && <p className="mt-1 text-xs text-muted-foreground italic">{r.notes}</p>}
                </div>
              </div>
              <Guard permission="farmacia.dispensar">
                <Button disabled={blocked} onClick={() => dispenseReferral(r.id)}>
                  <PackageCheck /> Dispensar
                </Button>
              </Guard>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
