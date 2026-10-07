# Auditoría integral del prototipo VetData

Fecha de corte: **2026-10-07**  
Alcance: frontend Next.js, UX/accesibilidad, arquitectura, dependencias, preparación de backend, seguridad y calidad operativa.  
Método: revisión estática, build/lint, auditoría de dependencias, comprobaciones en navegador de escritorio y móvil, y tres revisiones especializadas en paralelo.

## Veredicto ejecutivo

VetData es un prototipo amplio, coherente y demostrable. Compila, pasa ESLint, registra 43 rutas, mantiene límites de capas razonables y posee una documentación de backend excepcionalmente completa: 96 operaciones, 21 permisos y 41 estados están trazados.

No está listo para producción ni para datos clínicos reales. Los bloqueantes son autenticación/autorización solo visual, adaptador HTTP totalmente no implementado, mutaciones optimistas sin reconciliación ni rollback, contratos que no pueden limitar correctamente una ficha compartida y ausencia de evidencia de consentimiento en el contrato del servidor.

## Evidencia de validación

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | Correcto; 672 paquetes resueltos |
| `pnpm lint` | Correcto, sin errores |
| `pnpm build` | Correcto; 43 rutas, TypeScript incluido |
| Tests automatizados | No existen scripts ni archivos de pruebas |
| Navegación de escritorio | Seis rutas representativas sin errores de consola ni overflow global |
| Vista móvil 390 px | Sidebar funcional; dashboard y tabla clínica sin overflow global |
| Vista móvil 320 px | La topbar desborda hasta 337 px |
| Auditoría de producción | 1 advisory alto: `braces@3.0.3`, transitivo desde `shadcn` |
| Fronteras de capas | Sin imports directos de `@/mocks` o `@/services` desde `app/`/`components/` |
| Deuda de lectura mock | 58 archivos importan `@/lib/lookups`; 52 `TODO(api)` en `src/` |

## Hallazgos P0 — bloqueantes antes de usar datos reales

### P0.1 Autenticación inexistente y autorización posterior a cargar datos

- El login ignora credenciales y solo navega a `/dashboard`: `src/app/login/page.tsx:32-37`.
- El layout privado no comprueba sesión: `src/app/(dashboard)/layout.tsx:8-27`.
- La ficha de mascota resuelve paciente, dueño y contenido antes de delegar el recorte a un Client Component: `src/app/(dashboard)/pacientes/historial/[id]/page.tsx:29-44` y `src/components/sharing/access-gate.tsx:1-46`.
- El patrón se repite para propietarios: `src/app/(dashboard)/pacientes/propietarios/[rut]/page.tsx:25-42`.

Impacto: ocultar la UI no evita que datos clínicos o personales lleguen en el payload RSC, ni protege rutas directas o APIs.

Acción: crear una DAL `server-only` que valide sesión, clínica, rol, permiso y grant antes de consultar o serializar. Repetir la autorización en la API.

Cierre: un anónimo no recibe el dashboard; un tenant sin acceso recibe 403/404; el payload RSC no contiene campos restringidos; E2E cubre aislamiento entre clínicas.

### P0.2 El modo HTTP no ejecuta ninguna operación

- `NEXT_PUBLIC_DATA_SOURCE=http` selecciona `httpServices`: `src/services/index.ts:17-19`.
- Los 96 métodos de `src/services/http/*` lanzan `NotImplementedError`.
- Los stores siguen hidratando desde semillas: `src/lib/store.tsx:111-126`, `src/lib/retail-store.tsx:67-71`, `src/lib/security-store.tsx:62-68` y `src/lib/support-store.tsx:40-41`.

Impacto: activar HTTP conserva la demo local y hace que toda persistencia falle.

Acción: implementar primero un flujo vertical completo —sesión, lectura, mutación y error— y mantener el modo HTTP deshabilitado hasta que su contrato esté probado.

Cierre: no queda `NotImplementedError` alcanzable en operaciones habilitadas y cada operación tiene pruebas contractuales de éxito y 400/401/403/404/409/422.

### P0.3 Mutaciones optimistas sin reconciliación, rollback ni feedback

- `runInBackground` descarta la respuesta y solo registra el error: `src/services/index.ts:21-27`.
- Los stores generan IDs y folios locales y publican éxito antes del servidor: `src/lib/store.tsx:149-174`, `src/lib/retail-store.tsx:100-156` y `src/lib/support-store.tsx:45-71`.
- El flujo check-in → espera reutiliza un ID temporal aunque `CheckInResult` define un ID canónico: `src/lib/security-store.tsx:119-148` y `src/services/contracts.ts:119-120`.

