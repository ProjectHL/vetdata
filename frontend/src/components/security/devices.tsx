"use client";

import { useRouter } from "next/navigation";
import { BatteryLow, HardDrive, LifeBuoy, Lock, LockOpen, RotateCcw, Settings2, Wrench } from "lucide-react";
import { ExportButton } from "@/components/analytics/shared";
import { Field } from "@/components/care-actions/field";
import { Guard, RequirePermission } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { NVR } from "./nvr";
import { type SecuritySettings, ZONES } from "@/domain/security";
import { formatDateTime } from "@/lib/format";
import { useSecurity } from "@/lib/security-store";
import { useCan } from "@/lib/store";
import { useSupport } from "@/lib/support-store";
import { cn } from "@/lib/utils";
import { CameraStatusBadge } from "./badges";

export function Devices() {
  const router = useRouter();
  const { cameras, devices, settings, audit, setCameraStatus, toggleLock, updateSettings } = useSecurity();
  const { createTicket } = useSupport();
  const can = useCan();
  const admin = can("seguridad.administrar");
  const usedPct = Math.round((NVR.usedTb / NVR.totalTb) * 100);

  const report = (name: string, detail: string) => {
    const t = createTicket({
      title: `Falla de dispositivo: ${name}`,
      category: "Integración / datos",
      priority: "Alta",
      module: "Seguridad › Dispositivos",
      body: detail,
      route: "/seguridad/dispositivos",
    });
    router.push(`/soporte/tickets/${t.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HardDrive className="size-4 text-primary" /> Grabador (NVR)</CardTitle>
            <CardDescription>{NVR.usedTb} TB de {NVR.totalTb} TB · {NVR.daysRecorded} días grabados de {settings.retentionDays} de retención</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="h-3 rounded-full bg-muted">
              <div className={cn("h-3 rounded-full", usedPct > 90 ? "bg-destructive" : "bg-[var(--viz-1)]")} style={{ width: `${usedPct}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {NVR.daysRecorded < settings.retentionDays
                ? `Con el espacio actual se alcanzan ${NVR.daysRecorded} días: para cumplir ${settings.retentionDays} días bajar resolución de cámaras por movimiento o ampliar disco.`
                : "La retención configurada se cumple."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="size-4 text-primary" /> Configuración</CardTitle>
            {!admin && <CardDescription>Solo lectura: requiere permiso de administrar seguridad.</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Retención de grabaciones">
              <Select
                value={String(settings.retentionDays)}
                disabled={!admin}
                onValueChange={(v) => updateSettings({ retentionDays: Number(v) as SecuritySettings["retentionDays"] })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 60, 90].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} días</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fuera de horario desde" htmlFor="ah-from">
                <Input id="ah-from" type="time" value={settings.afterHoursFrom} disabled={!admin} onChange={(e) => updateSettings({ afterHoursFrom: e.target.value })} />
              </Field>
              <Field label="Hasta" htmlFor="ah-to">
                <Input id="ah-to" type="time" value={settings.afterHoursTo} disabled={!admin} onChange={(e) => updateSettings({ afterHoursTo: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="privacy" checked={settings.privacyInBoxes} disabled={!admin} onCheckedChange={(v) => updateSettings({ privacyInBoxes: v === true })} />
              <Label htmlFor="privacy" className="leading-snug font-normal">Privacidad en boxes: ocultar video en vivo durante la atención</Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="autoarm" checked={settings.autoArm} disabled={!admin} onCheckedChange={(v) => updateSettings({ autoArm: v === true })} />
              <Label htmlFor="autoarm" className="leading-snug font-normal">Armar la alarma automáticamente fuera de horario</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cámaras ({cameras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cámara</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Grabación</TableHead>
                <TableHead>Resolución</TableHead>
                <TableHead>Firmware</TableHead>
                <TableHead>Últ. movimiento</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cameras.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.location}{c.ptz && " · PTZ"}{c.audio && " · audio"}</p>
                  </TableCell>
                  <TableCell>{ZONES[c.zone].label}</TableCell>
                  <TableCell><CameraStatusBadge status={c.status} /></TableCell>
                  <TableCell>{c.recording}</TableCell>
                  <TableCell>{c.resolution}</TableCell>
                  <TableCell className="font-mono text-xs">{c.firmware}</TableCell>
                  <TableCell className="tabular-nums">{c.lastMotion ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex gap-1">
                      {c.status !== "En línea" && (
                        <Guard permission="seguridad.administrar">
                          <Button size="sm" variant="ghost" onClick={() => setCameraStatus(c.id, "En línea")}><RotateCcw /> Reiniciar</Button>
                        </Guard>
                      )}
                      {c.status === "En línea" ? (
                        <Guard permission="seguridad.administrar">
                          <Button size="sm" variant="ghost" onClick={() => setCameraStatus(c.id, "Mantención")}><Wrench /> Mantención</Button>
                        </Guard>
                      ) : (
                        <Guard permission="soporte.crear">
                          <Button size="sm" variant="ghost" onClick={() => report(c.name, `La cámara ${c.name} (${c.location}) está "${c.status}". Firmware ${c.firmware}.`)}>
                            <LifeBuoy /> Soporte
                          </Button>
                        </Guard>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sensores y accesos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Batería</TableHead>
                <TableHead>Última señal</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.kind}</TableCell>
                  <TableCell>{ZONES[d.zone].label}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "Operativo" ? "outline" : "destructive"}>
                      {d.status === "Batería baja" && <BatteryLow />} {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.battery !== undefined ? `${d.battery}%` : "—"}</TableCell>
                  <TableCell className="tabular-nums">{d.lastSeen}</TableCell>
                  <TableCell className="text-right">
                    {d.kind === "Cerradura" && (
                      <Guard permission="seguridad.administrar">
                        <Button size="sm" variant="ghost" onClick={() => toggleLock(d.id)}>
                          {d.locked ? <><LockOpen /> Desbloquear</> : <><Lock /> Bloquear</>}
                        </Button>
                      </Guard>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RequirePermission permission="seguridad.administrar" message="El registro de auditoría está disponible para quienes administran la seguridad.">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Registro de auditoría</CardTitle>
              <CardDescription>Cada acceso a grabaciones, exportación o vista de un box en atención, con su motivo.</CardDescription>
            </div>
            <ExportButton
              filename="auditoria-camaras.csv"
              rows={audit.map((a) => ({
                Fecha: a.at.replace("T", " "),
                Usuario: a.user,
                Rol: a.role,
                Acción: a.action,
                Cámara: cameras.find((c) => c.id === a.cameraId)?.name ?? a.cameraId,
                Motivo: a.reason ?? "",
              }))}
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Cámara</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...audit].sort((a, b) => b.at.localeCompare(a.at)).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">{formatDateTime(a.at)}</TableCell>
                    <TableCell>{a.user} <span className="text-xs text-muted-foreground">· {a.role}</span></TableCell>
                    <TableCell>
                      <Badge variant={a.action === "Desactivó privacidad" ? "destructive" : "outline"}>{a.action}</Badge>
                    </TableCell>
                    <TableCell>{cameras.find((c) => c.id === a.cameraId)?.name}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{a.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </RequirePermission>
    </div>
  );
}
