/**
 * Seguridad: cámaras por zona, accesos, sala de espera, eventos y auditoría.
 * Reglas:
 * 1. Las cámaras de boxes pasan a modo privacidad cuando el box está ocupado.
 * 2. Todo acceso a grabaciones o a un box en privacidad queda auditado (con motivo).
 * 3. Los eventos siguen Nuevo → En revisión → Resuelto / Falsa alarma.
 */

export type Zone = "hall" | "espera" | "boxes" | "tienda" | "bodega" | "farmacia";

export const ZONES: Record<Zone, { label: string; href?: string }> = {
  hall: { label: "Hall y entrada", href: "/seguridad/hall" },
  espera: { label: "Sala de espera", href: "/seguridad/sala-espera" },
  boxes: { label: "Boxes", href: "/seguridad/boxes" },
  tienda: { label: "Tienda", href: "/seguridad/tienda" },
  bodega: { label: "Bodega" },
  farmacia: { label: "Farmacia" },
};

export const WAITING_CAPACITY = 12;

/** Escena ilustrada que dibuja la cámara (no hay video real en el prototipo). */
export type Scene = "door" | "reception" | "waiting" | "exam" | "surgery" | "counter" | "aisle" | "shelves";

export type CameraStatus = "En línea" | "Sin señal" | "Mantención";

export type Camera = {
  id: string;
  name: string;
  zone: Zone;
  scene: Scene;
  location: string;
  /** Box del mapa de Actividad que vigila (para la regla de privacidad). */
  roomId?: string;
  status: CameraStatus;
  recording: "Continua" | "Por movimiento";
  resolution: "1080p" | "2K" | "4K";
  ptz: boolean;
  audio: boolean;
  /** Hora del último movimiento detectado (HH:mm, hoy). */
  lastMotion?: string;
  firmware: string;
};

export type DeviceKind = "Cerradura" | "Botón de pánico" | "Sensor de humo" | "Sensor de movimiento" | "Grabador (NVR)";

export type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  zone: Zone;
  status: "Operativo" | "Batería baja" | "Sin conexión";
  /** Para cerraduras. */
  locked?: boolean;
  battery?: number;
  lastSeen: string;
  firmware: string;
};

/** Almacenamiento del grabador (TB) y días efectivamente guardados. */
export type NvrStorage = { usedTb: number; totalTb: number; daysRecorded: number };

export type AccessKind = "Cliente" | "Proveedor" | "Courier" | "Personal";

export type AccessEntry = {
  id: string;
  time: string;
  direction: "Ingreso" | "Salida";
  kind: AccessKind;
  who: string;
  detail: string;
  ownerRut?: string;
  patientId?: string;
  appointmentId?: string;
  href?: string;
};

export type WaitingEntry = {
  id: string;
  appointmentId: string;
  arrivedAt: string;
  /** Personas que acompañan (para el aforo). */
  people: number;
  alert?: string;
};

export type EventType =
  | "Movimiento fuera de horario"
  | "Puerta forzada"
  | "Puerta abierta"
  | "Acceso no autorizado"
  | "Aforo excedido"
  | "Cámara sin señal"
  | "Caja abierta sin venta"
  | "Botón de pánico"
  | "Marcado manual";

export type Severity = "Crítica" | "Alta" | "Media" | "Baja";
export const SEVERITIES: Severity[] = ["Crítica", "Alta", "Media", "Baja"];

export type EventStatus = "Nuevo" | "En revisión" | "Resuelto" | "Falsa alarma";
export const EVENT_STATUSES: EventStatus[] = ["Nuevo", "En revisión", "Resuelto", "Falsa alarma"];
export const OPEN_EVENT: EventStatus[] = ["Nuevo", "En revisión"];

export type EventNote = { by: string; at: string; text: string };

export type SecurityEvent = {
  id: string;
  /** "2026-10-07T10:47" */
  at: string;
  zone: Zone;
  cameraId?: string;
  type: EventType;
  severity: Severity;
  status: EventStatus;
  assignee?: string;
  notes: EventNote[];
  resolvedAt?: string;
};

export type AuditAction = "Vio en vivo" | "Abrió grabación" | "Exportó clip" | "Desactivó privacidad";

export type AuditEntry = {
  id: string;
  at: string;
  user: string;
  role: string;
  action: AuditAction;
  cameraId: string;
  reason?: string;
};

export type SecuritySettings = {
  retentionDays: 15 | 30 | 60 | 90;
  privacyInBoxes: boolean;
  afterHoursFrom: string;
  afterHoursTo: string;
  autoArm: boolean;
  alarmArmed: boolean;
};
