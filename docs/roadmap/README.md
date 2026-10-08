# Roadmap ejecutable de VetData

Documento para revisión con el desarrollador. Fecha de inventario: **2026-10-08**.

## Autoridad, alcance y orden

[DECISIONES.md](../DECISIONES.md) determina las reglas de producto; [TAREAS.md](../TAREAS.md) organiza las fases. Este roadmap transforma esas tareas en entregables y evidencias. Los contratos del prototipo documentan el punto de partida y no prevalecen sobre decisiones cerradas.

La **Fase 1 está validada técnicamente para desarrollo por API**: [cierre y evidencia](cierre-fase-01.md), [instalación Docker](../backend/instalacion-fase1.md). Las fases restantes siguen abiertas. El [avance técnico](avance-backend.md) conserva el inventario de los paquetes adelantados. Las [definiciones pendientes del desarrollador](pendientes-dev.md) se conservan en Markdown por instrucción del usuario. No se cambian decisiones p-NN mediante este roadmap. Si una validación futura las modifica, aplicar el registro de cambio de DECISIONES.md, incluida su entrada Engram; no afirmar sincronización si ese sistema no está disponible.

Secuencia: preparación → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Las fases 1–4 se validan por API; las pantallas y el enlace del dueño se conectan en Fase 5. Las integraciones externas se seleccionan al llegar a su fase. No hay estimaciones de calendario sin capacidad del equipo acordada.

| Fase | Documento | Condición de salida |
|---|---|---|
| 1. Fundaciones técnicas | [Fase 1](fase-01.md) | API y DB reproducibles, autenticación y recuperación verificadas, aislamiento probado y seeds repetibles. Cierre por API; no exige pantallas conectadas. |
| 2. Identidad y acceso entre clínicas | [Fase 2](fase-02.md) | Dos clínicas comparten mediante autorización del dueño; proyección y auditoría comprobadas por API. La pantalla del enlace del dueño se conecta en Fase 5. |
| 3. Operación clínica | [Fase 3](fase-03.md) | Flujo clínico completo por API y pruebas de atomicidad, stock y pagos aprobadas. Recepción parcial pertenece a esta fase según p-24. |
| 4. Tienda, seguridad, soporte y analítica | [Fase 4](fase-04.md) | Diez dominios cubiertos por API y permisos; stock consistente; eventos inmutables; agregados y aislamiento revisados. |
| 5. Integración frontend | [Fase 5](fase-05.md) | Modo HTTP persistente y flujos habilitados sin semillas ni simulación. Pantallas reflejan errores y alcance real. |
| 6. Endurecimiento | [Fase 6](fase-06.md) | Controles críticos aprobados con evidencia reproducible. No sustituir esta suite por una compilación satisfactoria. |
| 7. Chile y producción | [Fase 7](fase-07.md) | Certificación del proveedor, restauración demostrada, validación de políticas y acta de piloto. Credenciales ausentes o certificación pendiente mantienen el paquete bloqueado. |
| 8. Integraciones posteriores al MVP | [Fase 8](fase-08.md) | Cerrar cada T8 por separado con proveedor y pruebas reales; la fase completa requiere todos sus paquetes validados. Diferir uno no equivale a darlo por terminado. |

El alcance MVP definido en T0-7 sigue siendo fundaciones, identidad/red, agenda y pacientes de lectura. El roadmap completo es más amplio. En Fase 7, el piloto debe enumerar módulos habilitados; no equiparar desarrollo de un módulo con habilitación comercial.

## Preparación y estado observado al crear el roadmap

Siguiente trabajo: [preparación ejecutable de Fase 2](ejecucion-fase-02.md), con paquetes ordenados, brechas de código, matriz de pruebas y decisiones pendientes.

Inventario histórico anterior a la implementación. Para el estado vigente, consultar [avance-backend.md](avance-backend.md) y [validacion.md](validacion.md).

| Elemento | Evidencia del repositorio | Estado / brecha |
|---|---|---|
| API Go | backend/cmd/api/main.go; internal/handler/handler.go | Base existente: solo dos healthchecks; sin handlers de negocio ni autenticación. |
| Migraciones | backend/migrations/001_init.sql, 002_fase1_core.sql, migrations.go | Esquema inicial; SQL y registro no son atómicos entre sí; errores al consultar versión no se distinguen. |
| Modelo y multitenancy | backend/internal/model/model.go; 002_fase1_core.sql | Groups, clinics, users, memberships, doctors, owners y permisos; falta aislamiento de sesión y dominio clínico completo. |
| Seeds | backend/seeds/002_fase1_seeds.sql | Parciales; bloques de role_permissions sin ON CONFLICT fallan al repetir; clínicas de ejemplo comparten grupo. Crear fixtures de grupos distintos. |
| Infra | infra/docker-compose.yml; backend/Dockerfile | Existe Compose y healthchecks; el usuario informó arranque local. No se acreditó ejecución desde la revisión. |
| Frontend | frontend/src/services/http; frontend/src/lib/lookups.ts | Adaptadores pendientes y datos de demo; 96 operaciones inventariadas no equivalen a endpoints implementados. |
| Validación técnica | Revisión previa de esta conversación | Docker/HTTP local y caché Go denegados por permisos del entorno. No se registra una suite verde. |

Acciones de preparación documental:

1. Corregir la instrucción circular de TAREAS: cerrar decisiones previas y construir las fundaciones dentro de Fase 1.
2. Conservar T1-1/T1-3/T1-9 como en curso, con evidencia de base parcial; no marcar sus casillas completas.
3. Reconciliar el contrato de red con p-03 a p-07 y p-10: dueño autoriza, origen custodia y puede suspender bajo causa.
4. Aplicar p-24: recepción parcial en Fase 3; Fase 8 extiende FEFO/compras.
5. Separar auditoría general, lecturas compartidas y video; no habilitar purgas sin política validada.

