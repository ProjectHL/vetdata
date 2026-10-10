"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, LogIn, Plus, UserX, X, ArrowRightToLine } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Appointment, SLOTS } from "@/domain/appointments";
import { ownerName } from "@/domain/owners";
import { NOW_TIME, TODAY, addDays, formatDate, formatRut, minutesSince } from "@/lib/format";
import { type AppointmentStage, appointmentStage, stageStyle } from "@/lib/metrics/day";
import { useSecurity } from "@/lib/security-store";
import { useDoctorsAll, useOwners, usePatients } from "@/lib/server-state";
import { useCan, useCanView, useDoctors, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const ROW = 56; // alto de cada bloque de 30 min (px)

function useStage() {
  const { rooms } = useStore();
  const { waiting } = useSecurity();
  return (a: Appointment) => appointmentStage(a, waiting, rooms);
}

export function Agenda() {
  const { appointments } = useStore();
  const doctors = useDoctors();
  const [date, setDate] = useState(TODAY);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ doctorId: string; date: string; time: string } | null>(null);

  const step = mode === "day" ? 1 : 7;
  const monday = addDays(date, -((weekday(date) + 6) % 7));
  const label =
    mode === "day"
      ? `${WEEKDAYS[weekday(date)]} ${formatDate(date)}${date === TODAY ? " · hoy" : ""}`
      : `Semana del ${formatDate(monday)} al ${formatDate(addDays(monday, 6))}`;
  const selectedAppt = appointments.find((a) => a.id === selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" aria-label="Anterior" onClick={() => setDate(addDays(date, -step))}><ChevronLeft /></Button>
          <Button variant="outline" onClick={() => setDate(TODAY)}>Hoy</Button>
          <Button size="icon" variant="outline" aria-label="Siguiente" onClick={() => setDate(addDays(date, step))}><ChevronRight /></Button>
        </div>
        <span className="font-medium">{label}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mode === "week" && (
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger aria-label="Filtrar por profesional" size="sm" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profesionales</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList>
              <TabsTrigger value="day">Día</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <StageLegend />

      {mode === "day" ? (
        <DayView date={date} onSelect={setSelected} onSlot={setSlot} />
      ) : (
        <WeekView
          monday={monday}
          doctorId={doctorFilter}
          onSelect={setSelected}
          onDay={(d) => {
            setDate(d);
            setMode("day");
          }}
        />
      )}

      <AppointmentSheet appointment={selectedAppt} onClose={() => setSelected(null)} />
      <NewAppointmentDialog slot={slot} onClose={() => setSlot(null)} />
    </div>
  );
}

function StageLegend() {
  const stages: AppointmentStage[] = ["Por llegar", "En espera", "En box", "Realizada", "No asistió", "Cancelada"];
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {stages.map((s) => (
        <span key={s} className={cn("rounded-md border px-2 py-0.5", stageStyle[s])}>{s}</span>
      ))}
    </div>
  );
}

