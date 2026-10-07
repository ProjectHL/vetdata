/**
 * Contratos de la capa de servicios: una interfaz async por dominio.
 *
 * - Lecturas (`list*` / `get*`): lo que el backend debe servir para hidratar
 *   los stores de sesión y los catálogos que hoy salen de `src/lib/lookups.ts`.
 * - Mutaciones: una por cada acción que hoy hacen los stores (`src/lib/*store*.tsx`).
 *   Los stores aplican una actualización optimista local y luego llaman a la
 *   operación en segundo plano; el resultado del servidor es la versión canónica.
 *
 * Entradas y salidas usan solo tipos de `src/domain`. El usuario que ejecuta la
 * acción (createdBy, user, seller, requestedBy…) lo resuelve el backend desde la
 * sesión autenticada; por eso no viaja en las entradas.
 *
 * Implementaciones: `mock/` (en memoria, sobre `src/mocks`) y `http/` (esqueleto).
 * Cada método indica el endpoint REST sugerido.
 */
import type { Appointment } from "@/domain/appointments";
import type { Doctor, Room } from "@/domain/clinic";
import type { Invoice } from "@/domain/invoices";
import type { Medication } from "@/domain/medications";
import type {
  BoxOccupancy,
  CoverageByVaccine,
  DiagnosisCategory,
  MonthlyConsults,
  MonthlyRevenue,
  NetworkAlert,
  RevenueByLine,
  VaccineCoverage,
} from "@/domain/metrics";
import type { Clinic } from "@/domain/network";
import type { Owner } from "@/domain/owners";
import type { Patient } from "@/domain/patients";
import type { MovementReason, PurchaseOrder, StockMovement, Supplier } from "@/domain/pharmacy";
import type { Referral } from "@/domain/referrals";
import type {
  Location,
  PaymentMethod,
  Product,
  RetailMovement,
  RetailOrder,
  RetailSupplier,
  Sale,
  SaleItem,
  Shipment,
} from "@/domain/retail";
import type {
  AccessEntry,
  AuditAction,
  AuditEntry,
  Camera,
  CameraStatus,
  Device,
  EventType,
  NvrStorage,
  SecurityEvent,
  SecuritySettings,
  Severity,
  WaitingEntry,
  Zone,
} from "@/domain/security";
import type { Service } from "@/domain/services";
import type { ClinicProfile, Permission, Role, RolePermissions, SharingPolicy, User } from "@/domain/settings";
import type { AccessDuration, AccessGrant, AccessRequest, AccessScope } from "@/domain/sharing";
import type { Idea, Release, Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/domain/support";
import type { TaskMeta } from "@/domain/tasks";

// ---------------------------------------------------------------------------
// Entradas de las mutaciones
// ---------------------------------------------------------------------------

export type NewAppointment = Omit<Appointment, "id">;
export type AppointmentPatch = Partial<Omit<Appointment, "id">>;
export type NewInvoice = Omit<Invoice, "id" | "folio">;
export type NewReferral = Omit<Referral, "id">;

export type SendAccessRequestsInput = {
  patientIds: string[];
  scope: AccessScope;
  duration: AccessDuration;
  reason: string;
};
export type RespondAccessRequestInput = {
  approve: boolean;
  /** Términos ajustados por la clínica de origen al aprobar. */
  terms?: { scope: AccessScope; duration: AccessDuration };
};
export type RespondAccessRequestResult = { request: AccessRequest; grant?: AccessGrant };

export type AdjustStockInput = { medicationId: string; qty: number; reason: MovementReason };
export type NewPurchaseOrder = { supplierId: string; items: { medicationId: string; qty: number }[] };

export type CheckoutInput = {
  items: SaleItem[];
  ownerRut?: string;
  payment: PaymentMethod;
  delivery?: { courier: string };
};
export type CheckoutResult = { sale: Sale; shipment?: Shipment };
export type RetailAdjustInput = { productId: string; location: Location; qty: number; reason: "Merma" | "Conteo" };
export type NewRetailOrder = { supplierId: string; items: { productId: string; qty: number }[]; leadTimeDays: number };

export type NewTicket = {
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  module: string;
  body: string;
  /** Ruta desde donde se reportó (contexto para soporte). */
  route: string;
  ideaId?: string;
};
export type NewIdea = { title: string; description: string; module: string };
export type ProposeIdeaResult = { idea: Idea; ticket: Ticket };

export type NewSecurityEvent = { zone: Zone; cameraId?: string; type: EventType; severity: Severity; note?: string };
export type SecurityEventPatch = Partial<Pick<SecurityEvent, "status" | "assignee">>;
export type NewAuditEntry = { cameraId: string; action: AuditAction; reason?: string };
export type CheckInResult = { access: AccessEntry; waiting: WaitingEntry };
export type CallFromWaitingResult = { room: Room };

export type InviteUserInput = Pick<User, "name" | "email" | "role" | "specialty">;

// ---------------------------------------------------------------------------
// Contratos por dominio
// ---------------------------------------------------------------------------

export interface PatientsService {
  /** GET /api/v1/patients */
  list(): Promise<Patient[]>;
  /** GET /api/v1/patients/:id */
  get(id: string): Promise<Patient | undefined>;
  /** GET /api/v1/owners/:rut/patients */
  listByOwner(ownerRut: string): Promise<Patient[]>;
}

export interface OwnersService {
  /** GET /api/v1/owners */
  list(): Promise<Owner[]>;
  /** GET /api/v1/owners/:rut */
  get(rut: string): Promise<Owner | undefined>;
}

export interface ClinicService {
  /** GET /api/v1/doctors */
  listDoctors(): Promise<Doctor[]>;
  /** GET /api/v1/rooms */
  listRooms(): Promise<Room[]>;
  /** PATCH /api/v1/rooms/:id */
  updateRoom(id: string, patch: Partial<Room>): Promise<Room>;
  /** GET /api/v1/billable-services */
  listServices(): Promise<Service[]>;
}

export interface AppointmentsService {
  /** GET /api/v1/appointments */
  list(): Promise<Appointment[]>;
  /** POST /api/v1/appointments */
  create(input: NewAppointment): Promise<Appointment>;
  /** PATCH /api/v1/appointments/:id */
  update(id: string, patch: AppointmentPatch): Promise<Appointment>;
}

export interface InvoicesService {
  /** GET /api/v1/invoices */
  list(): Promise<Invoice[]>;
  /** POST /api/v1/invoices — asigna folio y descuenta del inventario los medicamentos vendidos. */
  create(input: NewInvoice): Promise<Invoice>;
}

export interface ReferralsService {
  /** GET /api/v1/referrals */
  list(): Promise<Referral[]>;
  /** POST /api/v1/referrals */
  create(input: NewReferral): Promise<Referral>;
  /** POST /api/v1/referrals/:id/dispense — salida de stock por cada ítem (solo farmacia interna). */
  dispense(id: string): Promise<Referral>;
}

export interface NetworkService {
  /** GET /api/v1/me/clinic */
  getCurrentClinic(): Promise<string>;
  /** GET /api/v1/network/clinics */
  listClinics(): Promise<Clinic[]>;
}

export interface SharingService {
  /** GET /api/v1/sharing/requests */
  listRequests(): Promise<AccessRequest[]>;
  /** GET /api/v1/sharing/grants */
  listGrants(): Promise<AccessGrant[]>;
  /** POST /api/v1/sharing/requests — una solicitud por mascota de otra clínica sin solicitud pendiente. */
  sendRequests(input: SendAccessRequestsInput): Promise<AccessRequest[]>;
  /** POST /api/v1/sharing/requests/:id/response — si aprueba, crea el acceso. */
  respond(id: string, input: RespondAccessRequestInput): Promise<RespondAccessRequestResult>;
  /** POST /api/v1/sharing/grants/:id/revoke */
  revoke(grantId: string): Promise<AccessGrant>;
}

export interface PharmacyService {
  /** GET /api/v1/pharmacy/medications */
  listMedications(): Promise<Medication[]>;
  /** GET /api/v1/pharmacy/movements */
  listMovements(): Promise<StockMovement[]>;
  /** POST /api/v1/pharmacy/movements — ajuste manual (merma, vencimiento…). */
  adjustStock(input: AdjustStockInput): Promise<StockMovement>;
  /** GET /api/v1/pharmacy/suppliers */
  listSuppliers(): Promise<Supplier[]>;
  /** GET /api/v1/pharmacy/purchase-orders */
  listPurchaseOrders(): Promise<PurchaseOrder[]>;
  /** POST /api/v1/pharmacy/purchase-orders — crea en borrador con costo estimado. */
  createPurchaseOrder(input: NewPurchaseOrder): Promise<PurchaseOrder>;
  /** POST /api/v1/pharmacy/purchase-orders/:id/send */
  sendPurchaseOrder(id: string): Promise<PurchaseOrder>;
  /** POST /api/v1/pharmacy/purchase-orders/:id/receive — entrada de stock por cada ítem. */
  receivePurchaseOrder(id: string): Promise<PurchaseOrder>;
}

export interface RetailService {
  /** GET /api/v1/retail/products */
  listProducts(): Promise<Product[]>;
  /** GET /api/v1/retail/suppliers */
  listSuppliers(): Promise<RetailSupplier[]>;
  /** GET /api/v1/retail/sales */
  listSales(): Promise<Sale[]>;
  /** POST /api/v1/retail/sales — vende desde sala; con despacho crea el envío. */
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
  /** GET /api/v1/retail/movements */
  listMovements(): Promise<RetailMovement[]>;
  /** POST /api/v1/retail/transfers — bodega central → sala de ventas. */
  transferToSala(productId: string, qty: number): Promise<RetailMovement>;
  /** POST /api/v1/retail/adjustments */
  adjust(input: RetailAdjustInput): Promise<RetailMovement>;
  /** GET /api/v1/retail/orders */
  listOrders(): Promise<RetailOrder[]>;
  /** POST /api/v1/retail/orders */
  createOrder(input: NewRetailOrder): Promise<RetailOrder>;
  /** POST /api/v1/retail/orders/:id/send */
  sendOrder(id: string): Promise<RetailOrder>;
  /** POST /api/v1/retail/orders/:id/receive — entrada a bodega central. */
  receiveOrder(id: string): Promise<RetailOrder>;
  /** GET /api/v1/retail/shipments */
  listShipments(): Promise<Shipment[]>;
  /** POST /api/v1/retail/shipments/:id/advance — siguiente estado de SHIPMENT_FLOW. */
  advanceShipment(id: string): Promise<Shipment>;
}

export interface SupportService {
  /** GET /api/v1/support/tickets */
  listTickets(): Promise<Ticket[]>;
  /** GET /api/v1/support/tickets/:id */
  getTicket(id: string): Promise<Ticket | undefined>;
  /** POST /api/v1/support/tickets */
  createTicket(input: NewTicket): Promise<Ticket>;
  /** POST /api/v1/support/tickets/:id/messages */
  reply(id: string, body: string): Promise<Ticket>;
  /** PATCH /api/v1/support/tickets/:id/status */
  changeStatus(id: string, status: TicketStatus): Promise<Ticket>;
  /** POST /api/v1/support/tickets/:id/rating — califica y cierra. */
  rate(id: string, rating: number): Promise<Ticket>;
  /** GET /api/v1/support/ideas */
  listIdeas(): Promise<Idea[]>;
  /** POST /api/v1/support/ideas/:id/vote — alterna el voto de la clínica. */
  vote(id: string): Promise<Idea>;
  /** POST /api/v1/support/ideas — crea la idea y su ticket "Mejora" vinculado. */
  proposeIdea(input: NewIdea): Promise<ProposeIdeaResult>;
  /** GET /api/v1/support/releases */
  listReleases(): Promise<Release[]>;
}

export interface SecurityService {
  /** GET /api/v1/security/cameras */
  listCameras(): Promise<Camera[]>;
  /** PATCH /api/v1/security/cameras/:id */
  setCameraStatus(id: string, status: CameraStatus): Promise<Camera>;
  /** GET /api/v1/security/devices */
  listDevices(): Promise<Device[]>;
  /** POST /api/v1/security/devices/:id/toggle-lock */
  toggleLock(deviceId: string): Promise<Device>;
  /** GET /api/v1/security/nvr */
  getNvrStorage(): Promise<NvrStorage>;
  /** GET /api/v1/security/events */
  listEvents(): Promise<SecurityEvent[]>;
  /** POST /api/v1/security/events */
  createEvent(input: NewSecurityEvent): Promise<SecurityEvent>;
  /** PATCH /api/v1/security/events/:id */
  updateEvent(id: string, patch: SecurityEventPatch): Promise<SecurityEvent>;
  /** POST /api/v1/security/events/:id/notes */
  addEventNote(id: string, text: string): Promise<SecurityEvent>;
  /** GET /api/v1/security/audit */
  listAudit(): Promise<AuditEntry[]>;
  /** POST /api/v1/security/audit */
  logAudit(input: NewAuditEntry): Promise<AuditEntry>;
  /** GET /api/v1/security/access */
  listAccess(): Promise<AccessEntry[]>;
  /** GET /api/v1/security/waiting */
  listWaiting(): Promise<WaitingEntry[]>;
  /** POST /api/v1/security/waiting — registra la llegada de una cita de hoy. */
  checkIn(appointmentId: string): Promise<CheckInResult>;
  /** POST /api/v1/security/waiting/:id/call — el box queda ocupado. */
  callFromWaiting(entryId: string, roomId: string): Promise<CallFromWaitingResult>;
  /** GET /api/v1/security/settings */
  getSettings(): Promise<SecuritySettings>;
  /** PATCH /api/v1/security/settings */
  updateSettings(patch: Partial<SecuritySettings>): Promise<SecuritySettings>;
  /** PUT /api/v1/security/alarm */
  setAlarm(armed: boolean): Promise<SecuritySettings>;
}

export interface SettingsService {
  /** GET /api/v1/me */
  getCurrentUser(): Promise<User>;
  /** GET /api/v1/users */
  listUsers(): Promise<User[]>;
  /** POST /api/v1/users/invitations */
  inviteUser(input: InviteUserInput): Promise<User>;
  /** PATCH /api/v1/users/:id */
  updateUser(id: string, patch: Partial<User>): Promise<User>;
  /** GET /api/v1/settings/role-permissions */
  getRolePermissions(): Promise<RolePermissions>;
  /** POST /api/v1/settings/role-permissions/:role/toggle */
  togglePermission(role: Role, permission: Permission): Promise<RolePermissions>;
  /** GET /api/v1/settings/clinic-profile */
  getClinicProfile(): Promise<ClinicProfile>;
  /** PUT /api/v1/settings/clinic-profile */
  updateClinicProfile(profile: ClinicProfile): Promise<ClinicProfile>;
  /** GET /api/v1/settings/sharing-policy */
  getSharingPolicy(): Promise<SharingPolicy>;
  /** PUT /api/v1/settings/sharing-policy */
  updateSharingPolicy(policy: SharingPolicy): Promise<SharingPolicy>;
}

export interface TasksService {
  /** GET /api/v1/tasks/meta */
  listMeta(): Promise<Record<string, TaskMeta>>;
  /** PUT /api/v1/tasks/:taskId/assignee */
  assign(taskId: string, assignee: string | undefined): Promise<TaskMeta>;
  /** PUT /api/v1/tasks/:taskId/done */
  complete(taskId: string, done: boolean): Promise<TaskMeta>;
  /** GET /api/v1/reminders — ids de pacientes con recordatorio enviado. */
  listReminders(): Promise<string[]>;
  /** POST /api/v1/patients/:patientId/reminders — recordatorio de vacuna al dueño. */
  sendReminder(patientId: string): Promise<void>;
}

export interface AnalyticsService {
  /** GET /api/v1/analytics/monthly-consults */
  monthlyConsults(): Promise<MonthlyConsults[]>;
  /** GET /api/v1/analytics/monthly-revenue */
  monthlyRevenue(): Promise<MonthlyRevenue[]>;
  /** GET /api/v1/analytics/revenue-by-line */
  revenueByLine(): Promise<RevenueByLine[]>;
  /** GET /api/v1/analytics/vaccine-coverage */
  vaccineCoverage(): Promise<VaccineCoverage[]>;
  /** GET /api/v1/analytics/coverage-by-vaccine */
  coverageByVaccine(): Promise<CoverageByVaccine[]>;
  /** GET /api/v1/analytics/diagnosis-categories */
  diagnosisCategories(): Promise<DiagnosisCategory[]>;
  /** GET /api/v1/analytics/network-alerts */
  networkAlerts(): Promise<NetworkAlert[]>;
  /** GET /api/v1/analytics/box-occupancy */
  boxOccupancy(): Promise<BoxOccupancy[]>;
}

/** Punto de entrada único: `services.<dominio>.<operación>()`. */
export interface Services {
  patients: PatientsService;
  owners: OwnersService;
  clinic: ClinicService;
  appointments: AppointmentsService;
  invoices: InvoicesService;
  referrals: ReferralsService;
  network: NetworkService;
  sharing: SharingService;
  pharmacy: PharmacyService;
  retail: RetailService;
  support: SupportService;
  security: SecurityService;
  settings: SettingsService;
  tasks: TasksService;
  analytics: AnalyticsService;
}
