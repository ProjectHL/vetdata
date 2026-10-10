"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  FileText,
  Phone,
  Pill,
  Receipt,
} from "lucide-react";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { StatusBadge } from "@/components/patients/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ownerName } from "@/domain/owners";
import { type Patient, lastVisit, patientAge } from "@/domain/patients";
import { TODAY, formatDate, formatRut } from "@/lib/format";
import { read } from "@/lib/server-state";
import { doctors as mockDoctors } from "@/mocks/clinic";
import { owners as mockOwners } from "@/mocks/owners";
import { useStore } from "@/lib/store";
import { Guard } from "@/components/settings/guard";
import { InvoiceForm } from "./invoice-form";
import { ReferralForm } from "./referral-form";
import { ScheduleForm } from "./schedule-form";

export type CareView = "summary" | "schedule" | "invoice" | "referral";

const titles: Record<Exclude<CareView, "summary">, string> = {
  schedule: "Agendar hora",
  invoice: "Generar factura por atención",
  referral: "Derivar ficha de medicamentos",
};

export function useNextAppointment(patientId: string) {
  const { appointments } = useStore();
  return appointments
    .filter((a) => a.patientId === patientId && a.date >= TODAY && (a.status === "Agendada" || a.status === "Confirmada"))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
}

export function PatientQuickView({
  patient,
  open,
  onOpenChange,
  initialView = "summary",
}: {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: CareView;
}) {
  return (
    <Dialog open={open && !!patient} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {patient && (
          // key: reinicia la vista interna cada vez que se abre otro paciente/acción.
          <QuickViewBody
            key={`${patient.id}-${initialView}`}
            patient={patient}
            initialView={initialView}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickViewBody({
  patient,
  initialView,
  onClose,
}: {
  patient: Patient;
  initialView: CareView;
  onClose: () => void;
}) {
  const [view, setView] = useState<CareView>(initialView);
  const owners = read("owners", mockOwners);
  const doctors = read("doctors", mockDoctors);
  const owner = owners.find((o) => o.rut === patient.ownerRut)!;
  const next = useNextAppointment(patient.id);
  // Si se abrió directo en una acción, "Listo" cierra el modal.
  const back = () => (initialView === "summary" ? setView("summary") : onClose());

  if (view !== "summary") {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initialView === "summary" && (
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setView("summary")} aria-label="Volver">
                <ArrowLeft />
              </Button>
            )}
            {titles[view]}
          </DialogTitle>
          <DialogDescription>
            {patient.name} · {patient.species} · {ownerName(owner)} ({formatRut(owner.rut)})
          </DialogDescription>
        </DialogHeader>
        {view === "schedule" && <ScheduleForm patient={patient} onDone={back} />}
        {view === "invoice" && <InvoiceForm patient={patient} onDone={back} />}
        {view === "referral" && <ReferralForm patient={patient} onDone={back} />}
      </>
    );
  }

  const nextDoctor = doctors.find((d) => d.id === next?.doctorId);

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SpeciesIcon species={patient.species} className="size-6" />
          </span>
          <div className="text-left">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {patient.name} <StatusBadge status={patient.status} />
            </DialogTitle>
            <DialogDescription>
              {patient.species} · {patient.breed} · {patient.sex} · {patientAge(patient)} · {patient.weightKg.toLocaleString("es-CL")} kg
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">Propietario</dt>
          <dd>
            <Link href={`/pacientes/propietarios/${owner.rut}`} className="font-medium hover:text-primary hover:underline" onClick={onClose}>
              {ownerName(owner)}
            </Link>
            <p className="text-xs text-muted-foreground">RUT {formatRut(owner.rut)}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3" /> {owner.phone}
            </p>
          </dd>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">Atención</dt>
          <dd>
            <p>Última visita: <span className="font-medium">{formatDate(lastVisit(patient))}</span></p>
            <p>
              Próxima cita:{" "}
              <span className="font-medium">
                {next ? `${formatDate(next.date)} ${next.time} h` : "sin agendar"}
              </span>
            </p>
            {next && nextDoctor && <p className="text-xs text-muted-foreground">{nextDoctor.name} · {next.reason}</p>}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{patient.clinic}</Badge>
        <Badge variant="outline">Chip {patient.chip}</Badge>
        <Badge variant="outline">{patient.sterilized ? "Esterilizado/a" : "No esterilizado/a"}</Badge>
        {patient.conditions.map((c) => (
          <Badge key={c} variant="secondary">{c}</Badge>
        ))}
        {patient.allergies.map((a) => (
          <Badge key={a} variant="destructive"><AlertTriangle /> {a}</Badge>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Guard permission="agenda.gestionar">
          <ActionButton icon={CalendarPlus} label="Agendar hora" onClick={() => setView("schedule")} />
        </Guard>
        <Guard permission="facturas.emitir">
          <ActionButton icon={Receipt} label="Generar factura" onClick={() => setView("invoice")} />
        </Guard>
        <Guard permission="medicamentos.derivar">
          <ActionButton icon={Pill} label="Derivar medicamentos" onClick={() => setView("referral")} />
        </Guard>
      </div>

      <Button asChild variant="outline">
        <Link href={`/pacientes/historial/${patient.id}`} onClick={onClose}>
          <FileText /> Ver ficha clínica completa
        </Link>
      </Button>
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

/** Botones de acción para la cabecera de la ficha clínica. */
export function CareActionButtons({ patient }: { patient: Patient }) {
  const [view, setView] = useState<CareView | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Guard permission="agenda.gestionar">
          <Button size="sm" onClick={() => setView("schedule")}><CalendarPlus /> Agendar hora</Button>
        </Guard>
        <Guard permission="facturas.emitir">
          <Button size="sm" variant="outline" onClick={() => setView("invoice")}><Receipt /> Generar factura</Button>
        </Guard>
        <Guard permission="medicamentos.derivar">
          <Button size="sm" variant="outline" onClick={() => setView("referral")}><Pill /> Derivar medicamentos</Button>
        </Guard>
      </div>
      <PatientQuickView
        patient={patient}
        open={view !== null}
        onOpenChange={(o) => !o && setView(null)}
        initialView={view ?? "summary"}
      />
    </>
  );
}
