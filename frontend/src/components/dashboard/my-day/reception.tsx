"use client";

import Link from "next/link";
import { CalendarDays, Clock, HandCoins, LogIn, ShoppingBag, Truck, Users } from "lucide-react";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDoctorsAll, useOwners, usePatients } from "@/lib/server-state";
import { ownerName } from "@/domain/owners";
import { WAITING_CAPACITY } from "@/domain/security";
import { formatCLP, minutesSince, useNowTime, useToday } from "@/lib/format";
import { expectedArrivals, todayAppointments } from "@/lib/metrics/day";
import { retailKpis } from "@/lib/metrics/retail";
import { useRetail } from "@/lib/retail-store";
import { useSecurity } from "@/lib/security-store";
import { useStore } from "@/lib/store";
import { LinkTile, MyTasksCard } from "./shared";

import { type Doctor } from "@/domain/clinic";

const doctorName = (doctors: Doctor[], id: string) => doctors.find((d) => d.id === id)?.name ?? "";

export function ReceptionDay() {
  const { appointments, rooms, invoices } = useStore();
  const { access, waiting, checkIn } = useSecurity();
  const { sales, products, shipments } = useRetail();
  const doctors = useDoctorsAll();
  const patients = usePatients();
  const owners = useOwners();
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);
  // T5-5: fecha real tras el montaje en modo http (fijo en mock/SSR).
  const today = useToday();
  const now = useNowTime();
  const todayList = todayAppointments(appointments, today).filter((a) => a.status !== "Cancelada");
  const expected = expectedArrivals(appointments, access, waiting, rooms, today, now);
  const people = waiting.reduce((s, w) => s + w.people, 0);
  const retail = retailKpis(sales, products, today);
  const toPrepare = shipments.filter((s) => s.status === "Por preparar").length;

  // Cobros: dueños que vienen hoy con facturas emitidas o saldo pendiente.
  const todayOwners = [...new Set(todayList.map((a) => getPatient(a.patientId)?.ownerRut).filter(Boolean))] as string[];
  const charges = todayOwners
    .map((rut) => {
      const owner = getOwner(rut)!;
      const unpaid = invoices.filter((i) => i.ownerRut === rut && i.status === "Emitida").reduce((s, i) => s + i.total, 0);
      return { owner, amount: unpaid + owner.balance };
    })
    .filter((c) => c.amount > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LinkTile icon={CalendarDays} label="Citas de hoy" value={todayList.length} hint={`${todayList.filter((a) => a.status === "Confirmada").length} confirmadas`} href="/inicio/agenda" />
        <LinkTile icon={LogIn} label="Por llegar" value={expected.length} hint="Sin registro de ingreso" href="/seguridad/hall" tone="text-muted-foreground" />
        <LinkTile icon={Users} label="Sala de espera" value={`${people}/${WAITING_CAPACITY}`} hint={`${waiting.length} mascotas`} href="/seguridad/sala-espera" tone="text-amber-600 dark:text-amber-400" />
        <LinkTile icon={ShoppingBag} label="Ventas tienda hoy" value={formatCLP(retail.todayTotal)} hint={`${retail.todayCount} boletas`} href="/tienda/ventas" tone="text-muted-foreground" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Llegadas esperadas</CardTitle>
            <CardDescription>Registra la llegada y pasa a sala de espera</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {expected.length === 0 && <p className="text-sm text-muted-foreground">No hay llegadas pendientes.</p>}
            {expected.map((a) => {
              const p = getPatient(a.patientId)!;
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <SpeciesIcon species={p.species} className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.time} · {p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{ownerName(getOwner(p.ownerRut)!)} · {doctorName(doctors, a.doctorId)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => checkIn(a.id)}>Llegó</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>En sala de espera</CardTitle>
            <CardDescription>
              <Link href="/seguridad/sala-espera" className="text-primary hover:underline">Ver cámaras y pasar a box</Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {waiting.length === 0 && <p className="text-sm text-muted-foreground">Sala vacía.</p>}
            {waiting.map((w) => {
              const appt = appointments.find((a) => a.id === w.appointmentId)!;
              const p = getPatient(appt.patientId)!;
              const min = minutesSince(w.arrivedAt, now);
              return (
                <div key={w.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <SpeciesIcon species={p.species} className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name} <span className="font-normal text-muted-foreground">· cita {appt.time}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{doctorName(doctors, appt.doctorId)}</p>
                  </div>
                  <Badge variant={min > 20 ? "destructive" : "secondary"} className="tabular-nums"><Clock /> {min} min</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HandCoins className="size-4 text-primary" /> Cobros de hoy</CardTitle>
              <CardDescription>Dueños con cita hoy y monto pendiente</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {charges.length === 0 && <p className="text-muted-foreground">Sin cobros pendientes.</p>}
              {charges.map((c) => (
                <Link key={c.owner.rut} href={`/pacientes/propietarios/${c.owner.rut}`} className="flex justify-between gap-2 hover:text-primary">
                  <span>{ownerName(c.owner)}</span>
                  <span className="font-medium tabular-nums">{formatCLP(c.amount)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Link href="/tienda/despachos">
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-3 text-sm">
                <Truck className="size-5 text-primary" />
                <span className="flex-1">Despachos por preparar</span>
                <Badge variant={toPrepare > 0 ? "secondary" : "outline"}>{toPrepare}</Badge>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <MyTasksCard />
    </div>
  );
}
