// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import {
  type ClinicProfile,
  PERMISSIONS,
  type Role,
  type RolePermissions,
  type SharingPolicy,
  type User,
} from "@/domain/settings";

const all = PERMISSIONS.map((p) => p.id);

export const defaultRolePermissions: RolePermissions = {
  Admin: all,
  Veterinario: ["ficha.ver", "ficha.editar", "agenda.gestionar", "facturas.emitir", "medicamentos.derivar", "red.solicitar", "red.aprobar", "soporte.crear"],
  Recepción: ["agenda.gestionar", "facturas.emitir", "red.solicitar", "tienda.vender", "soporte.crear", "seguridad.ver"],
  Farmacia: ["farmacia.dispensar", "farmacia.inventario", "facturas.emitir", "tienda.vender", "tienda.inventario", "tienda.compras", "soporte.crear", "seguridad.ver"],
};

export const seedUsers: User[] = [
  { id: "u1", name: "Dra. Paula Rivas", email: "privas@vetprovidencia.cl", role: "Veterinario", specialty: "Medicina general", doctorId: "d1", status: "Activo", lastAccess: "07 oct 2026 · 11:04" },
  { id: "u2", name: "Dr. Tomás Herrera", email: "therrera@vetprovidencia.cl", role: "Veterinario", specialty: "Cirugía", doctorId: "d2", status: "Activo", lastAccess: "07 oct 2026 · 09:28" },
  { id: "u3", name: "Dra. Javiera Lagos", email: "jlagos@vetprovidencia.cl", role: "Veterinario", specialty: "Dermatología", doctorId: "d3", status: "Activo", lastAccess: "07 oct 2026 · 10:15" },
  { id: "u4", name: "Dr. Andrés Molina", email: "amolina@vetprovidencia.cl", role: "Veterinario", specialty: "Traumatología", doctorId: "d4", status: "Activo", lastAccess: "06 oct 2026 · 18:40" },
  { id: "u5", name: "Dra. Catalina Vera", email: "cvera@vetprovidencia.cl", role: "Veterinario", specialty: "Imagenología", doctorId: "d5", status: "Activo", lastAccess: "07 oct 2026 · 10:31" },
  { id: "u6", name: "Dr. Ignacio Paredes", email: "iparedes@vetprovidencia.cl", role: "Veterinario", specialty: "Medicina felina", doctorId: "d6", status: "Activo", lastAccess: "07 oct 2026 · 10:47" },
  { id: "u7", name: "Constanza Arias", email: "recepcion@vetprovidencia.cl", role: "Recepción", status: "Activo", lastAccess: "07 oct 2026 · 08:55" },
  { id: "u8", name: "Bastián Lillo", email: "blillo@vetprovidencia.cl", role: "Recepción", status: "Activo", lastAccess: "06 oct 2026 · 19:02" },
  { id: "u9", name: "Marcela Toro", email: "farmacia@vetprovidencia.cl", role: "Farmacia", status: "Activo", lastAccess: "07 oct 2026 · 10:20" },
  { id: "u10", name: "Rodrigo Bravo", email: "admin@vetprovidencia.cl", role: "Admin", status: "Activo", lastAccess: "05 oct 2026 · 16:12" },
  { id: "u11", name: "Dra. Fernanda Gálvez", email: "fgalvez@vetprovidencia.cl", role: "Veterinario", specialty: "Oftalmología", status: "Invitado", lastAccess: "—" },
];

/** Usuario demo según el rol elegido en "Ver como". */
export const demoUserByRole: Record<Role, string> = {
  Admin: "u10",
  Veterinario: "u1",
  Recepción: "u7",
  Farmacia: "u9",
};

export const seedClinicProfile: ClinicProfile = {
  legalName: "Clínica Veterinaria Providencia SpA",
  rut: "76.543.210-3",
  address: "Av. Providencia 1650",
  sector: "Providencia, Santiago",
  phone: "+56 2 2233 4455",
  email: "contacto@vetprovidencia.cl",
  hours: "Lun a Sáb 09:00–20:00 · Urgencias 24 h",
  boxes: 6,
};

export const seedSharingPolicy: SharingPolicy = {
  defaultScope: "Resumen clínico",
  defaultDuration: 90,
  requireConsent: true,
  notifyRequests: true,
};
