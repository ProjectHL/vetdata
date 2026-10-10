"use client";

import Link from "next/link";
import { Bug, Lightbulb, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type Release } from "@/domain/support";
import { formatDate } from "@/lib/format";
import { useLiveList } from "@/lib/server-state";
import { useSupport } from "@/lib/support-store";

const typeIcon = { Nuevo: Sparkles, Mejora: Wrench, Corrección: Bug } as const;

export function Releases() {
  const { ideas } = useSupport();
  const releases = useLiveList<Release>("releases");
  return (
    <div className="flex flex-col gap-4">
      {releases.map((r, idx) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Versión {r.version}
              {idx === 0 && <Badge>Última</Badge>}
            </CardTitle>
            <CardDescription>{formatDate(r.date)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {r.items.map((item, i) => {
                const Icon = typeIcon[item.type];
                const idea = ideas.find((x) => x.id === item.ideaId);
                return (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant={item.type === "Nuevo" ? "default" : "outline"} className="w-28 shrink-0 justify-start">
                      <Icon /> {item.type}
                    </Badge>
                    <div>
                      <p>{item.text}</p>
                      {idea && (
                        <Link href="/soporte/mejoras" className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Lightbulb className="size-3" /> Idea de la red: {idea.title} · {idea.votes} votos · propuesta por {idea.proposedBy}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
