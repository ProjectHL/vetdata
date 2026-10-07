"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera as CameraIcon,
  Download,
  Flag,
  LifeBuoy,
  PlayCircle,
  Radio,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { doctors, getPatient } from "@/lib/lookups";
import { type Camera, ZONES } from "@/domain/security";
import { NOW_TIME, TODAY } from "@/lib/format";
import { usePrivacy, useSecurity } from "@/lib/security-store";
import { useCan } from "@/lib/store";
import { useSupport } from "@/lib/support-store";
import { cn } from "@/lib/utils";
import { CameraStatusBadge } from "./badges";
import { CameraFeed, type FeedView } from "./camera-feed";

/** Qué puede ver el usuario actual de una cámara, según estado, permisos y privacidad. */
export function useCameraView(camera: Camera): { view: FeedView; overlay?: string } {
  const can = useCan();
  const { private: isPrivate, room } = usePrivacy(camera);
  if (camera.status !== "En línea") return { view: "offline" };
  if (!can("seguridad.ver") || (camera.zone === "boxes" && !can("seguridad.boxes"))) return { view: "locked" };
  if (isPrivate) {
    const doctor = doctors.find((d) => d.id === room?.doctorId);
    const patient = getPatient(room?.patientId ?? "");
    return { view: "private", overlay: `Atención en curso${doctor ? ` · ${doctor.name}` : ""}${patient ? ` con ${patient.name}` : ""}` };
  }
  if (room?.status === "limpieza") return { view: "live", overlay: "Verificación de limpieza" };
  return { view: "live" };
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function CameraDialog({
  camera,
  open,
  onOpenChange,
  initialRecordingAt,
}: {
  camera: Camera;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Abre directamente la grabación a esta hora (HH:mm). */
  initialRecordingAt?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        {open && <CameraDialogBody camera={camera} initialRecordingAt={initialRecordingAt} />}
      </DialogContent>
    </Dialog>
  );
}

function CameraDialogBody({ camera, initialRecordingAt }: { camera: Camera; initialRecordingAt?: string }) {
  const router = useRouter();
  const can = useCan();
  const { events, logAudit, createEvent } = useSecurity();
  const { createTicket } = useSupport();
  const base = useCameraView(camera);
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hour, setHour] = useState(initialRecordingAt ? Number(initialRecordingAt.slice(0, 2)) : 10);
  const canOpenRecording =
    !!initialRecordingAt && can("seguridad.grabaciones") && base.view !== "offline" && base.view !== "locked";
  const [recordingAt, setRecordingAt] = useState<string | null>(canOpenRecording ? initialRecordingAt! : null);
  const [message, setMessage] = useState("");

  // Abrir una grabación directa (desde boleta o evento) también queda auditado, una sola vez.
  const audited = useRef(false);
  useEffect(() => {
    if (canOpenRecording && !audited.current) {
      audited.current = true;
      logAudit(camera.id, "Abrió grabación", `Revisión de las ${initialRecordingAt}`);
    }
  }, [canOpenRecording, camera.id, initialRecordingAt, logAudit]);

  const view: FeedView = recordingAt ? "recording" : base.view === "private" && override ? "live" : base.view;
  const todayEvents = events.filter((e) => e.cameraId === camera.id && e.at.startsWith(TODAY));
  const move = (dx: number, dy: number) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {camera.name} <CameraStatusBadge status={camera.status} />
        </DialogTitle>
        <DialogDescription>
          {ZONES[camera.zone].label} · {camera.location} · {camera.resolution} · grabación {camera.recording.toLowerCase()}
          {camera.audio && " · con audio"}
        </DialogDescription>
      </DialogHeader>

      <CameraFeed camera={camera} view={view} zoom={zoom} pan={pan} recordingAt={recordingAt ?? undefined} overlay={base.overlay} />

      {message && <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}

      {/* Privacidad: ver un box en atención exige permiso + motivo, y se audita. */}
      {base.view === "private" && !override && !recordingAt && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="text-sm font-medium">Box en atención: la vista en vivo está oculta para proteger la privacidad.</p>
          <Field label="Motivo para ver de todos modos (queda registrado en auditoría)" htmlFor="priv-reason">
            <Textarea id="priv-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Guard permission="seguridad.boxes">
              <Button
                size="sm"
                variant="outline"
                disabled={!reason.trim()}
                onClick={() => {
                  logAudit(camera.id, "Desactivó privacidad", reason.trim());
                  setOverride(true);
                }}
              >
                Ver de todos modos
              </Button>
            </Guard>
          </div>
        </div>
      )}

      {/* Controles */}
      {view !== "offline" && view !== "locked" && (
        <div className="flex flex-wrap items-center gap-2">
          {camera.ptz && !recordingAt && (
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button size="icon" variant="ghost" className="size-7" aria-label="Izquierda" onClick={() => move(12, 0)}><ArrowLeft /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Arriba" onClick={() => move(0, 10)}><ArrowUp /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Abajo" onClick={() => move(0, -10)}><ArrowDown /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Derecha" onClick={() => move(-12, 0)}><ArrowRight /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}><ZoomIn /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Alejar" onClick={() => { setZoom((z) => Math.max(1, z - 0.2)); if (zoom <= 1.2) setPan({ x: 0, y: 0 }); }}><ZoomOut /></Button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => setMessage(`Captura guardada (${camera.name}).`)}>
            <CameraIcon /> Captura
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              createEvent({ zone: camera.zone, cameraId: camera.id, type: "Marcado manual", severity: "Media", note: "Marcado desde la vista de cámara" });
              setMessage("Evento marcado. Lo encuentras en Seguridad › Eventos.");
            }}
          >
            <Flag /> Marcar evento
          </Button>
          {recordingAt && (
            <Button size="sm" variant="outline" onClick={() => setRecordingAt(null)}>
              <Radio /> Volver a en vivo
            </Button>
          )}
        </div>
      )}

      {view === "offline" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
          <span>La cámara no responde. Si el problema persiste, repórtalo al equipo de VetData.</span>
          <Guard permission="soporte.crear">
            <Button
              size="sm"
              onClick={() => {
                const t = createTicket({
                  title: `Cámara sin señal: ${camera.name}`,
                  category: "Integración / datos",
                  priority: "Alta",
                  module: "Seguridad › Dispositivos",
                  body: `La cámara ${camera.name} (${camera.location}, firmware ${camera.firmware}) está sin señal desde las ${camera.lastMotion ?? "—"}.`,
                  route: "/seguridad/monitoreo",
                });
                router.push(`/soporte/tickets/${t.id}`);
              }}
            >
              <LifeBuoy /> Reportar a soporte
            </Button>
          </Guard>
        </div>
      )}

      {/* Línea de tiempo de grabación */}
      {view !== "locked" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Grabación de hoy</span>
            <span className="text-xs text-muted-foreground">{todayEvents.length} eventos marcados</span>
          </div>
          <div className="relative grid grid-cols-24 gap-px overflow-hidden rounded-md">
            {HOURS.map((h) => {
              const hasEvent = todayEvents.some((e) => Number(e.at.slice(11, 13)) === h);
              const future = h > Number(NOW_TIME.slice(0, 2));
              return (
                <button
                  key={h}
                  type="button"
                  disabled={future}
                  onClick={() => setHour(h)}
                  aria-label={`${h}:00`}
                  className={cn(
                    "relative h-8 bg-muted transition-colors disabled:opacity-30",
                    camera.recording === "Continua" || hasEvent ? "bg-primary/25" : "bg-muted",
                    hour === h && "ring-2 ring-primary ring-inset"
                  )}
                >
                  {hasEvent && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-destructive" />}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="tabular-nums">{String(hour).padStart(2, "0")}:00</Badge>
            <Guard permission="seguridad.grabaciones">
              <Button
                size="sm"
                onClick={() => {
                  const at = `${String(hour).padStart(2, "0")}:00`;
                  setRecordingAt(at);
                  logAudit(camera.id, "Abrió grabación", `Revisión de las ${at}`);
                }}
              >
                <PlayCircle /> Abrir grabación
              </Button>
            </Guard>
            <Guard permission="seguridad.grabaciones">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const at = `${String(hour).padStart(2, "0")}:00`;
                  logAudit(camera.id, "Exportó clip", `Clip ${at}–${String(hour).padStart(2, "0")}:15`);
                  setMessage(`Clip de ${at} exportado (15 min). Quedó registrado en auditoría.`);
                }}
              >
                <Download /> Exportar clip
              </Button>
            </Guard>
          </div>
        </div>
      )}
    </>
  );
}
