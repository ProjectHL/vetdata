"use client";

import Link from "next/link";
import { ArrowRight, Cctv, LifeBuoy, ListChecks, ShieldAlert } from "lucide-react";
import { TaskRow } from "@/components/tasks/task-inbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OPEN_EVENT } from "@/domain/security";
import { supportKpis } from "@/lib/metrics/support";
import { useSecurity } from "@/lib/security-store";
import { useSupport } from "@/lib/support-store";
import { useTasks } from "@/lib/tasks";

export function LinkTile({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href: string;
  tone?: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Icon className={`size-4 ${tone}`} /> {label}
            <ArrowRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </CardDescription>
          <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </CardHeader>
      </Card>
    </Link>
  );
}

/** Los pendientes que me tocan (máx. 5), con acción rápida. */
export function MyTasksCard() {
  const { mine } = useTasks();
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-primary" /> Mis pendientes</CardTitle>
          <CardDescription>{mine.length} por resolver</CardDescription>
        </div>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/inicio/pendientes">Ver todos <ArrowRight /></Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {mine.length === 0 && <p className="text-sm text-muted-foreground">Nada pendiente.</p>}
        {mine.slice(0, 5).map((t) => (
          <TaskRow key={t.id} task={t} compact />
        ))}
      </CardContent>
    </Card>
  );
}

/** Franja de alertas transversales para Admin. */
export function AdminAlerts() {
  const { events, cameras } = useSecurity();
  const { tickets } = useSupport();
  const { open } = useTasks();
  const critical = events.filter((e) => OPEN_EVENT.includes(e.status) && e.severity === "Crítica").length;
  const offline = cameras.filter((c) => c.status !== "En línea").length;
  const support = supportKpis(tickets);
  const items = [
    { icon: ShieldAlert, text: `${critical} eventos críticos de seguridad`, href: "/seguridad/eventos", show: critical > 0, danger: true },
    { icon: Cctv, text: `${offline} cámaras sin señal`, href: "/seguridad/dispositivos", show: offline > 0, danger: false },
    { icon: LifeBuoy, text: `${support.atRisk} tickets con SLA en riesgo`, href: "/soporte/tickets", show: support.atRisk > 0, danger: false },
    { icon: ListChecks, text: `${open.length} pendientes del equipo`, href: "/inicio/pendientes", show: open.length > 0, danger: false },
  ].filter((i) => i.show);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.text} href={i.href}>
          <Badge variant={i.danger ? "destructive" : "outline"} className="h-8 gap-1.5 px-3 text-sm">
            <i.icon /> {i.text}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
