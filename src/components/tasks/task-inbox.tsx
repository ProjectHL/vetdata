"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Cctv, Check, LifeBuoy, ListChecks, Pill, RotateCcw, ShoppingBag, Stethoscope } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK_CHANNELS, type TaskChannel, type TaskWithMeta, useTasks } from "@/lib/tasks";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/empty-state";

const channelIcon: Record<TaskChannel, React.ComponentType<{ className?: string }>> = {
  Clínica: Stethoscope,
  Red: Building2,
  Farmacia: Pill,
  Tienda: ShoppingBag,
  Seguridad: Cctv,
  Soporte: LifeBuoy,
};

const priorityVariant = { Alta: "destructive", Media: "secondary", Baja: "outline" } as const;

export function TaskInbox() {
  const { mine, open, done } = useTasks();
  const [tab, setTab] = useState<"mine" | "team" | "done">("mine");
  const [channel, setChannel] = useState<"all" | TaskChannel>("all");
  const [priority, setPriority] = useState("all");

  const source = tab === "mine" ? mine : tab === "team" ? open : done;
  const list = source.filter((t) => (channel === "all" || t.channel === channel) && (priority === "all" || t.priority === priority));
  const groups = TASK_CHANNELS.map((c) => ({ channel: c, tasks: list.filter((t) => t.channel === c) })).filter((g) => g.tasks.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="mine">Para mí ({mine.length})</TabsTrigger>
            <TabsTrigger value="team">Equipo ({open.length})</TabsTrigger>
            <TabsTrigger value="done">Hechos ({done.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
          <SelectTrigger aria-label="Canal" size="sm" className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {TASK_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Prioridad" size="sm" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridad</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Media">Media</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Solo ves lo que tu rol puede resolver. Cada pendiente desaparece cuando se resuelve en su módulo.
      </p>

      {groups.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={ListChecks}
              title={tab === "done" ? "Aún no marcas pendientes como hechos." : "Nada pendiente. ¡Bien!"}
              className="py-12"
            />
          </CardContent>
        </Card>
      )}

      {groups.map(({ channel: c, tasks }) => {
        const Icon = channelIcon[c];
        return (
          <Card key={c}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-primary" /> {c}
                <Badge variant="secondary">{tasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function TaskRow({ task: t, compact }: { task: TaskWithMeta; compact?: boolean }) {
  const { users, assignTask, completeTask } = useStore();
  return (
    <div className={cn("flex flex-col gap-2 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center", t.meta.done && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={priorityVariant[t.priority]}>{t.priority}</Badge>
          <span className="font-medium">{t.title}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.detail} · {t.ageLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {!compact && (
          <Select value={t.meta.assignee ?? "none"} onValueChange={(v) => assignTask(t.id, v === "none" ? undefined : v)}>
            <SelectTrigger aria-label="Responsable" size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {users.filter((u) => u.status === "Activo").map((u) => (
                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {t.quick && !t.meta.done && (
          <Button size="sm" onClick={t.quick.run}>{t.quick.label}</Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link href={t.href}>Ir <ArrowRight /></Link>
        </Button>
        {!compact && (
          <Button size="icon" variant="ghost" className="size-8" aria-label={t.meta.done ? "Reabrir" : "Marcar hecho"} onClick={() => completeTask(t.id, !t.meta.done)}>
            {t.meta.done ? <RotateCcw /> : <Check />}
          </Button>
        )}
      </div>
    </div>
  );
}
