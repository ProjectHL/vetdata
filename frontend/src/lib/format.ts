// Fecha "actual" fija del prototipo: evita diferencias entre servidor y cliente.
// En modo mock es la fecha de todo; en modo http solo es el valor SSR/primer
// render. Los hooks `useToday`/`useNowTime`/`useNowIso` devuelven la fecha real
// del navegador tras el montaje (sin mismatch de hidratación).
export const TODAY = "2026-10-07";
export const NOW_TIME = "11:05";

import { useEffect, useState } from "react";

/** Verdadero solo con `NEXT_PUBLIC_DATA_SOURCE=http` (se inyecta en build). */
const isServerMode = process.env.NEXT_PUBLIC_DATA_SOURCE === "http";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Fecha real del navegador en "yyyy-mm-dd" (zona local). */
export function realToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Hora real del navegador en "HH:MM" (zona local). */
export function realNowTime(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Momento real del navegador en "yyyy-mm-ddTHH:MM" (zona local). */
export function realNowIso(): string {
  return `${realToday()}T${realNowTime()}`;
}

/**
 * "Hoy" compatible con hidratación (T5-5): SSR y primer render devuelven el
 * fijo (idéntico al servidor); tras el montaje, en modo http, la fecha real
 * del navegador. En modo mock siempre el fijo (demo reproducible).
 */
export function useToday(): string {
  const [today, setToday] = useState(TODAY);
  useEffect(() => {
    if (!isServerMode) return;
    const real = realToday();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount intencional: fecha real sin mismatch SSR
    if (real !== TODAY) setToday(real);
  }, []);
  return today;
}

/** Hora "ahora" compatible con hidratación (mismo patrón que `useToday`). */
export function useNowTime(): string {
  const [now, setNow] = useState(NOW_TIME);
  useEffect(() => {
    if (!isServerMode) return;
    const real = realNowTime();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount intencional: hora real sin mismatch SSR
    if (real !== NOW_TIME) setNow(real);
  }, []);
  return now;
}

/** Momento "ahora" ISO compatible con hidratación (mismo patrón que `useToday`). */
export function useNowIso(): string {
  const [now, setNow] = useState(`${TODAY}T${NOW_TIME}`);
  useEffect(() => {
    if (!isServerMode) return;
    const seed = `${TODAY}T${NOW_TIME}`;
    const real = realNowIso();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount intencional: momento real sin mismatch SSR
    if (real !== seed) setNow(real);
  }, []);
  return now;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function daysUntil(iso: string, from = TODAY) {
  const ms = Date.parse(iso) - Date.parse(from);
  return Math.round(ms / 86_400_000);
}

export function minutesSince(time: string, now = NOW_TIME) {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return toMin(now) - toMin(time);
}

function thousands(n: number) {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatCLP(n: number) {
  return `${n < 0 ? "-" : ""}$${thousands(n)}`;
}

/** "16482335-0" → "16.482.335-0" */
export function formatRut(rut: string) {
  const [body, dv] = rut.split("-");
  return `${thousands(Number(body))}-${dv}`;
}

/** Quita puntos/espacios para comparar RUTs escritos por el usuario. */
export function normalizeRut(input: string) {
  return input.replace(/[.\s]/g, "").toUpperCase();
}

export function ageFrom(birthDate: string, from = TODAY) {
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ty, tm, td] = from.split("-").map(Number);
  let months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  if (months < 0) months = 0;
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Momento "actual" del prototipo en formato ISO local. */
export const NOW_ISO = `${TODAY}T${NOW_TIME}`;

export function hoursBetween(fromIso: string, toIso = NOW_ISO) {
  return (Date.parse(`${toIso}:00Z`) - Date.parse(`${fromIso}:00Z`)) / 3_600_000;
}

/** "07 oct 2026 · 09:30" desde "2026-10-07T09:30". */
export function formatDateTime(iso: string) {
  const [d, t] = iso.split("T");
  return `${formatDate(d)} · ${t}`;
}

/** Duración legible desde horas: "3 h", "2 d 4 h". */
export function formatHours(h: number) {
  const abs = Math.abs(h);
  if (abs < 1) return `${Math.round(abs * 60)} min`;
  if (abs < 24) return `${Math.round(abs)} h`;
  const d = Math.floor(abs / 24);
  const rest = Math.round(abs % 24);
  return rest ? `${d} d ${rest} h` : `${d} d`;
}
