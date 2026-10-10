"use client";

import { useEffect, useId, useState } from "react";
import { EyeOff, Lock, VideoOff } from "lucide-react";
import type { Camera, Scene } from "@/domain/security";
import { realNowTime, useNowTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FeedView = "live" | "recording" | "private" | "locked" | "offline";

/** Reloj "en vivo": parte del fijo en SSR/primer render y avanza en el cliente (sin desajuste de hidratación). */
function useLiveClock() {
  const [seconds, setSeconds] = useState(0);
  // T5-5: semilla fija en el primer render (idéntica al servidor); tras el
  // montaje, en modo http, se sincroniza una sola vez con la hora real.
  const seed = useNowTime();
  const [base] = useState(seed);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "http") return;
    const [h, m] = realNowTime().split(":").map(Number);
    const [sh, sm] = base.split(":").map(Number);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount intencional: sincroniza el reloj con la hora real sin mismatch SSR
    setOffset(h * 3600 + m * 60 - (sh * 3600 + sm * 60));
  }, [base]);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const [h, m] = base.split(":").map(Number);
  const total = h * 3600 + m * 60 + offset + seconds;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/** Escenas ilustradas en SVG (no hay video real en el prototipo). Colores fijos: es "video", no UI. */
function SceneArt({ scene }: { scene: Scene }) {
  const floor = <rect x="0" y="120" width="320" height="60" fill="#2b3036" />;
  const wall = <rect x="0" y="0" width="320" height="120" fill="#353b42" />;
  switch (scene) {
    case "door":
      return (
        <>
          {wall}
          {floor}
          <rect x="120" y="30" width="80" height="100" fill="#22272c" stroke="#4b535c" strokeWidth="3" />
          <rect x="128" y="38" width="30" height="84" fill="#3d5a63" opacity="0.6" />
          <rect x="162" y="38" width="30" height="84" fill="#3d5a63" opacity="0.6" />
          <rect x="40" y="96" width="44" height="6" rx="2" fill="#4b535c" />
          <circle cx="250" cy="108" r="10" fill="#5b636c" />
          <rect x="244" y="118" width="12" height="30" rx="4" fill="#5b636c" />
          <path d="M60 170 L120 130 L200 130 L260 170 Z" fill="#30363d" />
        </>
      );
    case "reception":
      return (
        <>
          {wall}
          {floor}
          <rect x="40" y="90" width="200" height="45" rx="4" fill="#4a525b" />
          <rect x="40" y="86" width="200" height="8" rx="2" fill="#5b646d" />
          <rect x="70" y="62" width="40" height="26" rx="2" fill="#1f2429" stroke="#5b646d" />
          <circle cx="160" cy="70" r="11" fill="#6b737c" />
          <rect x="150" y="80" width="20" height="10" rx="3" fill="#6b737c" />
          <circle cx="275" cy="112" r="9" fill="#5b636c" />
          <rect x="268" y="121" width="14" height="32" rx="4" fill="#5b636c" />
        </>
      );
    case "waiting":
      return (
        <>
          {wall}
          {floor}
          {[30, 90, 150, 210].map((x) => (
            <g key={x}>
              <rect x={x} y="104" width="44" height="18" rx="3" fill="#4a525b" />
              <rect x={x} y="84" width="44" height="22" rx="3" fill="#545c66" />
              <rect x={x + 4} y="122" width="4" height="16" fill="#3c434a" />
              <rect x={x + 36} y="122" width="4" height="16" fill="#3c434a" />
            </g>
          ))}
          <circle cx="112" cy="78" r="8" fill="#6b737c" />
          <rect x="104" y="86" width="16" height="20" rx="4" fill="#6b737c" />
          <ellipse cx="128" cy="150" rx="16" ry="7" fill="#7a6a58" />
          <circle cx="142" cy="144" r="6" fill="#7a6a58" />
          <rect x="270" y="30" width="34" height="24" rx="2" fill="#1f2429" stroke="#4b535c" />
        </>
      );
    case "exam":
      return (
        <>
          {wall}
          {floor}
          <rect x="100" y="100" width="120" height="12" rx="3" fill="#8a949e" />
          <rect x="150" y="112" width="20" height="34" fill="#5b636c" />
          <rect x="30" y="50" width="60" height="70" rx="2" fill="#424950" />
          <rect x="36" y="58" width="48" height="10" fill="#525a62" />
          <rect x="36" y="74" width="48" height="10" fill="#525a62" />
          <rect x="240" y="40" width="50" height="34" rx="2" fill="#1f2429" stroke="#4b535c" />
          <circle cx="265" cy="110" r="5" fill="#4b535c" />
        </>
      );
    case "surgery":
      return (
        <>
          {wall}
          {floor}
          <ellipse cx="160" cy="30" rx="50" ry="12" fill="#6f7983" />
          <rect x="155" y="0" width="10" height="20" fill="#5b636c" />
          <rect x="90" y="104" width="140" height="12" rx="3" fill="#8a949e" />
          <rect x="150" y="116" width="20" height="34" fill="#5b636c" />
          <rect x="250" y="70" width="40" height="60" rx="3" fill="#3f474f" />
          <path d="M256 84 L266 78 L274 90 L284 80" stroke="#3fb98f" strokeWidth="2" fill="none" />
          <rect x="30" y="80" width="30" height="50" rx="3" fill="#4a525b" />
        </>
      );
    case "counter":
      return (
        <>
          {wall}
          {floor}
          <rect x="60" y="92" width="200" height="44" rx="4" fill="#4a525b" />
          <rect x="190" y="70" width="34" height="24" rx="2" fill="#1f2429" stroke="#5b646d" />
          <rect x="120" y="82" width="40" height="10" rx="2" fill="#5f5a4e" />
          {[20, 40, 60, 80].map((y) => (
            <rect key={y} x="10" y={y} width="40" height="14" fill="#4a525b" />
          ))}
          <circle cx="160" cy="58" r="10" fill="#6b737c" />
          <rect x="150" y="67" width="20" height="25" rx="4" fill="#6b737c" />
        </>
      );
    case "aisle":
      return (
        <>
          {wall}
          {floor}
          {[20, 210].map((x) => (
            <g key={x}>
              <rect x={x} y="20" width="90" height="120" fill="#3f474f" />
              {[30, 58, 86, 114].map((y) => (
                <g key={y}>
                  <rect x={x} y={y + 18} width="90" height="4" fill="#5b636c" />
                  <rect x={x + 6} y={y} width="16" height="18" fill="#6e6250" />
                  <rect x={x + 28} y={y + 4} width="14" height="14" fill="#4f6a5f" />
                  <rect x={x + 48} y={y} width="18" height="18" fill="#6a5560" />
                  <rect x={x + 70} y={y + 2} width="14" height="16" fill="#55606f" />
                </g>
              ))}
            </g>
          ))}
          <path d="M110 180 L140 120 L180 120 L210 180 Z" fill="#30363d" />
        </>
      );
    case "shelves":
      return (
        <>
          {wall}
          {floor}
          {[20, 120, 220].map((x) => (
            <g key={x}>
              <rect x={x} y="24" width="80" height="116" fill="#3f474f" />
              {[40, 70, 100].map((y) => (
                <g key={y}>
                  <rect x={x} y={y + 20} width="80" height="4" fill="#5b636c" />
                  <rect x={x + 6} y={y} width="30" height="20" fill="#6e6250" />
                  <rect x={x + 42} y={y + 4} width="30" height="16" fill="#5d5547" />
                </g>
              ))}
            </g>
          ))}
        </>
      );
  }
}

