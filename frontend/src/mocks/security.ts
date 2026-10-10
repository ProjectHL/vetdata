// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import type {
  AccessEntry,
  AuditEntry,
  Camera,
  Device,
  NvrStorage,
  SecurityEvent,
  SecuritySettings,
  WaitingEntry,
} from "@/domain/security";


export const seedCameras: Camera[] = [
  { id: "c-hall-1", name: "Puerta principal", zone: "hall", scene: "door", location: "Acceso Av. Providencia", status: "En línea", recording: "Continua", resolution: "4K", ptz: false, audio: false, lastMotion: "11:03", firmware: "5.7.2" },
  { id: "c-hall-2", name: "Recepción", zone: "hall", scene: "reception", location: "Mesón de recepción", status: "En línea", recording: "Continua", resolution: "2K", ptz: true, audio: true, lastMotion: "11:04", firmware: "5.7.2" },
  { id: "c-esp-1", name: "Sala de espera · perros", zone: "espera", scene: "waiting", location: "Sector perros", status: "En línea", recording: "Continua", resolution: "2K", ptz: true, audio: false, lastMotion: "11:02", firmware: "5.7.2" },
  { id: "c-esp-2", name: "Sala de espera · gatos", zone: "espera", scene: "waiting", location: "Sector gatos y exóticos", status: "En línea", recording: "Continua", resolution: "1080p", ptz: false, audio: false, lastMotion: "10:58", firmware: "5.6.9" },
  ...[1, 2, 3, 4, 5, 6].map((n): Camera => ({
    id: `c-box-${n}`, name: `Box ${n}`, zone: "boxes", scene: "exam", location: `Box ${n}`, roomId: `box-${n}`,
    status: "En línea", recording: "Por movimiento", resolution: "1080p", ptz: false, audio: false, lastMotion: n % 2 ? "11:01" : "10:50", firmware: "5.6.9",
  })),
  { id: "c-quir", name: "Quirófano", zone: "boxes", scene: "surgery", location: "Pabellón", roomId: "quirofano", status: "En línea", recording: "Continua", resolution: "4K", ptz: true, audio: true, lastMotion: "11:04", firmware: "5.7.2" },
  { id: "c-tda-1", name: "Caja tienda", zone: "tienda", scene: "counter", location: "Caja y POS", status: "En línea", recording: "Continua", resolution: "2K", ptz: false, audio: true, lastMotion: "11:00", firmware: "5.7.2" },
  { id: "c-tda-2", name: "Pasillos tienda", zone: "tienda", scene: "aisle", location: "Alimentos y accesorios", status: "En línea", recording: "Continua", resolution: "2K", ptz: true, audio: false, lastMotion: "10:57", firmware: "5.7.2" },
  { id: "c-tda-3", name: "Bodega tienda", zone: "tienda", scene: "shelves", location: "Bodega central", status: "Sin señal", recording: "Por movimiento", resolution: "1080p", ptz: false, audio: false, lastMotion: "09:12", firmware: "5.4.1" },
  { id: "c-far", name: "Farmacia", zone: "farmacia", scene: "shelves", location: "Mesón y vitrinas", status: "En línea", recording: "Continua", resolution: "2K", ptz: false, audio: false, lastMotion: "10:55", firmware: "5.7.2" },
  { id: "c-bod", name: "Bodega clínica", zone: "bodega", scene: "shelves", location: "Insumos y medicamentos", status: "En línea", recording: "Por movimiento", resolution: "1080p", ptz: false, audio: false, lastMotion: "06:12", firmware: "5.6.9" },
];

export const seedDevices: Device[] = [
  { id: "dv-door-main", name: "Cerradura puerta principal", kind: "Cerradura", zone: "hall", status: "Operativo", locked: false, battery: 88, lastSeen: "11:05", firmware: "2.1.0" },
  { id: "dv-door-bod", name: "Cerradura bodega clínica", kind: "Cerradura", zone: "bodega", status: "Operativo", locked: true, battery: 64, lastSeen: "11:05", firmware: "2.1.0" },
  { id: "dv-door-tda", name: "Cerradura bodega tienda", kind: "Cerradura", zone: "tienda", status: "Batería baja", locked: true, battery: 14, lastSeen: "11:04", firmware: "2.0.3" },
  { id: "dv-panic", name: "Botón de pánico recepción", kind: "Botón de pánico", zone: "hall", status: "Operativo", lastSeen: "11:05", firmware: "1.4.2" },
  { id: "dv-smoke-1", name: "Sensor de humo hall", kind: "Sensor de humo", zone: "hall", status: "Operativo", battery: 92, lastSeen: "11:00", firmware: "3.0.1" },
  { id: "dv-smoke-2", name: "Sensor de humo quirófano", kind: "Sensor de humo", zone: "boxes", status: "Operativo", battery: 77, lastSeen: "11:00", firmware: "3.0.1" },
  { id: "dv-motion-far", name: "Sensor de movimiento farmacia", kind: "Sensor de movimiento", zone: "farmacia", status: "Operativo", battery: 55, lastSeen: "10:55", firmware: "1.9.0" },
  { id: "dv-nvr", name: "Grabador NVR 16 canales", kind: "Grabador (NVR)", zone: "bodega", status: "Operativo", lastSeen: "11:05", firmware: "4.2.7" },
];