## Forma de ejecución y revisión

Cada tarea tiene un único estado: **pendiente**, **en curso**, **bloqueada**, **validada**. Un avance parcial se describe en evidencia y permanece en curso. No usar porcentajes subjetivos.

- Antes de cada paquete: comprobar decisiones, contrato de API, campos autorizados y migración compatible.
- Con cada implementación: actualizar contrato/documentación, pruebas unitarias de reglas y pruebas de integración relevantes con Postgres.
- Para revisar: entregar diff o commit, comandos/resultados, ejemplos de petición/respuesta y defectos abiertos, sin secretos.
- Al cerrar: actualizar [validacion.md](validacion.md), el estado de la fase y la casilla T correspondiente en TAREAS. Conservar pendientes los gates externos.
- Ante fallo de despliegue: revertir aplicación/configuración compatible, conservar datos y usar restauración ensayada si procede. No borrar volúmenes como estrategia de rollback.
- Usar esquema de dos clínicas en grupos distintos, cuatro roles, un usuario multiclínica y accesos con distintos estados en todas las pruebas de aislamiento.
- Las pruebas de seguridad/atomicidad nacen con cada fase; Fase 6 las consolida, no posterga su implementación.

## Decisiones y dependencias diferidas

Estas entradas son gates de ejecución; no cambian p-NN ni acreditan aprobación. Para detalles técnicos aún no definidos, registrar el contrato antes del paquete dependiente.

| ID | Resolver | Responsable de validación | Momento / paquete afectado | Criterio |
|---|---|---|---|---|
| D-01 | Duración exacta entre 2–3 años de lecturas compartidas y tratamiento de evidencia de consentimiento | Producto + responsable de privacidad | T2-7 diseño; T7-3 antes de purga | Política aprobada, separada de auditoría general de cinco años. Sin purga automática pendiente. |
| D-02 | Bandeja/aceptación de derivaciones externas recibidas | Dev + responsable clínico | T3-5 | Actores, rutas, estados, acceso a receta y efecto de dispensación documentados. |
| D-03 | Cálculo de PatientStatus y prioridad clínica | Responsable clínico + dev | T3-2 | Reglas deterministas y casos de prueba; p-22 exige cálculo servidor pero no fija fórmula. |
| D-04 | Fórmulas de cobertura y cortes publicables | Producto + privacidad + dev | T4-4 | Denominadores, ventanas, sector y controles de inferencia compatibles con k≥5. |
| D-05 | Proveedor DTE | Producto + dev | T7-1 | Selección, costos/capacidades, credenciales y certificación para 39/33; posteriores 61/52 registrados. |
| D-06 | VPS, dominio, operación y objetivos de recuperación | Operaciones + producto | T7-4 | Acceso, responsables, TLS, backups, RPO/RTO acordados y ensayo de restauración. |
| D-07 | Retención clínica, anonimización y procedimiento de privacidad | Responsable de privacidad + producto | T7-2/T7-3 | Política aprobada y alcance explícito; p-14 cita plazo clínico como ejemplo. |
| D-08 | WhatsApp/mensajería | Producto + dev | T8-1 | Proveedor, plantillas autorizadas, opt-out, costos y prueba de entrega. |
| D-09 | Pasarela/terminal | Producto + dev | T8-2 | Proveedor, devolución/conciliación, firma de webhooks y sandbox. |
| D-10 | Almacenamiento y antivirus | Operaciones + dev | T8-3 | Proveedor elegido entre opciones p-20, cuarentena, límites, permisos y costos. |
| D-11 | NVR/cámaras y conectividad | Operaciones + clínica + dev | T8-4 | Equipo compatible, acceso de prueba, privacidad y retención verificados. |
| D-12 | Firma avanzada y catálogo diagnóstico | Responsable clínico + producto + dev | T8-5/T8-6 | Validación, proveedor/licencias y entorno de pruebas disponible. |
| D-13 | Transporte de correo transaccional | Producto + dev | T1-2, reutilizado en fases 2/3 | Capturador local para pruebas; remitente y entrega real antes de cerrar aceptación de correo. |
| D-14 | Inicio y alcance de una renovación aprobada antes del vencimiento | Producto + dev | T2-4 | Precisar inicio inmediato o sucesivo y tratamiento de alcances distintos. Ver pendientes-dev.md; no activar una regla por suposición. |

Roles personalizados: evaluar en T4-5 y dejar constancia; cuatro roles fijos continúan en MVP salvo nueva decisión explícita. El cierre de una decisión de proveedor exige evidencia, no solo disponer de una interfaz simulada.

## Contratos y compatibilidad

- El [contrato de red](../backend/dominios/red-y-acceso.md) describe el objetivo; el inventario de [API](../backend/api.md) mantiene trazabilidad de operaciones antiguas y sustituciones.
- Diferencias intencionales frente a TypeScript/modelos actuales: estados del dueño, Suspendido, red.suspender, consentimiento por grant, DTO de sesión, recepción parcial, eventos inmutables y auditoría servidor.
- No modificar migraciones aplicadas para aparentar una base nueva; usar migraciones incrementales y fixtures de prueba.
- El navegador no resuelve api:4000. Documentar URL pública/proxy/cookies en Fase 5 y configurarla al compilar Next.js.
- Antes de código frontend, leer guías locales de la versión instalada de Next.js conforme a AGENTS.md.

## Evidencia exigida

La matriz de [validación](validacion.md) es el registro de aceptación. Debe mostrar revisión de código, ambiente, resultado esperado/obtenido, fecha, persona revisora y enlace a evidencia. La revisión documental de este roadmap no sustituye pruebas funcionales, certificaciones, un piloto ni una aprobación de política.
