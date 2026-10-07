import { AlertTriangle, CheckCircle2, CircleDot, Eye, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CameraStatus, EventStatus, Severity } from "@/domain/security";
import { cn } from "@/lib/utils";

const severityClass: Record<Severity, string> = {
  Crítica: "border-destructive/40 bg-destructive/10 text-destructive",
  Alta: "border-orange-300 text-orange-700 dark:text-orange-300",
  Media: "text-amber-700 dark:text-amber-300",
  Baja: "text-muted-foreground",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant="outline" className={severityClass[severity]}>
      {(severity === "Crítica" || severity === "Alta") && <AlertTriangle />} {severity}
    </Badge>
  );
}

const statusIcon: Record<EventStatus, React.ComponentType<{ className?: string }>> = {
  Nuevo: CircleDot,
  "En revisión": Eye,
  Resuelto: CheckCircle2,
  "Falsa alarma": XCircle,
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const Icon = statusIcon[status];
  return (
    <Badge variant={status === "Nuevo" ? "default" : status === "En revisión" ? "secondary" : "outline"}>
      <Icon /> {status}
    </Badge>
  );
}

export function CameraStatusBadge({ status }: { status: CameraStatus }) {
  return (
    <Badge variant="outline" className={cn(status === "En línea" ? "text-primary" : "text-destructive")}>
      {status === "En línea" ? <span className="size-1.5 rounded-full bg-emerald-500" /> : <ShieldAlert />} {status}
    </Badge>
  );
}
