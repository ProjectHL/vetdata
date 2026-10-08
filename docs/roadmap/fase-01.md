# Fase 1 — Fundaciones técnicas

[Índice](README.md) · [Validación](validacion.md) · [Decisiones](../DECISIONES.md) · [Tareas](../TAREAS.md)

## Objetivo y entrada

Entregar una API reproducible, autenticada y aislada por clínica, con convenciones compartidas para los dominios siguientes.

**Dependencia:** Preparación documental revisada; entorno de desarrollo disponible.

**Estado inicial:** en curso (base parcial, sin aceptación funcional acreditada). Esta página especifica trabajo futuro; sus pruebas y entregables no están acreditados por existir el documento.

## Paquetes de trabajo

Ejecutar primero contratos y migraciones del paquete, luego reglas/servicios/handlers y finalmente pruebas. El orden numérico no elimina dependencias entre tareas; resolverlas según los contratos descritos abajo.

| Tarea | Decisiones / referencia | Estado | Entregable | Evidencia de aceptación |
|---|---|---|---|---|
| T1-1 | p-00, p-02, p-03 | en curso | Completar modelos, migraciones y seeds de clínicas, usuarios, dueños y pacientes. Hacer atómicos SQL y registro de versión; distinguir migración ausente de error SQL; seeds repetibles. | Instalación limpia, actualización desde 001/002, dos arranques concurrentes y reaplicación de seeds sin duplicados. |
| T1-2 | p-01 | pendiente | Login, logout, refresh con rotación y detección de reutilización, recovery por correo y sesión httpOnly. Solo Activo inicia sesión. | Sesión expirada/revocada rechazada; refresh reutilizado invalida su familia; recovery de un uso probado. |
| T1-3 | p-02 | en curso | Completar group, clinic y memberships. Clínica activa en sesión; cambio solo tras comprobar membresía y renovar contexto. | Un usuario en dos clínicas conserva roles separados; parámetros falsificados no cambian tenant. |
| T1-4 | p-00 | pendiente | Contrato REST /api/v1 con errores, paginación, filtros, campos permitidos y DTO separados del modelo SQL. | Pruebas de contrato para respuestas, validaciones y recursos ajenos. |
| T1-5 | p-03; T1-5 | pendiente | Normalización y validación módulo 11 de RUT en dueños, proveedores y perfil; unicidad del dueño normalizado. | Entradas equivalentes se normalizan igual; DV incorrecto devuelve 400; duplicado devuelve 409. |
| T1-6 | p-17 | pendiente | CLP enteros netos, IVA centralizado, redondeo sobre neto total y desglose de bruto en boletas. | Casos de redondeo y totales manipulados; resultados calculados por servidor. |
| T1-7 | p-15 | pendiente | Reloj inyectable; instantes con offset y fechas civiles diferenciadas; America/Santiago para reglas de negocio. | Cruces de medianoche y horario de verano; fechas civiles no cambian por UTC. |
| T1-8 | T1-8 | pendiente | UUID servidor, correlativos transaccionales e Idempotency-Key asociado a actor, clínica, ruta y contenido. | Reintento devuelve resultado original; misma clave con contenido distinto devuelve 409; concurrencia sin duplicados. |
| T1-9 | p-00 | en curso | CI con formato Go, vet, tests e integración Postgres; Compose, logs sin secretos, salud y tiempos máximos de DB. | Pipeline reproducible; caída de DB responde salud no disponible sin espera ilimitada. |
| T1-10 | p-15 | pendiente | Horarios por clínica y profesional, feriados, duración configurable de slots y urgencias sin cita. | Slots consistentes; rechazo de horas fuera de disponibilidad; excepción de urgencia explícita. |

## Contratos e interfaces

- Canonizar `GET /api/v1/me` como `{ user, clinic, permissions }`; añadir login, logout, refresh, recuperación y cambio validado de clínica.
- Documentar OpenAPI junto a las pruebas antes de implementar cada endpoint; los structs SQL actuales no son el contrato JSON.
- Respuestas de error con código estable, mensaje y detalle de validación; listas paginadas y con orden estable. Documentar límites y expiraciones antes de cerrar T1-4.
- Autenticación por cookies: Secure en despliegues HTTPS, httpOnly, controles CSRF/origen y limitación de intentos. Valores de expiración deben constar en configuración y pruebas.
- Correo mediante interfaz intercambiable y capturador local; seleccionar transporte real al cerrar recovery, sin acoplar dominio a un proveedor.

## Migraciones, compatibilidad y recuperación

Preservar 001/002 ya aplicadas. Usar migraciones nuevas para correcciones del esquema; bootstrap de schema_migrations antes de consultar versiones. Ejecutar cada archivo y su registro en una transacción, manteniendo el lock en la misma conexión. Probar rollback por error antes y después del DDL y cierre de proceso antes del registro. Los seeds son optativos de desarrollo y no crean contraseñas predeterminadas de producción.

## Pruebas de fase

- Arranque limpio y actualización con datos existentes; migración fallida no queda registrada ni aplicada parcialmente respecto de su registro.
- Aislamiento mediante dos clínicas de grupos distintos y un usuario con dos memberships.
- Auth: cookies, CSRF, enumeración de cuentas, expiración, rotación, recovery, usuario invitado/inactivo y cierre de sesión.
- RUT, dinero, idempotencia, correlativos y horarios con casos de borde y concurrencia.

Guardar resultados con revisión de código, ambiente, comando/escenario y salida verificable en [validacion.md](validacion.md). Las pruebas sobre datos usan fixtures, nunca registros reales como semillas.

## Criterio de cierre

API y DB reproducibles, autenticación y recuperación verificadas, aislamiento probado y seeds repetibles. Cierre por API; no exige pantallas conectadas.

## Dependencias externas y decisiones de implementación

Correo real: seleccionar transporte y disponer de remitente/credenciales para verificar entrega. La captura local permite avanzar con tests; no acredita entrega real.

Los identificadores D se resuelven en el registro del [roadmap](README.md#decisiones-y-dependencias-diferidas). Una tarea pasa a bloqueada solo cuando su ejecución alcanza una dependencia ausente; las restantes pueden avanzar.