/** Almacenamiento del grabador (TB) y días efectivamente guardados. */
export const NVR: NvrStorage = { usedTb: 6.8, totalTb: 8, daysRecorded: 27 };

export const seedAccess: AccessEntry[] = [
  { id: "ac01", time: "08:28", direction: "Ingreso", kind: "Personal", who: "Constanza Arias", detail: "Apertura · Recepción" },
  { id: "ac02", time: "08:35", direction: "Ingreso", kind: "Personal", who: "Dra. Paula Rivas", detail: "Turno mañana" },
  { id: "ac03", time: "08:41", direction: "Ingreso", kind: "Personal", who: "Dr. Tomás Herrera", detail: "Turno mañana · cirugía" },
  { id: "ac04", time: "08:52", direction: "Ingreso", kind: "Cliente", who: "Valentina Soto", detail: "Rocky · cirugía programada", ownerRut: "19234871-4", patientId: "p-003" },
  { id: "ac05", time: "09:02", direction: "Ingreso", kind: "Personal", who: "Marcela Toro", detail: "Farmacia y bodega" },
  { id: "ac06", time: "09:40", direction: "Ingreso", kind: "Proveedor", who: "Drag Pharma Chile", detail: "Visita comercial", href: "/farmacia/proveedores" },
  { id: "ac07", time: "10:05", direction: "Ingreso", kind: "Courier", who: "Pedidos Ya Envíos", detail: "Retiro de despachos web", href: "/tienda/despachos" },
  { id: "ac08", time: "10:09", direction: "Salida", kind: "Courier", who: "Pedidos Ya Envíos", detail: "2 paquetes", href: "/tienda/despachos" },
  { id: "ac09", time: "10:14", direction: "Ingreso", kind: "Cliente", who: "Matías Pérez", detail: "Nala · dermatología", ownerRut: "15620948-1", patientId: "p-004" },
  { id: "ac10", time: "10:15", direction: "Salida", kind: "Proveedor", who: "Drag Pharma Chile", detail: "Fin de visita", href: "/farmacia/proveedores" },
  { id: "ac11", time: "10:28", direction: "Ingreso", kind: "Cliente", who: "Fernanda Muñoz", detail: "Toby · rayos X", ownerRut: "11873264-2", patientId: "p-005" },
  { id: "ac12", time: "10:36", direction: "Ingreso", kind: "Cliente", who: "Camila Rojas", detail: "Luna · control anual", ownerRut: "16482335-0", patientId: "p-001" },
  { id: "ac13", time: "10:40", direction: "Ingreso", kind: "Cliente", who: "Benjamín Reyes", detail: "Coco · control", ownerRut: "18556013-9", patientId: "p-008", appointmentId: "a23" },
  { id: "ac14", time: "10:46", direction: "Ingreso", kind: "Cliente", who: "Diego Fuentes", detail: "Michi · control renal", ownerRut: "13907452-1", patientId: "p-002" },
  { id: "ac15", time: "10:52", direction: "Ingreso", kind: "Cliente", who: "Camila Rojas", detail: "Pimienta · control anual", ownerRut: "16482335-0", patientId: "p-009", appointmentId: "a21" },
  { id: "ac16", time: "10:58", direction: "Ingreso", kind: "Cliente", who: "Matías Pérez", detail: "Bruno · control tiroides", ownerRut: "15620948-1", patientId: "p-010", appointmentId: "a22" },
];

export const seedWaiting: WaitingEntry[] = [
  { id: "w1", appointmentId: "a23", arrivedAt: "10:40", people: 1, alert: "Conejo: ubicar en sector tranquilo, lejos de perros." },
  { id: "w2", appointmentId: "a21", arrivedAt: "10:52", people: 2 },
  { id: "w3", appointmentId: "a22", arrivedAt: "10:58", people: 2, alert: "Perro grande y ansioso: mantener separado de gatos." },
];

