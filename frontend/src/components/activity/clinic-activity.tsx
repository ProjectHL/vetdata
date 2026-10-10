"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDoctorsAll, useOwners, usePatients } from "@/lib/server-state";
import { type Doctor, type Room, type RoomStatus } from "@/domain/clinic";
import { ownerName } from "@/domain/owners";
import { minutesSince, useNowTime } from "@/lib/format";
import { useCanView, useDoctors, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { kindIcon, statusMeta } from "./room-status";

const STATUSES: RoomStatus[] = ["ocupado", "limpieza", "disponible"];

function doctorById(doctors: Doctor[], id?: string) {
  return doctors.find((d) => d.id === id);
}

function elapsed(since: string | undefined, now: string) {
  if (!since) return null;
  const min = minutesSince(since, now);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function ClinicActivity() {
  const { rooms, updateRoom } = useStore();
  const [filter, setFilter] = useState<RoomStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // T5-5: hora real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const now = useNowTime();

  const clinicalRooms = rooms.filter((r) => r.kind !== "comun");
  const activeDoctors = useDoctors();
  const patients = usePatients();
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const selected = rooms.find((r) => r.id === selectedId);


  return (
    <div className="flex flex-col gap-6">
      {/* Contadores = filtros */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {STATUSES.map((status) => {
          const meta = statusMeta[status];
          const count = clinicalRooms.filter((r) => r.status === status).length;
          const active = filter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(active ? null : status)}
              aria-pressed={active}
              className={cn(
                "flex flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-shadow hover:shadow-sm sm:p-4",
                active && "ring-2 ring-ring"
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-xs font-medium sm:text-sm", meta.text)}>
                <meta.icon className="size-4" />
                {meta.label}
              </span>
              <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Plano */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Plano de la clínica</CardTitle>
            <CardDescription>
              Estado en tiempo real · actualizado {now} h
              {filter && (
                <>
                  {" · "}
                  <button type="button" className="text-primary hover:underline" onClick={() => setFilter(null)}>
                    quitar filtro
                  </button>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
              {rooms.map((room) => (
                <RoomTile
                  key={room.id}
                  room={room}
                  dimmed={filter !== null && (room.kind === "comun" || room.status !== filter)}
                  onClick={() => setSelectedId(room.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Equipo médico */}
        <Card>
          <CardHeader>
            <CardTitle>Equipo médico</CardTitle>
            <CardDescription>Quién atiende a quién en este momento.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {activeDoctors.map((doctor) => {
                const room = rooms.find((r) => r.doctorId === doctor.id && r.status === "ocupado");
                const patient = getPatient(room?.patientId ?? "");
                return (
                  <li key={doctor.id} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {doctor.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doctor.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {room && patient ? (
                          <>
                            Con{" "}
                            <Link href={`/pacientes/historial/${patient.id}`} className="text-foreground hover:underline">
                              {patient.name}
                            </Link>{" "}
                            · {room.name}
                          </>
                        ) : (
                          doctor.specialty
                        )}
                      </p>
                    </div>
                    {room ? (
                      <Badge variant="outline" className={statusMeta.ocupado.text}>
                        Atendiendo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={statusMeta.disponible.text}>
                        Libre
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <RoomSheet
        room={selected}
        rooms={rooms}
        onClose={() => setSelectedId(null)}
        onUpdate={updateRoom}
      />
    </div>
  );
}

function RoomTile({ room, dimmed, onClick }: { room: Room; dimmed: boolean; onClick: () => void }) {
  const KindIcon = kindIcon[room.kind];
  const common = room.kind === "comun";
  const meta = statusMeta[room.status];
  const doctorsAll = useDoctorsAll();
  const patients = usePatients();
  const now = useNowTime();
  const doctor = doctorById(doctorsAll, room.doctorId);
  const patient = patients.find((p) => p.id === (room.patientId ?? ""));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-lg border p-3 text-left transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        room.span === 2 && "sm:col-span-2",
        common ? "bg-card" : meta.card,
        dimmed && "opacity-30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <KindIcon className="size-4 text-muted-foreground" />
          {room.name}
        </span>
        {!common && (
          <span className={cn("flex items-center gap-1 text-xs font-medium", meta.text)}>
            <span className={cn("size-2 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        )}
      </div>

      {room.status === "ocupado" && doctor && patient ? (
        <div className="mt-auto flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-background text-[10px]">{doctor.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-xs leading-tight">
            <p className="truncate font-medium">{patient.name} · {patient.species}</p>
            <p className="truncate text-muted-foreground">{doctor.name}</p>
          </div>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Clock className="size-3" />
            {elapsed(room.since, now)}
          </span>
        </div>
      ) : room.status === "limpieza" ? (
        <p className="mt-auto text-xs text-muted-foreground">
          Limpieza iniciada hace {elapsed(room.since, now)}
        </p>
      ) : (
        <p className="mt-auto text-xs text-muted-foreground">{room.note ?? "Lista para recibir paciente"}</p>
      )}
    </button>
  );
}

function RoomSheet({
  room,
  rooms,
  onClose,
  onUpdate,
}: {
  room?: Room;
  rooms: Room[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Room>) => void;
}) {
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const canView = useCanView();
  const activeDoctors = useDoctors();
  const doctorsAll = useDoctorsAll();
  const patients = usePatients();
  const owners = useOwners();
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);

  const busyDoctors = new Set(rooms.filter((r) => r.status === "ocupado").map((r) => r.doctorId));
  const busyPatients = new Set(rooms.filter((r) => r.status === "ocupado").map((r) => r.patientId));
  // T5-5: hora real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const now = useNowTime();
  const doctor = doctorById(doctorsAll, room?.doctorId);
  const patient = getPatient(room?.patientId ?? "");
  const meta = room ? statusMeta[room.status] : null;

  const close = () => {
    setDoctorId("");
    setPatientId("");
    onClose();
  };

  return (
    <Sheet open={!!room} onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full sm:max-w-md">
        {room && meta && (
          <>
            <SheetHeader>
              <SheetTitle>{room.name}</SheetTitle>
              <SheetDescription>
                {room.kind === "comun" ? "Área común" : (
                  <span className={cn("inline-flex items-center gap-1.5 font-medium", meta.text)}>
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    {meta.label}
                    {room.since && ` · desde las ${room.since} h`}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4">
              {room.status === "ocupado" && doctor && patient && (
                <>
                  <Detail label="Profesional" value={`${doctor.name} · ${doctor.specialty}`} />
                  <Detail
                    label="Paciente"
                    value={
                      <Link href={`/pacientes/historial/${patient.id}`} className="text-primary hover:underline">
                        {patient.name} ({patient.species}, {patient.breed})
                      </Link>
                    }
                  />
                  <Detail
                    label="Propietario"
                    value={
                      <Link href={`/pacientes/propietarios/${patient.ownerRut}`} className="text-primary hover:underline">
                        {ownerName(getOwner(patient.ownerRut)!)}
                      </Link>
                    }
                  />
                  <Detail label="Tiempo en atención" value={elapsed(room.since, now)} />
                  {patient.allergies.length > 0 && (
                    <Detail
                      label="Alergias"
                      value={
                        <span className="flex flex-wrap gap-1">
                          {patient.allergies.map((a) => (
                            <Badge key={a} variant="destructive">{a}</Badge>
                          ))}
                        </span>
                      }
                    />
                  )}
                </>
              )}

              {room.note && <p className="text-sm text-muted-foreground">{room.note}</p>}

              {room.status === "disponible" && room.kind !== "comun" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">Asignar atención</p>
                  <Select value={doctorId} onValueChange={setDoctorId}>
                    <SelectTrigger aria-label="Profesional" className="w-full"><SelectValue placeholder="Profesional" /></SelectTrigger>
                    <SelectContent>
                      {activeDoctors.filter((d) => !busyDoctors.has(d.id)).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger aria-label="Paciente" className="w-full"><SelectValue placeholder="Paciente" /></SelectTrigger>
                    <SelectContent>
                      {patients.filter((p) => canView(p.id) && !busyPatients.has(p.id)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} · {p.species}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <SheetFooter>
              {room.status === "ocupado" && (
                <Button onClick={() => onUpdate(room.id, { status: "limpieza", doctorId: undefined, patientId: undefined, since: now })}>
                  Finalizar atención y enviar a limpieza
                </Button>
              )}
              {room.status === "limpieza" && (
                <Button onClick={() => onUpdate(room.id, { status: "disponible", since: undefined })}>
                  Marcar como disponible
                </Button>
              )}
              {room.status === "disponible" && room.kind !== "comun" && (
                <Button
                  disabled={!doctorId || !patientId}
                  onClick={() => {
                    onUpdate(room.id, { status: "ocupado", doctorId, patientId, since: now });
                    setDoctorId("");
                    setPatientId("");
                  }}
                >
                  Iniciar atención
                </Button>
              )}
              <Button variant="outline" onClick={close}>Cerrar</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
