"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Lock, Share2, Stethoscope } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Guard } from "@/components/settings/guard";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { durationLabel } from "@/domain/sharing";
import { formatDate } from "@/lib/format";
import { usePatients } from "@/lib/server-state";
import { useAccess, usePendingRequest } from "@/lib/store";
import { RequestAccessDialog } from "./request-access-dialog";

/**
 * Aplica la regla de acceso a la ficha:
 * propio / compartido "Ficha completa" → todo; "Resumen clínico" → resumen; sin acceso → bloqueada.
 */
export function AccessGate({ patientId, children }: { patientId: string; children: React.ReactNode }) {
  const { level, grant } = useAccess(patientId);
  const patients = usePatients();
  const patient = patients.find((p) => p.id === patientId)!;

  if (level === "propio") return <>{children}</>;
  if (level === "ninguno") return <LockedRecord patientId={patientId} />;

  const banner = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <Share2 className="size-4 text-primary" />
      <span>
        Compartido por <strong>{patient.clinic}</strong> · {grant!.scope}
      </span>
      <span className="text-muted-foreground">
        · {grant!.until ? `vence el ${formatDate(grant!.until)}` : "acceso permanente"}
      </span>
    </div>
  );

  if (grant!.scope === "Ficha completa") {
    return (
      <PageContainer className="w-full">
        {banner}
        {children}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {banner}
      <PatientSummary patientId={patientId} />
    </PageContainer>
  );
}

function PatientHeader({ patientId }: { patientId: string }) {
  const patients = usePatients();
  const p = patients.find((p) => p.id === patientId)!;
  return (
    <div className="flex items-center gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <SpeciesIcon species={p.species} className="size-7" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
        <p className="text-sm text-muted-foreground">
          {p.species} · {p.breed} · clínica de origen: {p.clinic}
        </p>
      </div>
    </div>
  );
}

function PatientSummary({ patientId }: { patientId: string }) {
  const patients = usePatients();
  const p = patients.find((p) => p.id === patientId)!;
  return (
    <>
      <Card>
        <CardContent><PatientHeader patientId={patientId} /></CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-4" /> Alergias</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {p.allergies.length ? p.allergies.map((a) => <Badge key={a} variant="destructive">{a}</Badge>) : <span className="text-sm text-muted-foreground">Sin alergias registradas</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Stethoscope className="size-4 text-primary" /> Condiciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {p.conditions.length ? p.conditions.map((c) => <Badge key={c} variant="secondary">{c}</Badge>) : <span className="text-sm text-muted-foreground">Sin condiciones crónicas</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Vacunas</CardTitle></CardHeader>
          <CardContent>
            {p.vaccines.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {p.vaccines.map((v) => (
                  <li key={v.name} className="flex justify-between gap-2">
                    <span>{v.name}</span>
                    <span className="text-muted-foreground tabular-nums">{formatDate(v.date)}</span>
                  </li>
                ))}
              </ul>
            ) : <span className="text-sm text-muted-foreground">Sin vacunas registradas</span>}
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Acceso de tipo resumen clínico: consultas, exámenes y recetas no están incluidos.
      </p>
    </>
  );
}

function LockedRecord({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const pending = usePendingRequest(patientId);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-6">
          <PatientHeader patientId={patientId} />
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <p className="font-medium">Tu clínica no tiene acceso a esta ficha</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Los datos clínicos pertenecen a la clínica de origen. Solicita acceso y, cuando la aprueben con el
              consentimiento del dueño, la ficha aparecerá aquí.
            </p>
            {pending ? (
              <Badge variant="secondary">
                <Clock /> Solicitud enviada el {formatDate(pending.date)} · {pending.scope} · {durationLabel(pending.duration)}
              </Badge>
            ) : (
              <Guard permission="red.solicitar">
                <Button onClick={() => setOpen(true)}>Solicitar acceso</Button>
              </Guard>
            )}
          </div>
        </CardContent>
      </Card>
      <RequestAccessDialog patientIds={[patientId]} open={open} onOpenChange={setOpen} />
    </div>
  );
}