export const seedEvents: SecurityEvent[] = [
  { id: "ev12", at: "2026-10-07T10:47", zone: "bodega", cameraId: "c-bod", type: "Acceso no autorizado", severity: "Crítica", status: "Nuevo", notes: [] },
  { id: "ev3", at: "2026-10-07T09:15", zone: "tienda", cameraId: "c-tda-3", type: "Cámara sin señal", severity: "Alta", status: "Nuevo", notes: [] },
  { id: "ev10", at: "2026-10-07T08:20", zone: "hall", cameraId: "c-hall-1", type: "Puerta abierta", severity: "Baja", status: "Nuevo", notes: [] },
  { id: "ev2", at: "2026-10-07T06:12", zone: "bodega", cameraId: "c-bod", type: "Movimiento fuera de horario", severity: "Alta", status: "En revisión", assignee: "Rodrigo Bravo", notes: [{ by: "Rodrigo Bravo", at: "2026-10-07T08:40", text: "Revisando clip: parece personal de aseo con llave." }] },
  { id: "ev4", at: "2026-10-06T19:40", zone: "tienda", cameraId: "c-tda-1", type: "Caja abierta sin venta", severity: "Media", status: "Resuelto", assignee: "Marcela Toro", resolvedAt: "2026-10-06T20:05", notes: [{ by: "Marcela Toro", at: "2026-10-06T20:05", text: "Cambio de sencillo autorizado por administración." }] },
  { id: "ev8", at: "2026-10-06T11:30", zone: "espera", cameraId: "c-esp-1", type: "Aforo excedido", severity: "Media", status: "Resuelto", assignee: "Constanza Arias", resolvedAt: "2026-10-06T11:50", notes: [{ by: "Constanza Arias", at: "2026-10-06T11:50", text: "Se habilitó el patio para clientes con perros." }] },
  { id: "ev5", at: "2026-10-05T23:10", zone: "hall", cameraId: "c-hall-1", type: "Puerta forzada", severity: "Crítica", status: "Falsa alarma", assignee: "Rodrigo Bravo", resolvedAt: "2026-10-06T08:30", notes: [{ by: "Rodrigo Bravo", at: "2026-10-06T08:30", text: "Viento movió la puerta mal cerrada. Se ajustó el cierre." }] },
  { id: "ev6", at: "2026-10-04T17:22", zone: "hall", cameraId: "c-hall-2", type: "Botón de pánico", severity: "Crítica", status: "Resuelto", assignee: "Rodrigo Bravo", resolvedAt: "2026-10-04T17:45", notes: [{ by: "Constanza Arias", at: "2026-10-04T17:25", text: "Cliente alterado por tiempo de espera. Se calmó con apoyo del Dr. Herrera." }] },
  { id: "ev7", at: "2026-10-03T22:05", zone: "farmacia", cameraId: "c-far", type: "Movimiento fuera de horario", severity: "Alta", status: "Resuelto", assignee: "Marcela Toro", resolvedAt: "2026-10-04T09:10", notes: [{ by: "Marcela Toro", at: "2026-10-04T09:10", text: "Hospitalización retiró medicamento de urgencia, registrado en kardex." }] },
  { id: "ev9", at: "2026-10-02T21:40", zone: "tienda", cameraId: "c-tda-2", type: "Movimiento fuera de horario", severity: "Media", status: "Falsa alarma", resolvedAt: "2026-10-03T09:00", notes: [] },
  { id: "ev11", at: "2026-10-01T14:00", zone: "boxes", cameraId: "c-quir", type: "Cámara sin señal", severity: "Alta", status: "Resuelto", resolvedAt: "2026-10-01T16:30", notes: [{ by: "Soporte VetData", at: "2026-10-01T16:30", text: "Se reemplazó el inyector PoE." }] },
  { id: "ev1", at: "2026-09-30T12:10", zone: "espera", cameraId: "c-esp-2", type: "Aforo excedido", severity: "Baja", status: "Resuelto", resolvedAt: "2026-09-30T12:30", notes: [] },
];

export const seedAudit: AuditEntry[] = [
  { id: "au1", at: "2026-10-07T08:42", user: "Rodrigo Bravo", role: "Admin", action: "Abrió grabación", cameraId: "c-bod", reason: "Evento movimiento fuera de horario" },
  { id: "au2", at: "2026-10-06T20:01", user: "Marcela Toro", role: "Farmacia", action: "Abrió grabación", cameraId: "c-tda-1", reason: "Caja abierta sin venta" },
  { id: "au3", at: "2026-10-04T17:50", user: "Rodrigo Bravo", role: "Admin", action: "Exportó clip", cameraId: "c-hall-2", reason: "Respaldo de incidente botón de pánico" },
  { id: "au4", at: "2026-10-02T11:20", user: "Rodrigo Bravo", role: "Admin", action: "Desactivó privacidad", cameraId: "c-box-3", reason: "Reclamo de cliente por trato a mascota" },
];

export const seedSecuritySettings: SecuritySettings = {
  retentionDays: 30,
  privacyInBoxes: true,
  afterHoursFrom: "20:00",
  afterHoursTo: "08:30",
  autoArm: true,
  alarmArmed: false,
};
