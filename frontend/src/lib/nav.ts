import {
  Activity,
  BarChart3,
  Building2,
  FileHeart,
  FileText,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Network,
  PawPrint,
  Pill,
  Sun,
  CalendarDays,
  ListChecks,
  Cctv,
  MonitorPlay,
  DoorOpen,
  Armchair,
  Store,
  Siren,
  Router,
  Gauge,
  UsersRound,
  LifeBuoy,
  Ticket,
  Lightbulb,
  Megaphone,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Warehouse,
  PackageCheck,
  ClipboardList,
  Settings,
  Share2,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Truck,
  ArrowLeftRight,
  User,
  Users,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };
export type Channel = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const channels: Channel[] = [
  {
    id: "inicio",
    title: "Inicio",
    icon: LayoutDashboard,
    items: [
      { title: "Mi día", href: "/dashboard", icon: Sun },
      { title: "Agenda", href: "/inicio/agenda", icon: CalendarDays },
      { title: "Pendientes", href: "/inicio/pendientes", icon: ListChecks },
      { title: "Actividad", href: "/inicio/actividad", icon: Activity },
    ],
  },
  {
    id: "pacientes",
    title: "Pacientes",
    icon: PawPrint,
    items: [
      { title: "Mascotas", href: "/pacientes/mascotas", icon: PawPrint },
      { title: "Propietarios", href: "/pacientes/propietarios", icon: Users },
      { title: "Historial clínico", href: "/pacientes/historial", icon: FileHeart },
    ],
  },
  {
    id: "clinicas",
    title: "Clínicas",
    icon: Building2,
    items: [
      { title: "Red de clínicas", href: "/clinicas/red", icon: Network },
      { title: "Compartidos conmigo", href: "/clinicas/compartidos", icon: Share2 },
      { title: "Solicitudes", href: "/clinicas/solicitudes", icon: Inbox },
    ],
  },
  {
    id: "farmacia",
    title: "Farmacia",
    icon: Pill,
    items: [
      { title: "Medicamentos", href: "/farmacia/medicamentos", icon: Pill },
      { title: "Movimientos", href: "/farmacia/movimientos", icon: ArrowLeftRight },
      { title: "Proveedores", href: "/farmacia/proveedores", icon: Truck },
    ],
  },
  {
    id: "tienda",
    title: "Tienda",
    icon: ShoppingBag,
    items: [
      { title: "Productos", href: "/tienda/productos", icon: ClipboardList },
      { title: "Punto de venta", href: "/tienda/venta", icon: ShoppingCart },
      { title: "Ventas", href: "/tienda/ventas", icon: Receipt },
      { title: "Bodega", href: "/tienda/bodega", icon: Warehouse },
      { title: "Compras", href: "/tienda/compras", icon: Truck },
      { title: "Despachos", href: "/tienda/despachos", icon: PackageCheck },
    ],
  },
  {
    id: "analisis",
    title: "Análisis",
    icon: BarChart3,
    items: [
      { title: "Panorama", href: "/analisis/panorama", icon: Gauge },
      { title: "Vacunación", href: "/analisis/vacunacion", icon: Syringe },
      { title: "Diagnósticos", href: "/analisis/diagnosticos", icon: Stethoscope },
      { title: "Clientes", href: "/analisis/clientes", icon: UsersRound },
      { title: "Tienda", href: "/analisis/tienda", icon: ShoppingBag },
      { title: "Reportes", href: "/analisis/reportes", icon: FileText },
    ],
  },
  {
    id: "seguridad",
    title: "Seguridad",
    icon: Cctv,
    items: [
      { title: "Centro de monitoreo", href: "/seguridad/monitoreo", icon: MonitorPlay },
      { title: "Hall y entrada", href: "/seguridad/hall", icon: DoorOpen },
      { title: "Sala de espera", href: "/seguridad/sala-espera", icon: Armchair },
      { title: "Boxes", href: "/seguridad/boxes", icon: Stethoscope },
      { title: "Tienda", href: "/seguridad/tienda", icon: Store },
      { title: "Eventos", href: "/seguridad/eventos", icon: Siren },
      { title: "Dispositivos", href: "/seguridad/dispositivos", icon: Router },
    ],
  },
  {
    id: "soporte",
    title: "Soporte",
    icon: LifeBuoy,
    items: [
      { title: "Tickets", href: "/soporte/tickets", icon: Ticket },
      { title: "Mejoras", href: "/soporte/mejoras", icon: Lightbulb },
      { title: "Novedades", href: "/soporte/novedades", icon: Megaphone },
    ],
  },
  {
    id: "ajustes",
    title: "Ajustes",
    icon: Settings,
    items: [
      { title: "Perfil", href: "/ajustes/perfil", icon: User },
      { title: "Usuarios", href: "/ajustes/usuarios", icon: Users },
      { title: "Permisos", href: "/ajustes/permisos", icon: ShieldCheck },
    ],
  },
];

export function matchesPath(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function findByPath(pathname: string) {
  for (const channel of channels) {
    const item = channel.items.find((i) => matchesPath(i.href, pathname));
    if (item) return { channel, item };
  }
  return { channel: channels[0], item: undefined };
}
