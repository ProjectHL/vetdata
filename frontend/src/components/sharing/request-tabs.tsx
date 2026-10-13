"use client";

import { useState } from "react";
import { AlertTriangle, Check, FlaskConical, X } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { type AccessDuration, type AccessRequest, type AccessScope, DURATIONS, type RequestStatus, SCOPES, durationLabel } from "@/domain/sharing";
import { formatDate, formatRut } from "@/lib/format";
import { useCurrentClinic, useOwners, usePatients } from "@/lib/server-state";
import { useStore } from "@/lib/store";
import { dataSource } from "@/services";

const statusVariant: Record<RequestStatus, "default" | "secondary" | "destructive"> = {
  Pendiente: "secondary",
  "Esperando dueño": "secondary",
  Aprobada: "default",
  Rechazada: "destructive",
  Denegada: "destructive",
  Expirada: "secondary",
  Cancelada: "secondary",
};

const isPending = (status: RequestStatus) => status === "Pendiente" || status === "Esperando dueño";

// Pendientes primero, luego por fecha descendente.
const byPriority = (a: AccessRequest, b: AccessRequest) =>
  Number(isPending(b.status)) - Number(isPending(a.status)) || b.date.localeCompare(a.date);

export function RequestTabs() {
  const { requests } = useStore();
  const currentClinic = useCurrentClinic();
  const received = requests.filter((r) => r.to === currentClinic).sort(byPriority);
  const sent = requests.filter((r) => r.from === currentClinic).sort(byPriority);
  const pending = (list: AccessRequest[]) => list.filter((r) => isPending(r.status)).length;

  return (
    <Tabs defaultValue="recibidas">
      <TabsList>
        <TabsTrigger value="recibidas">Recibidas ({pending(received)} pendientes)</TabsTrigger>
        <TabsTrigger value="enviadas">Enviadas ({pending(sent)} pendientes)</TabsTrigger>
      </TabsList>
      <TabsContent value="recibidas" className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {dataSource === "http"
            ? "Las solicitudes de otras clínicas las decide el dueño mediante su enlace de autorización."
            : "Otras clínicas piden acceso a pacientes de tu clínica. Aprueba solo con el consentimiento del dueño."}
        </p>
        {received.map((r) => (
          <ReceivedCard key={r.id} request={r} />
        ))}
      </TabsContent>
      <TabsContent value="enviadas">
        <SentTable requests={sent} />
      </TabsContent>
    </Tabs>
  );
}

function ReceivedCard({ request: r }: { request: AccessRequest }) {
  const { respondRequest } = useStore();
  const patients = usePatients();
  const owners = useOwners();
  const [open, setOpen] = useState(false);
  const p = patients.find((p) => p.id === r.patientId);
  const owner = owners.find((o) => o.rut === (r.ownerRut ?? p?.ownerRut));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-start gap-3">
          {p && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SpeciesIcon species={p.species} className="size-5" />
          </span>}
          <div className="min-w-0 text-sm">
            <p>
              <strong>{r.from}</strong> solicita acceso a <strong>{p?.name ?? "un paciente"}</strong>
            </p>
            <p className="text-muted-foreground">
              {owner ? `Dueño: ${ownerName(owner)} · RUT ${formatRut(owner.rut)} · ` : ""}por {r.requestedBy} el {formatDate(r.date)}
            </p>
            <p className="mt-1 italic">“{r.reason}”</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline">{r.scope}</Badge>
              <Badge variant="outline">{durationLabel(r.duration)}</Badge>
              {dataSource === "mock" && owner && !owner.shareConsent && (
                <Badge variant="destructive"><AlertTriangle /> Dueño sin consentimiento registrado</Badge>
              )}
            </div>
          </div>
        </div>
        {dataSource === "mock" && r.status === "Pendiente" ? (
          <div className="flex gap-2">
            <Guard permission="red.aprobar">
              <Button variant="outline" onClick={() => respondRequest(r.id, false)}><X /> Rechazar</Button>
            </Guard>
            <Guard permission="red.aprobar">
              <Button onClick={() => setOpen(true)}><Check /> Aprobar</Button>
            </Guard>
          </div>
        ) : (
          <Badge variant={statusVariant[r.status]}>
            {r.status} {r.respondedAt && `· ${formatDate(r.respondedAt)}`}
          </Badge>
        )}
      </CardContent>
      {dataSource === "mock" && <ApproveDialog request={r} open={open} onOpenChange={setOpen} />}
    </Card>
  );
}

function ApproveDialog({
  request: r,
  open,
  onOpenChange,
}: {
  request: AccessRequest;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { respondRequest, sharingPolicy } = useStore();
  const patients = usePatients();
  const owners = useOwners();
  const [scope, setScope] = useState<AccessScope>(r.scope);
  const [duration, setDuration] = useState<AccessDuration>(r.duration);
  const [consent, setConsent] = useState(false);
  const owner = owners.find((o) => o.rut === r.ownerRut)!;
  const p = patients.find((p) => p.id === r.patientId)!;
  // La política de la clínica define si se exige confirmar la autorización del dueño.
  const needsConsent = sharingPolicy.requireConsent && !owner.shareConsent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar acceso a {p.name}</DialogTitle>
          <DialogDescription>{r.from} podrá ver la ficha con el alcance y la vigencia que definas.</DialogDescription>
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
        </div>
        {needsConsent && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <Checkbox id={`consent-${r.id}`} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <Label htmlFor={`consent-${r.id}`} className="text-sm leading-snug font-normal">
              {ownerName(owner)} no tiene consentimiento registrado. Confirmo que el dueño autorizó compartir estos datos
              (firma o SMS).
            </Label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={needsConsent && !consent}
            onClick={() => {
              respondRequest(r.id, true, { scope, duration });
              onOpenChange(false);
            }}
          >
            Aprobar acceso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SentTable({ requests }: { requests: AccessRequest[] }) {
  const { respondRequest } = useStore();
  const patients = usePatients();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Solicitudes de tu clínica a otras clínicas. Cuando el dueño autorice el acceso, la mascota aparecerá en Compartidos conmigo.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mascota</TableHead>
              <TableHead>Clínica de origen</TableHead>
              <TableHead>Solicitado</TableHead>
              <TableHead>Alcance · vigencia</TableHead>
              <TableHead>Estado</TableHead>
              {dataSource === "mock" && <TableHead className="text-right">
                <span className="inline-flex items-center gap-1"><FlaskConical className="size-3" /> Demo</span>
              </TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const p = patients.find((p) => p.id === r.patientId);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                  <span className="font-medium">{p?.name ?? "Paciente no disponible"}</span>
                    {r.ownerRut && <span className="block text-xs text-muted-foreground">Dueño RUT {formatRut(r.ownerRut)}</span>}
                  </TableCell>
                  <TableCell>{r.to}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(r.date)}
                    <span className="block text-xs text-muted-foreground">{r.requestedBy}</span>
                  </TableCell>
                  <TableCell>{r.scope} · {durationLabel(r.duration)}</TableCell>
                  <TableCell><Badge variant={statusVariant[r.status]}>{r.status}</Badge></TableCell>
                  {dataSource === "mock" && <TableCell className="text-right">
                    {r.status === "Pendiente" && (
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => respondRequest(r.id, false)}>Simular rechazo</Button>
                        <Button size="sm" variant="outline" onClick={() => respondRequest(r.id, true)}>Simular aprobación</Button>
                      </span>
                    )}
                  </TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
