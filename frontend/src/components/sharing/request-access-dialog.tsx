"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type AccessDuration, type AccessScope, DURATIONS, SCOPES } from "@/domain/sharing";
import { usePatients } from "@/lib/server-state";
import { useStore } from "@/lib/store";

export function RequestAccessDialog({
  patientIds,
  open,
  onOpenChange,
  onSent,
}: {
  patientIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (count: number) => void;
}) {
  const { sendRequest, sharingPolicy } = useStore();
  const patients = usePatients();
  const [scope, setScope] = useState<AccessScope>(sharingPolicy.defaultScope);
  const [duration, setDuration] = useState<AccessDuration>(sharingPolicy.defaultDuration);
  const [reason, setReason] = useState("");
  const pets = patientIds.map((id) => patients.find((p) => p.id === id)).filter((p) => p !== undefined);
  const origins = [...new Set(pets.map((p) => p.clinic))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar acceso</DialogTitle>
          <DialogDescription>
            {pets.map((p) => p.name).join(", ")} · la solicitud llega a {origins.join(" y ")}, que debe aprobarla con el
            consentimiento del dueño.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alcance">
            <Select value={scope} onValueChange={(v) => setScope(v as AccessScope)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vigencia">
            <Select value={String(duration)} onValueChange={(v) => setDuration(v === "null" ? null : (Number(v) as AccessDuration))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={String(d.value)} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Motivo" htmlFor="req-reason" className="sm:col-span-2">
            <Textarea
              id="req-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. el dueño se atenderá en nuestra clínica / urgencia"
            />
          </Field>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          {scope === "Resumen clínico"
            ? "Resumen clínico: alergias, condiciones crónicas y vacunas."
            : "Ficha completa: consultas, exámenes, recetas, vacunas y datos del dueño."}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!reason.trim() || pets.length === 0}
            onClick={() => {
              const count = sendRequest(patientIds, scope, duration, reason.trim());
              setReason("");
              onOpenChange(false);
              onSent?.(count);
            }}
          >
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