Impacto: éxito falso, navegación a IDs inexistentes, duplicados y divergencia entre UI y backend.

Acción: estados pending/success/error, reconciliación por `clientRef`, `Idempotency-Key`, rollback/refetch y mensajes recuperables.

Cierre: pruebas con IDs distintos y errores 409 demuestran crear → editar/transicionar sin divergencia.

### P0.4 Los contratos no representan el alcance real de una ficha compartida

- `PatientsService.list/get` devuelven siempre `Patient` completo: `src/services/contracts.ts:128-135`.
- `Patient` incluye consultas, vacunas, exámenes y recetas: `src/domain/patients.ts:19-39`.
- La documentación exige tarjeta mínima, resumen clínico y ficha completa: `docs/backend/transversales.md:45-51`.

Impacto: un backend que cumple el tipo puede exponer más datos de los permitidos; uno que recorta rompe el contrato.

Acción: DTOs discriminados `PatientCard`, `PatientSummary` y `PatientFull`, o endpoints separados, con alcance efectivo explícito.

Cierre: tests negativos prueban que resumen/sin acceso nunca incluyen consultas, exámenes, recetas ni PII no autorizada.

### P0.5 El consentimiento del dueño no llega al servidor

- `RespondAccessRequestInput` solo contiene `approve` y `terms`: `src/services/contracts.ts:83-88`.
- La UI exige confirmación, pero el store no la envía: `src/components/sharing/request-tabs.tsx:142-191` y `src/lib/store.tsx:214-217`.

Impacto: no existe evidencia auditable para crear el grant ni forma contractual de aplicar el 422 documentado.

Acción: agregar `ownerConsent` con método y referencia de evidencia; actor y timestamp deben salir de sesión/servidor.

Cierre: aprobar sin evidencia devuelve 422; aprobar con evidencia crea solicitud, grant y auditoría en una transacción.

## Hallazgos P1 — alta prioridad

### P1.1 La facturación permite sobreventa de medicamentos

- La cantidad no tiene máximo ni valida stock: `src/components/care-actions/invoice-form.tsx:114`.
- El kardex registra la salida completa, pero el stock se trunca a cero con `Math.max`: `src/lib/store.tsx:131` y `src/lib/store.tsx:159-174`.

Acción: validar el acumulado por medicamento y ejecutar factura + movimiento + stock de forma atómica en backend.

### P1.2 Identidad multi-tenant basada en nombres

- `Clinic` no tiene `id`: `src/domain/network.ts:3-15`.
- Pacientes, requests y grants relacionan clínicas con strings de nombre: `src/domain/patients.ts:31` y `src/domain/sharing.ts:29-55`.

Acción: introducir `clinicId` estable en sesión, entidades, DTOs, índices y reglas de autorización.

### P1.3 Comandos no idempotentes y operación clínica no atómica

- Toggle/advance: `support.vote`, `security.toggleLock`, `settings.togglePermission` y `retail.advanceShipment` en `src/services/contracts.ts`.
- Finalizar atención ejecuta cita y box como requests independientes: `src/components/dashboard/my-day/vet.tsx:98-106`.

Acción: comandos con estado deseado, control de versión e idempotencia; endpoint transaccional para finalizar atención.

### P1.4 Contratos sin paginación y DTOs de escritura demasiado amplios

- Las listas devuelven arrays completos pese a la paginación exigida en `docs/backend/transversales.md:214-219`.
- `NewAppointment`, `NewInvoice`, `NewReferral`, `AppointmentPatch` y `Partial<User>` permiten campos controlados por servidor: `src/services/contracts.ts:72-75` y `317-318`.

Acción: `Page<T>`, cursores/filtros y command DTOs mínimos con listas blancas.

### P1.5 Auditoría de video voluntaria desde el cliente

- `security.logAudit` es un POST separado: `src/services/contracts.ts:290-293`.
- La UI registra y luego habilita visualización local: `src/components/security/camera-dialog.tsx:124-139` y `241-260`.

Acción: entregar stream/clip únicamente mediante un endpoint que autorice y registre auditoría de forma atómica.

### P1.6 No existe suite de pruebas ni CI de calidad

- `package.json:5-10` solo define `dev`, `build`, `start` y `lint`.
- No existen archivos Vitest/Jest/Playwright/Cypress.

Acción: tests unitarios de reglas, contract tests de adapters y E2E de autenticación, aislamiento, sharing, farmacia, facturación y POS.

