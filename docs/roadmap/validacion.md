# Validación del roadmap

[Índice](README.md) · [TAREAS](../TAREAS.md)

## Registro y reglas

Fecha de inventario: 2026-10-08. Estado funcional inicial basado en lectura de código, sin ejecución verificada del stack por el agente. **Este archivo no da por implementadas las tareas.**

Valores permitidos: pendiente, en curso, bloqueada, validada. Marcar [x] únicamente tras revisar evidencia. Las tareas parciales están en curso; los proveedores se registran como dependencias futuras y pasan a bloqueados cuando impiden ejecutar un paquete concreto.

Formato mínimo de evidencia: fecha | commit/revisión | ambiente | comando o escenario | resultado esperado/obtenido | enlace a log/PR/acta | revisor. No adjuntar credenciales, tokens o datos personales.

## Preparación documental

- [x] Inventario estático y brechas de fundaciones registrados en el índice.
- [x] Roadmap de ocho fases y matriz de tareas redactados.
- [x] Contratos documentales de red reconciliados con p-03 a p-07/p-10.
- [x] Recepción parcial situada en Fase 3 y auditorías separadas.
- [ ] Revisión del roadmap por el desarrollador: pendiente de nombre, fecha y observaciones.
- [ ] Validación runtime de la base existente: pendientes acceso y resultados de pruebas.

Las casillas anteriores acreditan entrega documental, no cierre de T1–T8 ni aceptación del desarrollador.

Verificación documental del agente (2026-10-08): diez archivos de roadmap, 56 tareas únicas presentes en fases y matriz, 73 enlaces locales resueltos, 96 rutas numeradas conservadas frente al contrato TypeScript y diferencia esperada de permisos (21 actuales → 20 objetivo). `git diff --check` sin errores. La revisión del desarrollador sigue pendiente. No se ejecutaron pruebas funcionales para esta entrega documental.

## Actualización de implementación — 2026-10-08

Suite Docker/Postgres aislada ejecutada con salida 0. [Evidencia, contratos y brechas](avance-backend.md). Las fases siguen abiertas; la base existente real no fue migrada por estas pruebas. Revisión del desarrollador pendiente.

## Fase 1 — Fundaciones técnicas

[Paquetes y pruebas](fase-01.md). Gate técnico local: **validada**. [Acta y comandos de aceptación](cierre-fase-01.md).

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [x] | T1-1 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-2 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-3 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-4 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-5 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-6 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-7 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-8 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-9 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |
| [x] | T1-10 | validada | [Cierre técnico y pruebas por tarea](cierre-fase-01.md). | Validación automatizada aprobada; revisión humana pendiente. |

## Fase 2 — Identidad y acceso entre clínicas

[Paquetes y pruebas](fase-02.md). Gate: **en curso**. [Preparación ejecutable](ejecucion-fase-02.md) basada en `29f5e3d`; no se ha cerrado ninguna T2 por esta preparación.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T2-1 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Intentos concurrentes de retirar el último administrador rechazados; invitaciones de un uso. | Pendiente de revisión. |
| [ ] | T2-2 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Ningún camino de lectura expone clínico ajeno sin acceso; se conservan documentos propios. | Pendiente de revisión. |
| [ ] | T2-3 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Resumen excluye consultas, exámenes y recetas incluso en respuestas JSON; búsqueda no enumera contactos. | Pendiente de revisión. |
| [ ] | T2-4 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Doble respuesta concurrente crea un solo grant; token vencido/reutilizado falla; renovación no amplía acceso por sí sola. | Pendiente de revisión. |
| [ ] | T2-5 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Checkbox de clínica no autoriza; revocación corta lecturas y no borra evidencia. | Pendiente de revisión. |
| [ ] | T2-6 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Vet o Admin de otra clínica recibe 403; restablecer no revive consentimiento revocado ni vigencia vencida. | Pendiente de revisión. |
| [ ] | T2-7 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Auditoría persiste antes de entregar datos; evidencia aislada y sin token/RUT en logs generales. | Pendiente de revisión. |
| [ ] | T2-8 | pendiente | Sin evidencia funcional registrada. Exigir: Fuentes disponibles producen tareas reales; permisos filtran bandeja; fuentes futuras se incorporan en fases 3/4. | Pendiente de revisión. |
| [ ] | T2-9 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: 409 con citas afectadas; reasignación/cancelación explícita previa a desactivar. | Pendiente de revisión. |
| [ ] | T2-10 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Prueba de extremo a extremo por API, con solicitudes, auditoría y pérdida inmediata de acceso. | Pendiente de revisión. |

## Fase 3 — Operación clínica

