"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AppointmentStatus } from "@/domain/appointments";
import type { Invoice } from "@/domain/invoices";
import { formatCLP, formatDate, useToday } from "@/lib/format";
import { useDoctorsAll, usePatients } from "@/lib/server-state";
import { useStore } from "@/lib/store";
import { InvoicePreview } from "./invoice-form";
import { EmptyState } from "@/components/layout/empty-state";

const apptVariant: Record<AppointmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Confirmada: "default",
  Agendada: "secondary",
  Realizada: "outline",
  Cancelada: "destructive",
  "No asistió": "destructive",
};

function Empty({ text }: { text: string }) {
  return <EmptyState title={text} />;
}

/** Muestra columna "Paciente" cuando se listan varias mascotas (vista propietario). */
type Props = { patientIds: string[]; showPatient?: boolean };

export function AppointmentsTable({ patientIds, showPatient }: Props) {
  const { appointments, rooms } = useStore();
  const patients = usePatients();
  const doctors = useDoctorsAll();
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();
  const rows = appointments
    .filter((a) => patientIds.includes(a.patientId))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  if (rows.length === 0) return <Empty text="Sin citas registradas." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          {showPatient && <TableHead>Paciente</TableHead>}
          <TableHead>Profesional</TableHead>
          <TableHead>Box</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id} className={a.date < today ? "text-muted-foreground" : undefined}>
            <TableCell className="tabular-nums">{formatDate(a.date)} · {a.time}</TableCell>
            {showPatient && <TableCell className="font-medium">{patients.find((p) => p.id === a.patientId)?.name}</TableCell>}
            <TableCell>{doctors.find((d) => d.id === a.doctorId)?.name}</TableCell>
            <TableCell>{rooms.find((r) => r.id === a.roomId)?.name ?? "—"}</TableCell>
            <TableCell>{a.reason}</TableCell>
            <TableCell><Badge variant={apptVariant[a.status]}>{a.status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function InvoicesTable({ patientIds, showPatient }: Props) {
  const { invoices } = useStore();
  const patients = usePatients();
  const [open, setOpen] = useState<Invoice | null>(null);
  const rows = invoices
    .filter((i) => patientIds.includes(i.patientId))
    .sort((a, b) => b.folio - a.folio);
  if (rows.length === 0) return <Empty text="Sin facturas emitidas." />;
  const openPatient = open ? patients.find((p) => p.id === open.patientId) : undefined;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Fecha</TableHead>
            {showPatient && <TableHead>Paciente</TableHead>}
            <TableHead>Detalle</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium tabular-nums">N° {i.folio}</TableCell>
              <TableCell className="tabular-nums">{formatDate(i.date)}</TableCell>
              {showPatient && <TableCell>{patients.find((p) => p.id === i.patientId)?.name}</TableCell>}
              <TableCell className="max-w-56 truncate text-muted-foreground">
                {i.items.map((x) => x.description).join(", ")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCLP(i.total)}</TableCell>
              <TableCell>
                <Badge variant={i.status === "Pagada" ? "outline" : "secondary"}>{i.status}</Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" onClick={() => setOpen(i)}>Ver</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Factura N° {open?.folio}</DialogTitle>
          </DialogHeader>
          {open && openPatient && <InvoicePreview invoice={open} patient={openPatient} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReferralsTable({ patientIds, showPatient }: Props) {
  const { referrals, medications } = useStore();
  const patients = usePatients();
  const doctors = useDoctorsAll();
  const rows = referrals
    .filter((r) => patientIds.includes(r.patientId))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (rows.length === 0) return <Empty text="Sin derivaciones de medicamentos." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          {showPatient && <TableHead>Paciente</TableHead>}
          <TableHead>Destino</TableHead>
          <TableHead>Medicamentos</TableHead>
          <TableHead>Profesional</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="tabular-nums">{formatDate(r.date)}</TableCell>
            {showPatient && <TableCell className="font-medium">{patients.find((p) => p.id === r.patientId)?.name}</TableCell>}
            <TableCell>{r.destination}</TableCell>
            <TableCell className="whitespace-normal">
              <ul className="flex flex-col gap-0.5">
                {r.items.map((i) => (
                  <li key={i.medicationId}>
                    <span className="font-medium">{medications.find((m) => m.id === i.medicationId)?.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">{i.dose} · {i.frequency.toLowerCase()} · {i.duration}</span>
                  </li>
                ))}
              </ul>
            </TableCell>
            <TableCell>{doctors.find((d) => d.id === r.doctorId)?.name}</TableCell>
            <TableCell>
              <Badge variant={r.status === "Recibida" ? "outline" : "secondary"}>{r.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
