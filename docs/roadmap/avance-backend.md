# Avance verificable del backend

## Actualización de cierre de Fase 1

La Fase 1 fue validada técnicamente para desarrollo por API el 2026-10-08. Ver [acta vigente](cierre-fase-01.md) y [guía de instalación](../backend/instalacion-fase1.md). Los pendientes de fundaciones descritos en el inventario histórico siguiente fueron resueltos por ese cierre; las fases 2–8 continúan abiertas.

## Inventario anterior al cierre

Fecha: 2026-10-08. Revisión: cambios locales en rama `codex/backend-phases`, posteriores a `6ce76c0`; pendientes de commit y revisión del desarrollador.

## Alcance entregado y límites

Implementación parcial de fases 1–3 con preparación de esquema para operación. **Ninguna fase se declara cerrada**. El frontend continúa con sus adaptadores HTTP pendientes. La base y los contenedores habituales del usuario no se han actualizado con este código.

Las reglas sin respuesta permanecen en [pendientes-dev.md](pendientes-dev.md). PatientStatus se devuelve `null` con `statusPending: true`; no se inventa una clasificación médica. No se habilitan derivaciones externas ni purgas automáticas.

| Paquete | Implementado | Evidencia / falta para cerrar |
|---|---|---|
| T1-1, T1-3 | Migraciones SQL y registro en una transacción con bloqueo; esquemas 003–005; sesión y membresía verificadas por clínica. Seeds repetibles. | Pruebas de base vacía, actualización desde 001/002, migradores simultáneos, fallo con rollback y dos aplicaciones de seeds. Falta completar seeds de dominio y procedimiento de alta inicial. |
| T1-2 | Cookies httpOnly, refresh rotativo, detección de reutilización, recuperación de un uso, cierre/cambio de clínica, `/me`. | Login, expiración lógica del token anterior, replay de refresh, recovery y origen verificados. Falta cerrar cobertura completa de sesiones/invitaciones y configurar correo local reproducible. |
| T1-4 a T1-8 | Errores estructurados, JSON estricto, paginación acotada, RUT, CLP/IVA, UUID, idempotencia y correlativos transaccionales. | Pruebas de dominio, entradas desconocidas, claves repetidas y conflictos. Totales todavía no conectados a emisión de facturas. |
| T1-9 | Tests Docker con Postgres aislado; workflow de CI; logs JSON, salud y apagado ordenado. | Suite local aprobada. Workflow añadido, aún no ejecutado en GitHub. Falta prueba de caída de DB y completar operación reproducible. |
| T1-7, T1-10, T3-1 | Horarios por clínica/profesional, feriados, slots, urgencias explícitas, agenda, ingreso, espera, boxes y finalización. | Reserva concurrente, feriado, disponibilidad, aislamiento, llamada/finalización duplicada y liberación de box probados. Cambios de horario conservan citas existentes. |
| T2-1, T2-9 | Usuarios, invitaciones, permisos por clínica, protección de último Admin, doctor al crear Vet; desactivación rechazada con citas futuras/en curso. | Protección de Admin probada; error 409 incluye citas afectadas. Faltan escenarios adicionales de invitación y concurrencia de administradores. |
| T2-2 a T2-7, T2-10 | Dueños/pacientes, búsqueda mínima, solicitudes al dueño, token 72 horas/RUT, grants por alcance, cancelación/reenvío, sesión de dueño, revocación, suspensión/restauración, auditoría de lecturas. | Flujo de consentimiento, token no reutilizable, resumen sin consultas/contactos, pérdida de acceso y auditoría probados. Faltan renovación/aviso 7 días y ampliar pruebas de vencimiento/concurrencia. |
| T3-5; base compartida T4 | Proveedores, catálogo, compras con costo registrado, recepción parcial por lote, kardex inmutable y ajustes negativos. | Recepción 4+6 sobre pedido 10, reintento sin duplicado, exceso con rollback completo y concurrencia de merma (stock 10, dos salidas 7: una sola admitida). Falta dispensación, vinculación a recetas/facturas, transferencias y ventas. |
| T3-8 | Tabla de adjuntos con tipo, tamaño y cuarentena. | Solo modelo. Lectura autorizada, almacenamiento y antivirus pendientes. |

Los avances de agenda e inventario permiten probar fundaciones comunes; no eliminan la dependencia de cerrar fases anteriores antes de habilitar el flujo completo.

## Ejecución de pruebas

Desde la raíz del repositorio:

```powershell
docker compose -f infra/docker-compose.test.yml run --rm test
```

Entorno: Go 1.26 en Linux, Postgres 17, proyecto `vetdata-tests`, base de prueba efímera. Sin puertos publicados ni volumen de la aplicación. Cada fixture crea una base propia y la elimina al finalizar. La suite exige nombre de base `vetdata_test`; `REQUIRE_INTEGRATION=1` impide aprobar omitiendo integración.

