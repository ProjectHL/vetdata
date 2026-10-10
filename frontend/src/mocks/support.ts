// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import type { Idea, Release, Ticket, TicketMessage } from "@/domain/support";

const msg = (author: string, side: TicketMessage["side"], at: string, body: string): TicketMessage => ({ author, side, at, body });

export const seedTickets: Ticket[] = [
  {
    id: "tk1", number: 1041, title: "El kardex no muestra el saldo al filtrar por fecha", category: "Incidencia", priority: "Media",
    module: "Farmacia › Movimientos", status: "En progreso", createdBy: "Marcela Toro", createdAt: "2026-10-03T10:12", firstResponseAt: "2026-10-03T15:40",
    context: { route: "/farmacia/movimientos", role: "Farmacia" },
    messages: [
      msg("Marcela Toro", "Clínica", "2026-10-03T10:12", "Si filtro por los últimos 7 días, la columna saldo desaparece aunque tenga un medicamento elegido."),
      msg("Soporte VetData · Ignacia", "VetData", "2026-10-03T15:40", "Gracias Marcela, lo reprodujimos. El equipo lo está corrigiendo; te avisamos al publicar."),
    ],
  },
  {
    id: "tk2", number: 1046, title: "No se puede imprimir la boleta desde el punto de venta en Safari", category: "Incidencia", priority: "Alta",
    module: "Tienda › Punto de venta", status: "Nuevo", createdBy: "Constanza Arias", createdAt: "2026-10-06T09:30",
    context: { route: "/tienda/venta", role: "Recepción" },
    messages: [msg("Constanza Arias", "Clínica", "2026-10-06T09:30", "Al presionar Imprimir en Safari la boleta sale en blanco. En Chrome funciona.")],
  },
  {
    id: "tk3", number: 1047, title: "Caída al aprobar solicitudes de la red", category: "Incidencia", priority: "Crítica",
    module: "Clínicas › Solicitudes", status: "En revisión", createdBy: "Dra. Paula Rivas", createdAt: "2026-10-07T08:50",
    context: { route: "/clinicas/solicitudes", role: "Veterinario" },
    messages: [msg("Dra. Paula Rivas", "Clínica", "2026-10-07T08:50", "Al aprobar la solicitud de Hospital Ñuñoa la pantalla queda cargando. Es urgente: es un paciente en urgencia.")],
  },
  {
    id: "tk4", number: 1032, title: "¿Cómo exporto los reportes a Excel?", category: "Consulta", priority: "Baja",
    module: "Análisis › Reportes", status: "Resuelto", createdBy: "Rodrigo Bravo", createdAt: "2026-09-25T11:00", firstResponseAt: "2026-09-25T12:10", rating: 5,
    context: { route: "/analisis/reportes", role: "Admin" },
    messages: [
      msg("Rodrigo Bravo", "Clínica", "2026-09-25T11:00", "Necesito los ingresos por prestación en Excel para contabilidad."),
      msg("Soporte VetData · Tomás", "VetData", "2026-09-25T12:10", "Cada tabla tiene el botón CSV; el archivo usa punto y coma y abre directo en Excel en español."),
      msg("Rodrigo Bravo", "Clínica", "2026-09-25T12:30", "Perfecto, funcionó. Gracias."),
    ],
  },
  {
    id: "tk5", number: 1038, title: "Integrar la agenda con Google Calendar", category: "Mejora", priority: "Media",
    module: "Inicio › Actividad", status: "Esperando cliente", createdBy: "Dr. Tomás Herrera", createdAt: "2026-09-30T09:20", firstResponseAt: "2026-09-30T16:00", ideaId: "id2",
    context: { route: "/inicio/actividad", role: "Veterinario" },
    messages: [
      msg("Dr. Tomás Herrera", "Clínica", "2026-09-30T09:20", "Sería ideal ver las cirugías agendadas en mi Google Calendar."),
      msg("Soporte VetData · Ignacia", "VetData", "2026-09-30T16:00", "La sumamos al tablero de mejoras. ¿Necesitan sincronización en ambos sentidos o solo ver las citas?"),
    ],
  },
  {
    id: "tk6", number: 1043, title: "Los RUT con K no se encuentran en la búsqueda de la red", category: "Integración / datos", priority: "Alta",
    module: "Clínicas › Red de clínicas", status: "Resuelto", createdBy: "Dra. Paula Rivas", createdAt: "2026-10-04T10:00", firstResponseAt: "2026-10-04T13:30", rating: 4,
    context: { route: "/clinicas/red", role: "Veterinario" },
    messages: [
      msg("Dra. Paula Rivas", "Clínica", "2026-10-04T10:00", "Un dueño con RUT terminado en K no aparece al buscarlo."),
      msg("Soporte VetData · Tomás", "VetData", "2026-10-04T13:30", "Corregido en la versión 2.5: ahora la búsqueda ignora mayúsculas y puntos."),
    ],
  },
  {
    id: "tk7", number: 1044, title: "Factura de VetData de septiembre con monto duplicado", category: "Facturación del servicio", priority: "Media",
    module: "Ajustes › Perfil", status: "En revisión", createdBy: "Rodrigo Bravo", createdAt: "2026-10-05T09:00", firstResponseAt: "2026-10-05T11:15",
    context: { route: "/ajustes/perfil", role: "Admin" },
    messages: [
      msg("Rodrigo Bravo", "Clínica", "2026-10-05T09:00", "La factura del plan de septiembre cobra dos veces el módulo Tienda."),
      msg("Soporte VetData · Facturación", "VetData", "2026-10-05T11:15", "Lo estamos revisando con finanzas; emitiremos nota de crédito si corresponde."),
    ],
  },
  {
    id: "tk8", number: 1048, title: "Agregar recordatorio automático por WhatsApp para vacunas", category: "Mejora", priority: "Baja",
    module: "Análisis › Vacunación", status: "Nuevo", createdBy: "Constanza Arias", createdAt: "2026-10-07T10:05", ideaId: "id1",
    context: { route: "/analisis/vacunacion", role: "Recepción" },
    messages: [msg("Constanza Arias", "Clínica", "2026-10-07T10:05", "Hoy enviamos los recordatorios uno a uno. Que se envíen solos 7 días antes.")],
  },
  {
    id: "tk9", number: 1029, title: "Error al recibir orden de compra con productos repetidos", category: "Incidencia", priority: "Alta",
    module: "Tienda › Compras", status: "Cerrado", createdBy: "Marcela Toro", createdAt: "2026-09-20T15:00", firstResponseAt: "2026-09-22T09:00", rating: 3,
    context: { route: "/tienda/compras", role: "Farmacia" },
    messages: [
      msg("Marcela Toro", "Clínica", "2026-09-20T15:00", "Si una OC tiene el mismo producto dos veces, al recibir solo suma una línea."),
      msg("Soporte VetData · Tomás", "VetData", "2026-09-22T09:00", "Corregido. Disculpa la demora en responder."),
    ],
  },
  {
    id: "tk10", number: 1045, title: "Permitir firmar recetas con firma electrónica avanzada", category: "Mejora", priority: "Media",
    module: "Clínica › Derivación de medicamentos", status: "En revisión", createdBy: "Dra. Javiera Lagos", createdAt: "2026-10-05T18:00", firstResponseAt: "2026-10-06T10:00", ideaId: "id4",
    context: { route: "/pacientes/historial", role: "Veterinario" },
    messages: [
      msg("Dra. Javiera Lagos", "Clínica", "2026-10-05T18:00", "Las farmacias externas piden receta con firma electrónica."),
      msg("Soporte VetData · Ignacia", "VetData", "2026-10-06T10:00", "Está en evaluación con el equipo legal. La vinculamos a la idea en el tablero."),
    ],
  },
];

