"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Medication, stockStatus } from "@/domain/medications";
import type { Patient } from "@/domain/patients";
import { INTERNAL_PHARMACY, type Referral, type ReferralItem } from "@/domain/referrals";
import { useToday } from "@/lib/format";
import { useClinics, useCurrentClinic } from "@/lib/server-state";
import { useDoctors, useStore } from "@/lib/store";
import { Field, SuccessPanel } from "./field";

const FREQUENCIES = ["Cada 8 h", "Cada 12 h", "Cada 24 h", "Cada 48 h", "Semanal", "Mensual", "Dosis única"];

// Familias de fármacos para cruzar con alergias declaradas.
const ALLERGY_FAMILIES: Record<string, string[]> = {
  penicilina: ["amoxicilina", "penicilina", "cefalexina"],
};

function allergyConflict(patient: Patient, med: Medication) {
  const haystack = `${med.name} ${med.activeIngredient}`.toLowerCase();
  return patient.allergies.find((allergy) => {
    const key = allergy.toLowerCase().split(" ")[0];
    const family = ALLERGY_FAMILIES[key] ?? [key];
    return family.some((term) => haystack.includes(term));
  });
}

type Row = ReferralItem & { key: number };
let rowKey = 0;

export function ReferralForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const { addReferral, medications, currentUser } = useStore();
  const doctors = useDoctors();
  const clinics = useClinics();
  const currentClinic = useCurrentClinic();
  const destinations = [INTERNAL_PHARMACY, ...clinics.filter((c) => c !== currentClinic)];
  const [destination, setDestination] = useState(INTERNAL_PHARMACY);
  const [doctorId, setDoctorId] = useState(currentUser.doctorId ?? doctors[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState("");
  const [notes, setNotes] = useState("");
  const [created, setCreated] = useState<Referral | null>(null);
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  if (created) {
    return (
      <SuccessPanel title={`Ficha de medicamentos derivada a ${created.destination}`} onDone={onDone}>
        <ul className="list-disc pl-5">
          {created.items.map((i) => {
            const med = medications.find((m) => m.id === i.medicationId);
            return (
              <li key={i.medicationId}>
                {med?.name} — {i.dose}, {i.frequency.toLowerCase()}, {i.duration} ({i.qty} u.)
              </li>
            );
          })}
        </ul>
      </SuccessPanel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Derivar a">
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {destinations.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Profesional que prescribe">
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {patient.allergies.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="size-4" /> Alergias registradas: {patient.allergies.join(", ")}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const med = medications.find((m) => m.id === row.medicationId)!;
          const status = stockStatus(med);
          const conflict = allergyConflict(patient, med);
          return (
            <div key={row.key} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{med.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {med.activeIngredient} · stock {med.stock} {med.unit}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {status !== "Disponible" && (
                      <Badge variant={status === "Sin stock" ? "destructive" : "secondary"}>{status}</Badge>
                    )}
                    {conflict && <Badge variant="destructive">Alergia: {conflict}</Badge>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Quitar medicamento"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Dosis">
                  <Input value={row.dose} onChange={(e) => update(row.key, { dose: e.target.value })} placeholder="Ej. 1 comp." className="h-8" />
                </Field>
                <Field label="Frecuencia">
                  <Select value={row.frequency} onValueChange={(v) => update(row.key, { frequency: v })}>
                    <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Duración">
                  <Input value={row.duration} onChange={(e) => update(row.key, { duration: e.target.value })} className="h-8" />
                </Field>
                <Field label="Cantidad">
                  <Input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) => update(row.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-8"
                  />
                </Field>
              </div>
            </div>
          );
        })}

        <Select
          value={picker}
          onValueChange={(id) => {
            setRows((prev) => [...prev, { key: ++rowKey, medicationId: id, dose: "", frequency: "Cada 12 h", duration: "7 días", qty: 1 }]);
            setPicker("");
          }}
        >
          <SelectTrigger aria-label="Agregar medicamento" className="w-full">
            <Plus className="size-4" />
            <SelectValue placeholder="Agregar medicamento del inventario" />
          </SelectTrigger>
          <SelectContent>
            {medications
              .filter((m) => !rows.some((r) => r.medicationId === m.id))
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} · {m.stock > 0 ? `${m.stock} ${m.unit}` : "sin stock"}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Field label="Indicaciones / observaciones" htmlFor="ref-notes">
        <Textarea id="ref-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button
          disabled={rows.length === 0 || rows.some((r) => !r.dose)}
          onClick={() =>
            setCreated(
              addReferral({
                patientId: patient.id,
                date: today,
                doctorId,
                destination,
                items: rows.map(({ medicationId, dose, frequency, duration, qty }) => ({ medicationId, dose, frequency, duration, qty })),
                notes,
                status: "Enviada",
              })
            )
          }
        >
          Derivar ficha
        </Button>
      </div>
    </div>
  );
}
