# Usuarios, roles, permisos y ajustes de clínica

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-10 sustituye red.aprobar/red.revocar por red.suspender, exclusivo de Admin origen. Política de clínica no exime consentimiento del dueño; requireConsent/shareConsent del demo no son autorización real. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/settings.ts` (`Role`, `ROLES`, `Permission`, `PERMISSIONS`, `RolePermissions`, `User`, `UserStatus`, `ClinicProfile`, `SharingPolicy`) · `src/mocks/settings.ts` (`defaultRolePermissions`, `seedUsers`, `demoUserByRole`, `seedClinicProfile`, `seedSharingPolicy`) · `src/services/contracts.ts` (`SettingsService`) · `src/services/mock/settings.ts` · `src/lib/store.tsx` (ajustes, `useCan`, `useDoctors`) · `src/components/settings/*` (`guard.tsx`, `users-table.tsx`, `permissions-matrix.tsx`, `profile.tsx`) · `src/components/topbar.tsx` ("Ver como")

## Propósito
Gestión de los usuarios de la clínica (invitar, cambiar rol, activar/desactivar), matriz de permisos por rol configurable por clínica, perfil legal de la clínica y política de compartición en la red.

Pantallas: `/ajustes/perfil`, `/ajustes/usuarios`, `/ajustes/permisos` (matriz + política de compartición).

## Entidades

### User
| Campo | Tipo | Oblig. | Descripción / restricciones |
|---|---|---|---|
| id | uuid | sí | |
| clinicId | id | sí | Tenant. **Un usuario pertenece a una clínica** *(supuesto; multi-clínica por usuario → `preguntas-abiertas.md#p-02`)*. |
| name | string | sí | |
| email | email | sí | Único (global, es el login). |
| role | `Role` | sí | `Admin \| Veterinario \| Recepción \| Farmacia`. Un rol por usuario. |
| specialty | string | no | Solo veterinarios (`users-table.tsx`: se envía solo si rol Veterinario). |
| doctorId | id | no | Vincula al `Doctor` de agenda/mapa. **No se crea al invitar** (hallazgo, ver regla 6). |
| status | `UserStatus` | sí | `Invitado` al invitar. |
| lastAccess | datetime | sí | Hoy texto ("—" si nunca). |

### RolePermissions (por clínica)
`Record<Role, Permission[]>`. Valores por defecto (`src/mocks/settings.ts:defaultRolePermissions`) en [`../permisos.md`](../permisos.md).

### Permission (catálogo fijo del producto)
21 permisos en `src/domain/settings.ts:PERMISSIONS` (id, área, etiqueta, descripción). No configurable por clínica.

### ClinicProfile
`{ legalName, rut, address, sector, phone, email, hours (texto), boxes (int) }`. RUT de la clínica con puntos en semilla → normalizar/validar.

### SharingPolicy
Ver [red-y-acceso](red-y-acceso.md#sharingpolicy-por-clínica).

## Reglas de negocio
1. **Permiso efectivo** = `rolePermissions[user.role].includes(permiso)` con la matriz **de la clínica del usuario**. Fuente: `src/lib/store.tsx:useCan`. *(regla)* — en servidor.
2. **Admin tiene todos los permisos por defecto**; resto según matriz. Fuente: `src/mocks/settings.ts` (`Admin: all`). *(regla por defecto, editable)*.
3. **Administrar usuarios, matriz, perfil y política** requiere `usuarios.administrar`. Fuente: `users-table.tsx`, `permissions-matrix.tsx` (`editable = can("usuarios.administrar")`, también para la política de compartición), `profile.tsx`. *(regla)*
4. **No auto-modificarse**: un usuario no cambia su propio rol ni su propio estado. Fuente: `users-table.tsx` (`u.id !== currentUser.id`). *(regla)* → backend 409/403.
5. **Transiciones de estado de usuario**: `Invitado → Activo` ("Marcar aceptada" por admin), `Activo → Inactivo` ("Desactivar"), `Inactivo → Activo` ("Reactivar"). Fuente: `users-table.tsx`. *(regla de UI)* — `updateUser` acepta `Partial<User>` libre (puede tocar `email`, `id`, `doctorId`, `lastAccess`…). Backend DEBE limitar a `role`, `status`, `specialty` (y `name`) y validar transiciones. "Marcar aceptada" debería ser consecuencia de aceptar la invitación (`#p-01`).
6. **Profesionales de agenda** = usuarios `Activo` con rol `Veterinario` y `doctorId`. Fuente: `src/lib/store.tsx:useDoctors`. *(regla)* — **Hallazgo**: `inviteUser` no crea `doctorId`, así que un veterinario invitado y luego activado **nunca aparece en la agenda**. El backend DEBE crear/vincular el `Doctor` al activar un usuario Veterinario (o unificar `Doctor` dentro de `User`). Desactivar un veterinario con citas futuras → definir política (`#p-25`).
7. **Invitar**: crea usuario `Invitado`, `lastAccess = "—"`. Fuente: `mock/settings.ts:inviteUser`. *(regla)* — DEBE: email único, enviar invitación con enlace de expiración (`#p-01`).
8. **Matriz por toggle**: `togglePermission(role, permission)` agrega o quita. Fuente: `mock/settings.ts:togglePermission`. *(regla)* — DEBE impedir que la clínica quede sin usuarios activos con `usuarios.administrar` (incluido quitárselo al rol Admin). Cambios auditados. Efecto inmediato sobre sesiones activas.
9. **Perfil y política** se reemplazan completos (`PUT`). Fuente: `mock/settings.ts:updateClinicProfile, updateSharingPolicy`. *(regla)*
10. **"Ver como"** (`setRole`, `demoUserByRole`) es solo demo. Fuente: `src/lib/store.tsx`, `src/components/topbar.tsx`. *(supuesto del prototipo — no implementar)*.
11. **Usuario actual del mock** siempre es el veterinario demo `u1`. Fuente: `src/services/mock/db.ts:actor`. *(supuesto del prototipo)*.

## Estados
`UserStatus`: `Invitado → Activo ↔ Inactivo` (y `Invitado → Inactivo` revocar invitación, recomendado). Ver [`../estados.md#usuario`](../estados.md).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `settings.getCurrentUser` | `GET /api/v1/me` | — | `User` (recomendado + `clinic` + `permissions[]`) | sesión | 401 | — |
| `settings.listUsers` | `GET /api/v1/users` | `?status&role` | `User[]` de mi clínica | sesión (la agenda necesita profesionales) | 401 | — |
| `settings.inviteUser` | `POST /api/v1/users/invitations` | `{ name, email, role, specialty? }` | `User` (Invitado) | `usuarios.administrar` | 400, 409 (email existe) | Envía email de invitación; auditoría |
| `settings.updateUser` | `PATCH /api/v1/users/:id` | `{ role?, status?, specialty?, name? }` | `User` | `usuarios.administrar` | 403 (a sí mismo), 404, 409 (transición, último admin) | Auditoría; invalidar sesiones si `Inactivo` |
| `settings.getRolePermissions` | `GET /api/v1/settings/role-permissions` | — | `RolePermissions` | sesión | 401 | — |
| `settings.togglePermission` | `POST /api/v1/settings/role-permissions/:role/toggle` | `{ permission }` (recomendado `PUT /role-permissions/:role/:permission { granted }`) | `RolePermissions` | `usuarios.administrar` | 400 (rol/permiso desconocido), 409 (auto-bloqueo) | Auditoría |
| `settings.getClinicProfile` | `GET /api/v1/settings/clinic-profile` | — | `ClinicProfile` | sesión | 401 | — |
| `settings.updateClinicProfile` | `PUT /api/v1/settings/clinic-profile` | `ClinicProfile` | `ClinicProfile` | `usuarios.administrar` | 400 (RUT inválido) | Auditoría; sector afecta costo de despacho (hoy hardcodeado) |
| `settings.getSharingPolicy` | `GET /api/v1/settings/sharing-policy` | — | `SharingPolicy` | sesión | 401 | — |
| `settings.updateSharingPolicy` | `PUT /api/v1/settings/sharing-policy` | `SharingPolicy` | `SharingPolicy` | `usuarios.administrar` | 400 | Auditoría (desactivar `requireConsent` es sensible) |

Nota: el rol en la URL (`:role`) contiene tildes (`Recepción`): usar ids ASCII (`admin`, `veterinario`, `recepcion`, `farmacia`) o codificar.

## Efectos en otros dominios
- Matriz de permisos gobierna todos los endpoints.
- Usuarios veterinarios activos = profesionales de agenda/mapa.
- Política de compartición gobierna aprobaciones de red y notificaciones.

## Datos de referencia / semilla
Catálogo `PERMISSIONS`, `ROLES`, matriz por defecto, usuarios semilla (11), perfil y política semilla.

## Notas para el dev
- No hay login real, recuperación de contraseña, 2FA, ni SSO (`#p-01`).
- `ClinicProfile.boxes` (6) no está ligado a los `Room` reales.
