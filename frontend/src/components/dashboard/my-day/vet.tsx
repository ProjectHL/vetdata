"use client";

import Link from "next/link";
import { ArrowRightToLine, Building2, CalendarDays, Clock, Pill, Stethoscope } from "lucide-react";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentClinic, useOwners, usePatients } from "@/lib/server-state";
import { ownerName } from "@/domain/owners";
import { INTERNAL_PHARMACY } from "@/domain/referrals";
import { minutesSince, useNowTime, useToday } from "@/lib/format";
import { appointmentStage, stageStyle, todayAppointments } from "@/lib/metrics/day";
import { useSecurity } from "@/lib/security-store";
import { useCan, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LinkTile, MyTasksCard } from "./shared";

export function VetDay() {
  const { currentUser, appointments, rooms, referrals, requests, updateRoom, updateAppointment } = useStore();
  const { waiting, callFromWaiting } = useSecurity();
  const currentClinic = useCurrentClinic();
  const patients = usePatients();
  const owners = useOwners();
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);
  const can = useCan();
  const myId = currentUser.doctorId;
  // T5-5: fecha real tras el montaje en modo http (fijo en mock/SSR, sin mismatch).
  const today = useToday();
  const now = useNowTime();
  const mine = todayAppointments(appointments, today).filter((a) => a.doctorId === myId && a.status !== "Cancelada");
  const stageOf = (a: (typeof mine)[number]) => appointmentStage(a, waiting, rooms, today, now);
  const myRoom = rooms.find((r) => r.status === "ocupado" && r.doctorId === myId);
  const current = myRoom ? getPatient(myRoom.patientId ?? "") : undefined;
  const myReferrals = referrals.filter((r) => r.doctorId === myId && r.destination === INTERNAL_PHARMACY && r.status !== "Dispensada");
  const pendingRequests = requests.filter((r) => r.to === currentClinic && r.status === "Pendiente").length;
  const freeBoxes = rooms.filter((r) => r.kind === "box" && r.status === "disponible");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LinkTile icon={CalendarDays} label="Mis citas de hoy" value={mine.length} hint={`${mine.filter((a) => stageOf(a) === "Realizada").length} realizadas`} href="/inicio/agenda" />
        <LinkTile icon={Clock} label="Esperándome" value={mine.filter((a) => stageOf(a) === "En espera").length} hint="En sala de espera" href="/seguridad/sala-espera" tone="text-amber-600 dark:text-amber-400" />
        <LinkTile icon={Pill} label="Mis recetas sin dispensar" value={myReferrals.length} hint="Derivadas a farmacia interna" href="/farmacia/movimientos" tone="text-muted-foreground" />
        {can("red.aprobar") && (
          <LinkTile icon={Building2} label="Solicitudes de la red" value={pendingRequests} hint="Por responder" href="/clinicas/solicitudes" tone="text-muted-foreground" />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Mi agenda de hoy</CardTitle>
              <CardDescription>Estado real: sala de espera, box y atención</CardDescription>
            </div>
            <Button size="sm" variant="ghost" asChild><Link href="/inicio/agenda">Abrir agenda</Link></Button>
          </CardHeader>
          <CardContent>
            {mine.length === 0 && <p className="text-sm text-muted-foreground">No tienes citas hoy.</p>}
            <ol className="relative flex flex-col gap-3 border-l pl-5">
              {mine.map((a) => {
                const p = getPatient(a.patientId)!;
                const s = stageOf(a);
                const w = waiting.find((x) => x.appointmentId === a.id);
                const box = freeBoxes.find((b) => b.id === a.roomId) ?? freeBoxes[0];
                return (
                  <li key={a.id} className="relative">
                    <span className={cn("absolute top-3 -left-[25px] size-2.5 rounded-full ring-4 ring-card", a.time <= now ? "bg-primary" : "bg-muted-foreground/40")} />
                    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm", stageStyle[s])}>
                      <span className="w-11 font-semibold tabular-nums">{a.time}</span>
                      <SpeciesIcon species={p.species} className="size-4" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/pacientes/historial/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                        <span className="text-muted-foreground"> · {a.reason} · {ownerName(getOwner(p.ownerRut)!)}</span>
                        {w?.alert && <p className="text-xs text-amber-700 dark:text-amber-300">{w.alert}</p>}
                      </div>
                        <Badge variant="outline">{s}{w && ` · ${minutesSince(w.arrivedAt, now)} min`}</Badge>
                      {w && box && !myRoom && (
                        <Button size="sm" onClick={() => callFromWaiting(w.id, box.id)}>
                          <ArrowRightToLine /> Llamar a {box.name}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Stethoscope className="size-4 text-primary" /> Atendiendo ahora</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {myRoom && current ? (
                <>
                  <p>
                    <Link href={`/pacientes/historial/${current.id}`} className="font-semibold hover:text-primary hover:underline">{current.name}</Link>
                    <span className="text-muted-foreground"> en {rooms.find((r) => r.id === myRoom.id)?.name} desde las {myRoom.since} ({minutesSince(myRoom.since ?? now, now)} min)</span>
                  </p>
                  {current.allergies.length > 0 && <p className="text-xs text-destructive">Alergias: {current.allergies.join(", ")}</p>}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const appt = mine.find((a) => a.patientId === current.id && stageOf(a) === "En box");
                      if (appt) updateAppointment(appt.id, { status: "Realizada" });
                      updateRoom(myRoom.id, { status: "limpieza", doctorId: undefined, patientId: undefined, since: now });
                    }}
                  >
                    Finalizar atención y enviar box a limpieza
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Sin paciente en box. Llama al siguiente desde tu agenda.</p>
              )}
            </CardContent>
          </Card>
          <MyTasksCard />
        </div>
      </div>
    </div>
  );
}
