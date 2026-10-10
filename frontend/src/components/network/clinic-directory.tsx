"use client";

import { Mail, MapPin, Phone, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { grantStatus } from "@/domain/sharing";
import { useToday } from "@/lib/format";
import { useCurrentClinic, useNetworkClinics } from "@/lib/server-state";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ClinicDirectory() {
  const { grants } = useStore();
  const networkClinics = useNetworkClinics();
  const currentClinic = useCurrentClinic();
  // T5-5: fecha real tras el montaje en modo http (fija en mock/SSR, sin mismatch).
  const today = useToday();
  const active = grants.filter((g) => grantStatus(g, today) === "Vigente");

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Clínicas de la red ({networkClinics.length})</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {networkClinics.map((c) => {
          const mine = c.name === currentClinic;
          const withUs = active.filter((g) => g.ownerClinic === c.name && g.grantedTo === currentClinic).length;
          const byUs = active.filter((g) => g.ownerClinic === currentClinic && g.grantedTo === c.name).length;
          return (
            <Card key={c.name} className={cn(mine && "ring-2 ring-primary")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  {mine ? (
                    <Badge>Tu clínica</Badge>
                  ) : (
                    <Badge variant={c.status === "Conectada" ? "outline" : "secondary"}>
                      <span className={cn("size-1.5 rounded-full", c.status === "Conectada" ? "bg-emerald-500" : "bg-amber-500")} />
                      {c.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li className="flex items-center gap-2"><MapPin className="size-3.5" /> {c.address}, {c.sector}</li>
                  <li className="flex items-center gap-2"><Phone className="size-3.5" /> {c.phone}</li>
                  <li className="flex items-center gap-2"><Mail className="size-3.5" /> {c.email}</li>
                  <li className="flex items-center gap-2"><RefreshCw className="size-3.5" /> Sincronizada: {c.lastSync}</li>
                </ul>
                <div className="flex flex-wrap gap-1">
                  {c.specialties.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2 text-center text-xs">
                  <div>
                    <p className="font-semibold tabular-nums">{c.patients.toLocaleString("es-CL")}</p>
                    <p className="text-muted-foreground">Pacientes</p>
                  </div>
                  <div>
                    <p className="font-semibold tabular-nums">{mine ? "—" : withUs}</p>
                    <p className="text-muted-foreground">Comparte con nosotros</p>
                  </div>
                  <div>
                    <p className="font-semibold tabular-nums">{mine ? "—" : byUs}</p>
                    <p className="text-muted-foreground">Compartimos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
