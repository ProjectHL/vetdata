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

## Fase 1 — Fundaciones técnicas

[Paquetes y pruebas](fase-01.md). Gate: **en curso**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T1-1 | en curso | Base Go/migraciones/seeds observada; faltan pacientes completos y pruebas de repetición. Exigir: Instalación limpia, actualización desde 001/002, dos arranques concurrentes y reaplicación de seeds sin duplicados. | Pendiente de revisión. |
| [ ] | T1-2 | pendiente | Sin evidencia funcional registrada. Exigir: Sesión expirada/revocada rechazada; refresh reutilizado invalida su familia; recovery de un uso probado. | Pendiente de revisión. |
| [ ] | T1-3 | en curso | Tablas iniciales observadas; falta sesión y aislamiento probado. Exigir: Un usuario en dos clínicas conserva roles separados; parámetros falsificados no cambian tenant. | Pendiente de revisión. |
| [ ] | T1-4 | pendiente | Sin evidencia funcional registrada. Exigir: Pruebas de contrato para respuestas, validaciones y recursos ajenos. | Pendiente de revisión. |
| [ ] | T1-5 | pendiente | Sin evidencia funcional registrada. Exigir: Entradas equivalentes se normalizan igual; DV incorrecto devuelve 400; duplicado devuelve 409. | Pendiente de revisión. |
| [ ] | T1-6 | pendiente | Sin evidencia funcional registrada. Exigir: Casos de redondeo y totales manipulados; resultados calculados por servidor. | Pendiente de revisión. |
| [ ] | T1-7 | pendiente | Sin evidencia funcional registrada. Exigir: Cruces de medianoche y horario de verano; fechas civiles no cambian por UTC. | Pendiente de revisión. |
| [ ] | T1-8 | pendiente | Sin evidencia funcional registrada. Exigir: Reintento devuelve resultado original; misma clave con contenido distinto devuelve 409; concurrencia sin duplicados. | Pendiente de revisión. |
| [ ] | T1-9 | en curso | Compose/logs/salud observados; CI y suite no acreditados. Exigir: Pipeline reproducible; caída de DB responde salud no disponible sin espera ilimitada. | Pendiente de revisión. |
| [ ] | T1-10 | pendiente | Sin evidencia funcional registrada. Exigir: Slots consistentes; rechazo de horas fuera de disponibilidad; excepción de urgencia explícita. | Pendiente de revisión. |

## Fase 2 — Identidad y acceso entre clínicas