[Paquetes y pruebas](fase-03.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T3-1 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Dos reservas simultáneas no ocupan el mismo recurso; finalizar libera paciente/profesional y deja box en limpieza. | Pendiente de revisión. |
| [ ] | T3-2 | pendiente | Sin evidencia funcional registrada. Exigir: Corrección conserva original y autor; clínicas con acceso no sobrescriben registros ajenos. | Pendiente de revisión. |
| [ ] | T3-3 | pendiente | Sin evidencia funcional registrada. Exigir: Factura y stock se confirman juntos; reintento no duplica folio/movimiento; sin stock devuelve 409. | Pendiente de revisión. |
| [ ] | T3-4 | pendiente | Sin evidencia funcional registrada. Exigir: Precio/totales manipulados se ignoran o rechazan; descuento inválido falla. | Pendiente de revisión. |
| [ ] | T3-5 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Recepciones acumulan cantidades sin sobrepasar pedido; fallo revierte stock, movimiento y recepción. | Pendiente de revisión. |
| [ ] | T3-6 | pendiente | Sin evidencia funcional registrada. Exigir: Abonos parciales y concurrentes consistentes; no duplicar ni mezclar saldo de otras clínicas. | Pendiente de revisión. |
| [ ] | T3-7 | pendiente | Sin evidencia funcional registrada. Exigir: Reintento no duplica recordatorio; cancelación y opt-out suprimen envíos correspondientes. | Pendiente de revisión. |
| [ ] | T3-8 | en curso | Implementación parcial y pruebas en [avance-backend.md](avance-backend.md). Exigir: Un adjunto no amplía acceso al recurso padre; almacenamiento real permanece diferido. | Pendiente de revisión. |
| [ ] | T3-9 | pendiente | Sin evidencia funcional registrada. Exigir: Escenario completo por API con evidencia SQL de atomicidad. | Pendiente de revisión. |

## Fase 4 — Tienda, seguridad, soporte y analítica

[Paquetes y pruebas](fase-04.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T4-1 | pendiente | Implementación y pruebas en [cierre-fase-04.md](cierre-fase-04.md). Exigir: Venta concurrente no produce stock negativo; checkout crea venta/movimientos/despacho juntos. | Pendiente de revisión. |
| [ ] | T4-2 | pendiente | Implementación y pruebas en [cierre-fase-04.md](cierre-fase-04.md). Exigir: No se edita/reabre evento cerrado; caso nuevo vinculado; auditoría no depende de un POST del navegador. | Pendiente de revisión. |
| [ ] | T4-3 | pendiente | Implementación y pruebas en [cierre-fase-04.md](cierre-fase-04.md). Exigir: Clínica no se hace pasar por Staff; idea y ticket se crean juntos; transiciones autorizadas. | Pendiente de revisión. |
| [ ] | T4-4 | pendiente | Implementación y pruebas en [cierre-fase-04.md](cierre-fase-04.md). Exigir: Cortes menores a cinco no se publican; respuestas no llevan fichas/contactos ajenos; exclusión comprobable. | Pendiente de revisión. |
| [ ] | T4-5 | pendiente | Acta en TAREAS + [cierre-fase-04.md](cierre-fase-04.md). Exigir: Acta de evaluación; si se difiere, no incluirlo como funcionalidad faltante del MVP. | Pendiente de revisión. |
| [ ] | T4-6 | pendiente | Implementación y pruebas en [cierre-fase-04.md](cierre-fase-04.md). Exigir: Matriz de rutas, roles, errores y pruebas por dominio completada. | Pendiente de revisión. |

## Fase 5 — Integración frontend

[Paquetes y pruebas](fase-05.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T5-1 | pendiente | Implementación y pruebas en [cierre-fase-05.md](cierre-fase-05.md). Exigir: Inventario completo de operaciones implementadas/sustituidas; sin NotImplementedError en rutas habilitadas. | Pendiente de revisión. |
| [ ] | T5-2 | pendiente | Implementación y pruebas en [cierre-fase-05.md](cierre-fase-05.md). Exigir: Recarga conserva estado; cambio de clínica limpia datos/caché del tenant anterior. | Pendiente de revisión. |
| [ ] | T5-3 | pendiente | Implementación y pruebas en [cierre-fase-05.md](cierre-fase-05.md). Exigir: Pantallas, búsqueda, tareas y analítica no muestran datos de mocks en modo HTTP. | Pendiente de revisión. |
| [ ] | T5-4 | pendiente | Implementación y pruebas en [cierre-fase-05.md](cierre-fase-05.md). Exigir: No navegar a ticket con id temporal; errores revierten estado optimista o recargan recurso. | Pendiente de revisión. |
| [ ] | T5-5 | pendiente | Implementación y pruebas en [cierre-fase-05.md](cierre-fase-05.md). Exigir: Navegación y roles sobreviven recarga; fechas civiles y hora local correctas. | Pendiente de revisión. |
| [ ] | T5-6 | pendiente | Implementación y pruebas en [cierre-fase-05.md](cierre-fase-05.md). Exigir: E2E en navegador; recarga conserva datos; no existe aprobación por clínica ni consentimiento ajeno por checkbox. | Pendiente de revisión. |

## Fase 6 — Endurecimiento

[Paquetes y pruebas](fase-06.md). Gate: **validado técnicamente**. Evidencia: [cierre-fase-06.md](cierre-fase-06.md).

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T6-1 | validada | Implementación y pruebas en [cierre-fase-06.md](cierre-fase-06.md): 12 ops en tx, `checkoutRetail` owner snapshot en tx, concurrencia/rollback verdes. | Pendiente revisión humana. |
| [ ] | T6-2 | validada | Implementación y pruebas en [cierre-fase-06.md](cierre-fase-06.md): `{voted}` idempotente, no-op 200, `Lanzada` 409, `decode` campos desconocidos. | Pendiente revisión humana. |
| [ ] | T6-3 | validada | Implementación y pruebas en [cierre-fase-06.md](cierre-fase-06.md): Admin enrolado requiere challenge 2FA; reset no salta el control; migración 013 aditiva. | Pendiente revisión humana; TOTP/cámaras reales fuera de alcance. |
| [ ] | T6-4 | validada | Implementación y pruebas en [cierre-fase-06.md](cierre-fase-06.md): gate `isolation_test.go` con dos clínicas, roles, listas/detalle, búsqueda, tareas y analítica. | Pendiente revisión humana. |
| [ ] | T6-5 | validada | Suite `go test ./... -count=1` verde contra DB real `vetdata-tests`; sin defectos abiertos críticos del alcance. | Pendiente revisión humana. |

## Fase 7 — Chile y producción

[Paquetes y pruebas](fase-07.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T7-1 | pendiente | Sin evidencia funcional registrada. Exigir: Certificación/sandbox aprobados; reintento y callback duplicado no emiten dos documentos. | Pendiente de revisión. |
| [ ] | T7-2 | pendiente | Sin evidencia funcional registrada. Exigir: Exportación aislada; anonimización preserva registros que deban retenerse; validación de responsables antes de ejecutar. | Pendiente de revisión. |
| [ ] | T7-3 | pendiente | Sin evidencia funcional registrada. Exigir: Dry-run con conteos verificables; sin borrado automático para categorías sin política aprobada. | Pendiente de revisión. |
| [ ] | T7-4 | pendiente | Sin evidencia funcional registrada. Exigir: Restauración en entorno limpio, reinicio y rollback de app demostrados; smoke test HTTPS y responsables operativos. | Pendiente de revisión. |

## Fase 8 — Integraciones posteriores al MVP

[Paquetes y pruebas](fase-08.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T8-1 | pendiente | Sin evidencia funcional registrada. Exigir: Callbacks duplicados/fallidos y reintentos; plantilla/remitente autorizado y entrega verificada. | Pendiente de revisión. |
| [ ] | T8-2 | pendiente | Sin evidencia funcional registrada. Exigir: No marcar pagado por respuesta del navegador; callbacks autenticados; doble notificación no duplica abono. | Pendiente de revisión. |
| [ ] | T8-3 | pendiente | Sin evidencia funcional registrada. Exigir: Archivo falso, infectado o excesivo rechazado; acceso revocado impide nuevas descargas. | Pendiente de revisión. |
| [ ] | T8-4 | pendiente | Sin evidencia funcional registrada. Exigir: Enlace vencido, origen directo inaccesible, box privado y permiso insuficiente; dispositivos reales verificados. | Pendiente de revisión. |
| [ ] | T8-5 | pendiente | Sin evidencia funcional registrada. Exigir: Firma y vigencia verificables; no habilitar sin validación externa necesaria. | Pendiente de revisión. |
| [ ] | T8-6 | pendiente | Sin evidencia funcional registrada. Exigir: Diagnósticos previos conservados; selección de lotes por vencimiento y cantidades reconciliadas; recepción parcial existente no se reimplementa; precios por convenio resueltos en servidor. | Pendiente de revisión. |

## Defectos y bloqueos

| ID | Hallazgo / dependencia | Paquete | Estado de seguimiento |
|---|---|---|---|
| R-01 | Migración y registro se confirman por separado; errores de consulta ignorados | T1-1 | Pendiente de corrección y prueba |
| R-02 | Seeds de permisos no son repetibles; fixtures no cubren grupos distintos | T1-1 / T1-3 | Pendiente |
| R-03 | Código y mocks conservan aprobación por clínica y permisos antiguos | T2-1 a T2-6 / T5-1 / T5-6 | Contrato documental actualizado; implementación pendiente |
| R-04 | Caché Go, motor Docker y socket local denegados durante revisión previa | T1-9 | Repetir validación desde entorno autorizado; no inferir fallo de aplicación |
| R-05 | api:4000 configurado como URL pública del frontend | T5-1 | Corregir/configurar antes de habilitar HTTP |
| D-01 a D-13 | Decisiones y dependencias externas | Según índice | Resolver al llegar a su paquete |

## Acta de cierre de fase

Copiar al validar cada fase:

- Fase y tareas:
- Fecha y revisión de código:
- Ambiente y versiones:
- Evidencias de pruebas:
- Migraciones y compatibilidad comprobadas:
- Defectos abiertos y efecto:
- Dependencias externas resueltas:
- Revisor y resultado:
- Casillas sincronizadas con TAREAS:
