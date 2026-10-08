"use client";

import { useState } from "react";
import { Building2, Save } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClinicProfile } from "@/domain/settings";
import { useCan, useStore } from "@/lib/store";

const NOTIFICATIONS = [
  { id: "requests", label: "Nuevas solicitudes de acceso de la red" },
  { id: "stock", label: "Medicamentos bajo stock mínimo" },
  { id: "vaccines", label: "Vacunas vencidas de mis pacientes" },
  { id: "appointments", label: "Recordatorio de citas del día" },
];

export function UserProfile() {
  const { currentUser } = useStore();
  const [prefs, setPrefs] = useState<string[]>(["requests", "vaccines", "appointments"]);
  const initials = currentUser.name.replace(/^(Dra?\.)\s/, "").split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi perfil</CardTitle>
        <CardDescription>Datos que aparecen en recetas, derivaciones y solicitudes a la red.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{currentUser.name}</p>
            <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            <div className="mt-1 flex gap-1.5">
              <Badge>{currentUser.role}</Badge>
              {currentUser.specialty && <Badge variant="secondary">{currentUser.specialty}</Badge>}
            </div>
          </div>
        </div>

        <div key={currentUser.id} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="pf-name"><Input id="pf-name" defaultValue={currentUser.name} /></Field>
          <Field label="Email" htmlFor="pf-email"><Input id="pf-email" defaultValue={currentUser.email} /></Field>
          {currentUser.role === "Veterinario" && (
            <>
              <Field label="Registro profesional (Colegio Médico Veterinario)" htmlFor="pf-reg">
                <Input id="pf-reg" defaultValue={`CMV-${String(4120 + currentUser.id.length * 37)}`} />
              </Field>
              <Field label="Firma en recetas" htmlFor="pf-sign">
                <Input id="pf-sign" defaultValue={`${currentUser.name} · ${currentUser.specialty}`} />
              </Field>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Notificaciones</p>
          {NOTIFICATIONS.map((n) => (
            <div key={n.id} className="flex items-center gap-2">
              <Checkbox
                id={`nt-${n.id}`}
                checked={prefs.includes(n.id)}
                onCheckedChange={(v) => setPrefs((prev) => (v === true ? [...prev, n.id] : prev.filter((x) => x !== n.id)))}
              />
              <Label htmlFor={`nt-${n.id}`} className="font-normal">{n.label}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const FIELDS: { key: keyof ClinicProfile; label: string }[] = [
  { key: "legalName", label: "Razón social" },
  { key: "rut", label: "RUT empresa" },
  { key: "address", label: "Dirección" },
  { key: "sector", label: "Comuna / ciudad" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Email" },
  { key: "hours", label: "Horario" },
];

export function ClinicProfileCard() {
  const { clinicProfile, setClinicProfile } = useStore();
  const can = useCan();
  const editable = can("usuarios.administrar");
  const [draft, setDraft] = useState(clinicProfile);
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-primary" /> Datos de la clínica</CardTitle>
        <CardDescription>
          Se usan en la cabecera de las facturas y en el directorio de la red. Solo Admin puede editarlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`cl-${f.key}`}>
              <Input
                id={`cl-${f.key}`}
                value={String(draft[f.key])}
                disabled={!editable}
                onChange={(e) => {
                  setDraft({ ...draft, [f.key]: e.target.value });
                  setSaved(false);
                }}
              />
            </Field>
          ))}
          <Field label="N° de boxes" htmlFor="cl-boxes">
            <Input id="cl-boxes" type="number" value={draft.boxes} disabled={!editable} onChange={(e) => setDraft({ ...draft, boxes: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-primary">Cambios guardados</span>}
          <Guard permission="usuarios.administrar">
            <Button
              onClick={() => {
                setClinicProfile(draft);
                setSaved(true);
              }}
            >
              <Save /> Guardar
            </Button>
          </Guard>
        </div>
      </CardContent>
    </Card>
  );
}