[Paquetes y pruebas](fase-02.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T2-1 | pendiente | Sin evidencia funcional registrada. Exigir: Intentos concurrentes de retirar el último administrador rechazados; invitaciones de un uso. | Pendiente de revisión. |
| [ ] | T2-2 | pendiente | Sin evidencia funcional registrada. Exigir: Ningún camino de lectura expone clínico ajeno sin acceso; se conservan documentos propios. | Pendiente de revisión. |
| [ ] | T2-3 | pendiente | Sin evidencia funcional registrada. Exigir: Resumen excluye consultas, exámenes y recetas incluso en respuestas JSON; búsqueda no enumera contactos. | Pendiente de revisión. |
| [ ] | T2-4 | pendiente | Sin evidencia funcional registrada. Exigir: Doble respuesta concurrente crea un solo grant; token vencido/reutilizado falla; renovación no amplía acceso por sí sola. | Pendiente de revisión. |
| [ ] | T2-5 | pendiente | Sin evidencia funcional registrada. Exigir: Checkbox de clínica no autoriza; revocación corta lecturas y no borra evidencia. | Pendiente de revisión. |
| [ ] | T2-6 | pendiente | Sin evidencia funcional registrada. Exigir: Vet o Admin de otra clínica recibe 403; restablecer no revive consentimiento revocado ni vigencia vencida. | Pendiente de revisión. |
| [ ] | T2-7 | pendiente | Sin evidencia funcional registrada. Exigir: Auditoría persiste antes de entregar datos; evidencia aislada y sin token/RUT en logs generales. | Pendiente de revisión. |
| [ ] | T2-8 | pendiente | Sin evidencia funcional registrada. Exigir: Fuentes disponibles producen tareas reales; permisos filtran bandeja; fuentes futuras se incorporan en fases 3/4. | Pendiente de revisión. |
| [ ] | T2-9 | pendiente | Sin evidencia funcional registrada. Exigir: 409 con citas afectadas; reasignación/cancelación explícita previa a desactivar. | Pendiente de revisión. |
| [ ] | T2-10 | pendiente | Sin evidencia funcional registrada. Exigir: Prueba de extremo a extremo por API, con solicitudes, auditoría y pérdida inmediata de acceso. | Pendiente de revisión. |

## Fase 3 — Operación clínica

[Paquetes y pruebas](fase-03.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T3-1 | pendiente | Sin evidencia funcional registrada. Exigir: Dos reservas simultáneas no ocupan el mismo recurso; finalizar libera paciente/profesional y deja box en limpieza. | Pendiente de revisión. |
| [ ] | T3-2 | pendiente | Sin evidencia funcional registrada. Exigir: Corrección conserva original y autor; clínicas con acceso no sobrescriben registros ajenos. | Pendiente de revisión. |
| [ ] | T3-3 | pendiente | Sin evidencia funcional registrada. Exigir: Factura y stock se confirman juntos; reintento no duplica folio/movimiento; sin stock devuelve 409. | Pendiente de revisión. |
| [ ] | T3-4 | pendiente | Sin evidencia funcional registrada. Exigir: Precio/totales manipulados se ignoran o rechazan; descuento inválido falla. | Pendiente de revisión. |
| [ ] | T3-5 | pendiente | Sin evidencia funcional registrada. Exigir: Recepciones acumulan cantidades sin sobrepasar pedido; fallo revierte stock, movimiento y recepción. | Pendiente de revisión. |
| [ ] | T3-6 | pendiente | Sin evidencia funcional registrada. Exigir: Abonos parciales y concurrentes consistentes; no duplicar ni mezclar saldo de otras clínicas. | Pendiente de revisión. |
| [ ] | T3-7 | pendiente | Sin evidencia funcional registrada. Exigir: Reintento no duplica recordatorio; cancelación y opt-out suprimen envíos correspondientes. | Pendiente de revisión. |
| [ ] | T3-8 | pendiente | Sin evidencia funcional registrada. Exigir: Un adjunto no amplía acceso al recurso padre; almacenamiento real permanece diferido. | Pendiente de revisión. |
| [ ] | T3-9 | pendiente | Sin evidencia funcional registrada. Exigir: Escenario completo por API con evidencia SQL de atomicidad. | Pendiente de revisión. |

## Fase 4 — Tienda, seguridad, soporte y analítica

[Paquetes y pruebas](fase-04.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T4-1 | pendiente | Sin evidencia funcional registrada. Exigir: Venta concurrente no produce stock negativo; checkout crea venta/movimientos/despacho juntos. | Pendiente de revisión. |
| [ ] | T4-2 | pendiente | Sin evidencia funcional registrada. Exigir: No se edita/reabre evento cerrado; caso nuevo vinculado; auditoría no depende de un POST del navegador. | Pendiente de revisión. |
| [ ] | T4-3 | pendiente | Sin evidencia funcional registrada. Exigir: Clínica no se hace pasar por Staff; idea y ticket se crean juntos; transiciones autorizadas. | Pendiente de revisión. |
| [ ] | T4-4 | pendiente | Sin evidencia funcional registrada. Exigir: Cortes menores a cinco no se publican; respuestas no llevan fichas/contactos ajenos; exclusión comprobable. | Pendiente de revisión. |
| [ ] | T4-5 | pendiente | Sin evidencia funcional registrada. Exigir: Acta de evaluación; si se difiere, no incluirlo como funcionalidad faltante del MVP. | Pendiente de revisión. |
| [ ] | T4-6 | pendiente | Sin evidencia funcional registrada. Exigir: Matriz de rutas, roles, errores y pruebas por dominio completada. | Pendiente de revisión. |

## Fase 5 — Integración frontend

[Paquetes y pruebas](fase-05.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T5-1 | pendiente | Sin evidencia funcional registrada. Exigir: Inventario completo de operaciones implementadas/sustituidas; sin NotImplementedError en rutas habilitadas. | Pendiente de revisión. |
| [ ] | T5-2 | pendiente | Sin evidencia funcional registrada. Exigir: Recarga conserva estado; cambio de clínica limpia datos/caché del tenant anterior. | Pendiente de revisión. |
| [ ] | T5-3 | pendiente | Sin evidencia funcional registrada. Exigir: Pantallas, búsqueda, tareas y analítica no muestran datos de mocks en modo HTTP. | Pendiente de revisión. |
| [ ] | T5-4 | pendiente | Sin evidencia funcional registrada. Exigir: No navegar a ticket con id temporal; errores revierten estado optimista o recargan recurso. | Pendiente de revisión. |
| [ ] | T5-5 | pendiente | Sin evidencia funcional registrada. Exigir: Navegación y roles sobreviven recarga; fechas civiles y hora local correctas. | Pendiente de revisión. |
| [ ] | T5-6 | pendiente | Sin evidencia funcional registrada. Exigir: E2E en navegador; recarga conserva datos; no existe aprobación por clínica ni consentimiento ajeno por checkbox. | Pendiente de revisión. |

## Fase 6 — Endurecimiento

[Paquetes y pruebas](fase-06.md). Gate: **pendiente**.

| Aceptada | Tarea | Estado | Evidencia actual / exigida | Revisión y observaciones |
|---|---|---|---|---|
| [ ] | T6-1 | pendiente | Sin evidencia funcional registrada. Exigir: Fallo inyectado en cada efecto deja rollback completo; pruebas concurrentes aprobadas. | Pendiente de revisión. |
| [ ] | T6-2 | pendiente | Sin evidencia funcional registrada. Exigir: Campos actor/tenant/totales no controlables; no-op no se presenta como éxito. | Pendiente de revisión. |
| [ ] | T6-3 | pendiente | Sin evidencia funcional registrada. Exigir: Sin segundo factor no se accede; recuperación no permite saltar el control ni dejar al último Admin bloqueado. | Pendiente de revisión. |
| [ ] | T6-4 | pendiente | Sin evidencia funcional registrada. Exigir: Dos tenants/grupos y todos los roles; pruebas sobre listas, detalle, búsqueda, tareas y analítica. | Pendiente de revisión. |
| [ ] | T6-5 | pendiente | Sin evidencia funcional registrada. Exigir: Suite verde; cero defectos abiertos de filtración, doble operación, stock negativo o escalamiento. | Pendiente de revisión. |

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
