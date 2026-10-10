"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRightToLine, Clock, DoorClosed, DoorOpen, LogIn, LogOut, PlayCircle, ReceiptText, ShieldCheck } from "lucide-react";
import { kindIcon, statusMeta } from "@/components/activity/room-status";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { ProductThumb } from "@/components/retail/shared";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { type Doctor } from "@/domain/clinic";
import { ownerName } from "@/domain/owners";
import { type AccessKind, WAITING_CAPACITY } from "@/domain/security";
import { formatCLP, minutesSince, useNowTime, useToday } from "@/lib/format";
import { expectedArrivals } from "@/lib/metrics/day";
import { useDoctorsAll, useOwners, usePatients } from "@/lib/server-state";
import { useRetail } from "@/lib/retail-store";
import { useSecurity } from "@/lib/security-store";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EventStatusBadge, SeverityBadge } from "./badges";
import { CameraDialog } from "./camera-dialog";
import { CameraGrid, CameraTile } from "./camera-tile";
import { EmptyState } from "@/components/layout/empty-state";

function doctorName(doctors: Doctor[], id?: string) {
  return doctors.find((d) => d.id === id)?.name ?? "";
}

// ---------------------------------------------------------------- Hall

const KINDS: AccessKind[] = ["Cliente", "Proveedor", "Courier", "Personal"];

