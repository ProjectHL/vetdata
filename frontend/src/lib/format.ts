// Fecha "actual" fija del prototipo: evita diferencias entre servidor y cliente.
export const TODAY = "2026-10-07";
export const NOW_TIME = "11:05";

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
