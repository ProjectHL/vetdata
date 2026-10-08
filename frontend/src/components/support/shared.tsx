"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, CheckCircle2, CircleDot, Clock, Eye, Hourglass, ShieldAlert, Wrench } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, SLA_HOURS, type SlaState, TICKET_CATEGORIES, type Ticket, type TicketCategory, type TicketPriority, type TicketStatus, slaState } from "@/domain/support";
import { formatHours } from "@/lib/format";
import { channels } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { useSupport } from "@/lib/support-store";
import { cn } from "@/lib/utils";

export const GENERAL_MODULE = "General";

export function moduleLabel(channelTitle: string, itemTitle: string) {
  return `${channelTitle} › ${itemTitle}`;
}

const priorityClass: Record<TicketPriority, string> = {
  Crítica: "border-destructive/40 bg-destructive/10 text-destructive",
  Alta: "border-orange-300 text-orange-700 dark:text-orange-300",
  Media: "",
  Baja: "text-muted-foreground",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="outline" className={priorityClass[priority]}>
      {priority === "Crítica" && <AlertTriangle />} {priority}
    </Badge>
  );
}

const statusVariant: Record<TicketStatus, "default" | "secondary" | "outline"> = {
  Nuevo: "default",
  "En revisión": "secondary",
  "En progreso": "secondary",
  "Esperando cliente": "outline",
  Resuelto: "outline",
  Cerrado: "outline",
};

const statusIcon: Record<TicketStatus, React.ComponentType<{ className?: string }>> = {
  Nuevo: CircleDot,
  "En revisión": Eye,
  "En progreso": Wrench,
  "Esperando cliente": Hourglass,
  Resuelto: CheckCircle2,
  Cerrado: Archive,
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const Icon = statusIcon[status];
  return (
    <Badge variant={statusVariant[status]}>
      <Icon /> {status}
    </Badge>
  );
}

const slaStyle: Record<SlaState, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  "En plazo": { icon: Clock, className: "text-muted-foreground" },
  "En riesgo": { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-300" },
  Vencido: { icon: ShieldAlert, className: "text-destructive" },
  Cumplido: { icon: CheckCircle2, className: "text-primary" },
  Incumplido: { icon: ShieldAlert, className: "text-muted-foreground" },
};

/** Estado del SLA de primera respuesta, con ícono + texto (nunca solo color). */
export function SlaIndicator({ ticket }: { ticket: Ticket }) {
  const { state, hoursLeft } = slaState(ticket);
  const { icon: Icon, className } = slaStyle[state];
  const detail =
    state === "En plazo" || state === "En riesgo"
      ? `quedan ${formatHours(hoursLeft)}`
      : state === "Vencido"
        ? `hace ${formatHours(hoursLeft)}`
        : `respondido en ${formatHours(SLA_HOURS[ticket.priority] - hoursLeft)}`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <Icon className="size-3.5" />
      <span className="font-medium">{state}</span>
      <span className="text-muted-foreground">· {detail}</span>
    </span>
  );
}

export function NewTicketDialog({
  open,
  onOpenChange,
  defaultModule = GENERAL_MODULE,
  route = "/soporte/tickets",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultModule?: string;
  route?: string;
}) {
  const router = useRouter();
  const { createTicket } = useSupport();
  const { currentUser, role } = useStore();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TicketCategory>("Incidencia");
  const [priority, setPriority] = useState<TicketPriority>("Media");
  const [module, setModule] = useState(defaultModule);
  const [body, setBody] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setModule(defaultModule);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo ticket a VetData</DialogTitle>
          <DialogDescription>
            Reporta un problema o pide ayuda al equipo de VetData. Respondemos según la prioridad (SLA).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Asunto" htmlFor="tk-title" className="sm:col-span-2">
            <Input id="tk-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. No puedo imprimir la boleta" />
          </Field>
          <Field label="Categoría">
            <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p} · respuesta en {formatHours(SLA_HOURS[p])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Módulo afectado" className="sm:col-span-2">
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_MODULE}>General / no aplica</SelectItem>
                {channels.map((c) => (
                  <SelectGroup key={c.id}>
                    <SelectLabel>{c.title}</SelectLabel>
                    {c.items.map((i) => (
                      <SelectItem key={i.href} value={moduleLabel(c.title, i.title)}>{i.title}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descripción" htmlFor="tk-body" className="sm:col-span-2">
            <Textarea id="tk-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Qué pasó, qué esperabas y pasos para reproducirlo" />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Se adjunta automáticamente: {currentUser.name} · rol {role} · página {route}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!title.trim() || !body.trim()}
            onClick={() => {
              const t = createTicket({ title: title.trim(), category, priority, module, body: body.trim(), route });
              setTitle("");
              setBody("");
              onOpenChange(false);
              router.push(`/soporte/tickets/${t.id}`);
            }}
          >
            Enviar ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
