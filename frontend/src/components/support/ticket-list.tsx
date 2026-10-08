"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Plus, ShieldAlert, Smile, Timer } from "lucide-react";
import { StatTile } from "@/components/analytics/shared";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OPEN_STATUSES, PRIORITIES, TICKET_CATEGORIES, TICKET_FLOW } from "@/domain/support";
import { formatDateTime, formatHours } from "@/lib/format";
import { supportKpis } from "@/lib/metrics/support";
import { useCan, useStore } from "@/lib/store";
import { useSupport } from "@/lib/support-store";
import { NewTicketDialog, PriorityBadge, SlaIndicator, TicketStatusBadge } from "./shared";
import { EmptyState } from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/clickable-row";

export function TicketList() {
  const router = useRouter();
  const { tickets } = useSupport();
  const { currentUser } = useStore();
  const can = useCan();
  const admin = can("soporte.administrar");
  const [scope, setScope] = useState<"mine" | "all">(admin ? "all" : "mine");
  const [status, setStatus] = useState("open");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [creating, setCreating] = useState(false);

  // Sin permiso de administración solo se ven los tickets propios.
  const effectiveScope = admin ? scope : "mine";
  const visible = tickets.filter((t) => effectiveScope === "all" || t.createdBy === currentUser.name);
  const kpis = supportKpis(visible);
  const rows = visible
    .filter((t) => status === "all" || (status === "open" ? OPEN_STATUSES.includes(t.status) : t.status === status))
    .filter((t) => category === "all" || t.category === category)
    .filter((t) => priority === "all" || t.priority === priority)
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Inbox} label="Tickets abiertos" value={kpis.open} hint={`${kpis.critical} críticos`} />
        <StatTile icon={ShieldAlert} tone="text-destructive" label="SLA en riesgo o vencido" value={kpis.atRisk} hint="Primera respuesta de VetData" />
        <StatTile icon={Timer} tone="text-muted-foreground" label="Primera respuesta promedio" value={formatHours(kpis.avgFirstResponseHours)} />
        <StatTile icon={Smile} tone="text-muted-foreground" label="Satisfacción" value={kpis.csat ? `${kpis.csat} / 5` : "—"} hint="Tickets calificados" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {admin && (
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger aria-label="Alcance" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda la clínica</SelectItem>
              <SelectItem value="mine">Mis tickets</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Estado" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abiertos</SelectItem>
            <SelectItem value="all">Todos los estados</SelectItem>
            {TICKET_FLOW.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Categoría" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {TICKET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Prioridad" className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridad</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Guard permission="soporte.crear">
            <Button onClick={() => setCreating(true)}><Plus /> Nuevo ticket</Button>
          </Guard>
        </div>
      </div>
      {!admin && <p className="-mt-3 text-xs text-muted-foreground">Ves tus tickets. Admin ve los de toda la clínica.</p>}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>SLA respuesta</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} {...clickableRow(() => router.push(`/soporte/tickets/${t.id}`))}>
                  <TableCell className="font-medium tabular-nums">#{t.number}</TableCell>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.module}</p>
                  </TableCell>
                  <TableCell>
                    {t.category}
                    {t.ideaId && <Badge variant="outline" className="ml-1">Idea</Badge>}
                  </TableCell>
                  <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                  <TableCell><TicketStatusBadge status={t.status} /></TableCell>
                  <TableCell><SlaIndicator ticket={t} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(t.createdAt)}
                    <span className="block">{t.createdBy}</span>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="whitespace-normal">
                    <EmptyState icon={Inbox} title="Sin tickets para estos filtros." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewTicketDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