function DayView({
  date,
  onSelect,
  onSlot,
}: {
  date: string;
  onSelect: (id: string) => void;
  onSlot: (s: { doctorId: string; date: string; time: string }) => void;
}) {
  const { appointments, rooms } = useStore();
  const doctors = useDoctors();
  const can = useCan();
  const stage = useStage();
  const patients = usePatients();
  const dayAppts = appointments.filter((a) => a.date === date);
  const nowOffset = (minutesSince("09:00", NOW_TIME) / 30) * ROW;
  const showNow = date === TODAY && nowOffset >= 0 && nowOffset <= SLOTS.length * ROW;

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="overflow-x-auto px-0">
        <div className="grid min-w-[880px]" style={{ gridTemplateColumns: `64px repeat(${doctors.length}, minmax(130px, 1fr))` }}>
          {/* Encabezado */}
          <div className="sticky left-0 z-20 border-b bg-card" />
          {doctors.map((d) => (
            <div key={d.id} className="border-b border-l bg-card px-2 py-2 text-xs">
              <p className="truncate font-semibold">{d.name}</p>
              <p className="truncate text-muted-foreground">{d.specialty} · {dayAppts.filter((a) => a.doctorId === d.id && a.status !== "Cancelada").length} citas</p>
            </div>
          ))}

          {/* Cuerpo */}
          <div className="sticky left-0 z-10 bg-card">
            {showNow && (
              <span
                className="absolute right-1 z-20 -translate-y-1/2 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums"
                style={{ top: nowOffset }}
              >
                {NOW_TIME}
              </span>
            )}
            {SLOTS.map((t) => (
              <div key={t} className="border-b pr-2 text-right text-[11px] text-muted-foreground tabular-nums" style={{ height: ROW }}>
                {t}
              </div>
            ))}
          </div>
          {doctors.map((d) => (
            <div key={d.id} className="relative border-l">
              {showNow && <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary" style={{ top: nowOffset }} />}
              {SLOTS.map((t) => {
                const appt = dayAppts.find((a) => a.doctorId === d.id && a.time === t);
                const past = date < TODAY || (date === TODAY && minutesSince(t, NOW_TIME) >= 30);
                if (appt) {
                  const s = stage(appt);
                    const p = patients.find((x) => x.id === appt.patientId);
                  return (
                    <div key={t} className="border-b p-1" style={{ height: ROW }}>
                      <button
                        type="button"
                        onClick={() => onSelect(appt.id)}
                        className={cn("flex size-full flex-col overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] leading-tight transition hover:shadow-sm", stageStyle[s])}
                      >
                        <span className="flex items-center gap-1 font-medium">
                          {p && <SpeciesIcon species={p.species} className="size-3 shrink-0" />}
                          <span className="truncate">{p?.name}</span>
                        </span>
                        <span className="truncate text-muted-foreground">{appt.reason}</span>
                        <span className="truncate">{s} · {rooms.find((r) => r.id === appt.roomId)?.name}</span>
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={t} className="group border-b p-1" style={{ height: ROW }}>
                    {can("agenda.gestionar") && !past && (
                      <button
                        type="button"
                        aria-label={`Agendar ${d.name} ${t}`}
                        onClick={() => onSlot({ doctorId: d.id, date, time: t })}
                        className="flex size-full items-center justify-center rounded-md border border-dashed border-transparent text-muted-foreground opacity-0 transition group-hover:border-border group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekView({
  monday,
  doctorId,
  onSelect,
  onDay,
}: {
  monday: string;
  doctorId: string;
  onSelect: (id: string) => void;
  onDay: (date: string) => void;
}) {
  const { appointments } = useStore();
  const stage = useStage();
  const patients = usePatients();
  const allDoctors = useDoctorsAll();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((d) => {
        const list = appointments
          .filter((a) => a.date === d && (doctorId === "all" || a.doctorId === doctorId))
          .sort((a, b) => a.time.localeCompare(b.time));
        return (
          <Card key={d} className={cn("gap-2 py-3", d === TODAY && "ring-2 ring-primary")}>
            <CardContent className="flex flex-col gap-2 px-3">
              <button type="button" onClick={() => onDay(d)} className="flex items-baseline justify-between text-left hover:text-primary">
                <span className="font-semibold">{WEEKDAYS[weekday(d)]} {d.slice(8)}</span>
                <span className="text-xs text-muted-foreground">{list.filter((a) => a.status !== "Cancelada").length} citas</span>
              </button>
              {list.length === 0 && <p className="text-xs text-muted-foreground">Sin citas</p>}
              {list.map((a) => {
                const p = patients.find((x) => x.id === a.patientId);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelect(a.id)}
                    className={cn("rounded-md border px-2 py-1 text-left text-[11px] leading-tight", stageStyle[stage(a)])}
                  >
                    <span className="font-medium tabular-nums">{a.time}</span> {p?.name}
                    <span className="block truncate text-muted-foreground">{allDoctors.find((x) => x.id === a.doctorId)?.name}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AppointmentSheet({ appointment: a, onClose }: { appointment?: Appointment; onClose: () => void }) {
  const { updateAppointment, appointments, rooms } = useStore();
  const { waiting, checkIn, callFromWaiting } = useSecurity();
  const doctors = useDoctors();
  const stage = useStage();
  const patients = usePatients();
  const owners = useOwners();
  const allDoctors = useDoctorsAll();
  const [resched, setResched] = useState<{ date: string; time: string; doctorId: string } | null>(null);
  const [box, setBox] = useState("");

  const p = a ? patients.find((x) => x.id === a.patientId) : undefined;
  const owner = p ? owners.find((o) => o.rut === p.ownerRut) : undefined;
  const s = a ? stage(a) : undefined;
  const wait = a ? waiting.find((w) => w.appointmentId === a.id) : undefined;
  const freeBoxes = rooms.filter((r) => r.kind === "box" && r.status === "disponible");
  const active = a && (a.status === "Agendada" || a.status === "Confirmada");

  const taken = (date: string, doctorId: string) =>
    new Set(appointments.filter((x) => x.id !== a?.id && x.date === date && x.doctorId === doctorId && x.status !== "Cancelada").map((x) => x.time));

  return (
    <Sheet open={!!a} onOpenChange={(o) => { if (!o) { setResched(null); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {a && p && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <SpeciesIcon species={p.species} className="size-5 text-primary" /> {p.name}
              </SheetTitle>
              <SheetDescription>
                {formatDate(a.date)} · {a.time} · {allDoctors.find((d) => d.id === a.doctorId)?.name} · {rooms.find((r) => r.id === a.roomId)?.name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-6 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{a.status}</Badge>
                {s && <span className={cn("rounded-md border px-2 py-0.5 text-xs", stageStyle[s])}>{s}</span>}
              </div>
              <p><span className="text-muted-foreground">Motivo:</span> {a.reason}</p>
              {owner && (
                <p>
                  <span className="text-muted-foreground">Dueño:</span>{" "}
                  <Link href={`/pacientes/propietarios/${owner.rut}`} className="text-primary hover:underline">{ownerName(owner)}</Link>{" "}
                  · {formatRut(owner.rut)} · {owner.phone}
                </p>
              )}
              {wait && (
                <p className="rounded-lg bg-amber-50 p-2 text-xs dark:bg-amber-950/40">
                  En sala de espera desde las {wait.arrivedAt} ({minutesSince(wait.arrivedAt)} min).{wait.alert && ` ${wait.alert}`}
                </p>
              )}
              {p.allergies.length > 0 && <p className="text-xs text-destructive">Alergias: {p.allergies.join(", ")}</p>}

              <Guard permission="agenda.gestionar">
                <div className="flex flex-col gap-2">
                  {active && a.status === "Agendada" && (
                    <Button variant="outline" onClick={() => updateAppointment(a.id, { status: "Confirmada" })}><CalendarCheck /> Confirmar</Button>
                  )}
                  {active && s === "Por llegar" && a.date === TODAY && (
                    <Button onClick={() => checkIn(a.id)}><LogIn /> Registrar llegada</Button>
                  )}
                  {wait && (
                    <div className="flex gap-2">
                      <Select value={box || freeBoxes.find((b) => b.id === a.roomId)?.id || freeBoxes[0]?.id || ""} onValueChange={setBox} disabled={freeBoxes.length === 0}>
                        <SelectTrigger aria-label="Box" className="flex-1"><SelectValue placeholder="Sin boxes libres" /></SelectTrigger>
                        <SelectContent>
                          {freeBoxes.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={freeBoxes.length === 0}
                        onClick={() => callFromWaiting(wait.id, box || freeBoxes.find((b) => b.id === a.roomId)?.id || freeBoxes[0].id)}
                      >
                        <ArrowRightToLine /> Pasar a box
                      </Button>
                    </div>
                  )}
                  {s === "En box" && (
                    <Button variant="outline" onClick={() => updateAppointment(a.id, { status: "Realizada" })}>Marcar realizada</Button>
                  )}
                  {active && (
                    <>
                      {resched ? (
                        <div className="flex flex-col gap-2 rounded-lg border p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Fecha" htmlFor="rs-date">
                              <Input id="rs-date" type="date" min={TODAY} value={resched.date} onChange={(e) => setResched({ ...resched, date: e.target.value })} />
                            </Field>
                            <Field label="Hora">
                              <Select value={resched.time} onValueChange={(v) => setResched({ ...resched, time: v })}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {SLOTS.filter((t) => !taken(resched.date, resched.doctorId).has(t)).map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                          <Field label="Profesional">
                            <Select value={resched.doctorId} onValueChange={(v) => setResched({ ...resched, doctorId: v })}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {doctors.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setResched(null)}>Cancelar</Button>
                            <Button
                              size="sm"
                              disabled={taken(resched.date, resched.doctorId).has(resched.time)}
                              onClick={() => {
                                updateAppointment(a.id, { ...resched, status: "Agendada" });
                                setResched(null);
                              }}
                            >
                              Guardar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => setResched({ date: a.date, time: a.time, doctorId: a.doctorId })}>Reprogramar</Button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" className="text-destructive" onClick={() => updateAppointment(a.id, { status: "Cancelada" })}><X /> Cancelar cita</Button>
                        <Button variant="ghost" onClick={() => updateAppointment(a.id, { status: "No asistió" })}><UserX /> No asistió</Button>
                      </div>
                    </>
                  )}
                </div>
              </Guard>
              <Button variant="outline" asChild>
                <Link href={`/pacientes/historial/${p.id}`}>Abrir ficha clínica</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NewAppointmentDialog({ slot, onClose }: { slot: { doctorId: string; date: string; time: string } | null; onClose: () => void }) {
  const { addAppointment, rooms } = useStore();
  const canView = useCanView();
  const patients = usePatients();
  const owners = useOwners();
  const allDoctors = useDoctorsAll();
  const boxes = rooms.filter((r) => r.kind === "box");
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");
  const [roomId, setRoomId] = useState(boxes[0].id);
  const doctor = allDoctors.find((d) => d.id === slot?.doctorId);

  return (
    <Dialog open={!!slot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {slot && (
          <>
            <DialogHeader>
              <DialogTitle>Nueva cita</DialogTitle>
              <DialogDescription>{doctor?.name} · {formatDate(slot.date)} a las {slot.time}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Field label="Paciente">
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona mascota" /></SelectTrigger>
                  <SelectContent>
                    {patients.filter((p) => canView(p.id)).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} · {p.species} · {ownerName(owners.find((o) => o.rut === p.ownerRut)!)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Motivo" htmlFor="na-reason">
                  <Input id="na-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Control, vacuna…" />
                </Field>
                <Field label="Box">
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {boxes.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                disabled={!patientId}
                onClick={() => {
                  addAppointment({ ...slot, patientId, roomId, reason: reason.trim() || "Consulta", status: "Agendada" });
                  setPatientId("");
                  setReason("");
                  onClose();
                }}
              >
                Agendar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
