import { coverage, dueVaccines } from "@/lib/analytics";
import { read } from "@/lib/server-state";
import { monthlyConsults as mockMonthlyConsults } from "@/mocks/metrics";
import { patients as mockPatients } from "@/mocks/patients";
import { type Appointment, SLOTS } from "@/domain/appointments";
import type { Doctor } from "@/domain/clinic";
import { NOW_TIME, TODAY, addDays } from "@/lib/format";
import type { Patient } from "@/domain/patients";

/** Consultas del mes en curso (misma serie que el gráfico de Diagnósticos). */
export function consultsThisMonth() {
  const monthlyConsults = read("monthlyConsults", mockMonthlyConsults);
  const cur = monthlyConsults[monthlyConsults.length - 1];
  const prev = monthlyConsults[monthlyConsults.length - 2];
  return { value: cur.clinica, previous: prev.clinica };
}

export function vaccineKpis(visible: Patient[]) {
  const due = dueVaccines(visible);
  return {
    coverage: coverage(visible),
    networkCoverage: coverage(read("patients", mockPatients)),
    overdue: due.filter((d) => d.state === "vencida").length,
    soon: due.filter((d) => d.state === "próxima").length,
    due,
  };
}

const ACTIVE = (a: Appointment) => a.status === "Agendada" || a.status === "Confirmada";

/** Tasas sobre las citas ya ocurridas (realizadas, canceladas o no asistidas). */
export function appointmentRates(appointments: Appointment[]) {
  const past = appointments.filter((a) => a.status === "Realizada" || a.status === "Cancelada" || a.status === "No asistió");
  const pct = (n: number) => Math.round((n / Math.max(1, past.length)) * 100);
  return {
    upcoming: appointments.filter((a) => a.date >= TODAY && ACTIVE(a)).length,
    done: past.filter((a) => a.status === "Realizada").length,
    cancelPct: pct(past.filter((a) => a.status === "Cancelada").length),
    noShowPct: pct(past.filter((a) => a.status === "No asistió").length),
  };
}

/** Carga de agenda de los próximos 7 días por profesional y su próxima hora libre. */
export function agendaLoad(appointments: Appointment[], doctors: Doctor[], days = 7) {
  const range = Array.from({ length: days }, (_, i) => addDays(TODAY, i));
  return doctors.map((doctor) => {
    const mine = appointments.filter((a) => a.doctorId === doctor.id && ACTIVE(a) && range.includes(a.date));
    const taken = new Set(mine.map((a) => `${a.date} ${a.time}`));
    let nextFree: { date: string; time: string } | null = null;
    for (const date of range) {
      const time = SLOTS.find((t) => !taken.has(`${date} ${t}`) && (date > TODAY || t > NOW_TIME));
      if (time) {
        nextFree = { date, time };
        break;
      }
    }
    return {
      doctor,
      booked: mine.length,
      occupancyPct: Math.round((mine.length / (SLOTS.length * days)) * 100),
      nextFree,
    };
  });
}
