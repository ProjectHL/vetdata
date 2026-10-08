import { AlertTriangle, CheckCircle2, Clock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PatientStatus } from "@/domain/patients";

const meta: Record<PatientStatus, { variant: "default" | "secondary" | "destructive"; icon: LucideIcon }> = {
  "Al día": { variant: "default", icon: CheckCircle2 },
  Control: { variant: "secondary", icon: Clock },
  Urgente: { variant: "destructive", icon: AlertTriangle },
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  const { variant, icon: Icon } = meta[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden /> {status}
    </Badge>
  );
}