export const seedIdeas: Idea[] = [
  { id: "id1", title: "Recordatorios automáticos de vacunas por WhatsApp", description: "Enviar aviso al dueño 7 y 1 día antes del vencimiento, por su canal preferido.", module: "Análisis › Vacunación", status: "Planificada", votes: 31, votedByMe: true, proposedBy: "Hospital Veterinario Ñuñoa" },
  { id: "id2", title: "Sincronizar agenda con Google Calendar / Outlook", description: "Ver citas y cirugías en el calendario personal de cada profesional.", module: "Inicio › Actividad", status: "En evaluación", votes: 24, votedByMe: false, proposedBy: "Clínica Vet Providencia" },
  { id: "id3", title: "Portal del dueño para ver la ficha de su mascota", description: "Que el dueño vea vacunas, recetas y próximas citas, y autorice compartir datos desde su celular.", module: "Pacientes › Propietarios", status: "En desarrollo", votes: 42, votedByMe: true, proposedBy: "VetCare Las Condes" },
  { id: "id4", title: "Firma electrónica avanzada en recetas", description: "Recetas válidas para farmacias externas con firma electrónica avanzada.", module: "Clínica › Derivación de medicamentos", status: "En evaluación", votes: 18, votedByMe: false, proposedBy: "Clínica Vet Providencia" },
  { id: "id5", title: "Tienda online integrada con el catálogo", description: "Publicar productos con stock en sala y recibir pedidos con despacho.", module: "Tienda › Productos", status: "Lanzada", votes: 27, votedByMe: true, proposedBy: "Centro Animal Maipú", releaseId: "rl3" },
  { id: "id6", title: "Exportar reportes a CSV", description: "Descargar cualquier tabla de Análisis para contabilidad.", module: "Análisis › Reportes", status: "Lanzada", votes: 19, votedByMe: false, proposedBy: "Clínica Veterinaria Vitacura", releaseId: "rl2" },
  { id: "id7", title: "Alertas de stock por correo a proveedores", description: "Enviar la orden de compra directo al correo del proveedor al pasar a Enviada.", module: "Farmacia › Proveedores", status: "Planificada", votes: 15, votedByMe: false, proposedBy: "VetSur La Florida" },
  { id: "id8", title: "Modo sin conexión para el mapa de boxes", description: "Seguir viendo y actualizando boxes si se cae internet.", module: "Inicio › Actividad", status: "En evaluación", votes: 9, votedByMe: false, proposedBy: "Hospital Veterinario Puente Alto" },
];

export const releases: Release[] = [
  {
    id: "rl3", version: "2.5", date: "2026-10-01",
    items: [
      { type: "Nuevo", text: "Canal Tienda: catálogo, punto de venta, bodega, compras y despachos.", ideaId: "id5" },
      { type: "Mejora", text: "La búsqueda por RUT acepta K minúscula y RUT sin puntos." },
      { type: "Corrección", text: "Recepción de órdenes de compra con productos repetidos." },
    ],
  },
  {
    id: "rl2", version: "2.4", date: "2026-09-10",
    items: [
      { type: "Nuevo", text: "Exportación a CSV en todas las tablas de Análisis.", ideaId: "id6" },
      { type: "Nuevo", text: "Roles y permisos configurables por clínica." },
      { type: "Mejora", text: "Política de compartición con alcance y vigencia por defecto." },
    ],
  },
  {
    id: "rl1", version: "2.3", date: "2026-08-12",
    items: [
      { type: "Nuevo", text: "Red de clínicas: solicitudes y accesos compartidos con vigencia." },
      { type: "Mejora", text: "Ficha clínica con pestañas de citas, facturas y derivaciones." },
    ],
  },
];
