"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Lightbulb, Send, Star } from "lucide-react";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SLA_HOURS, TICKET_FLOW, type TicketStatus } from "@/domain/support";
import { formatDateTime, formatHours } from "@/lib/format";
import { useCan } from "@/lib/store";
import { useSupport } from "@/lib/support-store";
import { cn } from "@/lib/utils";
import { PriorityBadge, SlaIndicator, TicketStatusBadge } from "./shared";

export function TicketDetail({ id }: { id: string }) {
  const { tickets, ideas, replyTicket, changeStatus, rateTicket, simulateSupportReply } = useSupport();
  const can = useCan();
  const [reply, setReply] = useState("");
  const ticket = tickets.find((t) => t.id === id);

  if (!ticket) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Ticket no encontrado. <Link href="/soporte/tickets" className="text-primary hover:underline">Volver a tickets</Link>
        </CardContent>
      </Card>
    );
  }

  const idea = ideas.find((i) => i.id === ticket.ideaId);
  const closed = ticket.status === "Cerrado";
  const currentStep = TICKET_FLOW.indexOf(ticket.status);
  // La clínica puede marcar resuelto o reabrir; cerrar sin calificar queda para Admin.
  const statusOptions: TicketStatus[] = can("soporte.administrar")
    ? TICKET_FLOW
    : TICKET_FLOW.filter((s) => s !== "Cerrado");

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/soporte/tickets"><ArrowLeft /> Volver a tickets</Link>
      </Button>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">#{ticket.number}</span>
          <PriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
          <Badge variant="outline">{ticket.category}</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
        <p className="text-sm text-muted-foreground">
          {ticket.module} · creado por {ticket.createdBy} el {formatDateTime(ticket.createdAt)}
        </p>
      </div>

      {/* Línea de tiempo de estados */}
      <ol className="flex flex-wrap gap-1 text-xs">
        {TICKET_FLOW.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-full border px-2.5 py-1",
              i < currentStep && "border-primary/30 bg-primary/5 text-primary",
              i === currentStep && "border-primary bg-primary font-medium text-primary-foreground",
              i > currentStep && "text-muted-foreground"
            )}
          >
            {s}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        {/* Conversación */}
        <Card>
          <CardHeader><CardTitle>Conversación</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ticket.messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-1", m.side === "VetData" ? "items-start" : "items-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    m.side === "VetData" ? "rounded-tl-sm bg-muted" : "rounded-tr-sm bg-primary text-primary-foreground"
                  )}
                >
                  {m.body}
                </div>
                <span className="text-xs text-muted-foreground">{m.author} · {formatDateTime(m.at)}</span>
              </div>
            ))}

            {!closed && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <Textarea aria-label="Respuesta" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe una respuesta para el equipo de VetData" />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => simulateSupportReply(ticket.id)}>
                    <FlaskConical /> Simular respuesta de soporte
                  </Button>
                  <Button
                    disabled={!reply.trim()}
                    onClick={() => {
                      replyTicket(ticket.id, reply.trim());
                      setReply("");
                    }}
                  >
                    <Send /> Responder
                  </Button>
                </div>
              </div>
            )}

            {ticket.status === "Resuelto" && !ticket.rating && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-sm font-medium">¿Cómo evalúas la solución de VetData?</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button key={n} size="icon" variant="ghost" aria-label={`${n} estrellas`} onClick={() => rateTicket(ticket.id, n)}>
                      <Star className="size-5" />
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Al calificar, el ticket se cierra.</p>
              </div>
            )}
            {ticket.rating && (
              <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                Calificación:{" "}
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn("size-4", i < ticket.rating! ? "fill-current text-primary" : "")} />
                ))}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lateral */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Detalles</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">SLA de primera respuesta ({formatHours(SLA_HOURS[ticket.priority])})</p>
                <SlaIndicator ticket={ticket} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contexto adjunto</p>
                <p>Página <span className="font-mono text-xs">{ticket.context.route}</span></p>
                <p>Rol {ticket.context.role}</p>
              </div>
              {!closed && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Guard permission="soporte.crear">
                    <Select value={ticket.status} onValueChange={(v) => changeStatus(ticket.id, v as TicketStatus)}>
                      <SelectTrigger aria-label="Estado del ticket" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Guard>
                </div>
              )}
            </CardContent>
          </Card>
          {idea && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="size-4 text-primary" /> Idea vinculada</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="font-medium">{idea.title}</p>
                <div className="flex gap-1.5">
                  <Badge variant="secondary">{idea.status}</Badge>
                  <Badge variant="outline">{idea.votes} votos</Badge>
                </div>
                <Link href="/soporte/mejoras" className="text-primary hover:underline">Ver en el tablero de mejoras</Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