Última ejecución registrada: salida 0; paquetes `internal/domain`, `internal/handler` y `migrations` aprobados. No se enviaron correos reales: las pruebas descifran el outbox y entregan a un capturador en memoria. El outbox conserva payload cifrado y borra su contenido al confirmar entrega. SMTP ofrece reintento, no entrega exactamente una vez ante caídas después del envío.

Pruebas principales:

- `TestConcurrentMigrationsAndUpgrade`, `TestMigrationFailureRollsBackDDLAndLedger`, `TestSeedsReapplyWithoutDuplicates`.
- `auth_test.go`: cookies, sesión, refresh, recuperación, aislamiento y validación de origen/JSON.
- `sharing_test.go`: consentimiento, proyección, suspensión, revocación y último Admin.
- `TestSchedulesConcurrentBookingAndTenant`, `TestWaitingRoomLifecycle`.
- `TestPartialReceiptsIdempotencyRollbackAndConcurrentStock`.

## Contratos incorporados

Base `/api/v1`; los contratos actuales están en los handlers. Escrituras de negocio exigen cookie de sesión, `Origin` igual a `PUBLIC_WEB_URL`, JSON válido y `Idempotency-Key` de 8–128 caracteres. Misma clave/operación/cuerpo devuelve la respuesta persistida; contenido distinto responde 409. Las rutas de autenticación y consentimiento tienen su propio consumo de tokens.

| Ruta | Método | Contrato relevante |
|---|---|---|
| `/settings/schedule` | GET, PUT | `{hours:[{weekday,start,end,slotMinutes}],holidays:[{date,name}]}`. Domingo 0. PUT sustituye configuración y exige ambas listas. |
| `/doctors/{id}/schedule` | GET, PUT | `{hours:[{weekday,start,end}]}`. Lista vacía hereda horario de clínica. Clínica define duración de slots. |
| `/appointments/availability?date=YYYY-MM-DD&doctorId=UUID` | GET | `{date,doctorId,timezone,slots:[{startsAt,endsAt}]}` con offset Santiago. Disponibilidad orientativa; reservar vuelve a validar. |
| `/appointments` | GET, POST | POST `{patientId,doctorId,date,time,reason,emergency}`. PATCH `/{id}` solo campos permitidos; reprogramar y cambiar estado son operaciones separadas. |
| `/security/waiting`, `/security/access` | GET | Listas aisladas por clínica. POST waiting recibe `{appointmentId}` y crea ingreso + espera atómicos. |
| `/security/waiting/{id}/call` | POST | `{roomId}`; asigna box disponible y profesional. Solo citas de hoy activas. |
| `/rooms`, `/rooms/{id}`, `/rooms/{id}/finish` | GET/POST, PATCH, POST | Crear box requiere administración. Finalizar cita deja box en limpieza; PATCH disponible confirma término de limpieza. |
| `/{pharmacy,retail}/suppliers` | GET, POST | `{name,rut,email,phone}` con RUT validado. |
| `/pharmacy/medications`, `/retail/products` | GET, POST | `{name,priceNet,unitCost,supplierId,category,minStock}`; stock solo mediante movimientos. Costo registrado, no porcentaje del precio. |
| `/{pharmacy,retail}/purchase-orders` | GET, POST | `{supplierId,items:[{itemId,qty}]}`; costo tomado del catálogo y congelado en cada línea. |
| `/{pharmacy,retail}/purchase-orders/{id}/send` | POST | Borrador a Enviada; registro interno, no envía un correo al proveedor. |
| `/{pharmacy,retail}/purchase-orders/{id}/receive` | POST | `{items:[{itemId,qty,lot,expiry}]}`. Cantidades incrementales; vencimiento obligatorio para medicamento. Recepción, saldo por línea y movimiento se confirman juntos. |
| `/{pharmacy,retail}/movements` | GET, POST | Ajuste `{lotId,qty,reason}`; qty negativo, razón Merma/Vencimiento. Otras salidas deben venir de sus operaciones. |

Limitación de lotes: reutilizar lote con distinto costo o vencimiento responde 409; no reescribe la historia. Falta acordar y desarrollar el manejo de variaciones de costo dentro del mismo lote físico. Los endpoints de compras minoristas reutilizan el motor; su integración completa y pruebas de dominio tienda siguen pendientes.

## Siguiente secuencia de trabajo

1. Cerrar fundaciones: alta inicial reproducible, configuración SMTP de desarrollo, completar seeds y cobertura pendiente.
2. Cerrar identidad/red: invitaciones, renovación, vencimientos y tareas calculadas.
3. Escritura clínica append-only, recetas y derivaciones internas, dispensación, factura interna y abonos; completar flujo API integral. PatientStatus y bandeja externa quedan sujetos al desarrollador.
4. Completar dominios Fase 4 y después integración frontend según documentación Next local.
5. Endurecimiento/2FA, producción y proveedores de fases 7–8 según sus gates. No hay certificación DTE, despliegue ni integraciones externas acreditadas.

Revisión del desarrollador: pendiente. No marcar tareas completas en TAREAS por la existencia de código o de este documento.
