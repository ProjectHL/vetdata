# 🐾 VetData

VetData es un **dashboard de datos de mascotas compartido entre clínicas veterinarias** de Chile. Este repositorio contiene el frontend (prototipo funcional con datos simulados) y el backend en Go (en construcción) para gestionar consultas, pacientes, clínicas, farmacia, tienda, seguridad, análisis y soporte.

> **Estado:** frontend funcional con mocks + API Go con healthcheck y migraciones. Sin endpoints de dominio todavía (Fase 1 en curso, ver [docs/TAREAS.md](docs/TAREAS.md)).

## ✨ Funcionalidades

- Gestión de mascotas, propietarios y historiales clínicos.
- Agenda, boxes, citas y flujo de atención.
- Gestión de medicamentos, movimientos y proveedores.
- Punto de venta, inventario, compras y despachos.
- Análisis de clientes, diagnósticos, vacunación, tienda y reportes.
- Monitoreo de seguridad, zonas, dispositivos y eventos.
- Gestión de permisos, usuarios y acceso compartido entre clínicas.
- Solicitudes de acceso con alcance y vigencia.
- Búsqueda global y navegación por roles.

## 🛠️ Tecnologías

**Frontend** ([frontend/](frontend/)): Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui + Radix UI, Lucide React, Recharts, pnpm.

**Backend** ([backend/](backend/)): Go 1.26, Postgres 17, `pgx`, migraciones embebidas aplicadas al arrancar.

**Infra** ([infra/](infra/)): Docker Compose (web :3000 + api :4000 + db :5435).

## 🚀 Ejecución con Docker (recomendado)

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Web: http://localhost:3000 (redirige a /login, login simulado acepta cualquier correo)
- API: http://localhost:4000/healthz
- Postgres: localhost:5435

## 🚀 Desarrollo local

**Frontend** (requiere Node.js 22+ y pnpm 11):

```bash
cd frontend
pnpm install
pnpm dev   # http://localhost:3000, con NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Backend** (requiere Go 1.26 + Postgres):

```bash
cd backend
DATABASE_URL=postgresql://vetdata:vetdata@localhost:5435/vetdata go run ./cmd/api  # :4000
```

## 🧪 Comandos

```bash
cd frontend
pnpm dev          # Iniciar servidor de desarrollo
pnpm build        # Crear versión de producción
pnpm start        # Ejecutar la versión compilada
pnpm lint         # Ejecutar ESLint
```

## ⚙️ Configuración

Los valores opcionales se pueden definir en `frontend/.env.local`. Consulte [frontend/.env.example](frontend/.env.example) como referencia.

| Variable | Valor por defecto | Uso |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` | Usa datos simulados. |
| `NEXT_PUBLIC_API_URL` | Sin valor | URL base de la API cuando se conecta el backend. |

## 🧭 Canales del dashboard

| Canal | Funciones |
|---|---|
| **Inicio** | Mi día, agenda, pendientes y actividad. |
| **Pacientes** | Mascotas, propietarios y historial clínico. |
| **Clínicas** | Red, compartidos y solicitudes de acceso. |
| **Farmacia** | Medicamentos, movimientos y proveedores. |
| **Tienda** | Productos, punto de venta, ventas, bodega, compras y despachos. |
| **Análisis** | Panorama, vacunación, diagnósticos, clientes, tienda y reportes. |
| **Seguridad** | Monitoreo, hall, sala de espera, boxes, tienda y eventos. |
| **Soporte** | Tickets, mejoras y novedades. |
| **Ajustes** | Perfil, usuarios y permisos. |

Para buscar rápidamente desde cualquier pantalla, use **Cmd/Ctrl + K**.

## 🧩 Arquitectura

La estructura principal es:

```text
frontend/src/app/                  # Rutas y componentes de servidor
frontend/src/components/          # Componentes de interfaz y estados interactivos
frontend/src/domain/               # Tipos y reglas del dominio
frontend/src/lib/                  # Stores, utilidades y catálogos
frontend/src/mocks/                # Datos simulados
frontend/src/services/contracts.ts # Contratos de las operaciones
frontend/src/services/mock/        # Implementación simulada
frontend/src/services/http/        # Implementación preparada para la API
backend/cmd/api/                  # Main del servidor HTTP
backend/internal/config|db|handler # Config, pool Postgres, rutas
backend/migrations/               # SQL embebido, se aplica al arrancar
infra/docker-compose.yml          # Stack web+api+db
```

Para conocer la arquitectura completa, consulte [ARCHITECTURE.md](ARCHITECTURE.md). Para definir la API futura, consulte [docs/backend/README.md](docs/backend/README.md).

El [roadmap de ocho fases](docs/roadmap/README.md) detalla entregables, dependencias y criterios de cierre para revisar con el desarrollador. La [matriz de validación](docs/roadmap/validacion.md) registra el avance y la evidencia; las reglas de producto se rigen por [DECISIONES.md](docs/DECISIONES.md).

## 🔐 Comportamiento del prototipo

- Los datos se almacenan en memoria y se pierden al recargar la página.
- La fecha y hora fijadas son el **7 de octubre de 2026 a las 11:05**.
- La clínica actual es **Clínica Vet Providencia**.
- El usuario puede cambiar su rol mediante **Ver como**.
- Las cámaras son representaciones visuales y no muestran video real.
- El acceso entre clínicas requiere una solicitud aprobada, consentimiento y una vigencia activa.
- Las operaciones de citas, recetas, ventas y despachos se representan en la interfaz, pero aún no están conectadas a un backend.

## 👥 Roles disponibles

- **Administrador**
- **Veterinario**
- **Recepción**
- **Farmacia**

Los permisos se pueden consultar y modificar en **Ajustes → Permisos**.

## 🧑‍💻 Integración con backend

Los contratos y métodos de servicio se encuentran en [frontend/src/services/contracts.ts](frontend/src/services/contracts.ts). Las implementaciones HTTP están preparadas en [frontend/src/services/http](frontend/src/services/http), pero actualmente lanzan `NotImplementedError`.

Para conectar la API real:

1. Configure `NEXT_PUBLIC_DATA_SOURCE=http`.
2. Configure `NEXT_PUBLIC_API_URL` (`http://api:4000` en compose, `http://localhost:4000` en dev local).
3. Implementa los métodos de [frontend/src/services/http](frontend/src/services/http).
4. Reemplaza los estados iniciales marcados con `// TODO(api)` en [frontend/src/lib](frontend/src/lib) y [frontend/src/lib/lookups.ts](frontend/src/lib/lookups.ts).

La documentación de requisitos está disponible en [docs/backend/README.md](docs/backend/README.md).

## 🤖 Herramientas de desarrollo

El repositorio incluye agentes y skills en `.claude/`:

- `nextjs-expert`: rutas, servicios y Next.js.
- `frontend-expert`: interfaz, accesibilidad y gráficos.
- `backend-assistant`: requisitos de backend sin implementar el servidor.
- `arquitectura-vetdata`: ordenamiento y actualización de la arquitectura.
- `documentacion-backend`: mantenimiento de los requisitos del backend.
