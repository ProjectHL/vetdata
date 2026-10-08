"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import type { Camera } from "@/domain/security";
import { minutesSince } from "@/lib/format";
import { CameraDialog, useCameraView } from "./camera-dialog";
import { CameraFeed } from "./camera-feed";

export function CameraTile({ camera, compact }: { camera: Camera; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { view, overlay } = useCameraView(camera);
  const motion = camera.status === "En línea" && camera.lastMotion && minutesSince(camera.lastMotion) <= 5;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Abrir cámara ${camera.name}`}
      >
        <CameraFeed camera={camera} view={view} overlay={overlay} compact={compact} className="transition group-hover:ring-2 group-hover:ring-primary/60" />
        {motion && view === "live" && (
          <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            <Activity className="size-3" /> Movimiento
          </span>
        )}
      </button>
      <CameraDialog camera={camera} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CameraGrid({ cameras, columns = 3 }: { cameras: Camera[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" }[columns];
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {cameras.map((c) => (
        <CameraTile key={c.id} camera={c} compact={columns === 4} />
      ))}
    </div>
  );
}
