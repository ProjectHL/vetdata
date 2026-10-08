import type { AccessDuration, AccessScope } from "./sharing";

export type Role = "Admin" | "Veterinario" | "Recepción" | "Farmacia";
export const ROLES: Role[] = ["Admin", "Veterinario", "Recepción", "Farmacia"];

export type Permission =
  | "ficha.ver"
  | "ficha.editar"
  | "agenda.gestionar"
  | "facturas.emitir"
  | "medicamentos.derivar"
  | "farmacia.dispensar"
  | "farmacia.inventario"
  | "red.solicitar"
  | "red.aprobar"
  | "red.revocar"
  | "tienda.vender"
  | "tienda.inventario"
  | "tienda.compras"
  | "soporte.crear"
  | "soporte.administrar"
  | "seguridad.ver"
  | "seguridad.boxes"
  | "seguridad.grabaciones"
  | "seguridad.administrar"
  | "reportes.financiero"
  | "usuarios.administrar";

/** Catálogo de permisos (fijo en el producto; no depende de la clínica). */
export const PERMISSIONS: { id: Permission; area: string; label: string; description: string }[] = [
  { id: "ficha.ver", area: "Clínica", label: "Ver ficha clínica", description: "Consultas, exámenes y recetas del paciente." },
  { id: "ficha.editar", area: "Clínica", label: "Editar ficha clínica", description: "Registrar consultas, diagnósticos y tratamientos." },
  { id: "agenda.gestionar", area: "Clínica", label: "Gestionar agenda", description: "Agendar, mover y cancelar horas." },
  { id: "facturas.emitir", area: "Clínica", label: "Emitir facturas", description: "Generar facturas por atención." },
  { id: "medicamentos.derivar", area: "Clínica", label: "Derivar medicamentos", description: "Prescribir y derivar fichas de medicamentos." },
  { id: "farmacia.dispensar", area: "Farmacia", label: "Dispensar", description: "Entregar medicamentos derivados a farmacia interna." },
  { id: "farmacia.inventario", area: "Farmacia", label: "Gestionar inventario", description: "Ajustes de stock y órdenes de compra." },
  { id: "red.solicitar", area: "Red", label: "Solicitar acceso", description: "Pedir fichas a otras clínicas de la red." },
  { id: "red.aprobar", area: "Red", label: "Aprobar solicitudes", description: "Compartir fichas propias con otras clínicas." },
  { id: "red.revocar", area: "Red", label: "Revocar accesos", description: "Quitar accesos otorgados a otras clínicas." },
  { id: "tienda.vender", area: "Tienda", label: "Vender en tienda", description: "Usar el punto de venta y emitir boletas." },
  { id: "tienda.inventario", area: "Tienda", label: "Gestionar bodega", description: "Reponer sala, ajustes y despachos." },
  { id: "tienda.compras", area: "Tienda", label: "Compras de tienda", description: "Órdenes de compra a proveedores de productos." },
  { id: "soporte.crear", area: "Soporte", label: "Crear tickets de soporte", description: "Reportar incidencias y proponer mejoras a VetData." },
  { id: "soporte.administrar", area: "Soporte", label: "Administrar soporte", description: "Cerrar tickets y gestionar los de todo el equipo." },
  { id: "seguridad.ver", area: "Seguridad", label: "Ver cámaras en vivo", description: "Hall, sala de espera y tienda." },
  { id: "seguridad.boxes", area: "Seguridad", label: "Cámaras de boxes", description: "Ver boxes y quirófano; en atención exige motivo y queda auditado." },
  { id: "seguridad.grabaciones", area: "Seguridad", label: "Grabaciones", description: "Abrir y exportar clips grabados." },
  { id: "seguridad.administrar", area: "Seguridad", label: "Administrar seguridad", description: "Dispositivos, cerraduras, alarma y retención." },
  { id: "reportes.financiero", area: "Administración", label: "Reportes financieros", description: "Ingresos, facturación y cobranza." },
  { id: "usuarios.administrar", area: "Administración", label: "Administrar usuarios y permisos", description: "Invitar usuarios, cambiar roles y permisos." },
];

/** Matriz de permisos por rol (configurable por clínica). */
export type RolePermissions = Record<Role, Permission[]>;

export type UserStatus = "Activo" | "Invitado" | "Inactivo";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  specialty?: string;
  /** Vincula al profesional de la agenda/mapa (domain/clinic.ts → Doctor). */
  doctorId?: string;
  status: UserStatus;
  lastAccess: string;
};

export type ClinicProfile = {
  legalName: string;
  rut: string;
  address: string;
  sector: string;
  phone: string;
  email: string;
  hours: string;
  boxes: number;
};

export type SharingPolicy = {
  defaultScope: AccessScope;
  defaultDuration: AccessDuration;
  requireConsent: boolean;
  notifyRequests: boolean;
};