## Hallazgos P2 — calidad, accesibilidad y mantenibilidad

### P2.1 Comboboxes sin nombre accesible propio

`Field` da nombre a un `role="group"`, no al `SelectTrigger`: `src/components/care-actions/field.tsx:17-28`. Se detectaron 30 triggers sin asociación directa; el navegador confirmó el problema en POS y permisos, por ejemplo `src/components/retail/pos.tsx:236-244`.

Acción: conectar `Label htmlFor` con `SelectTrigger id` o propagar `aria-labelledby`.

### P2.2 Topbar desborda a 320 px

La composición fija de marca y acciones en `src/components/topbar.tsx:51` alcanza 337 px de ancho a viewport 320 px.

Acción: reducir gaps/padding bajo 360 px u ocultar texto de marca; validar también zoom 200 %.

### P2.3 Filas clicables sin semántica de enlace

`src/components/layout/clickable-row.ts:7` agrega foco, clic y teclado a `<tr>`, pero no comunica destino ni rol.

Acción: usar un enlace real en la celda principal y ampliar su área clicable.

### P2.4 Gráfico de diagnósticos dependiente del ratón

La selección solo usa `onClick` en `src/components/analytics/diagnoses.tsx:105`; el SVG no ofrece alternativa de teclado ni tabla equivalente.

Acción: selector accesible o tabla complementaria, más título y descripción del gráfico.

### P2.5 Contraste, jerarquía de headings y detalles de idioma

- El par primary/foreground queda aproximadamente en 4,32:1: `src/app/globals.css:58`.
- `CardTitle` renderiza un `<div>`: `src/components/ui/card.tsx:35`.
- El cierre de diálogos anuncia “Close”: `src/components/ui/dialog.tsx:79`.
- “¿La olvidaste?” usa `href="#"`: `src/app/login/page.tsx:46`.

### P2.6 Bundle/estado global y deuda de migración

- Cuatro providers viven en todas las rutas: `src/app/(dashboard)/layout.tsx:10-26`.
- 87 Client Components y unos 393 KiB de JavaScript sin comprimir en el entry compartido observado.
- 58 archivos importan `@/lib/lookups`; 52 `TODO(api)`; faltan `loading.tsx`, `error.tsx`, `global-error.tsx` y `not-found.tsx` propios.

Acción: providers por segmento, datos iniciales desde Server Components, selectores/contextos separados, carga diferida de gráficos y error/loading boundaries.

### P2.7 Advisory alto en dependencia de build

`pnpm audit --prod` reportó `GHSA-vfj7-8cjw-p6xm` en `braces@3.0.3`, transitivo desde `shadcn > fast-glob > micromatch`. Su explotabilidad en runtime es limitada porque la cadena corresponde principalmente al tooling, pero debe resolverse o reclasificarse `shadcn` según su uso de build.

Acción: actualizar la cadena hasta `braces >=3.0.4` o aplicar override compatible, y repetir lint/build/audit.

## Fortalezas verificadas

- Build y lint limpios; TypeScript estricto.
- Diseño visual coherente, feedback contextual, estados vacíos y badges bien resueltos.
- Sidebar móvil funcional y tablas con scroll horizontal contenido.
- Uso generalizado de elementos nativos, `aria-label`, foco visible y primitivas Radix.
- Capas bien definidas: la UI no importa mocks ni servicios directamente.
- Documentación honesta de la deuda y trazabilidad completa de operaciones, permisos y estados.
- Flujos compuestos principales ya están modelados conceptualmente: factura+kardex, dispensación+kardex, checkout+stock+despacho, check-in+espera, pasar a box y aprobación+grant.

## Orden recomendado de remediación

1. Establecer autenticación, sesión, tenant y autorización server-side.
2. Rediseñar DTOs de acceso compartido y evidencia de consentimiento.
3. Implementar un flujo HTTP vertical con hidratación, error, reconciliación e idempotencia.
4. Corregir invariantes transaccionales: stock, finalizar atención, toggles y folios.
5. Crear unit/contract/E2E y gates de CI.
6. Corregir accesibilidad sistémica de selects, filas y gráficos; validar 320 px y contraste.
7. Reducir deuda `lookups`, providers globales y bundle cuando exista medición por ruta.
8. Resolver advisory de dependencias y cerrar contradicciones documentales menores.

## Alcance no cubierto

Esta revisión no es un pentest, no valida cumplimiento legal chileno, no prueba una API real y no certifica WCAG. La fecha fija del prototipo (`src/lib/format.ts:1`) se mantuvo como convención de demo reproducible.
