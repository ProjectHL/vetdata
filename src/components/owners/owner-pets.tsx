"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { PatientQuickView, useNextAppointment } from "@/components/care-actions/patient-quick-view";
import { Guard } from "@/components/settings/guard";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { StatusBadge } from "@/components/patients/status-badge";
import { currentClinic, getPatient } from "@/lib/lookups";
import { type Patient, lastVisit, patientAge } from "@/domain/patients";
import { RequestAccessDialog } from "@/components/sharing/request-access-dialog";
import { AccessBadge } from "@/components/sharing/access-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useAccess, usePendingRequest } from "@/lib/store";

export function OwnerPets({ patientIds }: { patientIds: string[] }) {
  const [selected, setSelected] = useState<Patient | null>(null);
  const pets = patientIds.map((id) => getPatient(id)!);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pets.map((p) => (
          <PetSlot key={p.id} patient={p} onOpen={() => setSelected(p)} />
        ))}
      </div>
      <PatientQuickView patient={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

function PetSlot({ patient, onOpen }: { patient: Patient; onOpen: () => void }) {
  const { level } = useAccess(patient.id);
  return level === "ninguno" ? <LockedTile patient={patient} /> : <PetTile patient={patient} onClick={onOpen} />;
}

function LockedTile({ patient: p }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const pending = usePendingRequest(p.id);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{p.name}</p>
        <p className="truncate text-xs text-muted-foreground">{p.species} · origen: {p.clinic}</p>
        {pending ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> Solicitud pendiente
          </p>
        ) : (
          <Guard permission="red.solicitar" className="mt-2">
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
              Solicitar acceso
            </Button>
          </Guard>
        )}
      </div>
      <RequestAccessDialog patientIds={[p.id]} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function PetTile({ patient: p, onClick }: { patient: Patient; onClick: () => void }) {
  const next = useNextAppointment(p.id);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-md"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <SpeciesIcon species={p.species} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{p.name}</span>
          <StatusBadge status={p.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {p.species} · {p.breed} · {patientAge(p)}
        </p>
        <p className="mt-2 text-xs">
          Última visita <span className="font-medium">{formatDate(lastVisit(p))}</span>
        </p>
        <p className="text-xs">
          Próxima cita{" "}
          <span className="font-medium">{next ? `${formatDate(next.date)} ${next.time} h` : "—"}</span>
        </p>
        <div className="mt-2">
          <AccessBadge
            level={p.clinic === currentClinic ? "propio" : "compartido"}
            origin={p.clinic === currentClinic ? undefined : p.clinic}
          />
        </div>
        {p.allergies.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="size-3" /> {p.allergies.join(", ")}
          </p>
        )}
      </div>
    </button>
  );
}
