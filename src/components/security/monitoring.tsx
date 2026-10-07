"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Cctv, HardDrive, Siren, Users } from "lucide-react";
import { StatTile } from "@/components/analytics/shared";
import { Guard } from "@/components/settings/guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NVR } from "@/lib/lookups";
import { OPEN_EVENT, WAITING_CAPACITY, ZONES, type Zone } from "@/domain/security";
import { formatDateTime } from "@/lib/format";
import { useSecurity } from "@/lib/security-store";
import { EventStatusBadge, SeverityBadge } from "./badges";
import { CameraGrid } from "./camera-tile";

const LAYOUTS = { 4: "2 × 2", 9: "3 × 3", 16: "4 × 4" } as const;

export function Monitoring() {
  const { cameras, events, waiting, settings, setAlarm } = useSecurity();
  const [layout, setLayout] = useState<4 | 9 | 16>(9);
  const [zone, setZone] = useState<"all" | Zone>("all");

  const online = cameras.filter((c) => c.status === "En línea").length;
  const open = events.filter((e) => OPEN_EVENT.includes(e.status));
  const people = waiting.reduce((s, w) => s + w.people, 0);
  const list = cameras.filter((c) => zone === "all" || c.zone === zone).slice(0, layout);
  const recent = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Cctv} label="Cámaras en línea" value={`${online}/${cameras.length}`} hint={online < cameras.length ? `${cameras.length - online} sin señal` : "Todas operativas"} />
        <StatTile icon={Siren} tone="text-destructive" label="Eventos abiertos" value={open.length} hint={`${open.filter((e) => e.severity === "Crítica").length} críticos`} />
        <StatTile icon={Users} tone="text-muted-foreground" label="Aforo sala de espera" value={`${people}/${WAITING_CAPACITY}`} hint={`${waiting.length} mascotas esperando`} />
        <StatTile icon={HardDrive} tone="text-muted-foreground" label="Almacenamiento" value={`${Math.round((NVR.usedTb / NVR.totalTb) * 100)}%`} hint={`${NVR.daysRecorded} de ${settings.retentionDays} días`} />
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              {settings.alarmArmed ? <Bell className="size-4 text-destructive" /> : <BellOff className="size-4 text-muted-foreground" />} Alarma
            </CardDescription>
            <CardTitle className="text-2xl">{settings.alarmArmed ? "Armada" : "Desarmada"}</CardTitle>
            <Guard permission="seguridad.administrar">
              <Button size="sm" variant={settings.alarmArmed ? "outline" : "default"} onClick={() => setAlarm(!settings.alarmArmed)}>
                {settings.alarmArmed ? "Desarmar" : "Armar"}
              </Button>
            </Guard>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Muro de video</CardTitle>
              <CardDescription>Haz clic en una cámara para ampliarla, ver grabaciones o marcar un evento.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={zone} onValueChange={(v) => setZone(v as typeof zone)}>
                <SelectTrigger aria-label="Zona" size="sm" className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las zonas</SelectItem>
                  {(Object.keys(ZONES) as Zone[]).map((z) => (
                    <SelectItem key={z} value={z}>{ZONES[z].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(layout)} onValueChange={(v) => setLayout(Number(v) as typeof layout)}>
                <SelectTrigger aria-label="Distribución de cámaras" size="sm" className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LAYOUTS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <CameraGrid cameras={list} columns={layout === 4 ? 2 : layout === 9 ? 3 : 4} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eventos recientes</CardTitle>
            <CardDescription>
              <Link href="/seguridad/eventos" className="text-primary hover:underline">Ver todos los eventos</Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recent.map((e) => (
              <Link key={e.id} href={`/seguridad/eventos?id=${e.id}`} className="flex flex-col gap-1 rounded-lg border p-3 text-sm transition-colors hover:border-primary/50">
                <span className="font-medium">{e.type}</span>
                <span className="text-xs text-muted-foreground">{ZONES[e.zone].label} · {formatDateTime(e.at)}</span>
                <span className="flex flex-wrap gap-1">
                  <SeverityBadge severity={e.severity} />
                  <EventStatusBadge status={e.status} />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
