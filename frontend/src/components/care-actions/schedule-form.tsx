"use client";

import { useState } from "react";
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
import { type Appointment, SLOTS } from "@/domain/appointments";
import type { Patient } from "@/domain/patients";
import { TODAY, formatDate, useToday } from "@/lib/format";
import { useDoctorsAll } from "@/lib/server-state";
import { useDoctors, useStore } from "@/lib/store";
import { Field, SuccessPanel } from "./field";

export function ScheduleForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const { appointments, addAppointment, rooms } = useStore();
  const doctors = useDoctors();
  const allDoctors = useDoctorsAll();
  const boxes = rooms.filter((r) => r.kind === "box");
  const [date, setDate] = useState(TODAY);
  const [doctorId, setDoctorId] = useState("");
  const [time, setTime] = useState("");
  const [roomId, setRoomId] = useState(boxes[0].id);
  const [reason, setReason] = useState("");
  const [created, setCreated] = useState<Appointment | null>(null);
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();

  const taken = new Set(
    appointments
      .filter((a) => a.date === date && a.doctorId === doctorId && a.status !== "Cancelada")
      .map((a) => a.time)
  );

  if (created) {
    const doctor = allDoctors.find((d) => d.id === created.doctorId);
    const room = rooms.find((r) => r.id === created.roomId);
    return (
      <SuccessPanel title="Hora agendada" onDone={onDone}>
        <p>
          <strong>{patient.name}</strong> · {formatDate(created.date)} a las {created.time} h
        </p>
        <p className="text-muted-foreground">
          {doctor?.name} · {room?.name} · {created.reason}
        </p>
      </SuccessPanel>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setCreated(
          addAppointment({ patientId: patient.id, date, time, doctorId, roomId, reason: reason || "Consulta", status: "Agendada" })
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profesional">
          <Select value={doctorId} onValueChange={(v) => { setDoctorId(v); setTime(""); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona profesional" /></SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name} · {d.specialty}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fecha" htmlFor="appt-date">
          <Input id="appt-date" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
        </Field>
        <Field label="Box">
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {boxes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Motivo" htmlFor="appt-reason">
          <Input id="appt-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. control, vacuna…" />
        </Field>
      </div>

      <Field label={doctorId ? "Horario disponible" : "Horario (elige un profesional)"}>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {SLOTS.map((slot) => {
            const busy = taken.has(slot);
            return (
              <button
                key={slot}
                type="button"
                disabled={!doctorId || busy}
                onClick={() => setTime(slot)}
                className={
                  "h-8 rounded-md border text-xs tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                  (time === slot ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")
                }
              >
                {busy ? "Ocupado" : slot}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Notas para recepción (opcional)">
        <Textarea rows={2} placeholder="Ej. paciente en ayuno" />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={!doctorId || !time || !date}>Agendar hora</Button>
      </div>
    </form>
  );
}
