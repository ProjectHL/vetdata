"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronUp, Lightbulb, Plus } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_FLOW, type Idea } from "@/domain/support";
import { channels } from "@/lib/nav";
import { useCurrentClinic } from "@/lib/server-state";
import { useSupport } from "@/lib/support-store";
import { cn } from "@/lib/utils";
import { GENERAL_MODULE, moduleLabel } from "./shared";

export function IdeasBoard() {
  const { ideas, tickets, voteIdea } = useSupport();
  const [module, setModule] = useState("all");
  const [proposing, setProposing] = useState(false);
  const modules = [...new Set(ideas.map((i) => i.module))].sort();
  const list = ideas.filter((i) => module === "all" || i.module === module);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger aria-label="Filtrar por módulo" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los módulos</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">Las clínicas de la red votan; las más votadas se priorizan.</p>
        <div className="ml-auto">
          <Guard permission="soporte.crear">
            <Button onClick={() => setProposing(true)}><Plus /> Proponer mejora</Button>
          </Guard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {IDEA_FLOW.map((status) => {
          const column = list.filter((i) => i.status === status).sort((a, b) => b.votes - a.votes);
          return (
            <div key={status} className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
              <p className="flex items-center text-sm font-semibold">
                {status}
                <Badge variant="secondary" className="ml-auto">{column.length}</Badge>
              </p>
              {column.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  ticketId={tickets.find((t) => t.ideaId === idea.id)?.id}
                  onVote={() => voteIdea(idea.id)}
                />
              ))}
              {column.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin ideas</p>}
            </div>
          );
        })}
      </div>

      <ProposeDialog open={proposing} onOpenChange={setProposing} />
    </div>
  );
}

function IdeaCard({ idea, ticketId, onVote }: { idea: Idea; ticketId?: string; onVote: () => void }) {
  const currentClinic = useCurrentClinic();
  const launched = idea.status === "Lanzada";
  return (
    <Card className="gap-2 py-3">
      <CardContent className="flex gap-3 px-3">
        <button
          type="button"
          disabled={launched}
          onClick={onVote}
          aria-pressed={idea.votedByMe}
          aria-label={idea.votedByMe ? "Quitar voto" : "Votar"}
          className={cn(
            "flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors disabled:cursor-default",
            idea.votedByMe ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
          )}
        >
          <ChevronUp className="size-4" />
          {idea.votes}
        </button>
        <div className="min-w-0 text-sm">
          <p className="font-medium leading-snug">{idea.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{idea.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="outline" className="max-w-full truncate">{idea.module}</Badge>
            {idea.proposedBy === currentClinic && <Badge variant="secondary">Tu clínica</Badge>}
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            {ticketId && <Link href={`/soporte/tickets/${ticketId}`} className="text-primary hover:underline">Ver ticket</Link>}
            {launched && <Link href="/soporte/novedades" className="text-primary hover:underline">Ver en novedades</Link>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { proposeIdea } = useSupport();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState(GENERAL_MODULE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-primary" /> Proponer mejora</DialogTitle>
          <DialogDescription>
            Se publica en el tablero de la red para que otras clínicas voten, y se crea un ticket de Mejora para seguirla.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Título" htmlFor="idea-title">
            <Input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Módulo">
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_MODULE}>General</SelectItem>
                {channels.flatMap((c) =>
                  c.items.map((i) => (
                    <SelectItem key={i.href} value={moduleLabel(c.title, i.title)}>{moduleLabel(c.title, i.title)}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="¿Qué problema resuelve?" htmlFor="idea-desc">
            <Textarea id="idea-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!title.trim() || !description.trim()}
            onClick={() => {
              const t = proposeIdea({ title: title.trim(), description: description.trim(), module });
              setTitle("");
              setDescription("");
              onOpenChange(false);
              router.push(`/soporte/tickets/${t.id}`);
            }}
          >
            Publicar idea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