export function CameraFeed({
  camera,
  view,
  className,
  zoom = 1,
  pan = { x: 0, y: 0 },
  recordingAt,
  overlay,
  compact,
}: {
  camera: Camera;
  view: FeedView;
  className?: string;
  zoom?: number;
  pan?: { x: number; y: number };
  /** HH:mm de la grabación cuando view = "recording". */
  recordingAt?: string;
  /** Texto extra sobre la imagen (por ejemplo "Atención en curso"). */
  overlay?: React.ReactNode;
  compact?: boolean;
}) {
  const clock = useLiveClock();
  const grainId = useId().replace(/:/g, "");
  const showScene = view === "live" || view === "recording" || view === "private";

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-lg bg-[#15181c] text-white", className)}>
      {showScene && (
        <svg viewBox="0 0 320 180" className={cn("absolute inset-0 size-full", view === "private" && "scale-110 blur-md")} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <filter id={`grain-${grainId}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <radialGradient id={`vig-${grainId}`} cx="50%" cy="50%" r="70%">
              <stop offset="60%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
            </radialGradient>
          </defs>
          <g transform={`translate(${160 - 160 * zoom + pan.x} ${90 - 90 * zoom + pan.y}) scale(${zoom})`}>
            <SceneArt scene={camera.scene} />
          </g>
          <rect width="320" height="180" filter={`url(#grain-${grainId})`} opacity="0.08" />
          <rect width="320" height="180" fill={`url(#vig-${grainId})`} />
          {view === "recording" && <rect width="320" height="180" fill="#1d4ed8" opacity="0.06" />}
        </svg>
      )}

      {view === "offline" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(0deg,#1d2125_0px,#1d2125_2px,#262b30_2px,#262b30_4px)]">
          <VideoOff className="size-6 text-white/70" />
          <span className="text-xs font-medium text-white/80">{camera.status === "Mantención" ? "En mantención" : "Sin señal"}</span>
          {!compact && <span className="text-[10px] text-white/50">Último movimiento {camera.lastMotion ?? "—"}</span>}
        </div>
      )}
      {view === "locked" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1b1f24]">
          <Lock className="size-6 text-white/70" />
          <span className="px-4 text-center text-xs text-white/80">Tu rol no tiene permiso para esta cámara</span>
        </div>
      )}
      {view === "private" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 px-4 text-center">
          <EyeOff className="size-6 text-white/90" />
          <span className="text-xs font-medium">Modo privacidad</span>
          {overlay && <span className="text-[11px] text-white/75">{overlay}</span>}
        </div>
      )}

      {/* Overlays de cámara */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-2 text-[11px] leading-tight">
        <span className="font-medium drop-shadow">{camera.name}</span>
        <span className="flex items-center gap-1 font-mono tabular-nums">
          {view === "live" || view === "private" ? (
            <>
              <span className="size-2 animate-pulse rounded-full bg-red-500" /> REC {clock}
            </>
          ) : view === "recording" ? (
            <span className="rounded bg-blue-600/80 px-1">GRABACIÓN {recordingAt}</span>
          ) : null}
        </span>
      </div>
      {view === "live" && !compact && overlay && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-[11px]">{overlay}</div>
      )}
    </div>
  );
}
