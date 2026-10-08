import {
  Armchair,
  BedDouble,
  CircleCheck,
  CircleDot,
  FlaskConical,
  type LucideIcon,
  ScanLine,
  Scissors,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { RoomKind, RoomStatus } from "@/domain/clinic";

export const statusMeta: Record<
  RoomStatus,
  { label: string; icon: LucideIcon; card: string; dot: string; text: string }
> = {
  ocupado: {
    label: "Ocupado",
    icon: CircleDot,
    card: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
  limpieza: {
    label: "En limpieza",
    icon: Sparkles,
    card: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  disponible: {
    label: "Disponible",
    icon: CircleCheck,
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

export const kindIcon: Record<RoomKind, LucideIcon> = {
  box: Stethoscope,
  quirofano: Scissors,
  imagen: ScanLine,
  laboratorio: FlaskConical,
  hospitalizacion: BedDouble,
  comun: Armchair,
};
