"use client";

import { useState } from "react";
import { CheckCircle2, Flag, MessageSquarePlus, PlayCircle, ShieldAlert, ShieldCheck, Siren, Timer, XCircle } from "lucide-react";
import { StatTile } from "@/components/analytics/shared";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_STATUSES, type EventStatus, type EventType, OPEN_EVENT, SEVERITIES, type SecurityEvent, type Severity, ZONES, type Zone } from "@/domain/security";
import { formatDateTime, formatHours, hoursBetween } from "@/lib/format";
import { useSecurity } from "@/lib/security-store";
import { useStore } from "@/lib/store";
import { EventStatusBadge, SeverityBadge } from "./badges";
import { CameraDialog } from "./camera-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/clickable-row";

const TYPES: EventType[] = [
  "Acceso no autorizado",
  "Movimiento fuera de horario",
  "Puerta forzada",
  "Puerta abierta",
  "Aforo excedido",
  "Cámara sin señal",
  "Caja abierta sin venta",
  "Botón de pánico",
  "Marcado manual",
];

export function SecurityEvents({ initialId }: { initialId?: string }) {
  const { events, cameras } = useSecurity();
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [zone, setZone] = useState<"all" | Zone>("all");
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [status, setStatus] = useState<"open" | "all" | EventStatus>("all");
  const [creating, setCreating] = useState(false);

  const open = events.filter((e) => OPEN_EVENT.includes(e.status));
  const closed = events.filter((e) => e.resolvedAt);
  const avgResolution = closed.length ? closed.reduce((s, e) => s + hoursBetween(e.at, e.resolvedAt!), 0) / closed.length : 0;
  const rows = events
    .filter((e) => zone === "all" || e.zone === zone)
    .filter((e) => severity === "all" || e.severity === severity)
    .filter((e) => status === "all" || (status === "open" ? OPEN_EVENT.includes(e.status) : e.status === status))
    .sort((a, b) => b.at.localeCompare(a.at));
  const selected = events.find((e) => e.id === selectedId);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Siren} label="Eventos abiertos" value={open.length} hint="Nuevos y en revisión" />
        <StatTile icon={ShieldAlert} tone="text-destructive" label="Críticos abiertos" value={open.filter((e) => e.severity === "Crítica").length} />
        <StatTile icon={XCircle} tone="text-muted-foreground" label="Falsas alarmas" value={events.filter((e) => e.status === "Falsa alarma").length} hint="Últimos 7 días" />
        <StatTile icon={Timer} tone="text-muted-foreground" label="Tiempo medio de resolución" value={formatHours(avgResolution)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={zone} onValueChange={(v) => setZone(v as typeof zone)}>
          <SelectTrigger aria-label="Zona" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las zonas</SelectItem>
            {(Object.keys(ZONES) as Zone[]).map((z) => (
              <SelectItem key={z} value={z}>{ZONES[z].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
          <SelectTrigger aria-label="Severidad" className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger aria-label="Estado" className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="open">Abiertos</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setCreating(true)}><Flag /> Marcar evento</Button>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Zona · cámara</TableHead>
                <TableHead>Severidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} {...clickableRow(() => setSelectedId(e.id))}>
                  <TableCell className="tabular-nums">{formatDateTime(e.at)}</TableCell>
                  <TableCell className="font-medium">{e.type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ZONES[e.zone].label}
                    {e.cameraId && ` · ${cameras.find((c) => c.id === e.cameraId)?.name}`}
                  </TableCell>
                  <TableCell><SeverityBadge severity={e.severity} /></TableCell>
                  <TableCell><EventStatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{e.assignee ?? "Sin asignar"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="whitespace-normal">
                    <EmptyState icon={ShieldCheck} title="Sin eventos para estos filtros." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <EventDetail event={selected} />}
        </SheetContent>
      </Sheet>
      <NewEventDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function EventDetail({ event }: { event: SecurityEvent }) {
  const { cameras, updateEvent, addEventNote, logAudit } = useSecurity();
  const { users } = useStore();
  const [note, setNote] = useState("");
  const [clipOpen, setClipOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const camera = cameras.find((c) => c.id === event.cameraId);
  const closed = event.status === "Resuelto" || event.status === "Falsa alarma";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{event.type}</SheetTitle>
        <SheetDescription>
          {ZONES[event.zone].label}{camera && ` · ${camera.name}`} · {formatDateTime(event.at)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex flex-wrap gap-1.5">
          <SeverityBadge severity={event.severity} />
          <EventStatusBadge status={event.status} />
        </div>

        {camera && (
          <div className="flex flex-wrap gap-2">
            <Guard permission="seguridad.grabaciones">
              <Button size="sm" variant="outline" onClick={() => setClipOpen(true)}><PlayCircle /> Ver clip ({event.at.slice(11)})</Button>
            </Guard>
            <Guard permission="seguridad.grabaciones">
              <Button
                size="sm"
                variant="outline"
                disabled={exported}
                onClick={() => {
                  logAudit(camera.id, "Exportó clip", `Evento: ${event.type} ${formatDateTime(event.at)}`);
                  setExported(true);
                }}
              >
                {exported ? "Clip exportado" : "Exportar clip"}
              </Button>
            </Guard>
          </div>
        )}
        <p className="text-xs text-muted-foreground">El clip del evento se conserva hasta cerrar el evento, aunque supere la retención.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estado">
            <Select value={event.status} onValueChange={(v) => updateEvent(event.id, { status: v as EventStatus })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={event.assignee ?? ""} onValueChange={(v) => updateEvent(event.id, { assignee: v, status: event.status === "Nuevo" ? "En revisión" : event.status })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Asignar" /></SelectTrigger>
              <SelectContent>
                {users.filter((u) => u.status === "Activo").map((u) => (
                  <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {!closed && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateEvent(event.id, { status: "Resuelto" })}><CheckCircle2 /> Resolver</Button>
            <Button size="sm" variant="outline" onClick={() => updateEvent(event.id, { status: "Falsa alarma" })}><XCircle /> Falsa alarma</Button>
          </div>
        )}
        {event.resolvedAt && <p className="text-xs text-muted-foreground">Cerrado {formatDateTime(event.resolvedAt)}</p>}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Bitácora</p>
          {event.notes.length === 0 && <p className="text-sm text-muted-foreground">Sin notas.</p>}
          {event.notes.map((n, i) => (
            <div key={i} className="rounded-lg bg-muted/60 p-3 text-sm">
              <p>{n.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.by} · {formatDateTime(n.at)}</p>
            </div>
          ))}
          <Textarea aria-label="Agregar nota" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar nota" />
          <Button
            size="sm"
            variant="outline"
            className="self-end"
            disabled={!note.trim()}
            onClick={() => {
              addEventNote(event.id, note.trim());
              setNote("");
            }}
          >
            <MessageSquarePlus /> Agregar nota
          </Button>
        </div>
      </div>
      {camera && (
        <CameraDialog camera={camera} open={clipOpen} onOpenChange={setClipOpen} initialRecordingAt={event.at.slice(11)} />
      )}
    </>
  );
}

function NewEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { createEvent, cameras } = useSecurity();
  const [zone, setZone] = useState<Zone>("hall");
  const [type, setType] = useState<EventType>("Marcado manual");
  const [severity, setSeverity] = useState<Severity>("Media");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar evento</DialogTitle>
          <DialogDescription>Registra un incidente observado. Se asocia a la primera cámara de la zona.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Zona">
            <Select value={zone} onValueChange={(v) => setZone(v as Zone)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ZONES) as Zone[]).map((z) => (
                  <SelectItem key={z} value={z}>{ZONES[z].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Severidad">
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo" className="sm:col-span-2">
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descripción" htmlFor="ev-note" className="sm:col-span-2">
            <Textarea id="ev-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              createEvent({ zone, type, severity, cameraId: cameras.find((c) => c.zone === zone)?.id, note: note.trim() || undefined });
              setNote("");
              onOpenChange(false);
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