export function HallZone() {
  const { cameras, access, waiting, devices, checkIn, toggleLock } = useSecurity();
  const { appointments, clinicProfile, rooms } = useStore();
  const doctors = useDoctorsAll();
  const patients = usePatients();
  const owners = useOwners();
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);
  const [kind, setKind] = useState<"all" | AccessKind>("all");
  const door = devices.find((d) => d.id === "dv-door-main")!;
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();
  const now = useNowTime();

  const expected = expectedArrivals(appointments, access, waiting, rooms, today, now);
  const log = [...access].filter((a) => kind === "all" || a.kind === kind).sort((a, b) => b.time.localeCompare(a.time));
  const inside = access.filter((a) => a.direction === "Ingreso").length - access.filter((a) => a.direction === "Salida").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <CameraGrid cameras={cameras.filter((c) => c.zone === "hall")} columns={2} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {door.locked ? <DoorClosed className="size-4 text-destructive" /> : <DoorOpen className="size-4 text-primary" />} Puerta principal
            </CardTitle>
            <CardDescription>{clinicProfile.hours}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              Estado: <strong>{door.locked ? "Bloqueada" : "Abierta (horario de atención)"}</strong>
            </p>
            <p className="text-muted-foreground">Batería cerradura {door.battery}% · personas dentro ≈ {inside}</p>
            <Guard permission="seguridad.administrar">
              <Button variant={door.locked ? "default" : "outline"} onClick={() => toggleLock(door.id)}>
                {door.locked ? "Desbloquear puerta" : "Bloquear puerta"}
              </Button>
            </Guard>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Llegadas esperadas</CardTitle>
            <CardDescription>Citas de hoy que aún no registran ingreso.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {expected.length === 0 && <p className="text-sm text-muted-foreground">No hay llegadas pendientes.</p>}
            {expected.map((a) => {
              const p = getPatient(a.patientId)!;
              const o = getOwner(p.ownerRut)!;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <SpeciesIcon species={p.species} className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.time} · {p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{ownerName(o)} · {doctorName(doctors, a.doctorId)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => checkIn(a.id)}>
                    <LogIn /> Llegó
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Registro de accesos de hoy</CardTitle>
              <CardDescription>{access.length} movimientos en la entrada</CardDescription>
            </div>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger aria-label="Tipo de registro" size="sm" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quién</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">{a.time}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {a.direction === "Ingreso" ? <LogIn className="size-3.5 text-primary" /> : <LogOut className="size-3.5 text-muted-foreground" />}
                        {a.direction}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{a.kind}</Badge></TableCell>
                    <TableCell className="font-medium">
                      {a.ownerRut ? (
                        <Link href={`/pacientes/propietarios/${a.ownerRut}`} className="hover:text-primary hover:underline">{a.who}</Link>
                      ) : a.href ? (
                        <Link href={a.href} className="hover:text-primary hover:underline">{a.who}</Link>
                      ) : (
                        a.who
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.patientId ? (
                        <Link href={`/pacientes/historial/${a.patientId}`} className="hover:text-primary hover:underline">{a.detail}</Link>
                      ) : (
                        a.detail
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Sala de espera

export function WaitingZone() {
  const { cameras, waiting, callFromWaiting } = useSecurity();
  const { appointments, rooms } = useStore();
  const doctors = useDoctorsAll();
  const patients = usePatients();
  const owners = useOwners();
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);
  const people = waiting.reduce((s, w) => s + w.people, 0);
  const pct = Math.round((people / WAITING_CAPACITY) * 100);
  const freeBoxes = rooms.filter((r) => r.kind === "box" && r.status === "disponible");
  // T5-5: hora real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const now = useNowTime();
  const avgWait = waiting.length ? Math.round(waiting.reduce((s, w) => s + minutesSince(w.arrivedAt, now), 0) / waiting.length) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <CameraGrid cameras={cameras.filter((c) => c.zone === "espera")} columns={2} />
        <Card>
          <CardHeader>
            <CardTitle>Aforo</CardTitle>
            <CardDescription>Capacidad máxima {WAITING_CAPACITY} personas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold tabular-nums">{people}<span className="text-base text-muted-foreground">/{WAITING_CAPACITY}</span></p>
            <div className="h-3 rounded-full bg-muted">
              <div className={cn("h-3 rounded-full", pct >= 80 ? "bg-destructive" : "bg-[var(--viz-1)]")} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            {pct >= 80 ? (
              <p className="flex items-center gap-1 text-sm text-destructive"><AlertTriangle className="size-4" /> Sobre el 80%: habilitar espera exterior.</p>
            ) : (
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><ShieldCheck className="size-4" /> Aforo normal</p>
            )}
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="size-4" /> Espera promedio actual: {avgWait} min</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>En espera ({waiting.length})</CardTitle>
          <CardDescription>Al pasar a un box, el box queda ocupado en el mapa de Actividad y su cámara entra en modo privacidad.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {waiting.length === 0 && <p className="text-sm text-muted-foreground">Sala de espera vacía.</p>}
          {waiting.map((w) => {
            const appt = appointments.find((a) => a.id === w.appointmentId)!;
            const p = getPatient(appt.patientId)!;
            const o = getOwner(p.ownerRut)!;
            const minutes = minutesSince(w.arrivedAt, now);
            return (
              <WaitingRow
                key={w.id}
                title={`${p.name} · ${ownerName(o)}`}
                species={p.species}
                patientId={p.id}
                info={`Llegó ${w.arrivedAt} · cita ${appt.time} con ${doctorName(doctors, appt.doctorId)} · ${appt.reason}`}
                minutes={minutes}
                late={appt.time < now}
                alert={w.alert}
                boxes={freeBoxes.map((b) => ({ id: b.id, name: b.name }))}
                preferredBox={appt.roomId}
                onCall={(roomId) => callFromWaiting(w.id, roomId)}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function WaitingRow({
  title,
  species,
  patientId,
  info,
  minutes,
  late,
  alert,
  boxes,
  preferredBox,
  onCall,
}: {
  title: string;
  species: Parameters<typeof SpeciesIcon>[0]["species"];
  patientId: string;
  info: string;
  minutes: number;
  late: boolean;
  alert?: string;
  boxes: { id: string; name: string }[];
  preferredBox?: string;
  onCall: (roomId: string) => void;
}) {
  const [box, setBox] = useState(boxes.find((b) => b.id === preferredBox)?.id ?? boxes[0]?.id ?? "");
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center">
      <div className="flex flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SpeciesIcon species={species} className="size-5" />
        </span>
        <div className="min-w-0 text-sm">
          <Link href={`/pacientes/historial/${patientId}`} className="font-medium hover:text-primary hover:underline">{title}</Link>
          <p className="text-xs text-muted-foreground">{info}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant={minutes > 20 ? "destructive" : "secondary"} className="tabular-nums"><Clock /> {minutes} min esperando</Badge>
            {late && <Badge variant="outline">Hora de cita cumplida</Badge>}
            {alert && <Badge variant="outline" className="text-amber-700 dark:text-amber-300"><AlertTriangle /> {alert}</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={box} onValueChange={setBox} disabled={boxes.length === 0}>
          <SelectTrigger aria-label="Box" size="sm" className="w-32"><SelectValue placeholder="Sin boxes libres" /></SelectTrigger>
          <SelectContent>
            {boxes.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!box} onClick={() => onCall(box)}>
          <ArrowRightToLine /> Pasar a box
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Boxes

export function BoxesZone() {
  const { cameras, settings } = useSecurity();
  const { rooms } = useStore();
  const doctors = useDoctorsAll();
  const patients = usePatients();
  const boxCams = cameras.filter((c) => c.zone === "boxes");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
        <ShieldCheck className="size-4 text-primary" />
        Privacidad en boxes: <strong>{settings.privacyInBoxes ? "activada" : "desactivada"}</strong>
        <span className="text-muted-foreground">
          · los boxes ocupados no muestran video en vivo; ver de todos modos exige permiso y motivo, y queda auditado.
        </span>
        <Link href="/seguridad/dispositivos" className="ml-auto text-primary hover:underline">Configurar</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {boxCams.map((cam) => {
          const room = rooms.find((r) => r.id === cam.roomId);
          const meta = room ? statusMeta[room.status] : undefined;
          const KindIcon = room ? kindIcon[room.kind] : null;
          const patient = patients.find((p) => p.id === (room?.patientId ?? ""));
          return (
            <Card key={cam.id} className="gap-3 py-4">
              <CardContent className="flex flex-col gap-3 px-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold">{KindIcon && <KindIcon className="size-4 text-muted-foreground" />} {room?.name}</span>
                  {meta && (
                    <span className={cn("flex items-center gap-1 text-xs font-medium", meta.text)}>
                      <span className={cn("size-2 rounded-full", meta.dot)} /> {meta.label}
                    </span>
                  )}
                </div>
                <CameraTile camera={cam} />
                <p className="text-xs text-muted-foreground">
                  {room?.status === "ocupado" && patient
                    ? `${doctorName(doctors, room.doctorId ?? "")} con ${patient.name} desde las ${room.since}`
                    : room?.status === "limpieza"
                      ? `En limpieza desde las ${room.since}`
                      : "Disponible"}
                  {" · "}
                  <Link href="/inicio/actividad" className="text-primary hover:underline">Ver en Actividad</Link>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Tienda

export function StoreZone() {
  const { cameras, events } = useSecurity();
  const { sales, products } = useRetail();
  const [clipAt, setClipAt] = useState<string | null>(null);
  const cashCam = cameras.find((c) => c.id === "c-tda-1")!;
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const todayDate = useToday();
  const today = sales.filter((s) => s.date === todayDate && s.channel === "Mesón").sort((a, b) => b.time.localeCompare(a.time));
  const storeEvents = events.filter((e) => e.zone === "tienda").slice(0, 5);
  const highValue = products.filter((p) => p.price > 30000);

  return (
    <div className="flex flex-col gap-6">
      <CameraGrid cameras={cameras.filter((c) => c.zone === "tienda")} columns={3} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Boletas de hoy ↔ cámara de caja</CardTitle>
            <CardDescription>Abre el video de la caja a la hora exacta de cada venta. Cada apertura queda auditada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Boleta</TableHead>
                  <TableHead>Atendió</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {today.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="tabular-nums">{s.time}</TableCell>
                    <TableCell className="font-medium tabular-nums">{s.number}</TableCell>
                    <TableCell className="text-muted-foreground">{s.seller}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCLP(s.total)}</TableCell>
                    <TableCell className="text-right">
                      <Guard permission="seguridad.grabaciones">
                        <Button size="sm" variant="ghost" onClick={() => setClipAt(s.time)}>
                          <PlayCircle /> Ver clip
                        </Button>
                      </Guard>
                    </TableCell>
                  </TableRow>
                ))}
                {today.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="whitespace-normal">
                    <EmptyState icon={ReceiptText} title="Sin ventas en mesón hoy." />
                  </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de tienda</CardTitle>
              <CardDescription>
                <Link href="/seguridad/eventos" className="text-primary hover:underline">Ver todos los eventos</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {storeEvents.map((e) => (
                <Link key={e.id} href={`/seguridad/eventos?id=${e.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm hover:border-primary/50">
                  <span className="flex-1 font-medium">{e.type}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{e.at.slice(5, 10).split("-").reverse().join("/")} {e.at.slice(11)}</span>
                  <SeverityBadge severity={e.severity} />
                  <EventStatusBadge status={e.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Productos de alto valor en sala</CardTitle>
              <CardDescription>Sobre $30.000 · cubiertos por la cámara de pasillos</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {highValue.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <ProductThumb category={p.category} className="size-7" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums">{p.stock.sala} en sala · {formatCLP(p.price)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <CameraDialog camera={cashCam} open={!!clipAt} onOpenChange={(o) => !o && setClipAt(null)} initialRecordingAt={clipAt ?? undefined} />
    </div>
  );
}
